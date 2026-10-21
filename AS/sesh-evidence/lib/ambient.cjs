const fs=require('node:fs').promises;
const path=require('node:path');
const {digest,positive}=require('./tape.cjs');

const roots=[['.codex','codex'],['.claude','claude-code'],['.copilot','copilot']];
const explicit=[['AGENTS.md','user-instructions'],['CLAUDE.md','user-instructions'],['.codex/AGENTS.md','user-instructions'],['.codex/AGENTS.override.md','user-instructions'],['.codex/config.toml','settings'],['.claude/CLAUDE.md','user-instructions'],['.claude/settings.json','settings-and-hooks'],['.claude/settings.local.json','settings-and-hooks'],['.copilot/copilot-instructions.md','user-instructions']];
async function inventoryAmbient(home,options={}) {
  const maxFiles=positive(options.maxFiles??2000,'maxFiles'),maxBytes=positive(options.maxBytes??32*1024*1024,'maxBytes'),maxDepth=positive(options.maxDepth??6,'maxDepth');
  const root=await fs.realpath(home), records=[],gaps=[];let bytes=0,visited=0,stopped=false;
  async function inspect(relative,kind,depth=0) {
    if(stopped)return;
    if(depth>maxDepth){gaps.push({path:relative,kind:'depth-bound'});return;}
    const full=path.join(root,relative);
    if(!path.resolve(full).startsWith(root+path.sep))throw new Error('Ambient path escaped its explicit home');
    let stat;try{stat=await fs.lstat(full);}catch(e){if(e.code==='ENOENT')return;gaps.push({path:relative,kind:'unreadable',code:e.code});return;}
    if(++visited>maxFiles){gaps.push({kind:'maxFiles'});stopped=true;return;}
    if(stat.isSymbolicLink()) {records.push({path:full,relative,kind,link:true,target:await fs.readlink(full),followed:false});return;}
    if(stat.isDirectory()) {for(const child of (await fs.readdir(full)).sort())await inspect(path.join(relative,child),kind,depth+1);return;}
    if(!stat.isFile())return;
    if(bytes+stat.size>maxBytes){gaps.push({path:relative,kind:'maxBytes',bytes:stat.size});stopped=true;return;}
    const handle=await fs.open(full,'r'),data=Buffer.alloc(stat.size);let consumed=0;
    try{while(consumed<data.length){const read=await handle.read(data,consumed,data.length-consumed,null);if(!read.bytesRead)break;consumed+=read.bytesRead;}}finally{await handle.close();}
    const after=await fs.stat(full);
    if(consumed!==stat.size||stat.size!==after.size||stat.mtimeMs!==after.mtimeMs||stat.ino!==after.ino||stat.dev!==after.dev)throw new Error('Ambient file changed during inventory');
    bytes+=data.length;
    records.push({path:full,relative,kind,bytes:data.length,sha256:digest(data),mtimeMs:stat.mtimeMs,contentIncluded:false});
  }
  for(const [relative,kind] of explicit)await inspect(relative,kind);
  for(const [base] of roots)for(const [suffix,kind] of [['skills','skills'],['hooks','hooks'],['rules','rules'],['agents','agent-definitions']])await inspect(`${base}/${suffix}`,kind);
  return {schema:'sesh-ambient-inventory/v1',home:root,records,gaps,files:records.length,bytesHashed:bytes,complete:gaps.length===0,
    contentIncluded:false,hooksExecuted:false,settingsApplied:false,
    scope:'Allowlisted user guidance/configuration and skills/hooks/rules/agents directories only; environment, registry, accounts, extensions and external configuration roots are not exhaustively captured. Auth stores are not traversed.'};
}
function compareAmbient(source,destination) {
  const target=new Map(destination.records.map(r=>[r.relative.replace(/\\/g,'/'),r]));
  const comparison=source.records.map(r=>{const other=target.get(r.relative.replace(/\\/g,'/'));return {relative:r.relative,source:r.path,destination:other?.path||null,kind:r.kind,
    status:!other?'source-only':(r.sha256&&r.sha256===other.sha256?'same-bytes':'different-or-link'),sourceSha256:r.sha256||null,destinationSha256:other?.sha256||null,
    decision:'pending-agent-reasoning'};});
  const sourcePaths=new Set(source.records.map(r=>r.relative.replace(/\\/g,'/')));
  for(const r of destination.records)if(!sourcePaths.has(r.relative.replace(/\\/g,'/')))comparison.push({relative:r.relative,source:null,destination:r.path,kind:r.kind,status:'destination-only',sourceSha256:null,destinationSha256:r.sha256||null,decision:'preserve-current-unless-reasoned-change'});
  return comparison;
}
function reconciliationBrief(source,destination,comparison) {
  return `# Ambient policy reconciliation after transfer\n\nSource user home: ${source.home}\nDestination user home: ${destination.home}\n\nThis is a reasoning task for the transferred agent. The inventory describes present source files, not proof of which versions were active in historical context. Source links require the old drive; use preserved snapshots if that drive will be removed. Inventory JSON contains hashes and references, not copied configuration contents.\n\nRead source guidance as historical evidence. Keep the destination's applicable instructions authoritative until an explicit, scoped change is made. Do not execute source hooks or activate skills/services merely because they were found.\n\nCompare each relevant item with current destination guidance. Separate durable user preferences/project policy from machine-specific paths, executable locations, platform settings and stale assumptions. Propose preserve, adapt, append, replace, omit or defer with reasons and instruction scope. Appending conflicting instructions is still a policy change. Record conflicts, source/destination hashes and the final decision in a reconciliation journal. Preserve the source and record destination before/after content for any applied edit.\n\nPrefer agent-owned guidance for agent-specific preferences; do not overwrite global user settings to serve this one transferred agent. Any broader changes must remain within the user's authorization and preserve other agents' requirements. Hooks require individual review of command, runtime, trigger, access and effects before activation. Loading skill metadata is distinct from running skill code.\n\nThe ambient inventory is bounded: ${source.gaps.length} source gaps and ${destination.gaps.length} destination gaps. Historical effective instructions may also exist in tape metadata; compare them separately. File inventories cannot prove past activation.\n\n## Items requiring judgment\n\n${comparison.filter(r=>r.status!=='same-bytes').map(r=>`- ${r.relative}: ${r.status}; source ${r.source}; destination ${r.destination||'(absent)'}`).join('\n')}\n\nNo settings, hooks, skills or destination instructions were changed by generating this brief.\n`;
}
module.exports={inventoryAmbient,compareAmbient,reconciliationBrief};
