const path = require('node:path');
function keyFor(event) {
  const p = event.resolvedPath;
  if (!p) return null;
  const windows=/^[A-Za-z]:[\\/]|^\\\\/.test(p);
  const normalized=(windows?path.win32:path.posix).normalize(p).replace(/\\/g,'/');
  return windows?normalized.toLowerCase():normalized;
}
function glob(pattern,value) {
  const escape=c=>/[.+^${}()|[\]\\]/.test(c)?'\\'+c:c;
  let regex='';
  pattern=pattern.replace(/\\/g,'/'); value=value.replace(/\\/g,'/');
  for(let i=0;i<pattern.length;i++) { if(pattern[i]==='*') { if(pattern[i+1]==='*') {regex+='.*';i++;} else regex+='[^/]*'; } else if(pattern[i]==='?') regex+='[^/]'; else regex+=escape(pattern[i]); }
  return new RegExp('^'+regex+'$',/^[A-Za-z]:/.test(value)?'i':'').test(value);
}
function contains(root,value){const windows=/^[A-Za-z]:[\\/]|^\\\\/.test(root);const p=windows?path.win32:path.posix;const r=p.relative(p.resolve(root),p.resolve(value));return r===''||(!r.startsWith('..'+p.sep)&&r!=='..'&&!p.isAbsolute(r));}
function assessCoverage(pages){
  const tapes=new Map();let complete=pages.length>0;
  for(const page of pages){
    const c=page.coverage,id=c.checkpoint.realpath,prior=tapes.get(id);
    if(prior){if(JSON.stringify(prior.checkpoint)!==JSON.stringify(c.checkpoint))throw new Error('Mixed source checkpoints');if(prior.end!==c.startOffset)throw new Error('Missing, duplicated or out-of-order evidence pages');}
    else if(c.startOffset!==0)complete=false;
    if(page.gaps.length)complete=false;
    tapes.set(id,{checkpoint:c.checkpoint,end:c.endOffset,unresolvedCalls:page.unresolvedCalls});
  }
  for(const t of tapes.values())if(t.end!==t.checkpoint.size||t.unresolvedCalls)complete=false;
  return complete;
}
function compileSelection(pages, selection) {
  const coverageComplete=assessCoverage(pages);
  if (!['error','ordered-priority'].includes(selection.conflicts)) throw new Error('Explicit conflict policy required');
  if (selection.defaultAction!=='omit') throw new Error('Unmatched files must remain omitted in v0.1');
  if (new Set(selection.rules.map(r=>r.id)).size!==selection.rules.length) throw new Error('Duplicate rule IDs');
  if(!Array.isArray(selection.allowedSourceRoots)||!selection.allowedSourceRoots.length)throw new Error('Explicit allowed source roots required');
  for(const r of selection.rules){
    if(!['explicit','folder','tree'].includes(r.extent.mode))throw new Error('Unknown selection extent');
    if(r.extent.mode!=='tree'&&r.extent.maxDepth!==0)throw new Error('Explicit/folder selection requires depth 0');
    if(r.extent.maxDepth!==null&&(!Number.isSafeInteger(r.extent.maxDepth)||r.extent.maxDepth<0))throw new Error('Invalid expansion depth');
    if(r.extent.anchor==='explicit-root'&&(!r.extent.root||!selection.allowedSourceRoots.some(root=>contains(root,r.extent.root))))throw new Error('Expansion anchor outside allowed roots');
    if(['recovery-source','preserved-evidence'].includes(r.binding.targetRole)&&r.binding.access==='read-write')throw new Error('Writable recovery/evidence target rejected');
  }
  const observations=new Map(), unresolved=[];
  // Updates for one call replace its requested observation; independent calls remain independent.
  for(const page of pages) for(const event of page.events) {
    if(event.eventKind!=='file-access') continue;
    const key=keyFor(event);
    if(!key) {unresolved.push(event);continue;}
    const identity=`${page.coverage.checkpoint.realpath}:${event.observationId}`;
    observations.set(identity,{...event,pathKey:key});
  }
  const groups=new Map();
  for(const e of observations.values()) {if(!groups.has(e.pathKey))groups.set(e.pathKey,[]);groups.get(e.pathKey).push(e);}
  const selected=[],omitted=[],conflicts=[],outOfScope=[];
  for(const [key,events] of groups) {
    if(!selection.allowedSourceRoots.some(root=>contains(root,events[0].resolvedPath))){outOfScope.push({path:events[0].resolvedPath,reason:'outside explicit allowed source roots'});continue;}
    const matches=[];
    for(const rule of selection.rules) {
      const q=rule.match;
      const relevant=events.filter(e=>(!q.sessions?.length||q.sessions.includes(e.sessionId)) && (!q.paths?.length||q.paths.some(p=>glob(p,e.resolvedPath))));
      const qualifying=relevant.filter(e=>q.evidence.includes(e.evidence)&&e.outcome!=='failed');
      if(!qualifying.some(e=>q.actionsAny.includes(e.action)))continue;
      // Any nonfailed recorded mutation blocks a read-only selector, even if evidence is weaker.
      if(relevant.some(e=>e.outcome!=='failed'&&q.actionsNone.includes(e.action)))continue;
      matches.push(rule);
    }
    if(!matches.length){omitted.push({path:events[0].resolvedPath,actions:[...new Set(events.map(e=>e.action))]});continue;}
    const signatures=new Set(matches.map(r=>JSON.stringify({extent:r.extent,binding:r.binding})));
    if(signatures.size>1 && selection.conflicts==='error') {conflicts.push({path:events[0].resolvedPath,rules:matches.map(r=>r.id)});continue;}
    const chosen=matches[0];
    selected.push({path:events[0].resolvedPath,pathKey:key,ruleId:chosen.id,matchedRules:matches.map(r=>r.id),actions:[...new Set(events.map(e=>e.action))],
      evidence:events.map(e=>({sessionId:e.sessionId,action:e.action,outcome:e.outcome,evidence:e.evidence,source:e.source})),extent:chosen.extent,binding:chosen.binding});
  }
  const complete=coverageComplete;
  return {schema:'sesh-selection-preview/v1',selected,omitted,conflicts,unresolved,outOfScope,
    transcriptCoverageComplete:complete,executionReady:false,
    blockers:[...(!complete?['Transcript coverage has gaps or partial pages']:[]),...(conflicts.length?['Resolve overlapping selection rules']:[]),
      'Filesystem expansion, destinations, collisions, link capabilities, instruction loading and dependency completeness are not yet validated'],
    scope:'Pure evidence selector; no filesystem traversal, copy, link, instruction changes or delivery'};
}
module.exports={compileSelection,glob,keyFor,contains,assessCoverage};
