#!/usr/bin/env node
/**
 * sesh-hound — given a cwd, sniff out every Claude Code, Codex, and
 * VS Code Copilot Chat session ever spawned from that folder.
 *
 * Verified sources of truth (2026-08-29), each confirmed by direct
 * inspection on a real machine, not assumed:
 *
 *   - Claude Code: ~/.claude/projects/<escaped-cwd>/*.jsonl — every event
 *     carries a plain "cwd" field. Grepping content is more robust than
 *     reverse-engineering the folder-name escaping scheme (handles
 *     unicode/edge cases the escaping might mangle).
 *
 *   - Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl — directory
 *     structure is DATE-based, not cwd-based. First line is a session_meta
 *     event with a plain "cwd" field. The file's own UUID (from its
 *     filename) is the reliable session id — a "session_id" field found
 *     elsewhere in content can refer to a parent/original session after a
 *     resume/fork, not the file itself.
 *
 *   - VS Code Copilot Chat (Code and Code - Insiders, both checked, OS-
 *     appropriate config dir): <vscode-config-dir>/User/workspaceStorage/
 *     <hash>/workspace.json has a "folder" or "workspace" field with a
 *     file:// URI (URL-encoded) to the real folder or a .code-workspace
 *     file (strip via dirname if so). Matching hash's sibling chatSessions/
 *     dir holds the session *.jsonl files — NOT .json, a real gotcha.
 *
 * NOTE (added 2026-10-08, real incident): searching all three harnesses for
 * a single-harness question wastes real time — a full-tree Codex rollout
 * scan can run past a minute on a loaded machine. `--harness <name>` now
 * skips the other two scanners entirely. Codex also gained a fast path:
 * `~/.codex/state_5.sqlite`'s own `threads` table (id, cwd, title,
 * agent_nickname, updated_at, archived) is queried directly via the `sqlite3`
 * CLI when available — one indexed query instead of a recursive directory
 * walk reading every rollout `.jsonl` file's first 4KB. Falls back to the
 * old file-walk automatically if `sqlite3` isn't on PATH or the DB doesn't
 * exist, so this never becomes a hard dependency. Every result now also
 * carries a real display `title` (Codex: `agent_nickname` or the thread's
 * own `title`, truncated; Claude Code: the session's `slug`, same
 * extraction `sesh-hound-extended.js` already used) instead of forcing a
 * human to go look up what a bare UUID actually is.
 *
 * Usage:
 *   sesh-hound [cwd] [--json] [--config-dir <dir>...] [--harness <name>]
 *
 * [cwd] defaults to the current directory if omitted. Matched as an exact
 * string OR as a path prefix (pointing at a parent folder finds sessions
 * from subfolders too) — path separators and case are normalized before
 * comparing, so this works the same on Windows, macOS, and Linux.
 *
 * NOTE (added 2026-10-07): `CLAUDE_CONFIG_DIR` is a real, verified env var
 * (tested empirically: `CLAUDE_CONFIG_DIR=/x claude mcp list` writes
 * `.claude.json` AND relocates the entire `projects/` tree to `/x`, not
 * just the top-level config file — confirmed via a real launched session
 * landing its transcript under `/x/projects/<escaped-cwd>/*.jsonl` instead
 * of `~/.claude/projects/...`). Before this fix, sesh-hound ONLY scanned
 * `os.homedir()/.claude/projects` for Claude Code sessions — any session
 * launched with a custom `CLAUDE_CONFIG_DIR` (the real mechanism this
 * swarm's "housecat" per-account isolation uses) was INVISIBLE to it, a
 * real blind spot, not just a missing metadata field. `--config-dir <dir>`
 * (repeatable) now adds each given dir's own `projects/` subtree to the
 * Claude Code scan alongside the default HOME. Each result's `configDir`
 * field records which root it was found under (`"<home>"` for the
 * default), so a housecat session is distinguishable from a default one
 * without having to re-derive it from the file path by eye.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

const HOME = os.homedir();
const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const helpFlag = args.includes('--help') || args.includes('-h');

const configDirs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config-dir') configDirs.push(args[++i]);
}
let harnessFilter = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--harness') harnessFilter = (args[++i] || '').toLowerCase();
}
const VALID_HARNESSES = ['claude-code', 'codex', 'vscode-copilot'];
if (harnessFilter && !VALID_HARNESSES.includes(harnessFilter)) {
  console.error(`sesh-hound error: --harness must be one of ${VALID_HARNESSES.join(', ')}, got "${harnessFilter}"`);
  process.exit(1);
}
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--config-dir' || a === '--harness') { i++; continue; }
  if (a.startsWith('-')) continue;
  positional.push(a);
}
const targetArg = positional[0] || process.cwd();

if (helpFlag) {
  console.log(`sesh-hound — sniff out Claude Code / Codex / VS Code Copilot sessions from a folder

Usage:
  sesh-hound [cwd] [--json] [--config-dir <dir>...] [--harness <name>]

  [cwd]          Folder to search from. Defaults to the current directory.
  --json         Print machine-readable JSON instead of the friendly report.
  --config-dir   Additional Claude Code config root to scan, equivalent to
                 what CLAUDE_CONFIG_DIR would point a session at (repeatable).
                 Real need: a session launched with CLAUDE_CONFIG_DIR set
                 stores its ENTIRE transcript tree there, not under the
                 default ~/.claude/projects/ — without this flag, any such
                 session is invisible to sesh-hound, not just unlabeled.
  --harness      Only scan one harness: "claude-code", "codex", or
                 "vscode-copilot". Skips the other two scanners entirely —
                 real time saver when you already know which tool you're
                 looking for; a full Codex rollout-file scan alone can run
                 past a minute on a loaded machine.

Matches the folder exactly, or as a path prefix — pointing at a parent
folder also finds sessions from every subfolder underneath it.

Every result's "title" field is a real display name, not just its session
id: Codex uses its agent_nickname (or thread title) from state_5.sqlite;
Claude Code uses the session's own slug.`);
  process.exit(0);
}

function normalize(p) {
  // NOTE (found 2026-10-08): some Codex thread cwd values in state_5.sqlite
  // carry a Windows long-path prefix (`\\?\C:\...`), confirmed via a real
  // query against the live DB - without stripping it, those threads would
  // never match a plain `C:\...` target even when the real folder is
  // identical. Strip \\?\ (and the rarer \\?\UNC\ form) before any other
  // normalization.
  let s = p.replace(/^\\\\\?\\UNC\\/, '\\\\').replace(/^\\\\\?\\/, '');
  return s.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

const target = normalize(path.resolve(targetArg));

function matches(cwd) {
  if (!cwd) return false;
  const n = normalize(cwd);
  return n === target || n.startsWith(target + '/') || target.startsWith(n + '/');
}

function fileMTime(p) {
  try { return fs.statSync(p).mtime; } catch { return null; }
}

function truncate(s, n) {
  if (!s) return s;
  const oneLine = String(s).replace(/\s+/g, ' ').trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + '…' : oneLine;
}

const results = [];

// ---------- Claude Code ----------
// Scans one Claude-Code-config-root's projects/ tree. `configDirLabel` is
// "<home>" for the default os.homedir()-based root, or the actual
// CLAUDE_CONFIG_DIR path for an additional root passed via --config-dir —
// recorded on each result so a housecat session (isolated via a custom
// CLAUDE_CONFIG_DIR) is distinguishable from a default-root session.
function scanClaudeCodeRoot(configRoot, configDirLabel) {
  const projectsDir = path.join(configRoot, 'projects');
  if (!fs.existsSync(projectsDir)) return;
  for (const dir of fs.readdirSync(projectsDir)) {
    const dirPath = path.join(projectsDir, dir);
    let stat;
    try { stat = fs.statSync(dirPath); } catch { continue; }
    if (!stat.isDirectory()) continue;
    let files;
    try { files = fs.readdirSync(dirPath); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const fullPath = path.join(dirPath, f);
      let cwd = null;
      let title = null;
      try {
        // NOTE (found + fixed 2026-10-08, real measurement on a real
        // machine): this used to be `fs.readFileSync(fullPath,
        // {encoding:'utf8'}).slice(0, 8000)` - reading and UTF-8-decoding
        // the ENTIRE file before slicing. Real Claude Code session files on
        // this machine run 30-280MB (confirmed: one live session file was
        // 281,640,104 bytes). Reading full file content just to look at the
        // first 8KB was the dominant cost of a default sesh-hound run -
        // measured 16.3s for Claude Code alone vs. 0.8s for Codex (already
        // fixed) and 0.3s for VS Code Copilot. Switched to a bounded
        // fs.openSync/readSync read (same technique the Codex file-walk
        // fallback already used below) - only the first 8KB is ever read
        // off disk, regardless of file size.
        const fh = fs.openSync(fullPath, 'r');
        const rawBuf = Buffer.alloc(8000);
        const bytesRead = fs.readSync(fh, rawBuf, 0, 8000, 0);
        fs.closeSync(fh);
        const buf = rawBuf.slice(0, bytesRead).toString('utf8');
        const m = buf.match(/"cwd":"([^"]*)"/);
        if (m) cwd = m[1].replace(/\\\\/g, '\\');
        const slugM = buf.match(/"slug":"([^"]*)"/);
        if (slugM) title = slugM[1];
      } catch { continue; }
      if (matches(cwd)) {
        results.push({
          tool: 'claude-code',
          sessionId: f.replace(/\.jsonl$/, ''),
          title: title ? truncate(title, 70) : null,
          cwd,
          file: fullPath,
          mtime: fileMTime(fullPath),
          configDir: configDirLabel,
        });
      }
    }
  }
}

function scanClaudeCode() {
  scanClaudeCodeRoot(path.join(HOME, '.claude'), '<home>');
  for (const dir of configDirs) {
    scanClaudeCodeRoot(path.resolve(dir), dir);
  }
}

// ---------- Codex ----------
// Fast path: query ~/.codex/state_5.sqlite's own `threads` table directly
// (id, cwd, title, agent_nickname, updated_at, archived) via the `sqlite3`
// CLI — one indexed query against a table the Codex app-server daemon
// already maintains, instead of a recursive walk reading every rollout
// .jsonl file's first 4KB off disk. cwd matching stays in JS (same
// `matches()` used everywhere else) since the prefix-or-parent logic isn't
// a simple SQL LIKE in both directions; the DB read itself is the real
// time saved. Returns null (not []) on any failure so the caller can fall
// back cleanly — a `null` means "didn't work," not "found nothing."
// Resolves the real absolute path to the sqlite3 executable once. Plain
// `execFileSync('sqlite3', ...)` throws ENOENT on Windows for some real
// installs (confirmed: a WinGet-Links-shim install where `where sqlite3`
// resolves fine via cmd.exe's own PATH search, but Node's CreateProcess
// call without a shell does not find it the same way) even though the
// executable genuinely exists and is directly invocable once you have its
// real path. Resolving via `where` (Windows) / `command -v` (else) once
// and calling THAT absolute path directly avoids needing `shell: true` at
// all for the real sqlite3 invocation - no shell-escaping caveats, no
// deprecation warning, same reliability.
let _sqlite3Path;
function resolveSqlite3() {
  if (_sqlite3Path !== undefined) return _sqlite3Path;
  try {
    // A plain fixed string through execSync (not an args array through
    // execFileSync+shell:true) avoids Node's args-array-with-shell
    // deprecation warning entirely - "sqlite3" here is a hardcoded
    // literal, never interpolated input, so a plain shell string is safe.
    const cmd = process.platform === 'win32' ? 'where sqlite3' : 'command -v sqlite3';
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    _sqlite3Path = out.split('\n')[0].trim() || null;
  } catch (e) {
    _sqlite3Path = null;
  }
  return _sqlite3Path;
}

// A SECOND real, separate Codex-local database exists on some real installs:
// ~/.codex/sqlite/codex-dev.db's `local_thread_catalog` table, with a real
// `display_title` column holding the genuine human-assigned/UI-shown thread
// title (confirmed on a real machine: for one thread this returned the
// agent's actual full real identity string, far better than state_5.sqlite's
// bare `agent_nickname`/raw-first-message `title`). It is NOT comprehensive
// (confirmed: 43 total rows machine-wide vs. state_5.sqlite's hundreds, and
// only 3 of 43 real sessions for one tested folder) - a curated/opt-in
// catalog, not every session. Used here as a title ENRICHMENT pass only:
// query by the already-matched thread ids from the real state_5.sqlite scan,
// overlay display_title where this catalog has a better one, never as the
// primary source (it would silently miss most real sessions on its own).
function enrichTitlesFromCatalog(idsNeedingTitles) {
  if (!idsNeedingTitles.length) return new Map();
  const dbPath = path.join(HOME, '.codex', 'sqlite', 'codex-dev.db');
  if (!fs.existsSync(dbPath)) return new Map();
  const sqlite3Exe = resolveSqlite3();
  if (!sqlite3Exe) return new Map();
  let out;
  try {
    const idList = idsNeedingTitles.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    out = execFileSync(sqlite3Exe, ['-json', dbPath], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 10000,
      input: `SELECT thread_id, display_title FROM local_thread_catalog WHERE thread_id IN (${idList}) AND missing_candidate = 0;`,
    });
  } catch (e) {
    return new Map(); // locked, missing table, etc. - enrichment is optional, never fail the whole scan for it
  }
  const map = new Map();
  try {
    for (const row of JSON.parse(out || '[]')) {
      if (row.thread_id && row.display_title) map.set(row.thread_id, row.display_title);
    }
  } catch (e) { /* malformed output - skip enrichment, not fatal */ }
  return map;
}

