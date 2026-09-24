#!/usr/bin/env node
/**
 * sesh-hound — progressive address-book discovery for local agent sessions.
 *
 * Codex discovery uses the indexed native state database when available and
 * falls back to rollout-file scanning only when that index is unavailable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { CodexNativeState, normalize, pathMatches, fileMTime } = require('../../../lib/codex-native-state.cjs');

const HOME = os.homedir();
const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const helpFlag = args.includes('--help') || args.includes('-h');
const dbIndex = args.indexOf('--codex-db');
const codexDbArg = dbIndex >= 0 ? args[dbIndex + 1] : null;
const depthIndex = args.indexOf('--depth');
const depthArg = depthIndex >= 0 ? Number(args[depthIndex + 1]) : 1;
const claudeDepthIndex = args.indexOf('--claude-depth');
const claudeDepthArg = claudeDepthIndex >= 0 ? Number(args[claudeDepthIndex + 1]) : 2;

if (!Number.isInteger(claudeDepthArg) || claudeDepthArg < 0) {
  throw new Error('--claude-depth must be a non-negative integer.');
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

if (helpFlag) {
  console.log(`sesh-hound — address book for local agent sensing

Usage:
  sesh-hound [cwd] [--json]
  sesh-hound --by-title <name> [--json]
  sesh-hound --subagents <id-or-name> [--depth N] [--json]
  sesh-hound --codex-native-subagents [id-or-name] [--depth N] [--json]
  sesh-hound --codex-repair-report [id-or-name] [--depth N] [--json]
  sesh-hound [cwd] [--claude-depth N] [--json]
  sesh-hound --codex-db <path> ...

Discovery depth:
  folder       Fast cross-harness session index by working directory.
  title        Resolve a human/agent title, name, or nickname.
  subagents    Resolve a parent by UUID or name, then list native children.
  native       Codex-only alias for subagents; useful when proving the
               current Codex parent/child graph.
  repair       Read-only manifest mapping historical child IDs to candidate
               native control IDs without claiming recovery.

Claude tape-closet depth:
  --claude-depth N  Search N levels below each ~/.claude/projects tape closet
                    (default: 2; 0 keeps the historical direct-file scan).

Codex uses the newest ~/.codex/state_*.sqlite by default. The indexed database
avoids recursively opening every rollout file; --codex-db overrides it.

Related tools:
  sesh-falcon   launch or resume a named agent
  sesh-name     resolve an agent's own instruction identity
  sesh-nautilus reconstruct dropped compaction boundaries
  sesh-stork    deliver a session artifact to another harness`);
  process.exit(0);
}

function findPositional() {
  const skipped = new Set(['--json', '--help', '-h', '--by-title', '--subagents',
    '--codex-native-subagents', '--codex-repair-report', '--codex-db', '--depth',
    '--claude-depth']);
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (skipped.has(arg)) {
      if (['--by-title', '--subagents', '--codex-native-subagents', '--codex-repair-report', '--codex-db', '--depth', '--claude-depth'].includes(arg)) index += 1;
      continue;
    }
    if (!arg.startsWith('-')) values.push(arg);
  }
  return values[0] || process.cwd();
}

let mode = 'by-cwd';
let queryArg = findPositional();
if (args.includes('--by-title')) {
  mode = 'by-title';
  queryArg = valueAfter('--by-title');
} else if (args.includes('--subagents')) {
  mode = 'subagents';
  queryArg = valueAfter('--subagents');
} else if (args.includes('--codex-native-subagents')) {
  mode = 'native-subagents';
  queryArg = valueAfter('--codex-native-subagents');
} else if (args.includes('--codex-repair-report')) {
  mode = 'repair-report';
  queryArg = valueAfter('--codex-repair-report');
}

class HarnessDiscovery {
  extractCwd(filePath) {
    try {
      const text = fs.readFileSync(filePath).slice(0, 8000).toString('utf8');
      const match = text.match(/"cwd":"([^"]*)"/);
      return match ? match[1].replace(/\\\\/g, '\\') : null;
    } catch { return null; }
  }

  extractTitle(filePath) {
    try {
      const text = fs.readFileSync(filePath, 'utf8').slice(0, 8000);
      const match = text.match(/"(?:slug|display_title|title)":"([^"]*)"/);
      return match ? match[1] : null;
    } catch { return null; }
  }
}

class ClaudeDiscovery extends HarnessDiscovery {
  constructor(depth = 2) {
    super();
    this.depth = depth;
    this._files = null;
  }

  projectsRoot() {
    return process.env.SESH_HOUND_CLAUDE_PROJECTS
      || path.join(HOME, '.claude', 'projects');
  }

  files() {
    if (this._files) return this._files;
    const root = this.projectsRoot();
    if (!fs.existsSync(root)) return [];
    const files = [];
    const skipDirectories = new Set(['compaction-summaries', 'tool-results']);
    const walk = (directory, depth) => {
      let entries;
      try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        } else if (entry.isDirectory() && depth < this.depth && !skipDirectories.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
      }
    };

    let projects;
    try { projects = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
    for (const project of projects) {
      if (project.isDirectory()) walk(path.join(root, project.name), 0);
    }
    this._files = files;
    return files;
  }

  tapeCloset(filePath) {
    const relative = path.relative(this.projectsRoot(), filePath);
    const [closet] = relative.split(path.sep);
    return closet || null;
  }

  tapeDepth(filePath) {
    const relative = path.relative(this.projectsRoot(), filePath);
    const segments = relative.split(path.sep).filter(Boolean);
    return Math.max(0, segments.length - 2);
  }

  dedupeSessions(results) {
    const sessions = new Map();
    for (const result of results) {
      const key = `${result.tool}:${result.sessionId}`;
      const previous = sessions.get(key);
      if (!previous) {
        sessions.set(key, result);
        continue;
      }

      const previousTime = new Date(previous.mtime || 0).getTime();
      const currentTime = new Date(result.mtime || 0).getTime();
      const winner = currentTime >= previousTime ? result : previous;
      winner.duplicateCount = (previous.duplicateCount || 1) + 1;
      winner.duplicateFiles = [...new Set([
        ...(previous.duplicateFiles || [previous.file]),
        ...(result.duplicateFiles || [result.file]),
      ])];
      winner.duplicateTapeClosets = [...new Set([
        ...(previous.duplicateTapeClosets || [previous.tapeCloset].filter(Boolean)),
        ...(result.duplicateTapeClosets || [result.tapeCloset].filter(Boolean)),
      ])];
      sessions.set(key, winner);
    }
    return [...sessions.values()];
  }

  byCwd(target) {
    return this.dedupeSessions(this.files().flatMap(file => {
      const cwd = this.extractCwd(file);
      return cwd && pathMatches(cwd, target) ? [{
        sessionId: path.basename(file, '.jsonl'), title: this.extractTitle(file), cwd,
        file, tool: 'claude-code', mtime: fileMTime(file),
        tapeCloset: this.tapeCloset(file), tapeDepth: this.tapeDepth(file),
      }] : [];
    }));
  }

  byTitle(query) {
    const needle = String(query || '').toLowerCase();
    return this.dedupeSessions(this.files().flatMap(file => {
      const title = this.extractTitle(file);
      return title && title.toLowerCase().includes(needle) ? [{
        sessionId: path.basename(file, '.jsonl'), title, cwd: this.extractCwd(file),
        file, tool: 'claude-code', mtime: fileMTime(file),
        tapeCloset: this.tapeCloset(file), tapeDepth: this.tapeDepth(file),
      }] : [];
    }));
  }

  legacySubagents(query) {
    const needle = String(query || '').toLowerCase();
    return this.dedupeSessions(this.files().flatMap(file => {
      const sessionId = path.basename(file, '.jsonl');
      const title = this.extractTitle(file);
      if (needle && sessionId.toLowerCase() !== needle && !(title || '').toLowerCase().includes(needle)) return [];
      try {
        const text = fs.readFileSync(file, 'utf8').slice(0, 10 * 1024 * 1024);
        const match = text.match(/"environments":\s*{[^}]*"subagents":\s*"([^"]*)"/);
        if (!match) return [];
        const subagents = [];
        for (const line of match[1].replace(/\\n/g, '\n').split('\n')) {
          const item = line.match(/^\s*-\s+([a-fA-F0-9-]+)(?::\s+(.+))?$/);
          if (item) subagents.push({ id: item[1], name: item[2] ? item[2].trim() : null });
        }
        return subagents.length ? [{ tool: 'claude-code', sessionId, title, file,
          tapeCloset: this.tapeCloset(file), tapeDepth: this.tapeDepth(file), subagents }] : [];
      } catch { return []; }
    }));
  }
}

class VSCodeDiscovery extends HarnessDiscovery {
  configDirs() {
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
      return [path.join(appData, 'Code'), path.join(appData, 'Code - Insiders')];
    }
    if (process.platform === 'darwin') {
      const base = path.join(HOME, 'Library', 'Application Support');
      return [path.join(base, 'Code'), path.join(base, 'Code - Insiders')];
    }
    const base = process.env.XDG_CONFIG_HOME || path.join(HOME, '.config');
    return [path.join(base, 'Code'), path.join(base, 'Code - Insiders')];
  }

  byCwd(target) {
    const results = [];
    for (const configDir of this.configDirs()) {
      const storageRoot = path.join(configDir, 'User', 'workspaceStorage');
      if (!fs.existsSync(storageRoot)) continue;
      for (const workspace of fs.readdirSync(storageRoot, { withFileTypes: true })) {
        if (!workspace.isDirectory()) continue;
        const workspaceDir = path.join(storageRoot, workspace.name);
        let folderPath;
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'workspace.json'), 'utf8'));
          const uri = manifest.folder || manifest.workspace;
          if (!uri || !uri.startsWith('file:///')) continue;
          folderPath = decodeURIComponent(uri.slice('file:///'.length));
          if (folderPath.endsWith('.code-workspace')) folderPath = path.dirname(folderPath);
        } catch { continue; }
        if (!pathMatches(folderPath, target)) continue;
        const sessionsDir = path.join(workspaceDir, 'chatSessions');
        if (!fs.existsSync(sessionsDir)) continue;
        for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
          if (!entry.isFile() || !/\.jsonl?$/.test(entry.name)) continue;
          const file = path.join(sessionsDir, entry.name);
          results.push({
            sessionId: path.basename(entry.name).replace(/\.jsonl?$/, ''),
            cwd: folderPath, file, tool: 'vscode-copilot', mtime: fileMTime(file),
          });
        }
      }
    }
    return results;
  }
}

class CodexDiscovery extends HarnessDiscovery {
  constructor(dbPath) {
    super();
    this.state = new CodexNativeState({ dbPath });
  }

  byCwd(target) {
    if (this.state.dbPath) {
      try {
        return this.state.listThreadsByCwd(target).map(thread => ({
          ...thread, sessionId: thread.threadId,
          title: thread.title || thread.name || thread.agentNickname,
          file: thread.rolloutPath || null, tool: 'codex', mtime: thread.updatedAt,
        }));
      } catch { /* use the rollout fallback below */ }
    }
    return this.rolloutFiles().flatMap(file => {
      const cwd = this.extractCwd(file);
      return cwd && pathMatches(cwd, target) ? [{
        sessionId: this.sessionId(file), cwd, file, tool: 'codex', mtime: fileMTime(file),
      }] : [];
    });
  }

  byTitle(query) {
    if (!this.state.dbPath) return [];
    try {
      return this.state.listThreadsByTitle(query).map(thread => ({
        ...thread, sessionId: thread.threadId,
        title: thread.title || thread.name || thread.agentNickname,
        file: thread.rolloutPath || null, tool: 'codex', mtime: thread.updatedAt,
      }));
    } catch { return []; }
  }

  nativeSubagents(query, target, depth) {
    if (!this.state.dbPath) return [];
    try {
      return this.state.listNativeSubagents(query, target, depth).map(parent => ({
        ...parent, tool: 'codex-native',
        children: parent.children.map(child => ({
          ...child, sessionId: child.threadId,
          title: child.title || child.name || child.agentNickname,
        })),
      }));
    } catch { return []; }
  }

  repairReport(query, target, depth) {
    if (!this.state.dbPath) return null;
    try {
      return this.state.repairReport(query, target, depth);
    } catch { return null; }
  }

  legacySubagents(query) {
    const needle = String(query || '').toLowerCase();
    return this.rolloutFiles().flatMap(file => {
      const sessionId = this.sessionId(file);
      if (needle && sessionId.toLowerCase() !== needle) return [];
      try {
        const text = fs.readFileSync(file, 'utf8').slice(0, 10 * 1024 * 1024);
        const match = text.match(/"environments":\s*{[^}]*"subagents":\s*"([^"]*)"/);
        if (!match) return [];
        const subagents = [];
        for (const line of match[1].replace(/\\n/g, '\n').split('\n')) {
          const item = line.match(/^\s*-\s+([a-fA-F0-9-]+)(?::\s+(.+))?$/);
          if (item) subagents.push({ id: item[1], name: item[2] ? item[2].trim() : null });
        }
        return subagents.length ? [{ tool: 'codex-rollout', sessionId, file, subagents }] : [];
      } catch { return []; }
    });
  }

  rolloutFiles() {
    const root = path.join(HOME, '.codex', 'sessions');
    if (!fs.existsSync(root)) return [];
    const files = [];
    const walk = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.name.endsWith('.jsonl')) files.push(fullPath);
      }
    };
    try { walk(root); } catch { return []; }
    return files;
  }

  sessionId(file) {
    return path.basename(file).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1]
      || path.basename(file, '.jsonl');
  }
}

