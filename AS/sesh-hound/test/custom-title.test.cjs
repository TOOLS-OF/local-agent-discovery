const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('Claude discovery prefers the bounded custom-title index', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sesh-hound-title-'));
  const configRoot = path.join(fixtureRoot, 'claude-config');
  const projectRoot = path.join(configRoot, 'projects', 'encoded-office');
  const office = path.join(fixtureRoot, 'office');
  const sessionId = '00000000-0000-4000-8000-000000000001';

  fs.mkdirSync(path.join(projectRoot, sessionId), { recursive: true });
  fs.mkdirSync(office, { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, `${sessionId}.jsonl`),
    `${JSON.stringify({ cwd: office, type: 'user' })}\n`,
  );
  fs.writeFileSync(
    path.join(projectRoot, sessionId, 'custom-title.json'),
    JSON.stringify({ customTitle: 'Rabbit-0' }),
  );

  const cli = path.join(__dirname, '..', 'bin', 'sesh-hound.js');
  const run = spawnSync(
    process.execPath,
    [cli, office, '--json', '--harness', 'claude-code', '--config-dir', configRoot],
    { encoding: 'utf8' },
  );

  try {
    assert.equal(run.status, 0, run.stderr);
    const sessions = JSON.parse(run.stdout);
    const match = sessions.find((session) => session.sessionId === sessionId);
    assert.ok(match, 'expected synthetic Claude session to be discovered');
    assert.equal(match.title, 'Rabbit-0');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