function scanCodexViaSqlite() {
  const dbPath = path.join(HOME, '.codex', 'state_5.sqlite');
  if (!fs.existsSync(dbPath)) return null;
  const sqlite3Exe = resolveSqlite3();
  if (!sqlite3Exe) return null; // sqlite3 not installed/not on PATH - fall back
  let out;
  try {
    // NOTE (found + fixed 2026-10-08, real debugging on a real machine, not
    // assumed): passing the SQL string AND a custom `-separator '\x1f'` as
    // CLI argv elements through a shell (an earlier, now-removed fix for
    // the ENOENT issue above) silently mangled the non-printable separator
    // character and/or the semicolon-terminated SQL string - confirmed via
    // "Error: in prepare, incomplete input" on a real run. Fixed by moving
    // the SQL to stdin (`input:` option - never touches argv/shell quoting
    // at all) and using `-json` output instead of any custom separator,
    // which sidesteps character-escaping entirely by producing real JSON.
    out = execFileSync(sqlite3Exe, ['-json', dbPath], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 15000,
      input: 'SELECT id, cwd, title, agent_nickname, updated_at, archived FROM threads;',
    });
  } catch (e) {
    return null; // DB locked, schema changed, etc. - fall back
  }
  let rows;
  try {
    rows = JSON.parse(out || '[]');
  } catch (e) {
    return null; // unexpected output shape - fall back rather than guess
  }
  const matchedRows = [];
  for (const row of rows) {
    if (!row.id || !row.cwd) continue;
    if (!matches(row.cwd)) continue;
    matchedRows.push(row);
  }
  // Enrichment pass: ask codex-dev.db for a better display_title for every
  // matched id in one batched query, not one query per row.
  const catalogTitles = enrichTitlesFromCatalog(matchedRows.map(r => r.id));
  for (const row of matchedRows) {
    const nickname = row.agent_nickname && String(row.agent_nickname).trim();
    const catalogTitle = catalogTitles.get(row.id);
    const displayTitle = catalogTitle || nickname || row.title || null;
    results.push({
      tool: 'codex',
      sessionId: row.id,
      title: displayTitle ? truncate(displayTitle, 70) : null,
      cwd: row.cwd,
      file: null, // sqlite fast path doesn't resolve the rollout file path - id is the real key
      mtime: row.updated_at ? new Date(Number(row.updated_at) * 1000) : null,
      archived: row.archived === 1 || row.archived === '1',
      source: 'sqlite',
    });
  }
  return matchedRows.length; // count, so the caller can log how many this path found
}

