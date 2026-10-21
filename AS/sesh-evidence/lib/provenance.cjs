const path = require('node:path');
const { walkTape } = require('./tape.cjs');
const { digest } = require('./tape.cjs');
const { staticWrapperCalls } = require('./static-wrapper.cjs');

function resolveReference(value, cwd, mappings = []) {
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) return { lexicalPath:value, resolvedPath:null, reason:'invalid-or-nonliteral-path' };
  const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(value) || /^[A-Za-z]:[\\/]|^\\\\/.test(cwd || '');
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
    for (const m of cmd.matchAll(/(?:Get-Content|cat|type)\s+(?:(?:-LiteralPath|-Path)\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/gi)) result.push({path:m[1]||m[2]||m[3],action:'read',explicit:false});
    for (const m of cmd.matchAll(/[A-Za-z]:[\\/][^\r\n"'<>|;]+/g)) result.push({path:m[0].trim(),action:'mention',explicit:false});
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
  const mappings = options.mappings || [];
  const harness = options.harness;
  if (!['codex','claude-code'].includes(harness)) throw new Error('Supported provenance adapters: codex, claude-code');
  const mappingFingerprint=digest(Buffer.from(JSON.stringify(mappings)));
  if(options.cursor && (options.cursor.harness!==harness||options.cursor.mappingFingerprint!==mappingFingerprint))throw new Error('Cursor adapter or path mappings changed');
  state.pending=Object.assign(Object.create(null),state.pending);
  function emit(call, outcome, resultLocation) {
    if(events.length+call.effects.length>200000)throw new Error('Normalized event output budget exceeded; use a smaller page');
    for (let index=0;index<call.effects.length;index++) {
      const e = call.effects[index];
      events.push({eventKind:e.action === 'spawn-request'?'spawn-request':'file-access', observationId:`${call.location.offset}:${call.id}:${index}`, sessionId:call.sessionId,
        harness, tool:call.name, callId:call.id, action:e.action, outcome,
        evidence:e.wrapper?'static-wrapper-reference':e.explicit ? (outcome==='succeeded'?'explicit-tool-success':'explicit-tool-request') : 'inferred-shell',
        ...(e.wrapper?{nestedTool:e.nestedTool,executionVerified:false}:{}),
        ...('path' in e ? resolveReference(e.path,e.baseCwd||call.cwd,mappings) : {requestedName:e.name,requestedRole:e.role,nativeRelationshipVerified:false}),
        timestamp:call.timestamp, chamber:call.chamber, source:call.location, resultSource:resultLocation || null});
    }
  }
  function call(name,args,id,record,location) {
    name=String(name);id=String(id);
    if(Object.hasOwn(state.pending,id))throw new Error('Duplicate unresolved call ID');
    counts[name] = (counts[name]||0)+1;
    const cwd = args?.workdir || args?.cwd || state.cwd;
    if(typeof (args?.cmd||args?.command)==='string')gaps.push({kind:'shell-effects-not-exhaustive',tool:name,...location});
    let extracted = effects(name,args,cwd);
    if(name==='functions.exec'||name==='exec'){
      const code=typeof args==='string'?args:args?.code;
      if(typeof code==='string'){
        const parsed=staticWrapperCalls(code);
        extracted=parsed.calls.flatMap(c=>effects(c.name,c.args,c.args?.workdir||c.args?.cwd||cwd).map(e=>({...e,wrapper:true,nestedTool:c.name,baseCwd:c.args?.workdir||c.args?.cwd||cwd})));
        gaps.push({kind:'wrapper-execution-not-verified',details:parsed.gaps,...location});
      }
    }
    if(extracted.length>1000)throw new Error('Per-call reference budget exceeded');
    if (!extracted.length) gaps.push({kind:'unsupported-or-opaque-tool',tool:name,...location});
    if (Object.keys(state.pending).length >= 1000) throw new Error('Pending-call state budget exceeded; reduce page or add a parser adapter');
    const item={id,name,effects:extracted,cwd,sessionId:state.sessionId,timestamp:record.timestamp||null,chamber:state.chamber,location};
    emit(item,'requested');
    state.pending[id]=item;
  }
  function result(id, value, location, codex) {
    if (!Object.hasOwn(state.pending,id)) { gaps.push({kind:'result-without-request',callId:id,...location}); return; }
    const outcome=resultOutcome(value,codex);
    if(outcome==='unknown')gaps.push({kind:'unknown-tool-result-outcome',callId:id,...location});
    emit(state.pending[id],outcome,location); delete state.pending[id];
  }
  const coverage = await walkTape(file, {budgets:options.budgets,cursor:options.cursor}, async (record,location)=> {
    if (harness==='codex') {
      const p=record.payload||{};
      if (record.type==='session_meta') {
        state.sessionId=p.id||p.session_id||state.sessionId; state.cwd=p.cwd||state.cwd;
        const text=typeof p.base_instructions==='string'?p.base_instructions:p.base_instructions?.text;
        if(typeof text==='string')events.push({eventKind:'recorded-policy-snapshot',sessionId:state.sessionId,source:location,kind:'session-base-instructions',sha256:digest(Buffer.from(text)),bytes:Buffer.byteLength(text),contentIncluded:false});
      }
      if (record.type==='turn_context') state.cwd=p.cwd||state.cwd;
      if (record.type==='compacted') { state.chamber++; events.push({eventKind:'context-boundary',sessionId:state.sessionId,chamber:state.chamber,source:location,opaqueCheckpoint:!!p.replacement_history?.some(x=>x.type==='compaction')}); }
      if (record.type==='response_item') {
        if (['function_call','custom_tool_call'].includes(p.type)) {
          const args=p.type==='custom_tool_call'?p.input:parseArguments(p.arguments);
          call(p.name||'unknown',args,p.call_id||`offset-${location.offset}`,record,location);
        }
        if (['function_call_output','custom_tool_call_output'].includes(p.type)) result(p.call_id,p,location,true);
      }
    } else {
      state.sessionId=record.sessionId||state.sessionId; state.cwd=record.cwd||state.cwd;
      if (record.type==='system' && record.subtype==='compact_boundary') { state.chamber++; events.push({eventKind:'context-boundary',sessionId:state.sessionId,chamber:state.chamber,source:location}); }
      const content=record.message?.content;
      if (Array.isArray(content)) for (const block of content) {
        if (block.type==='tool_use') call(block.name,block.input,block.id,record,location);
        if (block.type==='tool_result') result(block.tool_use_id,block,location,false);
      }
    }
  });
  return {schema:'sesh-provenance-page/v1',harness,events,toolCounts:counts,gaps:[...coverage.gaps,...gaps],coverage,
    cursor:coverage.cursor?{...coverage.cursor,state,harness,mappingFingerprint}:null,unresolvedCalls:Object.keys(state.pending).length,
    scope:'Recorded operations only; shell effects inferred; literal nested JS references statically extracted but execution unverified; dynamic expressions and indirect accesses unobserved. Create-or-overwrite stays write.'};
}
module.exports = { scanProvenance, resolveReference, effects, resultOutcome };
