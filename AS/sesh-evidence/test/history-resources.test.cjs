const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs').promises,
  path = require('node:path'),
  os = require('node:os');
const {
  inspectHistory,
  planHistoryProjection,
  writeProjectionCandidate,
  expandResourcePreview,
} = require('..');
const { staticWrapperCalls } = require('../lib/static-wrapper.cjs');
const { expandTapeSnapshot } = require('..'),
  zlib = require('node:zlib');
async function folder(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sesh-dry-run-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('sesh-dry-run-'));
    assert.equal((await fs.lstat(dir)).isSymbolicLink(), false);
    for (const e of await fs.readdir(dir, { withFileTypes: true }))
      if (e.isSymbolicLink()) await fs.unlink(path.join(dir, e.name));
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}
const meta = {
  type: 'session_meta',
  payload: { id: 'native-one', cwd: 'C:/old' },
};
const boundary = (n) => ({
  type: 'compacted',
  payload: { message: 'checkpoint ' + n },
});
const message = (text) => ({
  type: 'response_item',
  payload: {
    type: 'message',
    role: 'user',
    content: [{ type: 'input_text', text }],
  },
});
async function tape(t, records) {
  const dir = await folder(t),
    file = path.join(dir, 'source.jsonl');
  await fs.writeFile(
    file,
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  return { dir, file };
}
test('two-interval candidate preserves incoming and intervening checkpoints plus native envelope', async (t) => {
  const { dir, file } = await tape(t, [
    meta,
    message('oldest'),
    boundary(1),
    message('older'),
    boundary(2),
    message('previous'),
    boundary(3),
    message('current'),
  ]);
  const page = await inspectHistory(file);
  const plan = planHistoryProjection([page], 2);
  assert.equal(plan.totalIntervals, 4);
  assert.equal(plan.candidateAllowed, true);
  assert.equal(
    plan.incomingCheckpoint.source.offset,
    page.boundaries[1].source.offset,
  );
  const output = path.join(dir, 'candidate.jsonl'),
    receipt = await writeProjectionCandidate(file, plan, output);
  const text = await fs.readFile(output, 'utf8');
  assert.ok(text.includes('native-one'));
  assert.ok(text.includes('checkpoint 2'));
  assert.ok(text.includes('checkpoint 3'));
  assert.ok(!text.includes('oldest'));
  assert.equal(receipt.bootValidated, false);
  assert.equal(receipt.executionReady, false);
  await assert.rejects(
    () => writeProjectionCandidate(file, plan, output),
    /EEXIST/,
  );
});
test('cutting across recorded tool request/result relationships is blocked', async (t) => {
  const { file } = await tape(t, [
    meta,
    { type: 'response_item', payload: { type: 'function_call', call_id: 'x' } },
    boundary(1),
    message('previous'),
    boundary(2),
    {
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: 'x' },
    },
  ]);
  const plan = planHistoryProjection([await inspectHistory(file)], 2);
  assert.equal(plan.candidateAllowed, false);
  assert.equal(plan.crossingCalls.length, 1);
});
test('settled-turn recipe explicitly excludes unfinished tail without changing source', async (t) => {
  const { file } = await tape(t, [
    meta,
    boundary(1),
    message('previous'),
    boundary(2),
    message('current'),
    { type: 'event_msg', payload: { type: 'task_complete' } },
    { type: 'event_msg', payload: { type: 'task_started' } },
    {
      type: 'response_item',
      payload: { type: 'function_call', call_id: 'pending' },
    },
  ]);
  const original = await fs.readFile(file),
    pages = [await inspectHistory(file)];
  assert.equal(planHistoryProjection(pages, 2).candidateAllowed, false);
  const settled = planHistoryProjection(pages, 2, {
    endPolicy: 'last-completed-turn',
  });
  assert.equal(settled.candidateAllowed, true);
  assert.ok(settled.excludedTailBytes > 0);
  assert.deepEqual(await fs.readFile(file), original);
});
test('projection rejects an overlapping or out-of-bounds supplied recipe', async (t) => {
  const { file, dir } = await tape(t, [meta, message('hello')]);
  const plan = planHistoryProjection([await inspectHistory(file)], 2);
  plan.ranges = [
    { start: 0, end: 1 },
    { start: 0, end: 1 },
  ];
  await assert.rejects(
    () => writeProjectionCandidate(file, plan, path.join(dir, 'bad.jsonl')),
    /overlapping/,
  );
});
test('Claude boundary maps do not imply parent-chain projection support', async (t) => {
  const { file } = await tape(t, [
    {
      type: 'system',
      subtype: 'compact_boundary',
      uuid: 'b',
      sessionId: 'claude',
    },
  ]);
  const page = await inspectHistory(file, { harness: 'claude-code' });
  const plan = planHistoryProjection([page], 2);
  assert.equal(plan.totalBoundaries, 1);
  assert.equal(plan.candidateAllowed, false);
});
test('partial history maps cannot certify interval selection', async (t) => {
  const { file } = await tape(t, [meta, boundary(1), message('tail')]);
  const page = await inspectHistory(file, { budgets: { maxEvents: 2 } });
  assert.equal(planHistoryProjection([page], 2).candidateAllowed, false);
});
async function tree(t) {
  const dir = await folder(t);
  await fs.mkdir(path.join(dir, 'source/a/b'), { recursive: true });
  for (const [p, text] of [
    ['source/top.txt', 't'],
    ['source/a/one.txt', 'one'],
    ['source/a/b/two.txt', 'two'],
  ])
    await fs.writeFile(path.join(dir, p), text);
  return {
    dir,
    source: path.join(dir, 'source'),
    destinationRoot: path.join(dir, 'not-created'),
  };
}
const selected = (p, mode, depth) => [
  {
    path: p,
    ruleId: 'example',
    extent: { mode, anchor: 'referenced-path', maxDepth: depth },
    binding: { action: 'copy', access: 'read-write' },
  },
];

