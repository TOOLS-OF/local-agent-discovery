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
class SessionLauncher {
  // params: { sessionRef, cwd, model, skipPermissions } - all required.
  // Returns the exact command string to run. Throws if any parameter is
  // missing or the wrong type; never fills in a default silently.
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

  // Validates params.agentName (if given) against a REAL .claude/agents/
  // folder on disk before it's ever allowed into a launch command. Real
  // incident, 2026-10-07: a relaunch used --agent hazrat-rabbit-pineapple,
  // a name that sounded right from memory but had no real spec file.
  // Claude Code does not error on an invalid --agent value - it silently
  // proceeds as something other than the intended agent. This is the same
  // "required, not a silent default" philosophy as model/skipPermissions
  // above, applied to agent identity: unverifiable is a hard error, not a
  // best-effort guess.
  _validateAgentName(agentName, cwd) {
    const fs = require('fs');
    const path = require('path');
    const agentsDir = path.join(cwd, '.claude', 'agents');
    let files;
    try {
      files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    } catch (e) {
      throw new Error(`SessionLauncher: cannot read ${agentsDir} to verify --agent "${agentName}": ${e.message}`);
    }
    if (!files.includes(`${agentName}.md`)) {
      throw new Error(
        `SessionLauncher: "${agentName}" has no real spec file at ${agentsDir}. ` +
        `Real candidates found there: ${files.join(', ') || '(none)'}. ` +
        'Refusing to build a launch command with an unverified --agent name.'
      );
    }
  }

  buildLaunchCommand(params) {
    const sessionRef = this._requireString(params, 'sessionRef',
      'The session id or full transcript path to resume.');
    const cwd = this._requireString(params, 'cwd',
      'The working directory this session should run in - part of its own identity, not incidental.');
    const model = this._requireString(params, 'model',
      'Claude Code launches must always name the model explicitly. If the harness default has a ' +
      'smaller context window than the session was actually built on, the first turn can trigger a ' +
      'compaction the smaller model cannot complete, stalling the session on its very first action.');
    const skipPermissions = this._requireBoolean(params, 'skipPermissions',
      'Must be an explicit choice. Launching without --dangerously-skip-permissions on an unattended ' +
      'agent means it stalls at the first permission prompt and does no further work until a human notices.');

    const parts = ['claude', '--resume', `"${sessionRef}"`, '--model', model];
    if (skipPermissions) parts.push('--dangerously-skip-permissions');
    if (params.agentName) {
      this._validateAgentName(params.agentName, cwd);
      parts.push('--agent', params.agentName);
    }
    return { command: parts.join(' '), cwd };
  }
}

// Checks (and, if false, mechanistically fixes) Claude Code's own
// first-launch trust-dialog state for a given cwd, stored in
// ~/.claude.json's projects[cwd].hasTrustDialogAccepted. Real incident,
// 2026-10-07: a fresh surface hit this dialog on first launch and NO
// simulated keypress (down/tab/right/enter) could navigate it - confirmed
// by watching a literal character land on the OUTER shell's prompt line
// instead of the dialog, proving input never reached it at all. Flipping
// this field directly is the only mechanism found that reliably works;
// never retry interactive navigation on this specific dialog.
function checkAndFixTrustDialog(cwd, claudeJsonPath) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const jsonPath = claudeJsonPath || path.join(os.homedir(), '.claude.json');
  const key = cwd.replace(/\\/g, '/');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const j = JSON.parse(raw);
  if (!j.projects || !j.projects[key]) {
    throw new Error(`checkAndFixTrustDialog: no project entry for cwd "${key}" in ${jsonPath}`);
  }
  const before = j.projects[key].hasTrustDialogAccepted;
  if (before === true) return { changed: false, before, after: true };
  j.projects[key].hasTrustDialogAccepted = true;
  fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2), 'utf8');
  return { changed: true, before, after: true };
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
    return { command: parts.join(' '), cwd };
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
  createSessionLauncher, checkAndFixTrustDialog,
};
