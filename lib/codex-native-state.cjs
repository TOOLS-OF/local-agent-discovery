const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalize(value) {
  let normalized = String(value || '').replace(/\\/g, '/');
  normalized = normalized.replace(/^\/\/\?\//, '');
  return normalized.replace(/\/+$/, '').toLowerCase();
}

function pathMatches(cwd, target) {
  const left = normalize(cwd);
  const right = normalize(target);
  if (!left || !right) return false;
  return left === right || left.startsWith(right + '/') || right.startsWith(left + '/');
}

function fileMTime(filePath) {
  try { return fs.statSync(filePath).mtime; } catch { return null; }
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toDate(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Date(number < 100000000000 ? number * 1000 : number);
}

class CodexNativeState {
  constructor(options = {}) {
    this.dbPath = this.findDb(options.dbPath);
    this.cache = new Map();
  }

  findDb(override) {
    const candidates = [];
    if (override) candidates.push(path.resolve(override));
    if (process.env.CODEX_STATE_DB) candidates.push(path.resolve(process.env.CODEX_STATE_DB));

    const codexHome = path.join(HOME, '.codex');
    try {
      for (const entry of fs.readdirSync(codexHome, { withFileTypes: true })) {
        if (entry.isFile() && /^state_[^/\\]+\.sqlite$/i.test(entry.name)) {
          candidates.push(path.join(codexHome, entry.name));
        }
      }
    } catch { /* report no database through the public result */ }
    candidates.push(path.join(codexHome, 'sqlite', 'codex-dev.db'));

    const existing = [...new Set(candidates)].filter(candidate => {
      try { return fs.statSync(candidate).isFile(); } catch { return false; }
    });
    existing.sort((a, b) => fileMTime(b) - fileMTime(a));
    return existing[0] || null;
  }

  query(sql, params = []) {
    const key = `${this.dbPath}\0${sql}\0${JSON.stringify(params)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.dbPath) throw new Error('No Codex state database found.');

    let rows;
    let cliError;
    try {
      const { execFileSync } = require('child_process');
      const cliParams = [...params];
      const renderedSql = sql.replace(/\?/g, () => sqlLiteral(cliParams.shift()));
      const output = execFileSync('sqlite3', ['-readonly', '-json', this.dbPath, renderedSql], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      rows = output.trim() ? JSON.parse(output) : [];
    } catch (error) {
      cliError = error;
      try {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(this.dbPath, { readOnly: true });
        try {
          rows = db.prepare(sql).all(...params);
        } finally {
          db.close();
        }
      } catch (nodeError) {
        const message = cliError && cliError.message ? cliError.message : String(nodeError);
        throw new Error(`unable to read Codex state database: ${message}`);
      }
    }
    this.cache.set(key, rows);
    return rows;
  }

  threadRows() {
    return this.query(`
      SELECT id, rollout_path, created_at, updated_at, source, model,
             cwd, title, name, agent_nickname, agent_role, archived,
             git_branch, agent_path
      FROM threads
    `);
  }

  edgeRows() {
    return this.query(`
      SELECT e.parent_thread_id, e.child_thread_id, e.status AS edge_status,
             p.rollout_path AS parent_rollout_path, p.created_at AS parent_created_at,
             p.updated_at AS parent_updated_at, p.source AS parent_source,
             p.model AS parent_model, p.cwd AS parent_cwd, p.title AS parent_title,
             p.name AS parent_name, p.agent_nickname AS parent_agent_nickname,
             p.agent_role AS parent_agent_role, p.archived AS parent_archived,
             c.rollout_path AS child_rollout_path, c.created_at AS child_created_at,
             c.updated_at AS child_updated_at, c.source AS child_source,
             c.model AS child_model, c.cwd AS child_cwd, c.title AS child_title,
             c.name AS child_name, c.agent_nickname AS child_agent_nickname,
             c.agent_role AS child_agent_role, c.archived AS child_archived,
             c.git_branch AS child_git_branch, c.agent_path AS child_agent_path
      FROM thread_spawn_edges e
      LEFT JOIN threads p ON p.id = e.parent_thread_id
      LEFT JOIN threads c ON c.id = e.child_thread_id
      ORDER BY e.parent_thread_id, c.created_at
    `);
  }

  shapeThread(row) {
    return {
      threadId: row.id || row.thread_id || null,
      rolloutPath: row.rollout_path || null,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      source: row.source || null,
      model: row.model || null,
      cwd: row.cwd || null,
      title: row.title || null,
      name: row.name || null,
      agentNickname: row.agent_nickname || null,
      agentRole: row.agent_role || null,
      archived: Boolean(row.archived),
      gitBranch: row.git_branch || null,
      agentPath: row.agent_path || null,
    };
  }

  parentFromEdge(row) {
    return this.shapeThread({
      id: row.parent_thread_id, rollout_path: row.parent_rollout_path,
      created_at: row.parent_created_at, updated_at: row.parent_updated_at,
      source: row.parent_source, model: row.parent_model, cwd: row.parent_cwd,
      title: row.parent_title, name: row.parent_name,
      agent_nickname: row.parent_agent_nickname, agent_role: row.parent_agent_role,
      archived: row.parent_archived,
    });
  }

  childFromEdge(row) {
    return this.shapeThread({
      id: row.child_thread_id, rollout_path: row.child_rollout_path,
      created_at: row.child_created_at, updated_at: row.child_updated_at,
      source: row.child_source, model: row.child_model, cwd: row.child_cwd,
      title: row.child_title, name: row.child_name,
      agent_nickname: row.child_agent_nickname, agent_role: row.child_agent_role,
      archived: row.child_archived, git_branch: row.child_git_branch,
      agent_path: row.child_agent_path,
    });
  }

  listThreadsByCwd(target) {
    return this.threadRows()
      .filter(row => pathMatches(row.cwd, target))
      .map(row => this.shapeThread(row));
  }

  listThreadsByTitle(query) {
    const needle = String(query || '').toLowerCase();
    return this.threadRows()
      .filter(row => [row.title, row.name, row.agent_nickname, row.agent_role]
        .some(value => value && String(value).toLowerCase().includes(needle)))
      .map(row => this.shapeThread(row));
  }

  resolveParentIds(query, target, edges) {
    const wanted = query ? String(query).toLowerCase() : null;
    const parentIds = new Set();
    for (const row of edges) {
      const parent = this.parentFromEdge(row);
      const idMatch = wanted && UUID_RE.test(wanted) && parent.threadId.toLowerCase() === wanted;
      const textMatch = wanted && [parent.title, parent.name, parent.agentNickname, parent.agentRole]
        .some(value => value && value.toLowerCase().includes(wanted));
      const cwdMatch = !wanted && pathMatches(parent.cwd, target);
      if (idMatch || textMatch || cwdMatch) parentIds.add(parent.threadId);
    }
    return parentIds;
  }

  listNativeSubagents(query, target, depth = 1) {
    const edges = this.edgeRows();
    const wantedDepth = Math.max(1, Number(depth) || 1);
    let frontier = this.resolveParentIds(query, target, edges);
    const roots = new Map();
    const rootFor = new Map([...frontier].map(id => [id, id]));

    for (let level = 1; level <= wantedDepth && frontier.size; level += 1) {
      const next = new Set();
      for (const row of edges) {
        if (!frontier.has(row.parent_thread_id)) continue;
        const rootId = rootFor.get(row.parent_thread_id) || row.parent_thread_id;
        if (!roots.has(rootId)) roots.set(rootId, { ...this.parentFromEdge(row), children: [] });
        roots.get(rootId).children.push({
          ...this.childFromEdge(row), edgeStatus: row.edge_status,
          parentThreadId: row.parent_thread_id, depth: level,
        });
        if (level < wantedDepth) {
          next.add(row.child_thread_id);
          rootFor.set(row.child_thread_id, rootId);
        }
      }
      frontier = next;
    }
    return [...roots.values()];
  }
}

module.exports = { CodexNativeState, normalize, pathMatches, fileMTime };
