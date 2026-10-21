#!/usr/bin/env node
const fs=require('node:fs').promises;
const path=require('node:path');
const {inventoryAmbient,compareAmbient,reconciliationBrief,compileSelection,expandResourcePreview,expandTapeSnapshot}=require('@tools-of/sesh-evidence');
async function main(){
  const [command,...argv]=process.argv.slice(2);const a={};
  if(!command||command==='--help'){console.log('agent-relocator ambient --source-home <home> --destination-home <home> --out-dir <new-directory> [--max-files N] [--max-bytes N] [--max-depth N]\nagent-relocator select --request <relocation-request.json> --pages <JSON-array-of-page-paths.json> --out <new-preview.json>\nagent-relocator expand --preview <selection.json> --allowed-roots <JSON-array> --destination-root <preview-root> --out <new-resource-preview.json> [--exclude-paths <JSON-array>] [--extent explicit|folder|tree] [--depth N] [--max-files N] [--max-bytes N]\nagent-relocator expand-tape --source <snapshot.zst|snapshot.gz> --out <new-expanded.jsonl> [--max-bytes N] [--max-decoded-bytes N]\nRead-only source inspection and derived artifacts only; no configuration merge, hook execution, workspace realization or session delivery.');return;}
  const allowed=command==='ambient'?['source-home','destination-home','out-dir','max-files','max-bytes','max-depth']:command==='select'?['request','pages','out']:command==='expand'?['preview','allowed-roots','destination-root','extent','depth','out','max-files','max-bytes','max-seconds','exclude-paths']:command==='expand-tape'?['source','out','max-bytes','max-decoded-bytes','max-seconds']:[];
  if(!allowed.length)throw new Error('Unknown command');
  for(let i=0;i<argv.length;i++){const key=argv[i].replace(/^--/,'');if(!argv[i].startsWith('--')||!allowed.includes(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('Unknown option or missing value: '+argv[i]);a[key]=argv[++i];}
  if(command==='ambient'){
    if(!a['source-home']||!a['destination-home']||!a['out-dir'])throw new Error('Source/destination home and new output directory required');
    const options={};for(const [flag,key] of [['max-files','maxFiles'],['max-bytes','maxBytes'],['max-depth','maxDepth']])if(a[flag])options[key]=Number(a[flag]);
    const source=await inventoryAmbient(a['source-home'],options),destination=await inventoryAmbient(a['destination-home'],options);
    const comparison=compareAmbient(source,destination),out=path.resolve(a['out-dir']);
    await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(out);
    for(const [name,value] of [['source.json',source],['destination.json',destination],['comparison.json',comparison]])await fs.writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
    await fs.writeFile(path.join(out,'RECONCILE_AMBIENT.md'),reconciliationBrief(source,destination,comparison),{flag:'wx'});
    await fs.writeFile(path.join(out,'AGENTS.migration.md'),'# Agent-local migration guidance\n\nAfter transfer, review [ambient policy reconciliation](RECONCILE_AMBIENT.md) with source.json, destination.json and comparison.json. This guidance is agent-local and is not a replacement for current user-level instructions. Review source settings using reasoning; the generator applies nothing. If this file is not natively loaded, explicitly reference it from the agent-owned launch guidance and verify delivery.\n',{flag:'wx'});
    console.log(JSON.stringify({output:out,sourceFiles:source.files,destinationFiles:destination.files,sourceGaps:source.gaps.length,destinationGaps:destination.gaps.length,settingsApplied:false}));
  }else if(command==='expand-tape'){
    if(!a.source||!a.out)throw new Error('--source and --out required');const budgets={};for(const [flag,key] of [['max-bytes','maxInputBytes'],['max-decoded-bytes','maxDecodedBytes'],['max-seconds','maxSeconds']])if(a[flag])budgets[key]=Number(a[flag]);
    const result=await expandTapeSnapshot(a.source,a.out,{budgets});await fs.writeFile(a.out+'.expansion.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
  }else if(command==='expand'){
    if(!a.preview||!a['allowed-roots']||!a['destination-root']||!a.out)throw new Error('Preview, allowed roots, destination root and output required');
    const preview=JSON.parse(await fs.readFile(a.preview,'utf8')),allowedSourceRoots=JSON.parse(await fs.readFile(a['allowed-roots'],'utf8'));
    const selected=preview.selected.map(r=>({...r,extent:a.extent?{mode:a.extent,anchor:a.extent==='explicit'?'referenced-path':'file-parent',maxDepth:a.extent==='tree'?Number(a.depth??2):0}:r.extent}));
    const budgets={};for(const [flag,key] of [['max-files','maxFiles'],['max-bytes','maxBytes'],['max-seconds','maxSeconds']])if(a[flag])budgets[key]=Number(a[flag]);
    const result=await expandResourcePreview(selected,{allowedSourceRoots,destinationRoot:a['destination-root'],budgets,excludePaths:a['exclude-paths']?JSON.parse(await fs.readFile(a['exclude-paths'],'utf8')):[]});
    await fs.writeFile(a.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:path.resolve(a.out),resources:result.resources.length,bytes:result.bytes,gaps:result.gaps.length,complete:result.complete,executionReady:false}));
  }else{
    if(!a.request||!a.pages||!a.out)throw new Error('--request, --pages and --out required');
    const request=JSON.parse(await fs.readFile(a.request,'utf8')),list=JSON.parse(await fs.readFile(a.pages,'utf8'));
    const pages=[];for(const f of list)pages.push(JSON.parse(await fs.readFile(path.resolve(path.dirname(a.pages),f),'utf8')));
    const preview=compileSelection(pages,request.selection);
    await fs.mkdir(path.dirname(path.resolve(a.out)),{recursive:true});await fs.writeFile(a.out,JSON.stringify(preview,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({output:path.resolve(a.out),selected:preview.selected.length,conflicts:preview.conflicts.length,unresolved:preview.unresolved.length,executionReady:false}));
  }
}
main().catch(e=>{console.error('agent-relocator:',e.message);process.exitCode=1;});
