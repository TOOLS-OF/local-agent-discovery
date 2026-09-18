#!/usr/bin/env node
const fs = require('fs'), path = require('path'), os = require('os'), {execSync} = require('child_process');
const HOME = os.homedir();
const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`sesh-hound extended — address book for agent sensing
Usage:
  sesh-hound [cwd]                    Find sessions spawned from folder
  sesh-hound --by-title <name>       Find session by agent title
  sesh-hound --subagents <sessionId> Sense subagents in session
  sesh-hound --json [...]            Output as JSON (works with any mode)
  sesh-hound --help                  Show this help`);
  process.exit(0);
}

let mode = 'by-cwd';
let queryArg = null;

if (args.includes('--by-title')) {
  mode = 'by-title';
  queryArg = args[args.indexOf('--by-title') + 1];
} else if (args.includes('--subagents')) {
  mode = 'subagents';
  queryArg = args[args.indexOf('--subagents') + 1];
} else {
  queryArg = args.find(a => !a.startsWith('-')) || process.cwd();
}

function normalize(p) { return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(); }
function pathMatches(cwd, target) { if (!cwd) return false; const n = normalize(cwd); return n === target || n.startsWith(target + '/') || target.startsWith(n + '/'); }
function fileMTime(p) { try { return fs.statSync(p).mtime; } catch { return null; } }

async function discoverByPath() {
  const results = [];
  const normalized = normalize(path.resolve(queryArg));

  // Claude Code
  try {
    const projectsDir = path.join(HOME, '.claude', 'projects');
    if (fs.existsSync(projectsDir)) {
      for (const dir of fs.readdirSync(projectsDir)) {
        const dirPath = path.join(projectsDir, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        for (const f of fs.readdirSync(dirPath)) {
          if (!f.endsWith('.jsonl')) continue;
          const fullPath = path.join(dirPath, f);
          try {
            const buf = fs.readFileSync(fullPath, 'utf8').slice(0, 8000);
            const cwdM = buf.match(/"cwd":"([^"]*)"/);
            const slugM = buf.match(/"slug":"([^"]*)"/);
            const cwd = cwdM ? cwdM[1].replace(/\\\\/g, '\\') : null;
            const title = slugM ? slugM[1] : null;
            if (cwd && pathMatches(cwd, normalized)) {
              results.push({ sessionId: f.replace('.jsonl', ''), title, cwd, file: fullPath, tool: 'claude-code', mtime: fileMTime(fullPath) });
            }
          } catch (e) { }
        }
      }
    }
  } catch (e) { }

  // Codex
  try {
    const sessionsDir = path.join(HOME, '.codex', 'sessions');
    if (fs.existsSync(sessionsDir)) {
      const walk = (dir) => {
        try {
          for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.jsonl')) {
              try {
                const buf = fs.readFileSync(full, 'utf8').slice(0, 4096);
                const cwdM = buf.match(/"cwd":"([^"]*)"/);
                const cwd = cwdM ? cwdM[1].replace(/\\\\/g, '\\') : null;
                if (cwd && pathMatches(cwd, normalized)) {
                  const sid = e.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] || e.name.replace('.jsonl', '');
                  results.push({ sessionId: sid, cwd, file: full, tool: 'codex', mtime: fileMTime(full) });
                }
              } catch (e) { }
            }
          }
        } catch (e) { }
      };
      walk(sessionsDir);
    }
  } catch (e) { }

  return results;
}

