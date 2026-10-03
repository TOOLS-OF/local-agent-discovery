#!/usr/bin/env node
/* sesh-hound Rancor Monster: consolidated local session address book. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const HOME = os.homedir();
const argv = process.argv.slice(2);
const opt = { json: false, exact: false, verbose: false, cache: null, routes: null, mode: 'cwd', query: null };
function need(i, flag) { if (!argv[i + 1] || argv[i + 1].startsWith('-')) throw Error(`${flag} requires a value`); return argv[++i]; }
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--json') opt.json = true;
  else if (a === '--exact') opt.exact = true;
  else if (a === '--verbose') opt.verbose = true;
  else if (a === '--cache') opt.cache = need(i, a), i += 1;
  else if (a === '--routes') opt.routes = need(i, a), i += 1;
  else if (a === '--by-title') opt.mode = 'title', opt.query = need(i, a), i += 1;
  else if (a === '--subagents') opt.mode = 'subagents', opt.query = need(i, a), i += 1;
  else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  else if (!a.startsWith('-') && !opt.query) opt.query = a;
  else throw Error(`Unknown argument: ${a}`);
}
opt.query = opt.query || process.cwd();

function printHelp() {
  console.log(`sesh-hound Rancor Monster — cached local agent address book

Usage:
  sesh-hound [cwd] [--exact] [--json] [--routes file] [--cache file]
  sesh-hound --by-title <text> [--json]
  sesh-hound --subagents <session-id> [--json]

Shows display name, canonical session ID, route class, parent route, compaction
count, and activity. A direct summon is shown only when a local route map
authoritatively supplies it; discovery alone never grants control.

  --exact       Do not include ancestor/descendant office records.
  --routes FILE Local-only route map: { "routes": { "id": { "displayName",
                "kind", "parent", "summon" } } }.
  --subagents   Read a parent session's declared child roster.
  --by-title    Search known display names without dumping transcripts.
  --cache FILE  Override the incremental cache location.`);
}
function normalize(v) { return String(v || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(); }
const target = normalize(path.resolve(opt.query));
function scope(cwd) { const n = normalize(cwd); if (!n) return null; if (n === target) return 'exact'; if (!opt.exact && n.startsWith(`${target}/`)) return 'descendant'; if (!opt.exact && target.startsWith(`${n}/`)) return 'ancestor'; return null; }
function cachePath() { return path.resolve(opt.cache || path.join(process.platform === 'win32' ? (process.env.LOCALAPPDATA || HOME) : (process.env.XDG_CACHE_HOME || path.join(HOME, '.cache')), 'sesh-hound', 'rancor-monster-v1.json')); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const cacheFile = cachePath(); const cache = readJson(cacheFile, { version: 2, files: {}, childRosters: {} });
if (!cache.files) cache.files = {};
if (!cache.childRosters) cache.childRosters = {};
const routes = opt.routes ? (readJson(path.resolve(opt.routes), {}).routes || {}) : {};
function stat(file) { try { const s = fs.statSync(file); return { size: s.size, mtimeMs: s.mtimeMs, mtime: s.mtime.toISOString() }; } catch { return null; } }
function readRange(file, start, length) { const fd = fs.openSync(file, 'r'); try { const b = Buffer.alloc(length); const n = fs.readSync(fd, b, 0, length, start); return b.slice(0, n).toString('utf8'); } finally { fs.closeSync(fd); } }
function jsonlHead(file) { return readRange(file, 0, Math.min(stat(file).size, 65536)).split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean); }
function countMarkers(file, start, end) {
  const fd = fs.openSync(file, 'r'); let offset = start; let carry = ''; let total = 0;
  try {
    while (offset < end) {
      const length = Math.min(1024 * 1024, end - offset); const buffer = Buffer.alloc(length);
      const bytes = fs.readSync(fd, buffer, 0, length, offset); if (!bytes) break;
      const text = carry + buffer.slice(0, bytes).toString('utf8');
      const boundary = carry.length;
      total += [...text.matchAll(/"type"\s*:\s*"compacted"/g)].filter(match => match.index >= boundary).length;
      carry = text.slice(-128); offset += bytes;
    }
  } finally { fs.closeSync(fd); }
  return total;
}
function compactions(file, s, prior) {
  if (prior && prior.size === s.size && prior.mtimeMs === s.mtimeMs) return prior.compactions;
  if (prior && prior.size <= s.size) return prior.compactions + countMarkers(file, prior.size, s.size);
  return countMarkers(file, 0, s.size);
}
let catalogTitles = null;
function titleFromCatalog(id) {
  if (catalogTitles === null) {
    catalogTitles = {};
    const db = path.join(HOME, '.codex', 'sqlite', 'codex-dev.db');
    if (fs.existsSync(db)) try {
      const rows = execFileSync('sqlite3', [db, 'SELECT thread_id, display_title FROM local_thread_catalog;'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/);
      rows.forEach(row => { const split = row.indexOf('|'); if (split > 0) catalogTitles[row.slice(0, split)] = row.slice(split + 1); });
    } catch { /* title resolution is optional */ }
  }
  return catalogTitles[id] || null;
}
function inspectCodex(file, knownMeta) {
  const s = stat(file); if (!s) return null; const old = cache.files[file];
  let meta = knownMeta || (old && old.meta);
  if (!meta) { const item = jsonlHead(file).find(x => x.type === 'session_meta'); meta = item && item.payload || {}; }
  if (opt.mode === 'title') return { meta, stat: s, compactions: old && typeof old.compactions === 'number' ? old.compactions : null };
  const info = { size: s.size, mtimeMs: s.mtimeMs, meta, compactions: compactions(file, s, old) }; cache.files[file] = info; return { meta, stat: s, compactions: info.compactions };
}
function route(id, meta) {
  const declared = routes[id] || {}; const parent = declared.parent || meta.parent_thread_id || null;
  const sourceHint = meta.source === 'subagent' || Boolean(parent);
  const kind = declared.kind || (sourceHint ? 'subagent-candidate' : 'session-unverified');
  return { kind, parent: parent || null, summon: declared.summon || (kind === 'native-subagent' ? 'through-parent' : 'verify-first'), evidence: declared.kind ? 'route-map' : (sourceHint ? 'session-metadata' : 'none') };
}
function record(tool, id, cwd, file, s, meta, count) {
  const where = opt.mode === 'title' ? 'title-search' : scope(cwd); if (!where) return null; const declared = routes[id] || {}; const r = route(id, meta || {});
  return { tool, sessionId: id, displayName: declared.displayName || titleFromCatalog(id) || (meta && meta.agent_nickname) || null, cwd, scope: where, routing: r, compactions: count == null ? null : count, updatedAt: s.mtime, file };
}
function walk(dir, visit) { let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } entries.forEach(e => { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, visit); else visit(f, e.name); }); }
function codex() { const out = []; const root = path.join(HOME, '.codex', 'sessions'); if (!fs.existsSync(root)) return out; walk(root, (file, name) => { if (!name.endsWith('.jsonl')) return; const old = cache.files[file]; let meta = old && old.meta; if (!meta) { const item = jsonlHead(file).find(x => x.type === 'session_meta'); meta = item && item.payload || {}; } if (!meta.cwd || (opt.mode !== 'title' && !scope(meta.cwd))) return; const i = inspectCodex(file, meta); if (!i) return; const id = (name.match(/([0-9a-f-]{36})\.jsonl$/i) || [])[1] || name.replace(/\.jsonl$/, ''); const r = record('codex', id, i.meta.cwd, file, i.stat, i.meta, i.compactions); if (r) out.push(r); }); return out; }
function claude() { const out = []; const root = path.join(HOME, '.claude', 'projects'); if (!fs.existsSync(root)) return out; walk(root, (file, name) => { if (!name.endsWith('.jsonl')) return; const s = stat(file); if (!s) return; let head; try { head = readRange(file, 0, Math.min(s.size, 65536)); } catch { return; } const cwd = (head.match(/"cwd"\s*:\s*"([^\"]*)"/) || [])[1]; if (!cwd) return; const id = name.replace(/\.jsonl$/, ''); const title = (head.match(/"(?:customTitle|slug)"\s*:\s*"([^\"]*)"/) || [])[1] || null; const r = record('claude-code', id, cwd.replace(/\\\\/g, '\\'), file, s, { agent_nickname: title }, null); if (r) out.push(r); }); return out; }
function copilot() { const out = []; const bases = process.platform === 'win32' ? [path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Code'), path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Code - Insiders')] : []; for (const base of bases) { const store = path.join(base, 'User', 'workspaceStorage'); if (!fs.existsSync(store)) continue; for (const hash of fs.readdirSync(store)) { const dir = path.join(store, hash); let cwd; try { const ws = readJson(path.join(dir, 'workspace.json'), {}); cwd = decodeURIComponent((ws.folder || ws.workspace || '').replace('file:///', '')); } catch { continue; } const chats = path.join(dir, 'chatSessions'); if (!cwd || !fs.existsSync(chats)) continue; for (const name of fs.readdirSync(chats)) { if (!/\.jsonl?$/.test(name)) continue; const file = path.join(chats, name); const s = stat(file); const r = s && record(`vscode-copilot (${path.basename(base)})`, name.replace(/\.jsonl?$/, ''), cwd, file, s, {}, null); if (r) out.push(r); } } } return out; }
function locate(id) {
  const all = [...codex(), ...claude()]; const scoped = all.find(r => r.sessionId === id); if (scoped) return scoped;
  const root = path.join(HOME, '.codex', 'sessions'); let found = null;
  if (fs.existsSync(root)) walk(root, (file, name) => {
    if (found || !name.endsWith('.jsonl') || !name.includes(id)) return;
    const s = stat(file); if (!s) return;
    const item = jsonlHead(file).find(x => x.type === 'session_meta'); const meta = item && item.payload || {};
    found = { sessionId: id, cwd: meta.cwd || null, file, stat: s, meta };
  });
  return found;
}
function declaredChildren(file, s) {
  const cached = cache.childRosters[file];
  if (cached && cached.size === s.size && cached.mtimeMs === s.mtimeMs) return cached.children;
  const byId = new Map();
  const fd = fs.openSync(file, 'r'); let offset = 0; let carry = '';
  try {
    while (offset < s.size) {
      const length = Math.min(1024 * 1024, s.size - offset); const buffer = Buffer.alloc(length);
      const bytes = fs.readSync(fd, buffer, 0, length, offset); if (!bytes) break;
      const text = carry + buffer.slice(0, bytes).toString('utf8'); const lines = text.split(/\r?\n/);
      carry = lines.pop() || '';
      for (const line of lines) {
        if (!line.includes('receiver_agents')) continue;
        let item; try { item = JSON.parse(line); } catch { continue; }
        const agents = item?.payload?.item?.receiver_agents || item?.payload?.receiver_agents || [];
        for (const agent of agents) {
          const childId = agent.thread_id || agent.threadId;
          if (!childId) continue;
          byId.set(childId, { sessionId: childId, nativeHandle: childId, displayName: agent.agent_nickname || agent.nickname || null, lastObservedAt: item.timestamp || null, lifecycle: 'historical-native-child' });
        }
      }
      offset += bytes;
    }
  } finally { fs.closeSync(fd); }
  const children = [...byId.values()];
  cache.childRosters[file] = { size: s.size, mtimeMs: s.mtimeMs, children };
  return children;
}
function children(id) {
  const mapped = routes[id] && Array.isArray(routes[id].children) ? routes[id].children : [];
  if (mapped.length) return mapped.map(child => ({ sessionId: child.sessionId || null, nativeHandle: child.nativeHandle || null, displayName: child.displayName || null, parent: id, summon: 'through-parent', kind: child.kind || 'native-subagent', evidence: 'route-map' }));
  const parent = locate(id); if (!parent) return [];
  try {
    const parentStat = stat(parent.file); if (!parentStat) return [];
    const observed = declaredChildren(parent.file, parentStat);
    if (observed.length) return observed.map(child => ({ ...child, parent: id, summon: 'through-parent', kind: 'native-subagent', evidence: 'parent-tool-event' }));
    const text = readRange(parent.file, 0, Math.min(parentStat.size, 1024 * 1024)); const m = text.match(/"subagents"\s*:\s*"([^\"]+)"/); if (!m) return [];
    return m[1].replace(/\\n/g, '\n').split('\n').map(x => x.match(/^\s*-\s+([a-f0-9-]+)\s*:\s*(.+)$/i)).filter(Boolean).map(x => ({ sessionId: x[1], nativeHandle: null, displayName: x[2].trim(), parent: id, summon: 'through-parent', kind: 'native-subagent', lifecycle: 'historical-native-child', evidence: 'parent-session-meta' }));
  } catch { return []; }
}
let sessions;
if (opt.mode === 'subagents') sessions = children(opt.query); else { sessions = [...codex(), ...claude(), ...copilot()]; if (opt.mode === 'title') { const needle = opt.query.toLowerCase(); sessions = sessions.filter(x => String(x.displayName || '').toLowerCase().includes(needle)); } }
sessions.sort((a, b) => String(a.displayName || a.sessionId).localeCompare(String(b.displayName || b.sessionId)));
try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch { /* caching must never block discovery */ }
if (opt.json) console.log(JSON.stringify({ target: opt.query, sessions }, null, 2));
else {
  console.log(`🐕 sesh-hound Rancor Monster: ${opt.mode === 'cwd' ? opt.query : `${opt.mode} ${opt.query}`}`);
  if (!sessions.length) console.log('  No session records found.');
  for (const x of sessions) console.log(`  ${x.displayName || 'untitled'}\n    ${x.sessionId}  ${x.tool || x.kind}  ${x.routing ? `${x.routing.kind}; ${x.routing.summon}${x.routing.parent ? ` via ${x.routing.parent}` : ''}` : x.summon}\n    compactions: ${x.compactions == null ? '—' : x.compactions}; updated: ${x.updatedAt || '—'}`);
  console.log(`\n${sessions.length} record(s). Discovery evidence is not authority to resume, attach, or message.`);
}
