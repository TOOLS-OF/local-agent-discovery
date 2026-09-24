const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.resolve(__dirname, '..', 'bin', 'sesh-hound-extended.js');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sesh-hound-'));
const projectsRoot = path.join(tempRoot, '.claude', 'projects');
const closet = path.join(projectsRoot, 'encoded-project-closet');
const nestedCloset = path.join(closet, 'nested-agent-closet');
const ignored = path.join(closet, 'compaction-summaries');
const target = path.join(tempRoot, 'workspace');

fs.mkdirSync(nestedCloset, { recursive: true });
fs.mkdirSync(ignored, { recursive: true });
fs.mkdirSync(target, { recursive: true });

function writeTape(directory, sessionId, slug) {
  fs.writeFileSync(path.join(directory, `${sessionId}.jsonl`), `${JSON.stringify({
    cwd: target,
    slug,
  })}\n`, 'utf8');
}

writeTape(closet, '11111111-1111-4111-8111-111111111111', 'DirectTape');
writeTape(nestedCloset, '22222222-2222-4222-8222-222222222222', 'NestedTape');
writeTape(nestedCloset, '11111111-1111-4111-8111-111111111111', 'DirectTapeCopied');
writeTape(ignored, '33333333-3333-4333-8333-333333333333', 'IgnoredSummary');

function run(...args) {
  const env = {
    ...process.env,
    HOME: tempRoot,
    USERPROFILE: tempRoot,
    APPDATA: tempRoot,
    SESH_HOUND_CLAUDE_PROJECTS: projectsRoot,
  };
  const result = spawnSync(process.execPath, [cli, '--json', ...args], { env, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const deep = run(target, '--claude-depth', '2');
assert.ok(deep.some(result => result.sessionId === '11111111-1111-4111-8111-111111111111'));
const duplicate = deep.find(result => result.sessionId === '11111111-1111-4111-8111-111111111111');
assert.strictEqual(duplicate.duplicateCount, 2);
assert.strictEqual(duplicate.duplicateFiles.length, 2);
assert.strictEqual(duplicate.duplicateTapeClosets.length, 1);
const nested = deep.find(result => result.sessionId === '22222222-2222-4222-8222-222222222222');
assert.ok(nested, 'nested tape closet session should be discovered');
assert.strictEqual(nested.tapeCloset, 'encoded-project-closet');
assert.strictEqual(nested.tapeDepth, 1);
assert.ok(!deep.some(result => result.sessionId === '33333333-3333-4333-8333-333333333333'));

const shallow = run(target, '--claude-depth', '0');
assert.ok(shallow.some(result => result.sessionId === '11111111-1111-4111-8111-111111111111'));
assert.ok(!shallow.some(result => result.sessionId === '22222222-2222-4222-8222-222222222222'));

const byTitle = run('--by-title', 'NestedTape', '--claude-depth', '2');
assert.strictEqual(byTitle.length, 1);
assert.strictEqual(byTitle[0].sessionId, '22222222-2222-4222-8222-222222222222');

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('sesh-hound tape-closet discovery tests passed');