// Slow path: the original recursive rollout-file walk. Kept as the real
// fallback for when sqlite3 isn't available - never the only path, since
// not every machine running this tool will have the sqlite3 CLI installed.
function scanCodexViaFileWalk() {
  const sessionsDir = path.join(HOME, '.codex', 'sessions');
  if (!fs.existsSync(sessionsDir)) return;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.jsonl')) {
        let cwd = null;
        let title = null;
        const nameMatch = e.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
        const sessionId = nameMatch ? nameMatch[1] : e.name.replace(/\.jsonl$/, '');
        try {
          const fh = fs.openSync(full, 'r');
          const buf = Buffer.alloc(4096);
          const bytes = fs.readSync(fh, buf, 0, 4096, 0);
          fs.closeSync(fh);
          const text = buf.slice(0, bytes).toString('utf8');
          const cwdM = text.match(/"cwd":"([^"]*)"/);
          if (cwdM) cwd = cwdM[1].replace(/\\\\/g, '\\');
        } catch { continue; }
        if (matches(cwd)) {
          results.push({
            tool: 'codex',
            sessionId: sessionId || path.basename(full),
            title: null, // file-walk path doesn't have a cheap source for this - sqlite path does
            cwd,
            file: full,
            mtime: fileMTime(full),
            source: 'file-walk',
          });
        }
      }
    }
  }
  walk(sessionsDir);
}