async function discoverByTitle() {
  const results = [];
  const titleLower = queryArg.toLowerCase();

  // Claude Code
  try {
    const projectsDir = path.join(HOME, '.claude', 'projects');
    if (fs.existsSync(projectsDir)) {
      for (const dir of fs.readdirSync(projectsDir)) {
        const dirPath = path.join(projectsDir, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        for (const f of fs.readdirSync(dirPath)) {
          if (!f.endsWith('.jsonl')) continue;
          const fullPath = path.join(dirPath, f);
          try {
            const buf = fs.readFileSync(fullPath, 'utf8').slice(0, 8000);
            const slugM = buf.match(/"slug":"([^"]*)"/);
            const title = slugM ? slugM[1] : null;
            if (title && title.toLowerCase().includes(titleLower)) {
              results.push({ sessionId: f.replace('.jsonl', ''), title, file: fullPath, tool: 'claude-code', mtime: fileMTime(fullPath) });
            }
          } catch (e) { }
        }
      }
    }
  } catch (e) { }

  // Codex (via SQLite)
  try {
    const dbPath = path.join(HOME, '.codex', 'sqlite', 'codex-dev.db');
    if (fs.existsSync(dbPath)) {
      const q = `SELECT thread_id, display_title FROM local_thread_catalog WHERE display_title LIKE '%${queryArg.replace(/'/g, "''")}%';`;
      const res = execSync(`sqlite3 "${dbPath}" "${q}"`, {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
      for (const line of res.split('\n').filter(l => l.trim())) {
        const [sid, ...titleParts] = line.split('|');
        const title = titleParts.join('|');
        if (sid && title) {
          // Try to find the actual file
          let file = null;
          const sessionsDir = path.join(HOME, '.codex', 'sessions');
          if (fs.existsSync(sessionsDir)) {
            const walk = (dir) => {
              try {
                for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
                  const full = path.join(dir, e.name);
                  if (e.isDirectory()) {
                    const found = walk(full);
                    if (found) return found;
                  } else if (e.name.includes(sid) && e.name.endsWith('.jsonl')) {
                    return full;
                  }
                }
              } catch (e) { }
              return null;
            };
            file = walk(sessionsDir);
          }
          results.push({ sessionId: sid, title, tool: 'codex', file, mtime: file ? fileMTime(file) : null });
        }
      }
    }
  } catch (e) { }

  return results;
}

async function discoverSubagents() {
  const results = [];
  let session = null;

  // Search Claude Code
  try {
    const projectsDir = path.join(HOME, '.claude', 'projects');
    if (fs.existsSync(projectsDir)) {
      for (const dir of fs.readdirSync(projectsDir)) {
        const dirPath = path.join(projectsDir, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        const filePath = path.join(dirPath, queryArg + '.jsonl');
        if (fs.existsSync(filePath)) {
          session = { sessionId: queryArg, file: filePath, tool: 'claude-code' };
          break;
        }
      }
    }
  } catch (e) { }

  // Search Codex
  if (!session) {
    try {
      const sessionsDir = path.join(HOME, '.codex', 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const walk = (dir) => {
          try {
            for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
              const full = path.join(dir, e.name);
              if (e.isDirectory()) {
                const found = walk(full);
                if (found) return found;
              } else if (e.name.includes(queryArg) && e.name.endsWith('.jsonl')) {
                return full;
              }
            }
          } catch (e) { }
          return null;
        };
        const file = walk(sessionsDir);
        if (file) session = { sessionId: queryArg, file, tool: 'codex' };
      }
    } catch (e) { }
  }

  if (!session) {
    if (!jsonOut) console.error(`Session ${queryArg} not found.`);
    process.exit(1);
  }

  // Extract subagents from file
  try {
    const content = fs.readFileSync(session.file, 'utf8');
    const match = content.match(/"subagents"\s*:\s*"([^"]+)"/);
    const subagents = [];
    if (match) {
      const subagentText = match[1].replace(/\\n/g, '\n');
      for (const line of subagentText.split('\n')) {
        const m = line.match(/^-\s+[a-f0-9\-]+:\s+(.+)$/);
        if (m) subagents.push({name: m[1].trim()});
      }
    }
    results.push({...session, subagents});
  } catch (e) { }

  return results;
}

async function run() {
  let results = [];

  if (mode === 'by-cwd') results = await discoverByPath();
  else if (mode === 'by-title') results = await discoverByTitle();
  else if (mode === 'subagents') results = await discoverSubagents();

  results.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

  if (jsonOut) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const modeLabel = {'by-cwd': 'by folder', 'by-title': 'by title', 'subagents': 'subagents'}[mode];
    console.log(`🐕 sesh-hound sensing (${modeLabel}): ${queryArg}\n`);
    if (results.length === 0) console.log('  Nothing sensed.');
    for (const r of results) {
      console.log(`  [${r.tool}] ${r.sessionId}${r.mtime ? '  (last active: ' + r.mtime.toISOString() + ')' : ''}`);
      if (r.title) console.log(`      title: ${r.title}`);
      if (r.cwd) console.log(`      cwd:   ${r.cwd}`);
      if (r.subagents?.length > 0) {
        console.log(`      subagents:`);
        r.subagents.forEach(s => console.log(`        - ${s.name}`));
      }
      console.log(`      file:  ${r.file}`);
    }
    console.log(`\n${results.length} result${results.length === 1 ? '' : 's'} sensed.`);
  }
}

run();
