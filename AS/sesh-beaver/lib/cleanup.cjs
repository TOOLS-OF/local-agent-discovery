'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const {
  plain,
  header,
  digest,
} = require('../../sesh-stork/lib/codex-standalone.cjs');
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
      results.push({ home, alreadyAbsent: true });
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
    if (fs.existsSync(saved))
      throw Error('Backup collision; reconcile before retirement');
    plain(index);
    const source = new DatabaseSync(index, { readOnly: true });
    try {
      await backup(source, saved);
    } finally {
      source.close();
    }
    const preservedDigest = digest(saved);
    fs.rmSync(home, { recursive: true });
    results.push({
      home,
      removed: !fs.existsSync(home),
      entries,
      indexBackup: saved,
      indexSha256: preservedDigest,
    });
  }
  return { syntheticHomes: results, liveHomesTouched: false };
}
module.exports = { cleanup };
