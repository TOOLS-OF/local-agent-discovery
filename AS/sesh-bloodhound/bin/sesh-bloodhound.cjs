#!/usr/bin/env node
const fs = require('node:fs').promises;
const path = require('node:path');
const { scanProvenance } = require('@tools-of/sesh-evidence');
async function main() {
  const a = {};
  const allowed = new Set([
    'tape',
    'harness',
    'out',
    'cursor',
    'mappings',
    'source-store',
    'max-bytes',
    'max-line',
    'max-events',
    'max-seconds',
  ]);
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help')) {
    console.log(
      'sesh-bloodhound --tape <JSONL> --harness codex|claude-code --out <new.json> [--cursor <prior-page.json>] [--mappings <json-array>] [--source-store <id>] [--max-bytes N] [--max-line N] [--max-events N] [--max-seconds N]\nPlain JSONL only; compressed tapes require a lossless expanded snapshot. Reports requests/results, inferences and gaps; never executes recorded commands.',
    );
    return;
  }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (
      !allowed.has(k) ||
      !argv[i].startsWith('--') ||
      !argv[i + 1] ||
      argv[i + 1].startsWith('--')
    )
      throw new Error('Unknown option or missing value: ' + argv[i]);
    a[k] = argv[++i];
  }
  if (!a.tape || !a.harness || !a.out)
    throw new Error('--tape, --harness and --out required');
  const prior = a.cursor
    ? JSON.parse(await fs.readFile(a.cursor, 'utf8'))
    : null;
  if (prior && !prior.cursor)
    throw new Error('Prior page has no continuation cursor');
  const budgets = {};
  for (const [flag, key] of [
    ['max-bytes', 'maxInputBytes'],
    ['max-line', 'maxLineBytes'],
    ['max-events', 'maxEvents'],
    ['max-seconds', 'maxSeconds'],
  ])
    if (a[flag]) budgets[key] = Number(a[flag]);
  const result = await scanProvenance(path.resolve(a.tape), {
    harness: a.harness,
    sourceStoreId: a['source-store'] || null,
    cursor: prior?.cursor,
    budgets,
    mappings: a.mappings
      ? JSON.parse(await fs.readFile(a.mappings, 'utf8'))
      : [],
  });
  await fs.mkdir(path.dirname(path.resolve(a.out)), { recursive: true });
  await fs.writeFile(a.out, JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      output: path.resolve(a.out),
      records: result.coverage.records,
      events: result.events.length,
      gaps: result.gaps.length,
      complete: result.coverage.complete,
      stopReason: result.coverage.stopReason,
      hasCursor: !!result.cursor,
    }),
  );
}
main().catch((e) => {
  console.error('sesh-bloodhound:', e.message);
  process.exitCode = 1;
});
