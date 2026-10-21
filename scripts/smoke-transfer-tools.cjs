// Synthetic installed-package acceptance checks. Does not contact or mutate a harness.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2),
  flags = {};
for (let i = 0; i < args.length; i += 2) flags[args[i]] = args[i + 1];
for (const key of ['--prefix', '--fixtures', '--out'])
  assert.ok(flags[key], `Missing ${key}`);
const prefix = path.resolve(flags['--prefix']),
  fixtures = path.resolve(flags['--fixtures']),
  repo = path.resolve(__dirname, '..');
fs.mkdirSync(fixtures);
const checks = [];
const json = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bin = {
  bloodhound: path.join(
    prefix,
    'node_modules/sesh-bloodhound/bin/sesh-bloodhound.cjs',
  ),
  relocator: path.join(
    prefix,
    'node_modules/@tools-of/agent-relocator/bin/agent-relocator.cjs',
  ),
  nautilus: path.join(
    prefix,
    'node_modules/sesh-nautilus/bin/sesh-nautilus.js',
  ),
};
function run(tool, ...argv) {
  const result = spawnSync(process.execPath, [bin[tool], ...argv], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  checks.push({ tool, arguments: argv, status: result.status });
  return result.stdout;
}
const source = path.join(fixtures, 'source.jsonl'),
  resource = path.join(fixtures, 'work.md');
fs.writeFileSync(resource, 'fixture resource\n');
const records = [
  { type: 'session_meta', payload: { id: 'synthetic', cwd: fixtures } },
];
for (const id of ['one', 'two'])
  records.push(
    { type: 'event_msg', payload: { type: 'task_started', turn_id: id } },
    { type: 'turn_context', payload: { turn_id: id, cwd: fixtures } },
    {
      type: 'compacted',
      timestamp: id === 'one' ? '2026-01-01T00:00:01Z' : '2026-01-01T00:00:02Z',
      payload: {
        replacement_history: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'synthetic checkpoint' }],
          },
        ],
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'Read',
        call_id: id,
        arguments: JSON.stringify({ path: 'work.md' }),
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: id,
        output: '{"exit_code":0}',
      },
    },
    { type: 'event_msg', payload: { type: 'task_complete', turn_id: id } },
  );
fs.writeFileSync(source, records.map(JSON.stringify).join('\n') + '\n');
const sourceHash = sha(fs.readFileSync(source));
const page = path.join(fixtures, 'page.json');
run('bloodhound', '--tape', source, '--harness', 'codex', '--out', page);
assert.equal(load(page).coverage.complete, true);
const pages = path.join(fixtures, 'pages.json');
json(pages, [page]);
const request = path.join(fixtures, 'request.json');
json(request, {
  selection: {
    defaultAction: 'omit',
    conflicts: 'error',
    allowedSourceRoots: [fixtures],
    temporal: {
      sourceTape: fs.realpathSync(source),
      sessionId: 'synthetic',
      localAgentId: null,
      lastTurns: 1,
      completion: 'completed',
    },
    rules: [
      {
        id: 'read',
        match: {
          actionsAny: ['read'],
          actionsNone: [],
          evidence: ['explicit-tool-success'],
        },
        extent: { mode: 'folder', anchor: 'file-parent', maxDepth: 0 },
        binding: { action: 'copy' },
      },
    ],
  },
});
const selected = path.join(fixtures, 'selected.json');
run(
  'relocator',
  'select',
  '--request',
  request,
  '--pages',
  pages,
  '--out',
  selected,
);
assert.equal(load(selected).selected.length, 1);
assert.equal(load(selected).temporalWindow.turns[0].id, 'two');
const roots = path.join(fixtures, 'roots.json');
json(roots, [fixtures]);
const resources = path.join(fixtures, 'resources.json'),
  destination = path.join(fixtures, 'must-not-exist');
