// Polymorphic session launching: builds the exact launch command for a
// harness from explicit, required parameters - never a silent default that
// could quietly cause a broken session. Mirrors SessionDiscovery /
// boundary-reconstruction / session-delivery: one abstract concept, one
// concrete class per harness.
//
// Why every parameter here is required, not optional-with-a-default:
//
// - No permission-bypass flag -> the agent stalls on the first permission
//   prompt and never does another turn of work until a human notices and
//   clears it. Real incident, this same work session: an agent burned real
//   time stuck on an `npm list` approval prompt.
//
// - No explicit model on Claude Code -> if the harness's own default model
//   has a smaller context window than the session actually being resumed
//   (e.g. a 200k-context default resuming a session built on a 1M-context
//   model), the very first turn can trigger a compaction the smaller model
//   can't complete cleanly, stalling the session immediately.
//
// - No explicit model on Codex -> resuming with a DIFFERENT model than the
//   one currently active for that thread in the GUI can silently fork the
//   thread. Messages sent into that CLI fork never appear in the GUI the
//   user is actually looking at, and never make it into that thread's own
//   next compaction summary - a real, silent data-loss risk, not just a
//   cosmetic mismatch.
//
// config_dir isolation (added 2026-10-08):
//
// - No configDir on a hazrat-housecat (or any agent declaring config_dir:cwd_auto)
//   -> the agent inherits global ~/.claude credentials, authenticating as the
//   workspace primary account regardless of card name or CWD. Looks like a separate
//   account; shares budget. Real incident: rabbit-0 instance 75 created qlippoth
//   housecats by omitting CLAUDE_CONFIG_DIR. Victor caught via /status audit.
//
// The configDir is passed as CLAUDE_CONFIG_DIR in the returned env map, not as a
// CLI flag, because the claude CLI does not expose --config-dir. The caller must
// merge built.env into the child process environment before spawning.

class SessionLauncher {
  // params: { sessionRef?, cwd, model, skipPermissions, agentProfile?, sessionName?, configDir? }
  // Returns { command, cwd, env } where env is a map of additional env vars to set.
  // Throws if required parameters are missing or wrong type.
  buildLaunchCommand(params) { throw new Error('impl'); }

  _requireString(params, key, why) {
    const v = params[key];
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`SessionLauncher: "${key}" is required and must be a non-empty string. ${why}`);
    }
    return v;
  }

  _requireBoolean(params, key, why) {
    const v = params[key];
    if (typeof v !== 'boolean') {
      throw new Error(`SessionLauncher: "${key}" must be explicitly true or false (no default). ${why}`);
    }
    return v;
  }
}

class ClaudeSessionLauncher extends SessionLauncher {
  constructor() { super(); this.harness = 'claude-code'; }

  buildLaunchCommand(params) {
    const { sessionRef, sessionName, agentProfile, configDir } = params;

    // One of resume or new-agent is required; both can coexist (named resume).
    const isResume = typeof sessionRef === 'string' && sessionRef.length > 0;
    const isNew    = typeof agentProfile === 'string' && agentProfile.length > 0;
    if (!isResume && !isNew) {
      throw new Error(
        'SessionLauncher: either "sessionRef" (to resume an existing session) or ' +
        '"agentProfile" (to start a new named agent session) is required. ' +
        'Both can be provided together to resume a session with an explicit agent profile.'
      );
    }

    const cwd = this._requireString(params, 'cwd',
      'The working directory this session should run in - part of its own identity, not incidental.');
    const model = this._requireString(params, 'model',
      'Claude Code launches must always name the model explicitly. If the harness default has a ' +
      'smaller context window than the session was actually built on, the first turn can trigger a ' +
      'compaction the smaller model cannot complete, stalling the session on its very first action.');
    const skipPermissions = this._requireBoolean(params, 'skipPermissions',
      'Must be an explicit choice. Launching without --dangerously-skip-permissions on an unattended ' +
      'agent means it stalls at the first permission prompt and does no further work until a human notices.');

    const parts = ['claude'];
    if (isResume) parts.push('--resume', `"${sessionRef}"`);
    if (sessionName) parts.push('-n', `"${sessionName}"`);
    if (agentProfile) parts.push('--agent', agentProfile);
    parts.push('--model', model);
    if (skipPermissions) parts.push('--dangerously-skip-permissions');

    // configDir is passed via env, not CLI flag (claude has no --config-dir flag).
    // The caller must merge this into the child process env before spawning.
    const env = {};
    if (configDir) env.CLAUDE_CONFIG_DIR = configDir;

    return { command: parts.join(' '), cwd, env };
  }
}

class CodexSessionLauncher extends SessionLauncher {
  constructor() { super(); this.harness = 'codex'; }

  buildLaunchCommand(params) {
    const sessionRef = this._requireString(params, 'sessionRef',
      'The Codex session id (UUID) to resume.');
    const cwd = this._requireString(params, 'cwd',
      'The working directory this session should run in.');
    const model = this._requireString(params, 'model',
      'Codex launches must always name the model explicitly. Resuming with a DIFFERENT model than ' +
      'the one currently active for this thread in the GUI can silently fork the thread - messages ' +
      'sent into that CLI fork never appear in the GUI the user is watching, and never reach that ' +
      "thread's own next compaction summary. Verify the GUI's current model before overriding it.");
    const skipPermissions = this._requireBoolean(params, 'skipPermissions',
      'Must be an explicit choice - same stalled-on-first-prompt risk as Claude Code.');

    // Verified against real `codex resume --help` output, not assumed:
    // -m/--model, -C/--cd, --dangerously-bypass-approvals-and-sandbox.
    const parts = ['codex', 'resume', sessionRef, '--model', model, '--cd', `"${cwd}"`];
    if (skipPermissions) parts.push('--dangerously-bypass-approvals-and-sandbox');
    return { command: parts.join(' '), cwd, env: {} };
  }
}

function createSessionLauncher(harness) {
  switch (harness.toLowerCase()) {
    case 'claude-code': case 'claude': return new ClaudeSessionLauncher();
    case 'codex': return new CodexSessionLauncher();
    default: throw new Error('No SessionLauncher for harness: ' + harness);
  }
}

module.exports = {
  SessionLauncher, ClaudeSessionLauncher, CodexSessionLauncher,
  createSessionLauncher,
};