function printHuman(results, label, query) {
  console.log(`🐕 sesh-hound sensing (${label}): ${query || '(current folder)'}\n`);
  if (results.length === 0) console.log('  Nothing sensed.');
  for (const result of results) {
    console.log(`  [${result.tool}] ${result.sessionId || result.threadId}${result.mtime ? `  (last active: ${new Date(result.mtime).toISOString()})` : ''}`);
    if (result.title) console.log(`      title: ${result.title}`);
    if (result.agentNickname) console.log(`      nickname: ${result.agentNickname}`);
    if (result.cwd) console.log(`      cwd:   ${result.cwd}`);
    if (result.file) console.log(`      file:  ${result.file}`);
    if (result.tapeCloset) console.log(`      tape:  ${result.tapeCloset} (depth ${result.tapeDepth})`);
    if (result.duplicateCount > 1) {
      console.log(`      duplicates: ${result.duplicateCount} copies; newest tape selected`);
      if (result.duplicateTapeClosets?.length) console.log(`      copies: ${result.duplicateTapeClosets.join(', ')}`);
    }
    if (result.subagents) {
      console.log('      legacy subagents:');
      for (const subagent of result.subagents) {
        console.log(`        - ${subagent.name || subagent.id}`);
      }
    }
    if (result.children) {
      console.log('      native children:');
      for (const child of result.children) {
        console.log(`        - ${child.agentNickname || child.name || child.sessionId} (${child.sessionId}) [${child.edgeStatus}]`);
        if (child.title) console.log(`          title: ${child.title}`);
        if (child.depth > 1) console.log(`          depth: ${child.depth}`);
      }
    }
  }
  console.log(`\n${results.length} result${results.length === 1 ? '' : 's'} sensed.`);
}

