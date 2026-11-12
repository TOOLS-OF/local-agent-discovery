const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const CONFIG_VERSION = 'sesh-evidence.projection-config/v1';
const OWNERSHIPS = ['evidence-derived', 'diagnostic-owned'];

function result(errors, extra = {}) {
  return { schema: 'sesh-evidence.projection-result/v1', passed: !errors.length, errors, ...extra };
}
function member(object, name, type, errors, code, nonempty = false) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return errors.push(`${code}_PARENT_TYPE`), false;
  if (!Object.hasOwn(object, name)) return errors.push(`${code}_ABSENT:${name}`), false;
  const value = object[name], correct = type === 'array' ? Array.isArray(value) : typeof value === type;
  if (!correct || value === null) return errors.push(`${code}_TYPE:${name}`), false;
  if (nonempty && value === '') return errors.push(`${code}_EMPTY:${name}`), false;
  return true;
}
function escapePointer(token) { return String(token).replaceAll('~', '~0').replaceAll('/', '~1'); }
function resolvePointer(document, pointer) {
  if (pointer === '#') return document;
  if (typeof pointer !== 'string' || !pointer.startsWith('#/')) throw new TypeError('invalid-pointer');
  let current = document;
  for (const raw of pointer.slice(2).split('/')) {
    const token = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (current && typeof current === 'object' && !Array.isArray(current) && Object.hasOwn(current, token)) current = current[token];
    else if (Array.isArray(current) && /^(0|[1-9][0-9]*)$/.test(token) && Number(token) < current.length) current = current[Number(token)];
    else throw new RangeError('pointer-not-found');
  }
  return current;
}
function leafPointers(value, prefix = '#') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value); if (!keys.length) return new Set([prefix]); const out = new Set();
    for (const key of keys) for (const item of leafPointers(value[key], `${prefix}/${escapePointer(key)}`)) out.add(item);
    return out;
  }
  if (Array.isArray(value)) {
    if (!value.length) return new Set([prefix]); const out = new Set();
    value.forEach((value, index) => { for (const item of leafPointers(value, `${prefix}/${index}`)) out.add(item); });
    return out;
  }
  return new Set([prefix]);
}
async function readJson(role, file, errors) {
  try { const text = await fs.readFile(file, 'utf8'); try { return JSON.parse(text); } catch { errors.push(`E_JSON:${role}`); } }
  catch (error) { errors.push(`E_IO:${role}:${error.code === 'ENOENT' ? 'NOT_FOUND' : 'UNREADABLE'}`); }
  return undefined;
}
async function validateEvidenceProjection(config, options = {}) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return result(['E_CONFIG_OBJECT']);
  const specs = [['schema','string',true],['sourceMapFile','string',true],['targetFile','string',true],['mappingFile','string',true],['coverageRoots','array',false],['gapRecords','array',false]];
  if (!specs.map(([n,t,e]) => member(config,n,t,errors,'E_CONFIG',e)).every(Boolean)) return result(errors);
  if (config.schema !== CONFIG_VERSION) errors.push('E_CONFIG_VERSION');
  const base = path.resolve(options.baseDir || process.cwd());
  const [sourceMap,target,mapping] = await Promise.all([readJson('sourceMapFile',path.resolve(base,config.sourceMapFile),errors),readJson('targetFile',path.resolve(base,config.targetFile),errors),readJson('mappingFile',path.resolve(base,config.mappingFile),errors)]);
  if (sourceMap === undefined || target === undefined || mapping === undefined) return result(errors);
  const sources = Object.create(null), sourceHashes = Object.create(null);
  if (!sourceMap || typeof sourceMap !== 'object' || Array.isArray(sourceMap)) errors.push('E_SOURCE_MAP_OBJECT');
  else if (!Object.hasOwn(sourceMap,'sources')) errors.push('E_SOURCE_MAP_SOURCES_ABSENT');
  else if (!sourceMap.sources || typeof sourceMap.sources !== 'object' || Array.isArray(sourceMap.sources)) errors.push('E_SOURCE_MAP_SOURCES_TYPE');
  else for (const [name,binding] of Object.entries(sourceMap.sources)) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) { errors.push(`E_SOURCE_BINDING_OBJECT:${name}`); continue; }
    const pv=member(binding,'path','string',errors,`E_SOURCE_${name}`,true), hv=member(binding,'sha256','string',errors,`E_SOURCE_${name}`,true); if (!pv||!hv) continue;
    if (!/^[0-9a-f]{64}$/.test(binding.sha256)) { errors.push(`E_SOURCE_SHA256_FORMAT:${name}`); continue; }
    let bytes; try { bytes=await fs.readFile(path.resolve(base,binding.path)); } catch(e) { errors.push(`E_IO:source:${name}:${e.code==='ENOENT'?'NOT_FOUND':'UNREADABLE'}`); continue; }
    const observed=crypto.createHash('sha256').update(bytes).digest('hex'); sourceHashes[name]=observed;
    if (observed!==binding.sha256) { errors.push(`E_SOURCE_HASH:${name}`); continue; }
    try { sources[name]=JSON.parse(bytes.toString('utf8')); } catch { errors.push(`E_JSON:source:${name}`); }
  }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) errors.push('E_MAPPING_OBJECT');
  else if (!Object.hasOwn(mapping,'entries')) errors.push('E_MAPPING_ENTRIES_ABSENT');
  else if (!Array.isArray(mapping.entries)) errors.push('E_MAPPING_ENTRIES_TYPE');
  const entries=mapping&&Array.isArray(mapping.entries)?mapping.entries:[], covered=new Set(), seen=new Set();
  for (let i=0;i<entries.length;i++) {
    const entry=entries[i]; if (!entry||typeof entry!=='object'||Array.isArray(entry)) { errors.push(`E_ENTRY_OBJECT:${i}`); continue; }
    const pv=member(entry,'targetPointer','string',errors,`E_ENTRY_${i}`,true), ov=member(entry,'ownership','string',errors,`E_ENTRY_${i}`,true); if(!pv)continue;
    const p=entry.targetPointer; if(seen.has(p))errors.push(`E_DUPLICATE_TARGET:${p}`); seen.add(p);covered.add(p);
    let expected; try{expected=resolvePointer(target,p);}catch(e){errors.push(`${e instanceof TypeError?'E_TARGET_POINTER_INVALID':'E_TARGET_POINTER_NOT_FOUND'}:${p}`);continue;}
    if(!ov)continue; if(!OWNERSHIPS.includes(entry.ownership)){errors.push(`E_OWNERSHIP:${p}`);continue;}
    if(entry.ownership==='evidence-derived'){
      if(!Object.hasOwn(entry,'citations')||!Array.isArray(entry.citations)||!entry.citations.length||entry.citations.some(x=>typeof x!=='string'||!x)){errors.push(`E_CITATIONS:${p}`);continue;}
      if(Object.hasOwn(entry,'constant'))errors.push(`E_EVIDENCE_CONSTANT:${p}`);
      for(const citation of entry.citations){const sep=citation.indexOf(':#');if(sep<1){errors.push(`E_CITATION_SYNTAX:${p}`);continue;}const name=citation.slice(0,sep),sp=citation.slice(sep+1);if(!Object.hasOwn(sources,name)){errors.push(`E_CITATION_SOURCE:${p}:${name}`);continue;}try{if(!isDeepStrictEqual(resolvePointer(sources[name],sp),expected))errors.push(`E_CONFLICT:${p}:${citation}`);}catch{errors.push(`E_CITATION_POINTER:${p}:${citation}`);}}
    } else {if(!Object.hasOwn(entry,'constant'))errors.push(`E_CONSTANT_ABSENT:${p}`);else if(!isDeepStrictEqual(entry.constant,expected))errors.push(`E_CONSTANT_CONFLICT:${p}`);if(Object.hasOwn(entry,'citations'))errors.push(`E_DIAGNOSTIC_CITATION:${p}`);}
  }
  for(let i=0;i<config.gapRecords.length;i++){
    const gap=config.gapRecords[i];if(!gap||typeof gap!=='object'||Array.isArray(gap)){errors.push(`E_GAP_OBJECT:${i}`);continue;}
    const pv=member(gap,'pointer','string',errors,`E_GAP_${i}`,true),sv=member(gap,'status','string',errors,`E_GAP_${i}`,true);if(!pv||!sv)continue;
    let record;try{record=resolvePointer(target,gap.pointer);}catch{errors.push(`E_GAP_POINTER:${gap.pointer}`);continue;}
    if(!record||typeof record!=='object'||Array.isArray(record)){errors.push(`E_GAP_RECORD_TYPE:${gap.pointer}`);continue;}
    if(!Object.hasOwn(record,'status'))errors.push(`E_GAP_STATUS_ABSENT:${gap.pointer}`);else if(typeof record.status!=='string'||!record.status||record.status!==gap.status)errors.push(`E_GAP_STATUS:${gap.pointer}`);
    if(!Object.hasOwn(record,'value'))errors.push(`E_GAP_VALUE_ABSENT:${gap.pointer}`);else if(record.value!==null)errors.push(`E_GAP_VALUE_NOT_NULL:${gap.pointer}`);
    covered.add(`${gap.pointer}/status`);covered.add(`${gap.pointer}/value`);
  }
  const required=new Set();config.coverageRoots.forEach((root,i)=>{if(typeof root!=='string'||!root){errors.push(`E_COVERAGE_ROOT_TYPE:${i}`);return;}try{for(const item of leafPointers(resolvePointer(target,root),root))required.add(item);}catch{errors.push(`E_COVERAGE_ROOT:${root}`);}});
  for(const item of [...required].sort())if(!covered.has(item))errors.push(`E_UNMAPPED_TARGET:${item}`);for(const item of [...covered].sort())if(!required.has(item))errors.push(`E_MAPPING_OUTSIDE_COVERAGE:${item}`);
  return result(errors,{sourceHashes,coveredLeafCount:required.size});
}
module.exports={CONFIG_VERSION,resolvePointer,leafPointers,validateEvidenceProjection};
