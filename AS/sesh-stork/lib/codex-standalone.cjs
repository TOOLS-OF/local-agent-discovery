'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  cp = require('node:child_process'),
  readline = require('node:readline');
function plain(p, directory = false) {
  if (!path.isAbsolute(p)) throw Error('Absolute paths required');
  let cursor = path.resolve(p);
  while (true) {
    const s = fs.lstatSync(cursor);
    if (s.isSymbolicLink())
      throw Error('Links/reparse aliases are not accepted');
    if (
      cursor === path.resolve(p) &&
      (directory ? !s.isDirectory() : !s.isFile())
    )
      throw Error('Unexpected file type');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}
function digest(p) {
  const h = crypto.createHash('sha256'),
    fd = fs.openSync(p, 'r'),
    b = Buffer.alloc(1024 * 1024);
  try {
    let n;
    while ((n = fs.readSync(fd, b, 0, b.length, null)))
      h.update(b.subarray(0, n));
    return h.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}
function header(p) {
  const fd = fs.openSync(p, 'r'),
    b = Buffer.alloc(65536);
  try {
    const n = fs.readSync(fd, b, 0, b.length, 0),
      i = b.subarray(0, n).indexOf(10);
    if (i < 0) throw Error('First record exceeds 64KiB or lacks newline');
    const r = JSON.parse(b.subarray(0, i).toString('utf8'));
    if (r.type !== 'session_meta' || !r.payload?.id)
      throw Error('Not a native session tape');
    return r.payload;
  } finally {
    fs.closeSync(fd);
  }
}
function assertNativeSource(t, r) {
  if (t.id !== r.sourceId || !t.path)
    throw Error('Native source identity/path mismatch');
  const a = fs.statSync(t.path, { bigint: true }),
    b = fs.statSync(r.sourceTape, { bigint: true });
  if (a.dev !== b.dev || a.ino !== b.ino || digest(t.path) !== r.sourceSha256)
    throw Error(
      'Native source path/digest differs from supplied tape; no fork performed',
    );
}
function preflight(r, phase) {
  if (!['prepare', 'repair'].includes(phase)) throw Error('Unknown phase');
  if (
    r.disposition !== 'standalone' ||
    r.strategy !== 'native-fork-new-id' ||
    r.acceptNewIdentity !== true
  )
    throw Error(
      'Explicit standalone/new native ID acceptance required; same-ID conversion unsupported',
    );
  for (const key of ['codex', 'home', 'cwd', 'sourceTape', 'evidence'])
    if (typeof r[key] !== 'string' || !path.isAbsolute(r[key]))
      throw Error(`Absolute ${key} required`);
  plain(r.codex);
  plain(r.home, true);
  if (fs.existsSync(r.cwd)) plain(r.cwd, true);
  else {
    if (!r.createWorkspace)
      throw Error('Missing cwd without explicit createWorkspace');
    plain(path.dirname(r.cwd), true);
  }
  plain(r.sourceTape);
  if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > 200)
    throw Error('Explicit bounded title required');
  if (
    !/^[0-9a-f-]{36}$/i.test(r.sourceId) ||
    !/^[0-9a-f]{64}$/.test(r.sourceSha256)
  )
    throw Error('Source identity/digest required');
  const stat = fs.statSync(r.sourceTape);
  if (stat.size > 2 * 1024 ** 3)
    throw Error('Source exceeds explicit 2GiB limit');
  const h = header(r.sourceTape);
  if (h.id !== r.sourceId) throw Error('Source identity mismatch');
  if (phase === 'prepare' && h.history_base)
    throw Error(
      'Offline history_base dependency closure is not supported by this adapter; use verified native source repair instead',
    );
  if (digest(r.sourceTape) !== r.sourceSha256)
    throw Error('Source changed or incorrect digest');
  const q = r.quiescence,
    now = Date.now();
  if (
    !q ||
    q.sourceId !== r.sourceId ||
    !['idle', 'completed-boundary'].includes(q.status) ||
    !q.owner ||
    !q.evidence ||
    !Number.isFinite(Date.parse(q.observedAt)) ||
    now - Date.parse(q.observedAt) > 300000 ||
    now < Date.parse(q.observedAt)
  )
    throw Error(
      'Fresh external quiescence/completed-boundary assertion required (<=5min); this is not a writer lock',
    );
  if (phase === 'prepare' && (!q.offlineSource || q.status !== 'idle'))
    throw Error('Prepare requires inactive offline source assertion');
  if (
    phase === 'repair' &&
    (typeof r.lastTurnId !== 'string' || !/^[0-9a-f-]{36}$/i.test(r.lastTurnId))
  )
    throw Error(
      'Repair requires an explicit completed lastTurnId; native fork rejects in-progress boundaries',
    );
  return {
    phase,
    sourceId: h.id,
    sourceSha256: r.sourceSha256,
    bytes: stat.size,
    originalSource: h.source ?? null,
    originalThreadSource: h.thread_source ?? null,
    originalParent: h.source?.subagent?.thread_spawn?.parent_thread_id ?? null,
    historyBase: h.history_base ?? null,
    sameIdConversionSupported: false,
    strategy: r.strategy,
    desktopVisibility: 'unverified',
    quiescence: q,
  };
}
class Rpc {
  constructor(r) {
    this.id = 0;
    this.pending = new Map();
    this.completed = new Map();
    this.p = cp.spawn(r.codex, ['app-server', '--stdio'], {
      cwd: r.cwd,
      env: { ...process.env, CODEX_HOME: r.home },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.p.stderr.resume();
    this.rl = readline.createInterface({ input: this.p.stdout });
    this.rl.on('line', (line) => {
      let v;
      try {
        v = JSON.parse(line);
      } catch {
        return;
      }
      if (v.method === 'turn/completed')
        this.completed.set(v.params.turn.id, v.params.turn);
      const w = this.pending.get(v.id);
      if (w) {
        clearTimeout(w.timer);
        this.pending.delete(v.id);
        v.error
          ? w.reject(Error(JSON.stringify(v.error)))
          : w.resolve(v.result);
      }
    });
    this.p.on('error', (e) => this.fail(e));
    this.p.on('exit', () => this.fail(Error('App-server exited')));
  }
  fail(e) {
    for (const w of this.pending.values()) {
      clearTimeout(w.timer);
      w.reject(e);
    }
    this.pending.clear();
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id,
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(Error(`RPC timeout: ${method}`));
        }, 60000);
      this.pending.set(id, { resolve, reject, timer });
      this.p.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async init() {
    await this.call('initialize', {
      clientInfo: {
        name: 'sesh_beaver',
        title: 'Explicit standalone delivery',
        version: '0.1.0',
      },
      capabilities: { experimentalApi: true },
    });
    this.p.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  }
  async waitTurn(id) {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (this.completed.has(id)) return this.completed.get(id);
      if (this.p.exitCode !== null)
        throw Error('Server exited during commissioning');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error(
      'Commissioning completion not observed within 60s; recorded turn must be reconciled, not repeated',
    );
  }
  async close() {
    this.fail(Error('Client closed'));
    this.rl.close();
    this.p.stdin.end();
    if (this.p.exitCode === null) {
      this.p.kill();
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 3000);
        this.p.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }
}
async function listContains(rpc, id, title, sourceKinds) {
  let cursor = null;
  for (let page = 0; page < 100; page++) {
    const r = await rpc.call('thread/list', {
      limit: 100,
      cursor,
      ...(title ? { searchTerm: title } : {}),
      ...(sourceKinds ? { sourceKinds } : {}),
    });
    if (r.data.some((t) => t.id === id)) return true;
    if (!r.nextCursor) return false;
    cursor = r.nextCursor;
  }
  throw Error('Listing bound exceeded; acceptance incomplete');
}
async function verify(rpc, id, title) {
  const { thread: t } = await rpc.call('thread/read', {
    threadId: id,
    includeTurns: false,
  });
  const listed = await listContains(rpc, id, null, ['cli', 'vscode']);
  const named = await listContains(rpc, id, title, ['cli', 'vscode']);
  const extracted = t.preview?.slice(0, 32);
  const historical = extracted
    ? await listContains(rpc, id, extracted, ['cli', 'vscode'])
    : false;
  return {
    id: t.id,
    source: t.source,
    threadSource: t.threadSource,
    parentThreadId: t.parentThreadId,
    forkedFromId: t.forkedFromId,
    path: t.path,
    cwd: t.cwd,
    title: t.name,
    interactiveListed: listed,
    interactiveTitleSearchListed: named,
    historicalTitleSearchListed: historical,
    searchSemantics:
      'Requested name and historical preview are queried independently; neither proves desktop sidebar rendering',
    desktopSidebarVerified: false,
  };
}
async function run(verb, r) {
  if (verb === 'accept') {
    for (const a of r.audits ?? []) {
      if (
        !a.subject ||
        !a.owner ||
        !a.issue ||
        !a.instructionReceived ||
        !a.finding ||
        !a.causeEvidence ||
        !a.correction
      )
        throw Error('Incomplete bounded instruction audit');
    }
    plain(r.evidence, true);
    const file = path.join(r.evidence, 'operation.sqlite');
    plain(file);
    const lockfile = path.join(r.evidence, 'operation.lock'),
      lock = fs.openSync(lockfile, 'wx');
    const { DatabaseSync } = require('node:sqlite'),
      db = new DatabaseSync(file);
    try {
      db.exec('BEGIN IMMEDIATE');
      const row = db.prepare('SELECT * FROM operation WHERE singleton=1').get(),
        result = JSON.parse(row.result_json);
      if (
        r.listing?.id !== result.destinationId ||
        r.listing.title !== result.visibility.title ||
        r.listing.method !== 'codex_app.list_threads'
      )
        throw Error('Exact desktop API listing/identity/title required');
      result.desktopListing = {
        ...r.listing,
        renderedSidebarVerified: false,
        renderedTitleSearchVerified: false,
      };
      if (
        !result.visibility.interactiveListed ||
        !result.visibility.interactiveTitleSearchListed
      )
        throw Error('Native requested-name acceptance not met');
      result.state = 'desktop-api-listed-native-title-search-verified';
      db.prepare(
        'UPDATE operation SET state=?,result_json=? WHERE singleton=1',
      ).run(result.state, JSON.stringify(result));
      db.exec(
        'CREATE TABLE IF NOT EXISTS instruction_audit (subject TEXT PRIMARY KEY, current_json TEXT NOT NULL)',
      );
      for (const a of r.audits ?? []) {
        if (
          !a.subject ||
          !a.owner ||
          !a.issue ||
          !a.instructionReceived ||
          !a.finding ||
          !a.causeEvidence ||
          !a.correction
        )
          throw Error('Incomplete bounded instruction audit');
        db.prepare(
          'INSERT INTO instruction_audit VALUES (?,?) ON CONFLICT(subject) DO UPDATE SET current_json=excluded.current_json',
        ).run(a.subject, JSON.stringify(a));
      }
      db.exec('COMMIT');
      return {
        state: result.state,
        destinationId: result.destinationId,
        desktopListing: result.desktopListing,
      };
    } finally {
      if (db.isTransaction) db.exec('ROLLBACK');
      db.close();
      fs.closeSync(lock);
      fs.unlinkSync(lockfile);
    }
  }
  if (verb === 'activate') {
    if (r.acceptCommissioning !== true || !r.model || !r.parentTurnId)
      throw Error(
        'Explicit bounded commissioning/model/delegated-turn attribution required',
      );
    for (const [p, d] of [
      [r.codex, false],
      [r.home, true],
      [r.cwd, true],
      [r.evidence, true],
    ])
      plain(p, d);
    const file = path.join(r.evidence, 'operation.sqlite');
    plain(file);
    const lockfile = path.join(r.evidence, 'operation.lock'),
      lock = fs.openSync(lockfile, 'wx'),
      { DatabaseSync } = require('node:sqlite'),
      db = new DatabaseSync(file);
    let rpc;
    try {
      const row = db.prepare('SELECT * FROM operation WHERE singleton=1').get(),
        result = JSON.parse(row.result_json);
      if (
        !result.destinationId ||
        result.destinationId !== r.destinationId ||
        result.visibility?.cwd
          .replaceAll('\\', '/')
          .replace(/^\/\/\?\//, '')
          .toLowerCase() !== r.cwd.replaceAll('\\', '/').toLowerCase()
      )
        throw Error('Recorded destination/cwd mismatch');
      if (result.commissioningTurnId || result.commissioningRequested)
        throw Error(
          'Commissioning already requested; reconcile its recorded turn instead of repeating',
        );
      const save = () =>
        db
          .prepare(
            'UPDATE operation SET state=?,result_json=? WHERE singleton=1',
          )
          .run(result.state, JSON.stringify(result));
      rpc = new Rpc(r);
      await rpc.init();
      const resumed = await rpc.call('thread/resume', {
        threadId: r.destinationId,
        excludeTurns: true,
      });
      const actual = fs.statSync(resumed.thread.path, { bigint: true }),
        recorded = fs.statSync(result.visibility.path, { bigint: true });
      if (
        resumed.thread.id !== result.destinationId ||
        actual.dev !== recorded.dev ||
        actual.ino !== recorded.ino ||
        resumed.thread.forkedFromId !== result.sourceId ||
        resumed.thread.parentThreadId ||
        !['cli', 'vscode'].includes(resumed.thread.source)
      )
        throw Error(
          'Native commissioning target store/path/classification mismatch',
        );
      if (resumed.thread.status?.type === 'active')
        throw Error('Destination already active');
      result.commissioningRequested = true;
      result.state = 'commissioning-request-uncertain';
      save();
      const started = await rpc.call('turn/start', {
        threadId: r.destinationId,
        model: r.model,
        parentTurnId: r.parentTurnId,
        turnTrigger: 'agent',
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
        environments: [],
        input: [
          {
            type: 'text',
            text: `${r.title}: Victor authorized giving this historical subagent an intentionally independent, visible session. This is delegated migration commissioning from OTTOBOT-00Q. You are native fork ${r.destinationId} of source ${result.sourceId}, not the original writer or the ancestor Meridian coordinator. Your new cwd is ${r.cwd}. Original review task and routing remain with the original chat; do not resume backlog, use tools, access files/credentials, contact agents, spawn, or perform product work. Reply with one short acknowledgment of the new identity and await coordinator assignment.`,
            text_elements: [],
          },
        ],
      });
      result.commissioningTurnId = started.turn.id;
      result.state = 'commissioning-requested';
      save();
      const turn = await rpc.waitTurn(started.turn.id);
      result.commissioning = {
        id: turn.id,
        status: turn.status,
        model: r.model,
        parentTurnId: r.parentTurnId,
        reply:
          turn.items
            ?.filter((x) => x.type === 'agentMessage')
            .map((x) => x.text?.slice(0, 1500))
            .join('\n') ?? '',
      };
      result.visibility = await verify(rpc, r.destinationId, r.title);
      result.state =
        turn.status === 'completed' &&
        result.visibility.interactiveListed &&
        result.visibility.interactiveTitleSearchListed
          ? 'native-verified-desktop-pending'
          : 'acceptance-incomplete';
      save();
      return result;
    } finally {
      if (rpc) await rpc.close();
      db.close();
      fs.closeSync(lock);
      fs.unlinkSync(lockfile);
    }
  }
  if (verb === 'diagnose') {
    plain(r.home, true);
    const file = path.join(r.home, 'state_5.sqlite');
    plain(file);
    const { DatabaseSync } = require('node:sqlite'),
      db = new DatabaseSync(file, { readOnly: true });
    try {
      const allowed = [
          'id',
          'source',
          'thread_source',
          'archived',
          'has_user_event',
          'name',
          'title',
          'agent_nickname',
          'rollout_path',
          'cwd',
          'forked_from_id',
        ],
        columns = db
          .prepare('PRAGMA table_info(threads)')
          .all()
          .map((x) => x.name)
          .filter((x) => allowed.includes(x));
      return (
        db
          .prepare(`SELECT ${columns.join(',')} FROM threads WHERE id=?`)
          .get(r.destinationId) ?? { missing: true }
      );
    } finally {
      db.close();
    }
  }
  if (verb === 'inspect') {
    plain(r.codex);
    plain(r.home, true);
    plain(r.cwd, true);
    plain(r.sourceTape);
    if (fs.statSync(r.sourceTape).size > 2 * 1024 ** 3)
      throw Error('Source exceeds 2GiB limit');
    const h = header(r.sourceTape);
    if (h.id !== r.sourceId) throw Error('Source ID mismatch');
    const rpc = new Rpc(r);
    try {
      await rpc.init();
      const { thread: t } = await rpc.call('thread/read', {
        threadId: r.sourceId,
        includeTurns: false,
      });
      const turns = await rpc.call('thread/turns/list', {
        threadId: r.sourceId,
        limit: 1,
        itemsView: 'notLoaded',
      });
      return {
        sourceId: h.id,
        sourceSha256: digest(r.sourceTape),
        originalSource: h.source,
        originalThreadSource: h.thread_source,
        status: t.status,
        source: t.source,
        threadSource: t.threadSource,
        parentThreadId: t.parentThreadId,
        cwd: t.cwd,
        latestTurn:
          turns.data?.map((x) => ({ id: x.id, status: x.status })) ?? [],
        observedAt: new Date().toISOString(),
      };
    } finally {
      await rpc.close();
    }
  }
  if (verb === 'preflight') return preflight(r, r.phase);
  if (verb === 'verify') {
    plain(r.codex);
    plain(r.home, true);
    plain(r.cwd, true);
    const rpc = new Rpc(r);
    try {
      await rpc.init();
      return await verify(rpc, r.destinationId, r.title);
    } finally {
      await rpc.close();
    }
  }
  if (!['prepare', 'repair'].includes(verb))
    throw Error('Unregistered delivery verb');
  if (typeof r.evidence !== 'string' || !path.isAbsolute(r.evidence))
    throw Error('Absolute evidence path required');
  const preflightResult = preflight(r, verb);
  // The ledger is current operation state; it contains no append-only narrative.
  const { DatabaseSync } = require('node:sqlite');
  const key = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...r, quiescence: undefined }))
    .digest('hex');
  const exists = fs.existsSync(r.evidence);
  if (exists) {
    plain(r.evidence, true);
    plain(path.join(r.evidence, 'operation.sqlite'));
  } else {
    plain(path.dirname(r.evidence), true);
    fs.mkdirSync(r.evidence);
  }
  const db = new DatabaseSync(path.join(r.evidence, 'operation.sqlite'));
  db.exec(
    'CREATE TABLE IF NOT EXISTS operation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), request_key TEXT NOT NULL, state TEXT NOT NULL, result_json TEXT NOT NULL)',
  );
  let rpc, lock;
  const lockfile = path.join(r.evidence, 'operation.lock');
  try {
    lock = fs.openSync(lockfile, 'wx');
    const previous = db
      .prepare('SELECT * FROM operation WHERE singleton=1')
      .get();
    if (previous) {
      if (previous.request_key !== key)
        throw Error('Evidence directory belongs to a different request');
      if (
        previous.state.startsWith('native-') ||
        previous.state === 'desktop-api-listed-native-title-search-verified'
      ) {
        const result = JSON.parse(previous.result_json);
        rpc = new Rpc(r);
        await rpc.init();
        result.visibility = await verify(rpc, result.destinationId, r.title);
        result.state =
          result.visibility.interactiveListed &&
          result.visibility.title === r.title
            ? result.visibility.interactiveTitleSearchListed
              ? result.desktopListing?.id === result.destinationId
                ? 'desktop-api-listed-native-title-search-verified'
                : 'native-verified-desktop-pending'
              : 'native-listed-requested-search-pending'
            : 'acceptance-incomplete';
        db.prepare(
          'UPDATE operation SET state=?,result_json=? WHERE singleton=1',
        ).run(result.state, JSON.stringify(result));
        if (
          !result.state.startsWith('native-') &&
          result.state !== 'desktop-api-listed-native-title-search-verified'
        )
          throw Error(
            'Existing destination no longer visible; no replacement fork created',
          );
        return result;
      }
      throw Error(
        'Prior incomplete operation: inspect ledger; never automatically refork',
      );
    }
    const p = preflightResult;
    let result = {
      ...p,
      state: 'staged',
      destinationId: null,
      rollback:
        'Original identity/tape unchanged. New fork may depend on original lineage. No automatic archive/delete: these APIs cascade to descendants.',
    };
    const save = () =>
      db
        .prepare(
          'INSERT INTO operation VALUES (1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET state=excluded.state,result_json=excluded.result_json',
        )
        .run(key, result.state, JSON.stringify(result));
    save();
    const snapshot = path.join(r.evidence, path.basename(r.sourceTape));
    fs.copyFileSync(r.sourceTape, snapshot, fs.constants.COPYFILE_EXCL);
    if (
      digest(snapshot) !== r.sourceSha256 ||
      digest(r.sourceTape) !== r.sourceSha256
    )
      throw Error('Source writer raced snapshot; no fork performed');
    result.preservedTape = snapshot;
    save();
    if (!fs.existsSync(r.cwd)) {
      fs.mkdirSync(r.cwd);
      fs.writeFileSync(
        path.join(r.cwd, 'AGENTS.md'),
        `# Standalone restored session\n\nThis workspace belongs to an intentionally independent native fork of source ${r.sourceId}, not its historical parent or the ancestor Meridian coordinator. The current source/destination mapping and immutable source snapshot are in ${r.evidence}/operation.sqlite. No old backlog is a new task. Await the authorized coordinator's assignment. Current user/harness instructions govern. Original source parentage is provenance; no reparenting occurred. Product resources, source hooks and credentials have not been installed here.\n`,
        { flag: 'wx' },
      );
      result.createdWorkspace = r.cwd;
      save();
    }
    rpc = new Rpc(r);
    await rpc.init();
    if (verb === 'repair') {
      const { thread: t } = await rpc.call('thread/read', {
        threadId: r.sourceId,
        includeTurns: false,
      });
      assertNativeSource(t, r);
    }
    if (digest(r.sourceTape) !== r.sourceSha256)
      throw Error('Source changed before fork; refused');
    // Native session delivery belongs to stork. Beaver never rewrites native source/lineage.
    result.state = 'fork-requested';
    save();
    const fork = await rpc.call('thread/fork', {
      threadId: r.sourceId,
      ...(verb === 'prepare'
        ? { path: snapshot }
        : { lastTurnId: r.lastTurnId }),
      cwd: r.cwd,
      runtimeWorkspaceRoots: [r.cwd],
      threadSource: 'user',
      excludeTurns: true,
    });
    result.destinationId = fork.thread.id;
    result.state = 'forked';
    save();
    if (result.destinationId === r.sourceId)
      throw Error('Native fork did not allocate a new identity');
    await rpc.call('thread/name/set', {
      threadId: result.destinationId,
      name: r.title,
    });
    result.visibility = await verify(rpc, result.destinationId, r.title);
    if (
      result.visibility.parentThreadId ||
      result.visibility.forkedFromId !== r.sourceId ||
      !['cli', 'vscode'].includes(result.visibility.source)
    )
      throw Error(
        'Native standalone classification/ancestry mismatch; inspect recorded fork',
      );
    result.sourceUnchanged = digest(r.sourceTape) === r.sourceSha256;
    result.state =
      result.visibility.interactiveListed &&
      result.visibility.title === r.title &&
      (verb === 'repair' || result.sourceUnchanged)
        ? result.visibility.interactiveTitleSearchListed
          ? 'native-verified-desktop-pending'
          : 'native-listed-requested-search-pending'
        : 'acceptance-incomplete';
    save();
    await rpc.call('thread/unsubscribe', { threadId: result.destinationId });
    if (!result.state.startsWith('native-'))
      throw Error(
        'Fork recorded, but visibility/source acceptance incomplete; inspect operation.sqlite',
      );
    return result;
  } finally {
    if (rpc) await rpc.close();
    if (lock !== undefined) {
      fs.closeSync(lock);
      fs.unlinkSync(lockfile);
    }
    db.close();
  }
}
module.exports = {
  run,
  preflight,
  header,
  digest,
  Rpc,
  verify,
  assertNativeSource,
  plain,
};