function printRepairHuman(report, query) {
  console.log(`🐕 sesh-hound read-only repair report: ${query || '(current folder)'}\n`);
  console.log(`  control plane: ${report.controlPlane.service} (${report.controlPlane.status})`);
  console.log(`  database evidence: ${report.evidence.edgeRows} child edge row${report.evidence.edgeRows === 1 ? '' : 's'}`);
  for (const parent of report.parents) {
    console.log(`  parent: ${parent.name || parent.title || parent.threadId}`);
    console.log(`    id: ${parent.threadId}`);
    for (const child of parent.children) {
      const identity = child.agentNickname || child.name || child.title || child.threadId;
      console.log(`    - ${identity} (${child.threadId}) edge=${child.edgeStatus}, control=${child.controlStatus}`);
      if (child.model) console.log(`      model: ${child.model}`);
      if (child.historyMode) console.log(`      history: ${child.historyMode}`);
    }
  }
  console.log(`\n  ${report.controlPlane.note}`);
  console.log(`  ${report.evidence.limitation}`);
}

function run() {
  const codex = new CodexDiscovery(codexDbArg);
  if (mode === 'repair-report') {
    const report = codex.repairReport(queryArg, normalize(path.resolve(process.cwd())), depthArg);
    if (!report) throw new Error('No Codex state database found or repair report could not be read.');
    if (jsonOut) console.log(JSON.stringify(report, null, 2));
    else printRepairHuman(report, queryArg);
    return;
  }

  const claude = new ClaudeDiscovery(claudeDepthArg);
  const vscode = new VSCodeDiscovery();
  let results;
  if (mode === 'by-cwd') {
    const target = normalize(path.resolve(queryArg));
    results = [...claude.byCwd(target), ...codex.byCwd(target), ...vscode.byCwd(target)];
  } else if (mode === 'by-title') {
    results = [...claude.byTitle(queryArg), ...codex.byTitle(queryArg)];
  } else {
    results = [
      ...claude.legacySubagents(queryArg),
      ...codex.nativeSubagents(queryArg, normalize(path.resolve(process.cwd())), depthArg),
    ];
    if (results.length === 0) results = codex.legacySubagents(queryArg);
  }
  results.sort((a, b) => new Date(b.mtime || b.updatedAt || 0) - new Date(a.mtime || a.updatedAt || 0));
  if (jsonOut) console.log(JSON.stringify(results, null, 2));
  else printHuman(results, mode, queryArg);
}

try {
  run();
} catch (error) {
  if (jsonOut) console.log(JSON.stringify({ error: error.message }, null, 2));
  else console.error(`sesh-hound error: ${error.message}`);
  process.exitCode = 1;
}
