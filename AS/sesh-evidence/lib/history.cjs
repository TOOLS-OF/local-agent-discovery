const fs=require('node:fs').promises;
const crypto=require('node:crypto');
const path=require('node:path');
const {walkTape,checkpoint,positive}=require('./tape.cjs');
const {assessCoverage}=require('./selection.cjs');
async function inspectHistory(file,options={}){
  const harness=options.harness||'codex';
  if(!['codex','claude-code'].includes(harness))throw new Error('Unknown history adapter');
  const metadata=[],boundaries=[],contexts=[],calls=[],results=[],parents=[],taskEvents=[];
  let lastTaskEvent=null,firstTimestamp=null,lastTimestamp=null;
  const coverage=await walkTape(file,options,async(r,source)=>{
    if(typeof r.timestamp==='string'){firstTimestamp??=r.timestamp;lastTimestamp=r.timestamp;}
    if(harness==='codex'){
      const p=r.payload||{};
      if(r.type==='session_meta')metadata.push({source,sessionId:p.id||p.session_id||null,cwd:p.cwd||null});
      if(r.type==='turn_context')contexts.push({source,model:p.model||null,cwd:p.cwd||null});
      if(r.type==='compacted')boundaries.push({source,timestamp:r.timestamp||null,native:true,readableCheckpoint:!!p.message||!!p.replacement_history?.some(x=>x.type==='message'),opaqueCheckpoint:!!p.replacement_history?.some(x=>x.type==='compaction'),hasReplacementHistory:Array.isArray(p.replacement_history)});
      if(r.type==='response_item'&&['function_call','custom_tool_call'].includes(p.type))calls.push({id:p.call_id,source});
      if(r.type==='response_item'&&['function_call_output','custom_tool_call_output'].includes(p.type))results.push({id:p.call_id,source});
      if(r.type==='event_msg'&&['task_started','task_complete','turn_aborted'].includes(p.type)){lastTaskEvent={type:p.type,source};taskEvents.push(lastTaskEvent);}
    }else{
      if(r.type==='system'&&r.subtype==='compact_boundary')boundaries.push({source,timestamp:r.timestamp||null,native:!String(r.compactMetadata?.source||'').startsWith('sesh-nautilus'),readableCheckpoint:false,opaqueCheckpoint:false});
      if(r.uuid)parents.push({uuid:r.uuid,parent:r.parentUuid||null,source,isCompactSummary:!!r.isCompactSummary,sessionId:r.sessionId||null});
      if(r.type==='assistant'&&Array.isArray(r.message?.content))for(const b of r.message.content)if(b.type==='tool_use')calls.push({id:b.id,source});
      if(Array.isArray(r.message?.content))for(const b of r.message.content)if(b.type==='tool_result')results.push({id:b.tool_use_id,source});
    }
  });
  return {schema:'sesh-history-page/v1',harness,coverage,gaps:coverage.gaps,unresolvedCalls:0,metadata,boundaries,contexts,calls,results,parents,taskEvents,lastTaskEvent,firstTimestamp,lastTimestamp,cursor:coverage.cursor};
}
function mergeRanges(ranges){const sorted=ranges.filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start),out=[];for(const r of sorted){const last=out.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else out.push({...r});}return out;}
function planHistoryProjection(pages,retainedIntervals=2,options={}){
  positive(retainedIntervals,'retainedIntervals');
  if(!pages.length)throw new Error('History pages required');
  const complete=assessCoverage(pages),harness=pages[0].harness,identity=pages[0].coverage.checkpoint;
  if(pages.some(p=>p.harness!==harness||JSON.stringify(p.coverage.checkpoint)!==JSON.stringify(identity)))throw new Error('Projection requires exactly one source checkpoint and harness');
  if(options.endPolicy&&!['source-end','last-completed-turn'].includes(options.endPolicy))throw new Error('Unknown end policy');
  const allBoundaries=pages.flatMap(p=>p.boundaries),metadata=pages.flatMap(p=>p.metadata),contexts=pages.flatMap(p=>p.contexts);
  let end=identity.size;
  if(options.endPolicy==='last-completed-turn'){
    const completed=pages.flatMap(p=>p.taskEvents||[]).filter(t=>t.type==='task_complete').at(-1);
    if(!completed)throw new Error('No recorded completed turn available for this end policy');
    end=completed.source.endOffset;
  }
  const boundaries=allBoundaries.filter(b=>b.source.offset<end);
  const entry=boundaries.length>=retainedIntervals?boundaries.at(-retainedIntervals):null,cut=entry?.source.offset||0;
  const blockers=[];
  if(!complete)blockers.push('Incomplete or malformed source coverage');
  if(harness!=='codex')blockers.push('Claude parent-chain projection adapter not implemented; boundary map is available');
  const ids=[...new Set(metadata.map(m=>m.sessionId).filter(Boolean))];
  if(harness==='codex'&&ids.length!==1)blockers.push('Native envelope identity is absent or mixed');
  const callMap=new Map(pages.flatMap(p=>p.calls).map(c=>[c.id,c]));
  const results=pages.flatMap(p=>p.results),crossing=[];
  for(const r of results)if(r.source.offset>=cut&&r.source.offset<end){const c=callMap.get(r.id);if(!c||(c.source.offset<cut))crossing.push({callId:r.id,result:r.source,request:c?.source||null});}
  if(crossing.length)blockers.push('Retained results depend on missing or excluded tool calls');
  const resultIds=new Set(results.map(r=>r.id));
  const resultIdsInRange=new Set(results.filter(r=>r.source.offset<end).map(r=>r.id));
  const pending=pages.flatMap(p=>p.calls).filter(c=>c.source.offset>=cut&&c.source.offset<end&&!resultIdsInRange.has(c.id));
  if(pending.length)blockers.push('Retained tool requests have no recorded result');
  const ranges=mergeRanges([{start:cut,end},...metadata.filter(m=>m.source.offset<cut).map(m=>({start:m.source.offset,end:m.source.endOffset})),...contexts.filter(c=>c.source.offset<cut).slice(-1).map(c=>({start:c.source.offset,end:c.source.endOffset}))]);
  const outputBytes=ranges.reduce((n,r)=>n+r.end-r.start,0);
  return {schema:'sesh-history-projection-plan/v1',harness,checkpoint:identity,totalBoundaries:boundaries.length,totalIntervals:boundaries.length+1,requestedIntervals:retainedIntervals,
    retainedIntervals:Math.min(retainedIntervals,boundaries.length+1),incomingCheckpoint:entry,interveningBoundaries:boundaries.filter(b=>b.source.offset>cut),ranges,estimatedBytes:outputBytes,sourceBytes:identity.size,endPolicy:options.endPolicy||'source-end',retainedEndOffset:end,excludedTailBytes:identity.size-end,
    candidateAllowed:blockers.length===0,structuralBlockers:blockers,crossingCalls:crossing,pendingCalls:pending,
    executionReady:false,remainingValidation:['Native checkpoint applicability and effective instruction delivery','Target harness load and continuation; no delivery authorized in this dry run'],
    scope:'A byte-range candidate recipe, not a demonstrated resumable session. Original envelope and nearest prior turn context retained; no summaries fabricated.'};
}
async function writeProjectionCandidate(file,plan,output,maxOutputBytes=128*1024*1024){
  positive(maxOutputBytes,'maxOutputBytes');
  if(!plan.candidateAllowed)throw new Error('Projection structurally blocked: '+plan.structuralBlockers.join('; '));
  if(plan.harness!=='codex')throw new Error('Only native Codex candidate output implemented');
  if(plan.estimatedBytes>maxOutputBytes)throw new Error('Candidate output byte budget exceeded');
  if(path.resolve(file)===path.resolve(output))throw new Error('Cannot project onto source');
  const before=await checkpoint(file);if(JSON.stringify(before)!==JSON.stringify(plan.checkpoint))throw new Error('Source checkpoint changed');
  let previousEnd=0,total=0;for(const r of plan.ranges){if(!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||r.start<previousEnd||r.end<=r.start||r.end>before.size)throw new Error('Invalid or overlapping projection ranges');previousEnd=r.end;total+=r.end-r.start;}
  if(total!==plan.estimatedBytes||total>maxOutputBytes)throw new Error('Projection size/range budget mismatch');
  const input=await fs.open(file,'r');let out=null,owned=false;const h=crypto.createHash('sha256');let bytes=0;
  try{
    out=await fs.open(output,'wx');owned=true;
    for(const r of plan.ranges){let position=r.start;while(position<r.end){const buffer=Buffer.alloc(Math.min(1024*1024,r.end-position));const read=await input.read(buffer,0,buffer.length,position);if(!read.bytesRead)throw new Error('Short source read');const data=buffer.subarray(0,read.bytesRead);await out.writeFile(data);h.update(data);bytes+=data.length;position+=data.length;}}
    if(JSON.stringify(before)!==JSON.stringify(await checkpoint(file)))throw new Error('Source changed during projection');
    await out.close();out=null;
  }catch(e){if(out)await out.close();if(owned)await fs.unlink(output);throw e;}finally{await input.close();}
  return {schema:'sesh-history-candidate-receipt/v1',output:path.resolve(output),bytes,sha256:h.digest('hex'),nativeIdentityUnchanged:true,delivered:false,bootValidated:false,executionReady:false};
}
module.exports={inspectHistory,planHistoryProjection,writeProjectionCandidate,mergeRanges};
