#!/usr/bin/env node
// sesh-falcon — builds and executes a session launch command with every
// required parameter enforced explicitly. No silent defaults: a falcon
// released without its jesses handled correctly doesn't fly true, and a
// session launched without an explicit model/cwd/permission-mode/action doesn't
// either - it stalls on the first prompt, or the first compaction, or lands in
// the wrong pane under the wrong name with no one watching.
//
// Four modes (--action):
//   new     — start a fresh session with no prior transcript. Uses plain `claude`.
//   resume  — session is truly dead (ended cleanly or stopped). Uses `claude --resume`.
//   attach  — session is a live background daemon (orphaned by pane_close). Uses `claude attach`.
//   fork    — create a branched copy of a session. Uses `claude --resume --fork-session`.
//
// Real incident: using `claude --resume` on a background session printed an
// error and exited silently. The caller didn't check. The agent was never
// relaunched. --action makes the caller declare which world they are in.
//
// --agent passes through claude's own --agent <name> flag (verified in real
// `claude --help`, not assumed) - the preferred way to give a launch a durable
// identity when a named .claude/agents/<name>.md already exists, since claude
// resolves that file itself. --system-prompt-file is the fallback for a
// system-prompt addition with no corresponding named agent. See AS/sesh-name
// for the higher-level "launch this named agent" tool built on top of this.
//
// Executes via execFileSync(argv[0], argv.slice(1)) - NOT execSync(command) -
// because command is a display string that isn't safe to hand to a shell for
// every input (see the 2026-09-20 note in lib/session-launch.js for the real
// bug this replaced: $(cat file) shell substitution silently doesn't work
// under execSync's default cmd.exe on Windows).
const { execFileSync } = require('child_process');
const { createSessionLauncher } = require('../../../lib/session-launch.js');

function parseArgs(argv) {
  // --action defaults to 'resume' for backwards compatibility with callers
  // that predate the action parameter, but the lib now requires it explicitly
  // so we fill it in here if not provided.
  const args = { harness: 'claude-code', dryRun: false, action: 'resume' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session') args.sessionRef = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--skip-permissions') args.skipPermissions = true;
    else if (a === '--no-skip-permissions') args.skipPermissions = false;
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--action') args.action = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--agent') args.agent = argv[++i];
    else if (a === '--system-prompt-file') args.systemPromptFile = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-falcon — launch a session with every required parameter enforced explicitly

Usage:
  sesh-falcon [--session <id-or-path>] --cwd <folder> --model <model>
              (--skip-permissions | --no-skip-permissions)
              [--action new|resume|attach|fork] [--title "<display name>"]
              [--agent <name> | --system-prompt-file <path>]
              [--harness claude-code|codex] [--dry-run] [--json]

  --session             Session id or full transcript path. Required for every action except
                        "new" (a fresh session has nothing to reference). For --action attach,
                        a bare short id (e.g. 19d0cbba) is fine. For --action resume/fork, prefer
                        full .jsonl path — bare ids fail for sessions placed by file copy.
  --cwd                 Working directory for the launched session (required)
  --model               Model to run at (required — see lib/session-launch.js for why this
                        is never optional on either harness). For --action attach, the running
                        session owns its model config; this is a caller sanity check.
  --skip-permissions    Launch with permission prompts bypassed (required: choose this or
                        --no-skip-permissions). For --action attach, the running session owns
                        its permission config; this is a caller acknowledgment.
  --no-skip-permissions Launch with normal permission prompting
  --action              What kind of launch (default: resume):
                          new     — no prior transcript; use plain claude (the only action
                                    that doesn't need --session)
                          resume  — session is dead; use claude --resume
                          attach  — session is a background daemon (e.g. after pane_close orphaned it);
                                    use claude attach <id>
                          fork    — branch a copy of the session; use claude --resume --fork-session
  --title               Name the session tab and ListAgents entry (optional, but strongly
                        recommended for any agent that peers need to address by name).
                        Cannot be used with --action attach (running session owns its title).
  --agent               Bare agent name matching .claude/agents/<name>.md (verified real flag,
                        "claude --help" -> "--agent <agent>: Agent for the current session").
                        Preferred over --system-prompt-file whenever a named agent definition
                        already exists — claude resolves that file itself. Not combinable with
                        --system-prompt-file. Cannot be used with --action attach.
  --system-prompt-file  Path to a file whose contents are passed via --append-system-prompt, for
                        a system-prompt addition with no corresponding named agent. Valid on
                        new/resume/fork, not --action attach. Not combinable with --agent.
                        For launching a named agent by name, prefer AS/sesh-name, which resolves
                        --agent (and --model, --title) from .claude/agents/<name>.md automatically.
  --harness             Target harness (default: claude-code)
  --dry-run             Print the command that would run, don't execute it
  --json                Print machine-readable output

There is deliberately no default for --model or the permission-mode flags —
omitting them is an error, not a fallback, because the failure modes they
prevent (a stalled compaction on an undersized default model, a stalled
session on an unhandled permission prompt, a silently forked Codex thread,
a wrongly attached-vs-resumed session) are worse than forcing the caller to decide.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  let launcher, built;
  try {
    launcher = createSessionLauncher(args.harness);
    built = launcher.buildLaunchCommand({
      action: args.action,
      sessionRef: args.sessionRef,
      cwd: args.cwd,
      model: args.model,
      skipPermissions: args.skipPermissions,
      title: args.title,
      agent: args.agent,
      appendSystemPromptFile: args.systemPromptFile,
    });
  } catch (e) {
    console.error('sesh-falcon error:', e.message);
    printHelp();
    process.exit(1);
  }

  if (args.dryRun || args.json) {
    const out = { harness: launcher.harness, action: args.action, title: args.title || null, ...built };
    if (args.json) { console.log(JSON.stringify(out)); }
    else {
      const titleLine = args.title ? `\n  title:   ${args.title}` : '';
      console.log(`🦅 sesh-falcon would run (action=${args.action}):${titleLine}\n  cwd:     ${built.cwd}\n  command: ${built.command}`);
    }
    if (args.dryRun) return;
  }

  execFileSync(built.argv[0], built.argv.slice(1), { cwd: built.cwd, stdio: 'inherit' });
}

main().catch(e => { console.error('sesh-falcon error:', e.message); process.exit(1); });
