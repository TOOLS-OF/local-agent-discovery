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
// - No explicit action -> 'resume' silently fails with "already running as
//   a background session" when pane_close orphaned the session to a daemon.
//   The three actions are NOT interchangeable: 'resume' for dead sessions,
//   'attach' for background daemons, 'fork' for branched copies. Using the
//   wrong one is a silent no-op or a silent data fork. Real incident today:
//   claude --resume on a background session printed an error and exited;
//   the agent was never relaunched because the caller didn't check.
//
// - No title -> every agent tab shows "Claude Code" in the wmux surface and
//   ListAgents returns auto-generated names like "victorb-90". Named agents
//   are findable and addressable by peers. Unnamed agents are invisible to
//   the swarm routing layer. Real incident today: couldn't address an agent
//   by name because its session had no title and ListAgents showed garbage.

// VALID ACTIONS:
//   'resume' - session is truly dead (ended cleanly or stopped).
//              Command: claude --resume <sessionRef> --model <model> [--name <title>]
//              [--dangerously-skip-permissions] [--fork-session]
//   'attach' - session is a live background daemon (e.g., orphaned by pane_close).
//              Command: claude attach <sessionId>
//              Note: model and skipPermissions are required for caller verification
//              but are NOT passed to the command (running session owns its config).
//   'fork'   - create a branched copy of a session without stopping the original.
//              Command: claude --resume <sessionRef> --fork-session --model <model>
//              [--name <title>] [--dangerously-skip-permissions]
//
// NOTE (fixed 2026-09-19, issue #12): the generated command uses --name, not
// --title. `claude --help` has no --title flag at all - only `-n, --name
// <name>` ("Set a display name for this session"). An earlier version of
// this file built the command with --title, which claude silently doesn't
// recognize as a display-name setter - the naming fix didn't actually work
// as merged. The `title` parameter name here and in sesh-falcon's own CLI
// is kept as-is (it's this tool's own vocabulary); only the flag passed to
// the real `claude` binary changed.
//
// NOTE (fixed 2026-09-20): `buildLaunchCommand` now returns `argv` (an array)
// alongside `command` (a display string). Callers MUST execute via `argv`
// (e.g. `execFileSync(argv[0], argv.slice(1), {cwd, stdio:'inherit'})`), never
// by feeding `command` to `execSync`/a shell. Real bug this fixes: the first
// version of `appendSystemPromptFile` built `--append-system-prompt
// "$(cat "<path>")"` as part of the shell string and relied on `execSync`'s
// default shell to expand it. On Windows, `execSync` defaults to `cmd.exe`,
// which does not support `$(...)` substitution at all — verified directly
// (`execSync('echo $(echo hi)')` prints the literal text `$(echo hi)`, not
// `hi`). The flag would have been sent as that literal dead string, not the
// file's contents, and this was never caught because the only testing done
// was `--dry-run` (which just prints `command`, it never executes it).
// `command` is kept only for human-readable dry-run/json output now; it may
// not be perfectly shell-round-trippable for every input (long file
// contents), which is fine since nothing executes it. `execFileSync` with no
// `shell` option was verified to correctly resolve and run `claude` (a
// `.cmd` shim on Windows) directly, so this also needed no shell at all for
// the base case either.
//
// NOTE (added 2026-09-20): `claude --help` (real output, not assumed) has a
// top-level `--agent <agent>` flag: "Agent for the current session. Overrides
// the 'agent' setting." This resolves `.claude/agents/<name>.md` the same way
// the Agent/Task tool's own agent-type list does, natively - no need for a
// caller to read that file's content and inject it via
// `--append-system-prompt` at all when a named agent definition already
// exists. `agent` (a bare name, not a path) is the preferred way to give a
// launch a durable identity; `appendSystemPromptFile` remains for the case
// where there's a system-prompt addition with no corresponding named agent.

class SessionLauncher {
  // params: { action, sessionRef, cwd, model, skipPermissions, title? } - all except title required.
  // Returns { command, cwd }. Throws if any required parameter is missing
  // or the wrong type; never fills in a default silently.
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

  _optionalString(params, key) {
    const v = params[key];
    if (v !== undefined && (typeof v !== 'string' || v.length === 0)) {
      throw new Error(`SessionLauncher: "${key}" must be a non-empty string if provided.`);
    }
    return v || null;
  }
}

class ClaudeSessionLauncher extends SessionLauncher {
  constructor() { super(); this.harness = 'claude-code'; }

