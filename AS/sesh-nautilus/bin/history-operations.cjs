const fs=require('node:fs').promises,path=require('node:path');
const core=require('@tools-of/sesh-evidence');
async function main(argv){
 const [command,...flags]=argv,a={};const allowed={inspect:['source','out','harness','cursor','max-bytes','max-events','max-line'],plan:['pages','out','keep','end-policy'],project:['source','plan','out','max-output-bytes']}[command];
 if(flags.includes('--help')){console.log('sesh-nautilus inspect --source <JSONL> --out <new-page.json> [--harness codex|claude-code] [--cursor prior-page.json]\nsesh-nautilus plan --pages <JSON-array-of-page-paths> --out <new-plan.json> [--keep 2] [--end-policy source-end|last-completed-turn]\nsesh-nautilus project --source <preserved-JSONL> --plan <plan.json> --out <new-candidate.jsonl> [--max-output-bytes N]\nCandidates are not delivered, resumed or certified operational. Claude inspection is supported; Claude projection is blocked pending parent-chain support.');return;}
 for(let i=0;i<flags.length;i++){const k=flags[i].replace(/^--/,'');if(!allowed.includes(k)||!flags[i+1]||flags[i+1].startsWith('--'))throw new Error('Unknown option or missing value: '+flags[i]);a[k]=flags[++i];}
 if(!a.out)throw new Error('--out required');let result;
 if(command==='inspect'){
  if(!a.source)throw new Error('--source required');const budgets={};for(const [flag,key] of [['max-bytes','maxInputBytes'],['max-events','maxEvents'],['max-line','maxLineBytes']])if(a[flag])budgets[key]=Number(a[flag]);
  const previous=a.cursor?JSON.parse(await fs.readFile(a.cursor,'utf8')):null;if(previous&&!previous.cursor)throw new Error('Prior page has no continuation cursor');
  result=await core.inspectHistory(a.source,{harness:a.harness||'codex',budgets,cursor:previous?.cursor});
 }else if(command==='plan'){
  if(!a.pages)throw new Error('--pages required');const files=JSON.parse(await fs.readFile(a.pages,'utf8')),pages=[];for(const f of files)pages.push(JSON.parse(await fs.readFile(path.resolve(path.dirname(a.pages),f),'utf8')));
  result=core.planHistoryProjection(pages,Number(a.keep||2),{endPolicy:a['end-policy']||'source-end'});
 }else{
  if(!a.source||!a.plan)throw new Error('--source and --plan required');const plan=JSON.parse(await fs.readFile(a.plan,'utf8'));
  result=await core.writeProjectionCandidate(a.source,plan,a.out,a['max-output-bytes']?Number(a['max-output-bytes']):undefined);
  await fs.writeFile(a.out+'.receipt.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));return;
 }
 await fs.writeFile(a.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:path.resolve(a.out),schema:result.schema,complete:result.coverage?.complete,candidateAllowed:result.candidateAllowed,boundaries:result.totalBoundaries,estimatedBytes:result.estimatedBytes,executionReady:false}));
}
module.exports={main};
