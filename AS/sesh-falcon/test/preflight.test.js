'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const { main, parseArgs } = require('../bin/sesh-falcon.js');

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

test('parses explicit offline preflight route', () => {
  assert.deepEqual(parseArgs(['--preflight', '--config', 'expected.json']), {
    harness: 'claude-code', dryRun: false, preflight: true, config: 'expected.json'
  });
});

test('offline route emits structured diagnostics without session API or process execution', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-preflight-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp, 'target.txt'), 'synthetic\n');
  fs.writeFileSync(path.join(temp, 'expected.json'), JSON.stringify({ commands: [{
    id: 'falcon', components: [{ id: 'target', path: 'target.txt', sha256: digest('synthetic\n') }]
  }] }));
  const output = [];
  const bomb = () => { throw new Error('launch boundary must not be used'); };
  const code = await main(['--preflight', '--config', path.join(temp, 'expected.json')], {
    stdout: (line) => output.push(JSON.parse(line)), stderr: bomb,
    loadLauncher: bomb, execSync: bomb
  });
  assert.equal(code, 0);
  assert.equal(output.length, 1);
  assert.equal(output[0].mode, 'preflight');
  assert.equal(output[0].status, 'MATCH');
  assert.equal(output[0].commandExecuted, false);
  assert.equal(output[0].mutationPerformed, false);
});

test('offline route reports mismatch and still avoids launch boundaries', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-preflight-drift-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp, 'target.txt'), 'drift\n');
  fs.writeFileSync(path.join(temp, 'expected.json'), JSON.stringify({ commands: [{
    id: 'falcon', components: [{ id: 'target', path: 'target.txt', sha256: digest('expected\n') }]
  }] }));
  const output = [];
  const bomb = () => { throw new Error('launch boundary must not be used'); };
  const code = await main(['--preflight', '--config', path.join(temp, 'expected.json')], {
    stdout: (line) => output.push(JSON.parse(line)), stderr: bomb,
    loadLauncher: bomb, execSync: bomb
  });
  assert.equal(code, 1);
  assert.equal(output[0].status, 'MISMATCH');
  assert.match(output[0].commands[0].components[0].reasons.join(' '), /drift/);
});

test('Git-provenance input calls no child-process or session boundary', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-preflight-git-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp, 'target.txt'), 'synthetic\n');
  fs.writeFileSync(path.join(temp, 'expected.json'), JSON.stringify({ commands: [{
    id: 'falcon', components: [{ id: 'target', path: 'target.txt', git: {
      repository: '.', ref: 'HEAD', repoPath: 'target.txt', revision: 'synthetic', blob: 'synthetic'
    } }]
  }] }));
  const forbidden = ['spawnSync', 'execSync', 'sessionApi', 'sessionLoader', 'discovery', 'launch', 'delivery'];
  const calls = Object.fromEntries(forbidden.map((name) => [name, 0]));
  const bomb = (name) => () => { calls[name] += 1; throw new Error(`${name} boundary must not be used`); };
  const originalLoad = Module._load;
  const checker = require.resolve('../../fleet-preflight/lib/check.cjs');
  delete require.cache[checker];
  Module._load = function(request, parent, isMain) {
    if (request === 'child_process' || request === 'node:child_process') return { spawnSync: bomb('spawnSync'), execSync: bomb('execSync') };
    if (/session-(launch|discovery|delivery)|boundary-reconstruction/.test(request)) return bomb('sessionApi')();
    return originalLoad.call(this, request, parent, isMain);
  };
  t.after(() => { Module._load = originalLoad; delete require.cache[checker]; });
  const output = [];
  const code = await main(['--preflight', '--config', path.join(temp, 'expected.json')], {
    stdout: (line) => output.push(JSON.parse(line)), stderr: bomb('delivery'),
    loadLauncher: bomb('sessionLoader'), execSync: bomb('execSync'),
    discovery: bomb('discovery'), launch: bomb('launch'), delivery: bomb('delivery'), spawnSync: bomb('spawnSync')
  });
  Module._load = originalLoad;
  assert.equal(code, 1);
  assert.equal(output[0].status, 'UNKNOWN');
  assert.match(output[0].commands[0].components[0].reasons.join(' '), /child process/);
  assert.deepEqual(calls, Object.fromEntries(forbidden.map((name) => [name, 0])));
});