run(
  'relocator',
  'expand',
  '--preview',
  selected,
  '--allowed-roots',
  roots,
  '--destination-root',
  destination,
  '--out',
  resources,
);
assert.equal(fs.existsSync(destination), false);
assert.ok(load(resources).seeds.length);
const history = path.join(fixtures, 'history.json');
run('nautilus', 'inspect', '--source', source, '--out', history);
const historyPages = path.join(fixtures, 'history-pages.json');
json(historyPages, [history]);
const plan = path.join(fixtures, 'plan.json');
run(
  'nautilus',
  'plan',
  '--pages',
  historyPages,
  '--keep',
  '2',
  '--end-policy',
  'last-completed-turn',
  '--out',
  plan,
);
assert.equal(load(plan).candidateAllowed, true);
const candidate = path.join(fixtures, 'candidate.jsonl');
run(
  'nautilus',
  'project',
  '--source',
  source,
  '--plan',
  plan,
  '--out',
  candidate,
);
assert.equal(load(candidate + '.receipt.json').bootValidated, false);
const compressed = path.join(fixtures, 'source.gz'),
  decoded = path.join(fixtures, 'decoded.jsonl');
fs.writeFileSync(compressed, zlib.gzipSync(fs.readFileSync(source)));
run('relocator', 'expand-tape', '--source', compressed, '--out', decoded);
assert.equal(sha(fs.readFileSync(decoded)), sourceHash);
const target = path.join(fixtures, 'target.jsonl');
json(target, {
  type: 'user',
  uuid: 'u',
  sessionId: 'synthetic-target',
  timestamp: '2026-01-01T00:00:03Z',
  message: { role: 'user', content: 'synthetic' },
});
// The legacy format is JSONL: use one compact record, not pretty JSON.
fs.writeFileSync(target, JSON.stringify(load(target)) + '\n');
const legacy = path.join(fixtures, 'legacy.jsonl');
assert.equal(
  JSON.parse(
    run(
      'nautilus',
      '--source',
      source,
      '--target',
      target,
      '--output',
      legacy,
      '--json',
    ),
  ).insertedCount,
  2,
);
assert.equal(sha(fs.readFileSync(source)), sourceHash);
const packageChecks = [];
for (const name of [
  'sesh-evidence',
  'sesh-bloodhound',
  'agent-relocator',
  'sesh-nautilus',
]) {
  const folder = path.join(repo, 'AS', name),
    metadata = load(path.join(folder, 'package.json')),
    installed = path.join(prefix, 'node_modules', metadata.name);
  assert.equal(
    load(path.join(installed, 'package.json')).version,
    metadata.version,
  );
  const files = [];
  function walk(base) {
    for (const item of fs.readdirSync(base, { withFileTypes: true })) {
      if (['node_modules', 'test'].includes(item.name)) continue;
      const file = path.join(base, item.name);
      if (item.isDirectory()) walk(file);
      else {
        const relative = path.relative(folder, file).replace(/\\/g, '/');
        const declared =
          relative === 'package.json' ||
          relative === 'README.md' ||
          metadata.files.some(
            (entry) => relative === entry || relative.startsWith(entry + '/'),
          );
        if (!declared) continue;
        assert.ok(
          fs.existsSync(path.join(installed, relative)),
          `Declared package file missing: ${name}/${relative}`,
        );
        files.push(file);
      }
    }
  }
  walk(folder);
  for (const file of files) {
    const actual = fs.readFileSync(
        path.join(installed, path.relative(folder, file)),
      ),
      original = fs.readFileSync(file);
    const shebang =
      original.subarray(0, 2).toString() === '#!' &&
      Buffer.from(original.toString().replace('\r\n', '\n')).equals(actual);
    assert.ok(
      original.equals(actual) || shebang,
      `Installed source differs: ${file}`,
    );
    packageChecks.push({
      package: metadata.name,
      file: path.relative(folder, file),
      sourceSha256: sha(original),
      installedSha256: sha(actual),
      transform: original.equals(actual) ? 'none' : 'npm shebang line ending',
    });
  }
}
const revision = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
});
const status = spawnSync('git', ['-C', repo, 'status', '--porcelain'], {
  encoding: 'utf8',
});
json(path.resolve(flags['--out']), {
  runtime: process.version,
  sourceRevision: revision.status === 0 ? revision.stdout.trim() : null,
  sourceWorktreeDirty: status.status === 0 ? !!status.stdout.trim() : null,
  checks,
  packageChecks,
  sourceUnchanged: true,
  harnessContacted: false,
  canonicalDefault: false,
});
console.log(
  JSON.stringify({
    checks: checks.length,
    packagedFiles: packageChecks.length,
    output: flags['--out'],
  }),
);
