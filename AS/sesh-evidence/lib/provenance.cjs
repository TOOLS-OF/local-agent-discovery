const path = require('node:path');
const { walkTape } = require('./tape.cjs');
const { digest } = require('./tape.cjs');
const { staticWrapperCalls } = require('./static-wrapper.cjs');

function resolveReference(value, cwd, mappings = []) {
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) return { lexicalPath:value, resolvedPath:null, reason:'invalid-or-nonliteral-path' };
  const cwdWindows=/^[A-Za-z]:[\\/]|^\\\\/.test(cwd||'');
  const declaredPosix=value.startsWith('/')&&mappings.some(m=>m.from.startsWith('/')&&(value===m.from||value.startsWith(m.from.replace(/\/$/,'')+'/')));
  if(value.startsWith('/')&&cwdWindows&&!declaredPosix)return {lexicalPath:value,baseCwd:cwd,resolvedPath:null,reason:'rooted-POSIX-or-Windows-reference-needs-explicit-namespace-mapping'};
  const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(value) || (cwdWindows&&!declaredPosix);
  const p = windows ? path.win32 : path.posix;
  if (/[*$%]|\$\{|^~/.test(value) || (!p.isAbsolute(value) && !cwd)) return { lexicalPath:value, resolvedPath:null, reason:'unresolved-expansion-or-base' };
  const logicalPath = p.isAbsolute(value) ? p.normalize(value) : p.resolve(cwd, value);
  const normalized = logicalPath.replace(/^\\\\\?\\/, '').replace(/\\/g,'/');
  let mappedPath = logicalPath;
  for (const map of [...mappings].sort((a,b)=>b.from.length-a.from.length)) {
    const from = map.from.replace(/\\/g,'/').replace(/\/$/,'');
    const a = windows ? normalized.toLowerCase() : normalized, b = windows ? from.toLowerCase() : from;
    if (a === b || a.startsWith(b+'/')) { mappedPath = map.to.replace(/[\\/]$/,'') + normalized.slice(from.length); break; }
  }
  return {lexicalPath:value, baseCwd:cwd || null, logicalPath, resolvedPath:mappedPath, resolution:'lexical mapping only; filesystem identity not established'};
}
function parseArguments(value) { if (typeof value === 'object' && value) return value; try { return JSON.parse(value); } catch { return null; } }
function effects(name, args, cwd) {
  const n = name.split('.').pop().toLowerCase();
  const file = args?.file_path || args?.path || args?.filename;
  if (['read','readfile','read_file'].includes(n) && file) return [{path:file, action:'read', explicit:true}];
  if (['edit','multiedit'].includes(n) && file) return [{path:file, action:'edit', explicit:true}];
  if (['write','writefile'].includes(n) && file) return [{path:file, action:'write', explicit:true}];
  if (['glob','grep'].includes(n)) return [{path:args?.path || cwd, action:'scan', explicit:true}].filter(e=>e.path);
  if (/apply_patch$/i.test(name)) {
    const text = typeof args === 'string' ? args : args?.patch || args?.input || '';
    return [...text.matchAll(/^\*\*\* (Add|Update|Delete) File: (.+)\r?$/gm)].map(m=>({path:m[2].trim(), action:{Add:'create',Update:'edit',Delete:'delete'}[m[1]],explicit:true}));
  }
  if (['agent','task','spawn_agent'].includes(n) || /spawn_agent$/.test(name)) return [{action:'spawn-request',name:args?.name || args?.task_name || null,role:args?.subagent_type || null}];
  const cmd = args?.cmd || args?.command;
  if (typeof cmd === 'string') {
    const result = [];
    // These are intentionally inferences, never proven shell effects. No command is executed.
    for (const m of cmd.matchAll(/(?:Get-Content|cat|type)\s+(?:(?:-LiteralPath|-Path)\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/gi)) {const p=m[1]||m[2]||m[3];if(!/^[<>-]/.test(p))result.push({path:p,action:'read',explicit:false});}
    for(const m of cmd.matchAll(/(?:Set-Content|Add-Content|Out-File)\s+(?:(?:-LiteralPath|-Path|-FilePath)\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/gi)){const p=m[1]||m[2]||m[3];if(!p.startsWith('-'))result.push({path:p,action:'write',explicit:false});}
    for(const m of cmd.matchAll(/(?:^|\s)(?:>>|>)\s*(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/g)){const p=m[1]||m[2]||m[3];if(!p.startsWith('&'))result.push({path:p,action:'write',explicit:false});}
    for (const m of cmd.matchAll(/[A-Za-z]:[\\/][^\r\n"'<>|;]+/g)) result.push({path:m[0].trim(),action:'mention',explicit:false});
    for(const m of cmd.matchAll(/(?<![A-Za-z0-9:/])\/(?:mnt\/[a-z]|home|tmp|var|opt|usr|workspace|workspaces|root|etc)\/[^\s"'<>|;)]+/g))result.push({path:m[0],action:'mention',explicit:false});
    return result;
  }
  return [];
}
function resultOutcome(record, codex) {
  if (!codex) return record.is_error ? 'failed' : 'succeeded';
  let output = record.output;
  try { if (typeof output === 'string') output = JSON.parse(output); } catch {}
  if (output && typeof output === 'object') {
    if (output.error || output.isError || output.exit_code > 0 || output.exitCode > 0) return 'failed';
    if (output.exit_code === 0 || output.exitCode === 0) return 'succeeded';
  }
  if (typeof record.output === 'string') {
    const code = record.output.match(/(?:Process exited with code|Exit code:)\s*(-?\d+)/i);
    if (code) return Number(code[1]) === 0 ? 'succeeded' : 'failed';
    if (/^Success\./.test(record.output)) return 'succeeded';
  }
  return 'unknown';
}
async function scanProvenance(file, options = {}) {
  const state = structuredClone(options.cursor?.state || {cwd:null,sessionId:null,pending:{},chamber:0});
  const events = [], gaps = [], counts = {};
  function startTurn(id,basis,record,location) {
    const key=JSON.stringify([state.sessionId,state.localAgentId||null,id]);
    if(state.activeTurn?.key===key)return;
    state.turnOrdinal=(state.turnOrdinal||0)+1;
    state.activeTurn={key,id,basis,ordinal:state.turnOrdinal,sessionId:state.sessionId,localAgentId:state.localAgentId||null,startSource:location};
    events.push({eventKind:'turn-boundary',phase:'start',turn:{...state.activeTurn},chamber:state.chamber,source:location,timestamp:record.timestamp||null});
  }
  const mappings = options.mappings || [];
  const harness = options.harness;
  if (!['codex','claude-code'].includes(harness)) throw new Error('Supported provenance adapters: codex, claude-code');
  const mappingFingerprint=digest(Buffer.from(JSON.stringify({mappings,sourceStoreId:options.sourceStoreId||null})));
  if(options.cursor && (options.cursor.harness!==harness||options.cursor.mappingFingerprint!==mappingFingerprint))throw new Error('Cursor adapter, source store or path mappings changed');
  state.pending=Object.assign(Object.create(null),state.pending);
  function emit(call, outcome, resultLocation) {
    if(events.length+call.effects.length>200000)throw new Error('Normalized event output budget exceeded; use a smaller page');
    for (let index=0;index<call.effects.length;index++) {
      const e = call.effects[index];
      events.push({eventKind:e.action === 'spawn-request'?'spawn-request':'file-access', observationId:`${call.location.offset}:${call.id}:${index}`, sessionId:call.sessionId,
        localAgentId:call.localAgentId||null,sourceStoreId:options.sourceStoreId||null,
        harness, tool:call.name, callId:call.id, action:e.action, outcome,
        evidence:e.wrapper?'static-wrapper-reference':e.explicit ? (outcome==='succeeded'?'explicit-tool-success':'explicit-tool-request') : 'inferred-shell',
        ...(e.wrapper?{nestedTool:e.nestedTool,executionVerified:false}:{}),
        ...('path' in e ? resolveReference(e.path,e.baseCwd||call.cwd,mappings) : {requestedName:e.name,requestedRole:e.role,nativeRelationshipVerified:false}),
        timestamp:call.timestamp, chamber:call.chamber, turn:call.turn||null, source:call.location, resultSource:resultLocation || null});
    }
  }
  function call(name,args,id,record,location) {
    name=String(name);id=String(id);
    const fingerprint=digest(Buffer.from(JSON.stringify({name,args,cwd:state.cwd,sessionId:state.sessionId,localAgentId:state.localAgentId||null})));
    if(Object.hasOwn(state.pending,id)&&state.pending[id].fingerprint===fingerprint){gaps.push({kind:'duplicate-identical-tool-request',callId:id,previousSource:state.pending[id].location,...location});return;}
    counts[name] = (counts[name]||0)+1;
    const cwd = args?.workdir || args?.cwd || state.cwd;
    if(typeof (args?.cmd||args?.command)==='string')gaps.push({kind:'shell-effects-not-exhaustive',tool:name,...location});
    let extracted = effects(name,args,cwd);
    if(name==='functions.exec'||name==='exec'){
      const code=typeof args==='string'?args:args?.code;
      if(typeof code==='string'){
        let parsed;try{parsed=staticWrapperCalls(code);}catch(e){parsed={calls:[],gaps:['wrapper-static-analysis-budget-or-error: '+e.message]};}
        extracted=parsed.calls.flatMap(c=>effects(c.name,c.args,c.args?.workdir||c.args?.cwd||cwd).map(e=>({...e,wrapper:true,nestedTool:c.name,baseCwd:c.args?.workdir||c.args?.cwd||cwd})));
        gaps.push({kind:'wrapper-execution-not-verified',details:parsed.gaps,...location});
      }
    }
    if(extracted.length>1000)throw new Error('Per-call reference budget exceeded');
    if (!extracted.length) gaps.push({kind:'unsupported-or-opaque-tool',tool:name,...location});
    if (Object.keys(state.pending).length >= 1000) throw new Error('Pending-call state budget exceeded; reduce page or add a parser adapter');
    const item={id,name,effects:extracted,cwd,sessionId:state.sessionId,localAgentId:state.localAgentId||null,timestamp:record.timestamp||null,chamber:state.chamber,turn:state.activeTurn?{...state.activeTurn}:null,location,fingerprint};
    emit(item,'requested');
    if(Object.hasOwn(state.pending,id)){const old=state.pending[id],alternatives=old.ambiguousAlternatives||[old];if(alternatives.length>=10)throw new Error('Ambiguous duplicate call budget exceeded');alternatives.push(item);state.pending[id]={...item,ambiguousAlternatives:alternatives};gaps.push({kind:'ambiguous-duplicate-tool-request',callId:id,...location});}
    else state.pending[id]=item;
  }
  function result(id, value, location, codex) {
    if (!Object.hasOwn(state.pending,id)) { gaps.push({kind:'result-without-request',callId:id,...location}); return; }
    if(state.pending[id].ambiguousAlternatives){for(const item of state.pending[id].ambiguousAlternatives)emit(item,'unknown',location);gaps.push({kind:'ambiguous-result-correlation',callId:id,...location});delete state.pending[id];return;}
    const outcome=resultOutcome(value,codex);
    if(outcome==='unknown')gaps.push({kind:'unknown-tool-result-outcome',callId:id,...location});
    emit(state.pending[id],outcome,location); delete state.pending[id];
  }
  const coverage = await walkTape(file, {budgets:options.budgets,cursor:options.cursor}, async (record,location)=> {
    if (harness==='codex') {
      const p=record.payload||{};
      if (record.type==='session_meta') {
        if((p.id||p.session_id)&&state.sessionId!==(p.id||p.session_id))state.activeTurn=null;
        state.sessionId=p.id||p.session_id||state.sessionId; state.cwd=p.cwd||state.cwd;
        const text=typeof p.base_instructions==='string'?p.base_instructions:p.base_instructions?.text;
        if(typeof text==='string')events.push({eventKind:'recorded-policy-snapshot',sessionId:state.sessionId,source:location,kind:'session-base-instructions',sha256:digest(Buffer.from(text)),bytes:Buffer.byteLength(text),contentIncluded:false});
      }
      if (record.type==='turn_context') state.cwd=p.cwd||state.cwd;
      if ((record.type==='turn_context'||(record.type==='event_msg'&&p.type==='task_started'))&&p.turn_id)startTurn(p.turn_id,'native-turn-id',record,location);
      if(record.type==='event_msg'&&['task_complete','turn_aborted'].includes(p.type)){
        if(state.activeTurn&&(!p.turn_id||p.turn_id===state.activeTurn.id)){
          events.push({eventKind:'turn-boundary',phase:p.type==='task_complete'?'completed':'aborted',turn:{...state.activeTurn},chamber:state.chamber,source:location});state.activeTurn=null;
        }else gaps.push({kind:'turn-end-without-matching-start',...location});
      }
      if (record.type==='compacted') { state.chamber++; events.push({eventKind:'context-boundary',sessionId:state.sessionId,chamber:state.chamber,source:location,opaqueCheckpoint:!!p.replacement_history?.some(x=>x.type==='compaction')}); }
      if (record.type==='response_item') {
        if (['function_call','custom_tool_call'].includes(p.type)) {
          const args=p.type==='custom_tool_call'?p.input:parseArguments(p.arguments);
          call(p.name||'unknown',args,p.call_id||`offset-${location.offset}`,record,location);
        }
        if (['function_call_output','custom_tool_call_output'].includes(p.type)) result(p.call_id,p,location,true);
      }
    } else {
      if((record.sessionId&&record.sessionId!==state.sessionId)||(record.agentId&&record.agentId!==state.localAgentId))state.activeTurn=null;
      state.sessionId=record.sessionId||state.sessionId; state.cwd=record.cwd||state.cwd;if(record.agentId)state.localAgentId=record.agentId;
      if (record.type==='system' && record.subtype==='compact_boundary') { state.chamber++; events.push({eventKind:'context-boundary',sessionId:state.sessionId,chamber:state.chamber,source:location}); }
      const content=record.message?.content;
      // Claude tool-result envelopes and compaction carry-forward text are not user turns.
      const prompt=typeof content==='string'?content:Array.isArray(content)&&content.some(b=>b.type==='text'&&typeof b.text==='string');
      const carryForward=record.isMeta||record.isCompactSummary||(typeof content==='string'&&/^This session is being continued from a previous conversation/.test(content));
      if(record.type==='user'&&prompt&&!carryForward&&!(Array.isArray(content)&&content.some(b=>b.type==='tool_result')))startTurn(record.uuid||`offset-${location.offset}`,'inferred-user-prompt',record,location);
      if (Array.isArray(content)) for (const block of content) {
        if (block.type==='tool_use') call(block.name,block.input,block.id,record,location);
        if (block.type==='tool_result') {
          const pending=state.pending[block.tool_use_id],nativeId=record.tool_use_result?.agentId;
          if(pending?.effects?.some(e=>e.action==='spawn-request')&&typeof nativeId==='string')events.push({eventKind:'spawn-result',parentSessionId:pending.sessionId,parentLocalAgentId:pending.localAgentId||null,childLocalAgentId:nativeId,callId:block.tool_use_id,source:location,nativeRelationshipVerified:false,evidence:'recorded-tool-result-agent-id'});
          result(block.tool_use_id,block,location,false);
        }
      }
    }
  });
  return {schema:'sesh-provenance-page/v1',turnIndexVersion:1,harness,events,toolCounts:counts,gaps:[...coverage.gaps,...gaps],coverage,
    cursor:coverage.cursor?{...coverage.cursor,state,harness,mappingFingerprint}:null,unresolvedCalls:Object.keys(state.pending).length,
    scope:'Recorded operations only; shell effects inferred; literal nested JS references statically extracted but execution unverified; dynamic expressions and indirect accesses unobserved. Create-or-overwrite stays write.'};
}
module.exports = { scanProvenance, resolveReference, effects, resultOutcome };
