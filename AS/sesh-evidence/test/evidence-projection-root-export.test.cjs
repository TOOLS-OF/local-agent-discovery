const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const path = require('node:path');
const Module = require('node:module');

const direct = require('../lib/evidence-projection.cjs');
const originalLoad = Module._load;
let acornPropertyReads = 0;
const testOnlyAcornPlaceholder = new Proxy(
  Object.freeze({}),
  {
    get() {
      acornPropertyReads++;
      throw new Error('test-only acorn placeholder was exercised');
    },
  },
);
let root;
try {
  Module._load = function load(request, parent, isMain) {
    if (request === 'acorn') return testOnlyAcornPlaceholder;
    return originalLoad.call(this, request, parent, isMain);
  };
  root = require('..');
} finally {
  Module._load = originalLoad;
}

async function read(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

test('package root exports the direct projection API without exercising acorn', () => {
  assert.equal(root.validateEvidenceProjection, direct.validateEvidenceProjection);
  assert.equal(root.resolvePointer, direct.resolvePointer);
  assert.equal(root.leafPointers, direct.leafPointers);
  assert.equal(root.CONFIG_VERSION, direct.CONFIG_VERSION);
  assert.equal(acornPropertyReads, 0);
});

test('root export and direct module produce identical alpha and beta results', async () => {
  for (const name of ['projection-alpha', 'projection-beta']) {
    const baseDir = path.join(__dirname, 'fixtures', name);
    const config = await read(path.join(baseDir, 'config.json'));
    const rootResult = await root.validateEvidenceProjection(config, { baseDir });
    const directResult = await direct.validateEvidenceProjection(config, {
      baseDir,
    });
    assert.deepEqual(rootResult, directResult);
    assert.equal(rootResult.passed, true, JSON.stringify(rootResult));
  }
  assert.equal(acornPropertyReads, 0);
});

test('published contract describes the exported version and null semantics', async () => {
  const contract = await read(
    path.join(__dirname, '..', 'lib', 'evidence-projection-contract.json'),
  );
  assert.equal(contract.config.schema, root.CONFIG_VERSION);
  assert.match(contract.gap, /explicit-null/);
  assert.match(contract.failure, /does not throw/);
  assert.equal(acornPropertyReads, 0);
});