function scanCodex() {
  const sqliteMatched = scanCodexViaSqlite();
  if (sqliteMatched === null && !jsonOut) {
    console.error('  (sqlite3 CLI unavailable or state_5.sqlite missing — falling back to a full rollout-file scan, slower)');
  }
  if (sqliteMatched === null) scanCodexViaFileWalk();
}

// ---------- VS Code Copilot Chat (Code + Code - Insiders, any OS) ----------
function vscodeConfigDirs() {
  // Real, OS-specific config roots — checked for existence, never assumed.
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
    return [path.join(appData, 'Code'), path.join(appData, 'Code - Insiders')];
  }
  if (process.platform === 'darwin') {
    const base = path.join(HOME, 'Library', 'Application Support');
    return [path.join(base, 'Code'), path.join(base, 'Code - Insiders')];
  }
  // Linux and other XDG-compliant systems
  const base = process.env.XDG_CONFIG_HOME || path.join(HOME, '.config');
  return [path.join(base, 'Code'), path.join(base, 'Code - Insiders')];
}

function scanVSCodeCopilot() {
  for (const configDir of vscodeConfigDirs()) {
    const variant = path.basename(configDir);
    const wsStorageDir = path.join(configDir, 'User', 'workspaceStorage');
    if (!fs.existsSync(wsStorageDir)) continue;
    for (const hash of fs.readdirSync(wsStorageDir)) {
      const hashDir = path.join(wsStorageDir, hash);
      const wsJsonPath = path.join(hashDir, 'workspace.json');
      let folderPath = null;
      try {
        const wsJson = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
        const uri = wsJson.folder || wsJson.workspace;
        if (uri && uri.startsWith('file:///')) {
          folderPath = decodeURIComponent(uri.replace('file:///', ''));
          if (process.platform === 'win32') {
            // file:///c%3A/... decodes to c:/... on Windows; other OSes
            // don't have a drive letter to worry about.
            folderPath = folderPath.replace(/^([a-zA-Z])%3A/i, '$1:');
          } else {
            folderPath = '/' + folderPath;
          }
          if (folderPath.endsWith('.code-workspace')) folderPath = path.dirname(folderPath);
        }
      } catch { continue; }
      if (!matches(folderPath)) continue;
      const chatSessionsDir = path.join(hashDir, 'chatSessions');
      if (!fs.existsSync(chatSessionsDir)) continue;
      for (const f of fs.readdirSync(chatSessionsDir)) {
        if (!/\.jsonl?$/.test(f)) continue;
        const full = path.join(chatSessionsDir, f);
        results.push({
          tool: `vscode-copilot (${variant})`,
          sessionId: f.replace(/\.jsonl?$/, ''),
          title: null,
          cwd: folderPath,
          file: full,
          mtime: fileMTime(full),
        });
      }
    }
  }
}

if (!harnessFilter || harnessFilter === 'claude-code') scanClaudeCode();
if (!harnessFilter || harnessFilter === 'codex') scanCodex();
if (!harnessFilter || harnessFilter === 'vscode-copilot') scanVSCodeCopilot();

results.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

if (jsonOut) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`🐕 sesh-hound sniffing: ${targetArg}${harnessFilter ? ` (harness: ${harnessFilter})` : ''}\n`);
  if (results.length === 0) {
    console.log('  Nothing here — no scent trail from this folder.');
  }
  for (const r of results) {
    const mtimeStr = r.mtime ? r.mtime.toISOString() : 'unknown';
    const titleStr = r.title ? ` — "${r.title}"` : '';
    console.log(`  [${r.tool}] ${r.sessionId}${titleStr}  (last active: ${mtimeStr})`);
    console.log(`      cwd:  ${r.cwd}`);
    if (r.configDir && r.configDir !== '<home>') console.log(`      configDir: ${r.configDir}`);
    if (r.archived) console.log(`      archived: yes`);
    if (r.file) console.log(`      file: ${r.file}`);
  }
  console.log(`\n${results.length} session${results.length === 1 ? '' : 's'} found.`);
}
