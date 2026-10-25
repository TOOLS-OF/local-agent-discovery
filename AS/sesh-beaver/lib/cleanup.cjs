'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const {
  plain,
  header,
  digest,
} = require('../../sesh-stork/lib/codex-standalone.cjs');
function assertQuiescence(q) {
  const age = Date.now() - Date.parse(q?.observedAt);
  if (
    !q?.owner ||
    q.runtimeIndependent !== true ||
    !q.evidence ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 300000
  )
    throw Error(
      'Fresh attributed test-home runtime independence required; operation locks alone are insufficient and this assertion is not an OS lease',
    );
}
function reserveBackup(file) {
  const fd = fs.openSync(file, 'wx');
  fs.closeSync(fd);
}
function verifyBackup(file, subjectId, expected) {
  plain(file);
  const { DatabaseSync } = require('node:sqlite'),
    db = new DatabaseSync(file, { readOnly: true });
  try {
    if (Object.values(db.prepare('PRAGMA quick_check').get())[0] !== 'ok')
      throw Error('Backup integrity check failed');
    const rows = db
      .prepare(
        'SELECT id,source,thread_source,has_user_event,cwd,name,title FROM threads ORDER BY id',
      )
      .all();
    if (
      !rows.some((x) => x.id === subjectId) ||
      (expected && JSON.stringify(rows) !== JSON.stringify(expected))
    )
      throw Error('Backup relevant content mismatch');
    return rows.length;
  } finally {
    db.close();
  }
}
async function cleanup(r) {
  if (!Array.isArray(r.outputs) || r.outputs.length > 20 || !r.outputs.length)
    throw Error('Explicit bounded qualification roots required');
  const results = [];
  for (const output of r.outputs) {
    plain(output, true);
    if (path.basename(output) !== 'qualification')
      throw Error('Only qualification/test-home ownership accepted');
    const home = path.join(output, 'test-home');
    if (!fs.existsSync(home)) {
      if (r.verifyRetired) {
        const { DatabaseSync } = require('node:sqlite'),
          ledger = path.join(output, 'prepare/operation.sqlite');
        plain(ledger);
        const db = new DatabaseSync(ledger, { readOnly: true });
        let subject;
        try {
          subject = JSON.parse(
            db
              .prepare('SELECT result_json FROM operation WHERE singleton=1')
              .get().result_json,
          );
        } finally {
          db.close();
        }
        const saved = path.join(output, 'retired-test-index.sqlite');
        results.push({
          home,
          alreadyAbsent: true,
          indexBackup: saved,
          indexSha256: digest(saved),
          verifiedRows: verifyBackup(saved, subject.destinationId),
        });
      } else results.push({ home, alreadyAbsent: true });
      continue;
    }
    plain(home, true);
    if (
      fs.realpathSync(home) !== path.join(fs.realpathSync(output), 'test-home')
    )
      throw Error('Resolved target outside exact owned qualification');
    const { DatabaseSync, backup } = require('node:sqlite'),
      ledger = path.join(output, 'prepare/operation.sqlite');
    plain(ledger);
    const db = new DatabaseSync(ledger, { readOnly: true });
    let subject;
    try {
      subject = JSON.parse(
        db.prepare('SELECT result_json FROM operation WHERE singleton=1').get()
          .result_json,
      );
    } finally {
      db.close();
    }
    plain(subject.preservedTape);
    if (
      header(subject.preservedTape).originator !== 'synthetic-beaver-test' ||
      !path
        .resolve(subject.visibility.path)
        .startsWith(path.resolve(home) + path.sep)
    )
      throw Error('Not an owned synthetic test home');
    for (const name of ['prepare', 'repair', 'empty-index'])
      if (fs.existsSync(path.join(output, name, 'operation.lock')))
        throw Error('An owned operation still holds a lock');
    const pending = [home];
    let entries = 0;
    while (pending.length) {
      const item = pending.pop(),
        stat = fs.lstatSync(item);
      if (stat.isSymbolicLink() || ++entries > 10000)
        throw Error('Unsafe alias or unbounded test tree');
      if (stat.isDirectory())
        for (const name of fs.readdirSync(item))
          pending.push(path.join(item, name));
    }
    if (r.dryRun) {
      results.push({ home, entries, dryRun: true });
      continue;
    }
    const index = path.join(home, 'state_5.sqlite'),
      saved = path.join(output, 'retired-test-index.sqlite');
    assertQuiescence(r.quiescence);
    plain(index);
    const source = new DatabaseSync(index, { readOnly: true });
    let expected;
    try {
      expected = source
        .prepare(
          'SELECT id,source,thread_source,has_user_event,cwd,name,title FROM threads ORDER BY id',
        )
        .all();
      reserveBackup(saved);
      await backup(source, saved);
    } finally {
      source.close();
    }
    const verifiedRows = verifyBackup(saved, subject.destinationId, expected);
    const preservedDigest = digest(saved);
    fs.rmSync(home, { recursive: true });
    results.push({
      home,
      removed: !fs.existsSync(home),
      entries,
      indexBackup: saved,
      indexSha256: preservedDigest,
      verifiedRows,
      runtimeIndependence: r.quiescence,
    });
  }
  return { syntheticHomes: results, liveHomesTouched: false };
}
module.exports = { cleanup, assertQuiescence, reserveBackup, verifyBackup };
