const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const {
  validateEvidenceProjection,
  resolvePointer,
} = require('../lib/evidence-projection.cjs');

const fixtures = path.join(__dirname, 'fixtures');
const jsonTypes = [null, false, 7, 'text', [], {}];
async function read(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
async function fixture(t, name = 'projection-alpha') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projection-'));
  await fs.cp(path.join(fixtures, name), root, { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function write(root, name, value) {
  await fs.writeFile(path.join(root, name), JSON.stringify(value));
}
async function validate(root) {
  return validateEvidenceProjection(
    await read(path.join(root, 'config.json')),
    { baseDir: root },
  );
}

test('two public fixtures with different shapes validate', async () => {
  for (const name of ['projection-alpha', 'projection-beta']) {
    const root = path.join(fixtures, name);
    const result = await validateEvidenceProjection(
      await read(path.join(root, 'config.json')),
      { baseDir: root },
    );
    assert.equal(result.passed, true, JSON.stringify(result));
  }
});
test('RFC6901 resolves escaped object keys and array indices', () => {
  assert.equal(resolvePointer({ 'a/b': [{ '~x': 4 }] }, '#/a~1b/0/~0x'), 4);
});
test('all JSON types at config and ownership boundaries return structured results', async (t) => {
  for (const value of jsonTypes) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      const result = await validateEvidenceProjection(value);
      assert.equal(result.passed, false);
      assert.deepEqual(result.errors, ['E_CONFIG_OBJECT']);
    }
  }
  for (const value of jsonTypes) {
    if (typeof value === 'string') continue;
    const root = await fixture(t),
      mapping = await read(path.join(root, 'mapping.json'));
    mapping.entries[0].ownership = value;
    await write(root, 'mapping.json', mapping);
    const result = await validate(root);
    assert.equal(result.passed, false, JSON.stringify(value));
    assert.ok(result.errors.includes('E_ENTRY_0_TYPE:ownership'));
  }
});
test('every config member rejects absent and wrong JSON types before operations', async (t) => {
  const specs = {
    schema: 'string',
    sourceMapFile: 'string',
    targetFile: 'string',
    mappingFile: 'string',
    coverageRoots: 'array',
    gapRecords: 'array',
  };
  for (const [name, type] of Object.entries(specs)) {
    let root = await fixture(t),
      config = await read(path.join(root, 'config.json'));
    delete config[name];
    let result = await validateEvidenceProjection(config, { baseDir: root });
    assert.equal(result.passed, false);
    assert.ok(result.errors.includes(`E_CONFIG_ABSENT:${name}`));
    for (const value of jsonTypes) {
      if (
        (type === 'array' && Array.isArray(value)) ||
        (type === 'string' && typeof value === 'string')
      )
        continue;
      root = await fixture(t);
      config = await read(path.join(root, 'config.json'));
      config[name] = value;
      result = await validateEvidenceProjection(config, { baseDir: root });
      assert.equal(result.passed, false, `${name}:${JSON.stringify(value)}`);
      assert.ok(result.errors.includes(`E_CONFIG_TYPE:${name}`));
    }
  }
});
test('dangling pointer, incomplete coverage, wrong hash, conflict and ownership errors reject', async (t) => {
  const mutations = [
    async (root) => {
      const m = await read(path.join(root, 'mapping.json'));
      m.entries[0].citations = ['catalog:#/missing'];
      await write(root, 'mapping.json', m);
    },
    async (root) => {
      const m = await read(path.join(root, 'mapping.json'));
      m.entries.pop();
      await write(root, 'mapping.json', m);
    },
    async (root) => {
      const s = await read(path.join(root, 'source-map.json'));
      s.sources.catalog.sha256 = '0'.repeat(64);
      await write(root, 'source-map.json', s);
    },
    async (root) => {
      const x = await read(path.join(root, 'target.json'));
      x.projection.item.identifier = 'conflict';
      await write(root, 'target.json', x);
    },
    async (root) => {
      const m = await read(path.join(root, 'mapping.json'));
      m.entries[2].citations = ['catalog:#/catalog/0/code'];
      await write(root, 'mapping.json', m);
    },
  ];
  for (const mutate of mutations) {
    const root = await fixture(t);
    await mutate(root);
    const result = await validate(root);
    assert.equal(result.passed, false, JSON.stringify(result));
  }
});
test('explicit null gap and diagnostic constant are valid; absent and unknown differ', async (t) => {
  let root = await fixture(t),
    target = await read(path.join(root, 'target.json')),
    mapping = await read(path.join(root, 'mapping.json'));
  target.projection.label = null;
  mapping.entries[2].constant = null;
  await write(root, 'target.json', target);
  await write(root, 'mapping.json', mapping);
  assert.equal((await validate(root)).passed, true);
  root = await fixture(t);
  target = await read(path.join(root, 'target.json'));
  delete target.sourceScope.value;
  await write(root, 'target.json', target);
  let r = await validate(root);
  assert.ok(r.errors.includes('E_GAP_VALUE_ABSENT:#/sourceScope'));
  root = await fixture(t);
  target = await read(path.join(root, 'target.json'));
  target.sourceScope.value = 'unknown';
  await write(root, 'target.json', target);
  r = await validate(root);
  assert.ok(r.errors.includes('E_GAP_VALUE_NOT_NULL:#/sourceScope'));
});
test('malformed container types never throw and always return diagnostics', async (t) => {
  for (const [file, key] of [
    ['source-map.json', 'sources'],
    ['mapping.json', 'entries'],
  ])
    for (const value of jsonTypes) {
      const root = await fixture(t),
        document = await read(path.join(root, file));
      document[key] = value;
      await write(root, file, document);
      const result = await validate(root);
      assert.equal(result.passed, false, `${file}:${JSON.stringify(value)}`);
      assert.ok(result.errors.length);
    }
});
test('source, entry, gap and coverage members reject every wrong JSON type', async (t) => {
  const cases = [
    [
      'source-map.json',
      (d, v) => {
        d.sources.catalog.path = v;
      },
      'string',
    ],
    [
      'source-map.json',
      (d, v) => {
        d.sources.catalog.sha256 = v;
      },
      'string',
    ],
    [
      'mapping.json',
      (d, v) => {
        d.entries[0].targetPointer = v;
      },
      'string',
    ],
    [
      'mapping.json',
      (d, v) => {
        d.entries[0].citations = v;
      },
      'array',
    ],
    [
      'config.json',
      (d, v) => {
        d.gapRecords[0].pointer = v;
      },
      'string',
    ],
    [
      'config.json',
      (d, v) => {
        d.gapRecords[0].status = v;
      },
      'string',
    ],
    [
      'config.json',
      (d, v) => {
        d.coverageRoots[0] = v;
      },
      'string',
    ],
  ];
  for (const [file, mutate, expected] of cases)
    for (const value of jsonTypes) {
      if (
        (expected === 'string' && typeof value === 'string') ||
        (expected === 'array' && Array.isArray(value))
      )
        continue;
      const root = await fixture(t),
        document = await read(path.join(root, file));
      mutate(document, value);
      await write(root, file, document);
      const response = await validate(root);
      assert.equal(response.passed, false, `${file}:${JSON.stringify(value)}`);
      assert.ok(response.errors.length);
    }
});
