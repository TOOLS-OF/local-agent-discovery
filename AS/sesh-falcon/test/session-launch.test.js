const assert = require('assert');
const { CodexSessionLauncher, ClaudeSessionLauncher } = require('../../../lib/session-launch.js');

const codex = new CodexSessionLauncher();
const built = codex.buildLaunchCommand({
  sessionRef: '019f8db3-f1a1-7463-987d-7d6b2dd140ef',
  cwd: 'C:\\work tree',
  model: 'gpt-5.6-terra',
  reasoningEffort: 'medium',
  skipPermissions: true,
});

assert.strictEqual(
  built.command,
  'codex resume 019f8db3-f1a1-7463-987d-7d6b2dd140ef --model gpt-5.6-terra --config model_reasoning_effort=medium --cd "C:\\work tree" --dangerously-bypass-approvals-and-sandbox'
);

const deepLinkBuilt = codex.buildLaunchCommand({
  sessionRef: 'codex://threads/01a0febd-b034-7b60-a03c-e7ddf96147ec',
  cwd: 'C:\\work tree',
  model: 'gpt-5.6-terra',
  reasoningEffort: 'medium',
  skipPermissions: false,
});
assert.strictEqual(
  deepLinkBuilt.command,
  'codex resume 01a0febd-b034-7b60-a03c-e7ddf96147ec --model gpt-5.6-terra --config model_reasoning_effort=medium --cd "C:\\work tree"'
);
for (const sessionRef of [
  'not-a-session',
  '01a0febd-b034-7b60-a03c-e7ddf96147ec & unsafe',
  'codex://other/01a0febd-b034-7b60-a03c-e7ddf96147ec',
  'codex://threads/01a0febd-b034-7b60-a03c-e7ddf96147ec?extra=true',
  'codex://threads/01a0febd-b034-7b60-a03c-e7ddf96147ec/extra',
]) {
  assert.throws(
    () => codex.buildLaunchCommand({
      sessionRef, cwd: 'C:\\work', model: 'gpt-5.6-terra',
      reasoningEffort: 'medium', skipPermissions: false,
    }),
    /sessionRef|deep link/
  );
}
assert.throws(
  () => codex.buildLaunchCommand({
    sessionRef: '019f8db3-f1a1-7463-987d-7d6b2dd140ef',
    cwd: 'C:\\work', model: 'gpt-5.6-terra', skipPermissions: false,
  }),
  /reasoningEffort/
);
assert.throws(
  () => codex.buildLaunchCommand({
    sessionRef: '019f8db3-f1a1-7463-987d-7d6b2dd140ef',
    cwd: 'C:\\work', model: 'gpt-5.6-terra',
    reasoningEffort: 'medium & unsafe', skipPermissions: false,
  }),
  /reasoningEffort/
);

const claude = new ClaudeSessionLauncher();
assert.strictEqual(
  claude.buildLaunchCommand({
    sessionRef: 'session', cwd: 'C:\\work', model: 'claude-model', skipPermissions: false,
  }).command,
  'claude --resume "session" --model claude-model'
);

console.log('sesh-falcon session-launch tests passed');
