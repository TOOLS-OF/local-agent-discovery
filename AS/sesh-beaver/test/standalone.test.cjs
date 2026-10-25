'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const {
  preflight,
  digest,
  assertNativeSource,
  run,
} = require('../../sesh-stork/lib/codex-standalone.cjs');
const { main } = require('../bin/sesh-beaver.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sesh-beaver-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('sesh-beaver-test-'));
    fs.rmSync(resolved, { recursive: true });
  });
  const tape = path.join(root, 'source.jsonl'),
    id = '00000000-0000-7000-8000-000000000001';
  fs.writeFileSync(
    tape,
    JSON.stringify({
      type: 'session_meta',
      payload: {
        id,
        source: {
          subagent: { thread_spawn: { parent_thread_id: 'original-parent' } },
        },
        thread_source: 'subagent',
      },
    }) + '\n',
  );
  return {
    codex: process.execPath,
    home: root,
    cwd: root,
    sourceTape: tape,
    evidence: path.join(root, 'evidence'),
    sourceId: id,
    sourceSha256: digest(tape),
    title: 'Standalone canary',
    strategy: 'native-fork-new-id',
    disposition: 'standalone',
    acceptNewIdentity: true,
    quiescence: {
      sourceId: id,
      status: 'idle',
      owner: 'test',
      evidence: 'synthetic inactive fixture',
      observedAt: new Date().toISOString(),
      offlineSource: true,
    },
  };
}
test('preserves provenance without rewriting source', (t) => {
  const r = fixture(t),
    before = fs.readFileSync(r.sourceTape);
  const p = preflight(r, 'prepare');
  assert.equal(p.originalThreadSource, 'subagent');
  assert.equal(p.originalParent, 'original-parent');
  assert.equal(p.sameIdConversionSupported, false);
  assert.deepEqual(fs.readFileSync(r.sourceTape), before);
});
test('requires deliberate new identity', (t) => {
  const r = fixture(t);
  r.acceptNewIdentity = false;
  assert.throws(() => preflight(r, 'repair'), /acceptance/);
});
test('refuses changed source', (t) => {
  const r = fixture(t);
  fs.appendFileSync(r.sourceTape, '{}\n');
  assert.throws(() => preflight(r, 'prepare'), /changed/);
});
test('rejects incorrect source ID', (t) => {
  const r = fixture(t);
  r.sourceId = '00000000-0000-7000-8000-000000000002';
  assert.throws(() => preflight(r, 'prepare'), /identity mismatch/);
});
test('rejects active or stale quiescence', (t) => {
  const r = fixture(t);
  r.quiescence.status = 'active';
  assert.throws(() => preflight(r, 'repair'), /quiescence/);
  r.quiescence.status = 'idle';
  r.quiescence.observedAt = new Date(Date.now() - 600000).toISOString();
  assert.throws(() => preflight(r, 'repair'), /quiescence/);
});
test('offline base dependencies are never silently dropped', (t) => {
  const r = fixture(t);
  const row = JSON.parse(fs.readFileSync(r.sourceTape));
  row.payload.history_base = { thread_id: 'excluded' };
  fs.writeFileSync(r.sourceTape, JSON.stringify(row) + '\n');
  r.sourceSha256 = digest(r.sourceTape);
  assert.throws(() => preflight(r, 'prepare'), /dependency closure/);
});
test('prepare requires inactive source disposition', (t) => {
  const r = fixture(t);
  r.quiescence.offlineSource = false;
  assert.throws(() => preflight(r, 'prepare'), /offline source/);
});
test('rejects relative source path', (t) => {
  const r = fixture(t);
  r.sourceTape = 'relative.jsonl';
  assert.throws(() => preflight(r, 'prepare'), /Absolute/);
});
test('registry check and unknown operation refusal', async () => {
  assert.equal((await main(['check'])).registryValid, true);
  await assert.rejects(main(['raw-sql']), /Unregistered/);
  await assert.rejects(main(['check', 'extra']), /Unregistered/);
});
test('same-ID different native tape cannot supply false provenance', (t) => {
  const r = fixture(t),
    other = path.join(r.home, 'other.jsonl');
  fs.copyFileSync(r.sourceTape, other);
  assert.throws(
    () => assertNativeSource({ id: r.sourceId, path: other }, r),
    /differs/,
  );
  assert.doesNotThrow(() =>
    assertNativeSource({ id: r.sourceId, path: r.sourceTape }, r),
  );
});
test('repair requires exact completed boundary', (t) => {
  const r = fixture(t);
  assert.throws(() => preflight(r, 'repair'), /lastTurnId/);
  r.lastTurnId = '00000000-0000-7000-8000-000000000003';
  r.quiescence.status = 'completed-boundary';
  assert.equal(preflight(r, 'repair').phase, 'repair');
});
function ledger(t, changes = {}) {
  const r = fixture(t),
    { DatabaseSync } = require('node:sqlite'),
    file = path.join(r.home, 'operation.sqlite'),
    db = new DatabaseSync(file);
  const result = {
    destinationId: r.sourceId,
    sourceId: r.sourceId,
    visibility: {
      cwd: r.cwd,
      path: r.sourceTape,
      title: r.title,
      interactiveListed: true,
      interactiveTitleSearchListed: true,
    },
    ...changes,
  };
  db.exec(
    'CREATE TABLE operation (singleton INTEGER PRIMARY KEY,state TEXT,result_json TEXT)',
  );
  db.prepare('INSERT INTO operation VALUES (1,?,?)').run(
    'acceptance-incomplete',
    JSON.stringify(result),
  );
  db.close();
  return {
    ...r,
    evidence: r.home,
    destinationId: r.sourceId,
    model: 'synthetic',
    parentTurnId: r.sourceId,
    acceptCommissioning: true,
    listing: {
      id: r.sourceId,
      title: r.title,
      method: 'codex_app.list_threads',
    },
  };
}
test('uncertain commissioning intent prevents another turn', async (t) => {
  const r = ledger(t, { commissioningRequested: true });
  await assert.rejects(run('activate', r), /already requested/);
});
test('accept refuses concurrent operation before mutation', async (t) => {
  const r = ledger(t);
  fs.writeFileSync(path.join(r.evidence, 'operation.lock'), 'owned test');
  const before = digest(path.join(r.evidence, 'operation.sqlite'));
  await assert.rejects(run('accept', r), /EEXIST/);
  assert.equal(digest(path.join(r.evidence, 'operation.sqlite')), before);
});
test('invalid audit cannot partially accept an operation', async (t) => {
  const r = ledger(t);
  r.audits = [{ subject: 'incomplete' }];
  const before = digest(path.join(r.evidence, 'operation.sqlite'));
  await assert.rejects(run('accept', r), /Incomplete bounded/);
  assert.equal(digest(path.join(r.evidence, 'operation.sqlite')), before);
});
test('desktop acceptance is stored transactionally', async (t) => {
  const r = ledger(t);
  const result = await run('accept', r);
  assert.equal(result.state, 'desktop-api-listed-native-title-search-verified');
  assert.equal(result.desktopListing.renderedTitleSearchVerified, false);
  assert.equal(fs.existsSync(path.join(r.evidence, 'operation.lock')), false);
});
test('cleanup rejects an unrelated existing directory', async (t) => {
  const r = fixture(t),
    { cleanup } = require('../lib/cleanup.cjs');
  await assert.rejects(
    cleanup({ outputs: [r.home], dryRun: true }),
    /Only qualification/,
  );
  assert.equal(fs.existsSync(r.sourceTape), true);
});
test('cleanup requires fresh attributed runtime independence', () => {
  const { assertQuiescence } = require('../lib/cleanup.cjs');
  assert.throws(
    () =>
      assertQuiescence({ owner: 'test', observedAt: new Date().toISOString() }),
    /runtime independence/,
  );
  assert.doesNotThrow(() =>
    assertQuiescence({
      owner: 'test',
      observedAt: new Date().toISOString(),
      runtimeIndependent: true,
      evidence:
        'Owned RPC processes awaited exit; no external registrations or known consumers',
    }),
  );
});
test('backup reservation cannot overwrite existing destination', (t) => {
  const r = fixture(t),
    { reserveBackup } = require('../lib/cleanup.cjs');
  const before = fs.readFileSync(r.sourceTape);
  assert.throws(() => reserveBackup(r.sourceTape), /EEXIST/);
  assert.deepEqual(fs.readFileSync(r.sourceTape), before);
});