  buildLaunchCommand(params) {
    const action = this._requireString(params, 'action',
      'Must be "new", "resume", "attach", or "fork". "new" starts a fresh session with no prior ' +
      'transcript (the only action with no sessionRef); "resume" is for dead sessions, "attach" for ' +
      'background daemons (orphaned by pane_close), "fork" for branched copies of running sessions. ' +
      'Using the wrong one silently fails or corrupts.');

    if (!['new', 'resume', 'attach', 'fork'].includes(action)) {
      throw new Error(`SessionLauncher: "action" must be "new", "resume", "attach", or "fork", got "${action}".`);
    }

    // "new" is the one action with nothing to resume — every other action needs a real
    // prior session reference, so sessionRef stays required there, not defaulted away.
    const sessionRef = action === 'new'
      ? this._optionalString(params, 'sessionRef')
      : this._requireString(params, 'sessionRef',
          'The session id or full transcript path. For "attach", a bare short id (e.g. "19d0cbba") is fine. ' +
          'For "resume"/"fork", prefer a full .jsonl path — bare ids fail for sessions placed by file copy.');
    const cwd = this._requireString(params, 'cwd',
      'The working directory this session should run in - part of its own identity, not incidental.');
    const model = this._requireString(params, 'model',
      'Claude Code launches must always name the model explicitly. If the harness default has a ' +
      'smaller context window than the session was actually built on, the first turn can trigger a ' +
      'compaction the smaller model cannot complete, stalling the session on its very first action. ' +
      'For "attach", this is a required sanity check even though it is not passed to the command.');
    const skipPermissions = this._requireBoolean(params, 'skipPermissions',
      'Must be an explicit choice. Launching without --dangerously-skip-permissions on an unattended ' +
      'agent means it stalls at the first permission prompt and does no further work until a human notices. ' +
      'For "attach", this is a required acknowledgment even though it is not passed to the command ' +
      '(the running session owns its own permission config).');
    const title = this._optionalString(params, 'title');
    // Bare agent name (not a path) matching .claude/agents/<name>.md, passed through to the
    // real `--agent` flag verified in `claude --help`. Preferred over appendSystemPromptFile
    // whenever a named agent definition already exists - claude resolves the file itself.
    const agent = this._optionalString(params, 'agent');
    // Path to a file whose contents become --append-system-prompt, for the case where there's
    // a system-prompt addition with no corresponding named agent definition (or a one-off
    // addition on resume/fork to re-assert identity after a cross-harness reconstruction
    // dropped it). Not valid on "attach" — same reasoning as title: a running session already
    // has whatever system prompt it started with.
    const appendSystemPromptFile = this._optionalString(params, 'appendSystemPromptFile');
    if (agent && appendSystemPromptFile) {
      throw new Error('SessionLauncher: "agent" and "appendSystemPromptFile" are alternatives, not ' +
        'combinable — pick --agent <name> when a named .claude/agents/<name>.md already exists ' +
        '(claude resolves it natively), or --system-prompt-file for anything else.');
    }

    if (action === 'attach') {
      // claude attach uses a different command shape: no --resume, no model, no permissions flag.
      // The running session owns its own model and permission config.
      // title cannot be set on attach (session title is already established).
      if (title) {
        throw new Error('SessionLauncher: "title" cannot be set on action "attach" — ' +
          'the running session already has its title. Use "resume" or "fork" to launch with a new title.');
      }
      if (agent || appendSystemPromptFile) {
        throw new Error('SessionLauncher: "agent"/"appendSystemPromptFile" cannot be set on action ' +
          '"attach" — the running session already has whatever identity/system prompt it started with.');
      }
      const argv = ['claude', 'attach', sessionRef];
      return { command: argv.join(' '), argv, cwd };
    }

    // File content is read here, in Node, and passed as a literal argv element — never
    // interpolated into a shell string. See the 2026-09-20 note above for why that distinction
    // is load-bearing, not stylistic.
    let appendSystemPromptText = null;
    if (appendSystemPromptFile) {
      const fs = require('fs');
      try {
        appendSystemPromptText = fs.readFileSync(appendSystemPromptFile, 'utf8');
      } catch (e) {
        throw new Error(`SessionLauncher: could not read appendSystemPromptFile "${appendSystemPromptFile}": ${e.message}`);
      }
    }

    const argv = ['claude'];
    if (action !== 'new') argv.push('--resume', sessionRef);
    argv.push('--model', model);
    if (title) argv.push('--name', title);
    if (skipPermissions) argv.push('--dangerously-skip-permissions');
    if (action === 'fork') argv.push('--fork-session');
    if (agent) argv.push('--agent', agent);
    if (appendSystemPromptText !== null) argv.push('--append-system-prompt', appendSystemPromptText);

    // Display-only approximation for --dry-run/--json output. Quotes values containing spaces
    // for readability; not meant to be pasted into a shell verbatim for the appendSystemPrompt
    // case (arbitrary file content isn't shell-safe to render inline at all - that's the whole
    // point of executing via argv instead).
    const command = argv.map((a) => (/\s/.test(a) ? `"${a.length > 80 ? a.slice(0, 77) + '...' : a}"` : a)).join(' ');
    return { command, argv, cwd };
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
    const argv = ['codex', 'resume', sessionRef, '--model', model, '--cd', cwd];
    if (skipPermissions) argv.push('--dangerously-bypass-approvals-and-sandbox');
    const command = argv.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
    return { command, argv, cwd };
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