test('an old result cannot close a reused call ID after the compaction cut', async (t) => {
  const request = {
      type: 'response_item',
      payload: { type: 'function_call', call_id: 'reused', name: 'Read' },
    },
    result = {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'reused',
        output: 'ok',
      },
    };
  const { file } = await tape(t, [
    meta,
    request,
    result,
    boundary(1),
    message('between'),
    boundary(2),
    request,
  ]);
  const plan = planHistoryProjection([await inspectHistory(file)], 2);
  assert.equal(plan.candidateAllowed, false);
  assert.equal(plan.pendingCalls.length, 1);
});
test('overlapping duplicate IDs block ambiguous retained results', async (t) => {
  const request = {
      type: 'response_item',
      payload: { type: 'function_call', call_id: 'duplicate', name: 'Read' },
    },
    result = {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'duplicate',
        output: 'ok',
      },
    };
  const { file } = await tape(t, [meta, boundary(1), request, request, result]);
  const plan = planHistoryProjection([await inspectHistory(file)], 2);
  assert.equal(plan.candidateAllowed, false);
  assert.equal(plan.ambiguousCalls.length, 1);
});
test('folder depth zero includes immediate files and never creates destinations', async (t) => {
  const { source, destinationRoot } = await tree(t);
  const p = await expandResourcePreview(selected(source, 'folder', 0), {
    allowedSourceRoots: [source],
    destinationRoot,
  });
  assert.deepEqual(
    p.resources
      .filter((r) => r.kind === 'file')
      .map((r) => path.basename(r.source)),
    ['top.txt'],
  );
  await assert.rejects(() => fs.stat(destinationRoot), /ENOENT/);
});
test('tree depth one reaches child files and depth two reaches grandchild files', async (t) => {
  const { source, destinationRoot } = await tree(t);
  const a = await expandResourcePreview(selected(source, 'tree', 1), {
      allowedSourceRoots: [source],
      destinationRoot,
    }),
    b = await expandResourcePreview(selected(source, 'tree', 2), {
      allowedSourceRoots: [source],
      destinationRoot,
    });
  assert.equal(a.resources.filter((r) => r.kind === 'file').length, 2);
  assert.equal(b.resources.filter((r) => r.kind === 'file').length, 3);
});
test('expansion byte bound reports a partial preview', async (t) => {
  const { source, destinationRoot } = await tree(t);
  const p = await expandResourcePreview(selected(source, 'tree', null), {
    allowedSourceRoots: [source],
    destinationRoot,
    budgets: { maxBytes: 1 },
  });
  assert.equal(p.complete, false);
  assert.ok(p.gaps.some((g) => g.kind === 'file-or-byte-budget'));
  assert.ok(p.bytes <= 1);
});
test('expansion records conflicting copy/link bindings rather than hiding them', async (t) => {
  const { source, destinationRoot } = await tree(t);
  const a = selected(path.join(source, 'top.txt'), 'explicit', 0)[0],
    b = {
      ...a,
      ruleId: 'different',
      binding: { action: 'symlink', access: 'read-only' },
    };
  const p = await expandResourcePreview([a, b], {
    allowedSourceRoots: [source],
    destinationRoot,
  });
  assert.ok(p.gaps.some((g) => g.kind === 'incompatible-resource-bindings'));
});
test('literal top-level constants improve wrapper evidence without evaluating functions', () => {
  const p = staticWrapperCalls(
    'const base="C:/office"; const file=`${base}/a.txt`; await tools.Read({file_path:file});',
  );
  assert.equal(p.calls[0].args.file_path, 'C:/office/a.txt');
  const q = staticWrapperCalls(
    'const file=process.env.SECRET; await tools.Read({file_path:file});',
  );
  assert.equal(q.calls.length, 0);
  assert.ok(q.gaps.length);
});
test('bounded lossless expansion verifies bytes and refuses overwriting existing output', async (t) => {
  const dir = await folder(t),
    source = path.join(dir, 'source.jsonl.gz'),
    output = path.join(dir, 'expanded.jsonl'),
    text = Buffer.from(JSON.stringify(meta) + '\n');
  await fs.writeFile(source, zlib.gzipSync(text));
  const receipt = await expandTapeSnapshot(source, output);
  assert.equal(receipt.lossless, true);
  assert.deepEqual(await fs.readFile(output), text);
  await assert.rejects(() => expandTapeSnapshot(source, output), /EEXIST/);
  assert.deepEqual(await fs.readFile(output), text);
});
test('decoded byte cap rejects a compressed expansion and cleans its own partial output', async (t) => {
  const dir = await folder(t),
    source = path.join(dir, 'source.gz'),
    output = path.join(dir, 'expanded');
  await fs.writeFile(source, zlib.gzipSync(Buffer.alloc(10000, 65)));
  const original = await fs.readFile(source);
  await assert.rejects(
    () =>
      expandTapeSnapshot(source, output, { budgets: { maxDecodedBytes: 100 } }),
    /budget exceeded/,
  );
  await assert.rejects(() => fs.stat(output), /ENOENT/);
  assert.deepEqual(await fs.readFile(source), original);
});
test(
  'Zstandard expansion uses runtime capability without treating compressed bytes as text',
  { skip: typeof zlib.zstdCompressSync !== 'function' },
  async (t) => {
    const dir = await folder(t),
      source = path.join(dir, 'source.zst'),
      output = path.join(dir, 'expanded'),
      text = Buffer.from('a\nb\n');
    await fs.writeFile(source, zlib.zstdCompressSync(text));
    await expandTapeSnapshot(source, output);
    assert.deepEqual(await fs.readFile(output), text);
  },
);
