#!/usr/bin/env node
// sesh-falcon — builds and executes a session launch command with every
// required parameter enforced explicitly. No silent defaults: a falcon
// released without its jesses handled correctly doesn't fly true, and a
// session launched without an explicit model/cwd/permission-mode doesn't
// either - it stalls on the first prompt, or the first compaction, with no
// one watching.
const { execSync } = require('child_process');
const { createSessionLauncher, checkAndFixTrustDialog } = require('../../../lib/session-launch.js');

function parseArgs(argv) {
  const args = { harness: 'claude-code', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session') args.sessionRef = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--skip-permissions') args.skipPermissions = true;
    else if (a === '--no-skip-permissions') args.skipPermissions = false;
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--agent') args.agentName = argv[++i];
    else if (a === '--check-trust') args.checkTrust = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-falcon — launch a session with every required parameter enforced explicitly

Usage:
  sesh-falcon --session <id-or-path> --cwd <folder> --model <model> (--skip-permissions | --no-skip-permissions)
              [--harness claude-code|codex] [--dry-run] [--json]

  --session             Session id or transcript path to resume (required)
  --cwd                 Working directory for the launched session (required)
  --model               Model to run at (required - see lib/session-launch.js for why this
                         is never optional on either harness)
  --skip-permissions    Launch with permission prompts bypassed (required: choose this or --no-skip-permissions)
  --no-skip-permissions Launch with normal permission prompting
  --harness             Target harness (default: claude-code)
  --agent               Named agent spec to launch as (Claude Code only; optional).
                         Validated against a REAL <cwd>/.claude/agents/<name>.md on disk
                         before launch — refuses with the real candidate list if it does
                         not exist. Real incident this guards against: a relaunch used
                         --agent hazrat-rabbit-pineapple, a plausible-sounding name with
                         no real spec file, and Claude Code did not error — it just
                         silently was not the intended agent.
  --check-trust         Before launching, check (and if needed mechanistically fix)
                         Claude Code's own first-launch trust-dialog state for --cwd in
                         ~/.claude.json (projects[cwd].hasTrustDialogAccepted). Real
                         incident this guards against: that dialog cannot reliably be
                         navigated by any simulated keypress in a meta-harness like wmux —
                         confirmed by watching a literal keystroke land on the OUTER shell
                         prompt instead of the dialog. Flipping the field directly is the
                         only mechanism found that reliably works.
  --dry-run             Print the command that would run, don't execute it
  --json                Print machine-readable output

There is deliberately no default for --model or the permission-mode flags -
omitting them is an error, not a fallback, because the failure modes they
prevent (a stalled compaction on an undersized default model, a stalled
session on an unhandled permission prompt, a silently forked Codex thread)
are worse than forcing the caller to decide. --agent and --check-trust are
optional extensions, not required - most launches need neither.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  let launcher, built;
  try {
    if (args.checkTrust) {
      const trustResult = checkAndFixTrustDialog(args.cwd);
      if (trustResult.changed) {
        console.log(`sesh-falcon: trust dialog for "${args.cwd}" was not accepted (hasTrustDialogAccepted: ${trustResult.before}) — fixed mechanistically, now ${trustResult.after}.`);
      }
    }
    launcher = createSessionLauncher(args.harness);
    built = launcher.buildLaunchCommand({
      sessionRef: args.sessionRef,
      cwd: args.cwd,
      model: args.model,
      skipPermissions: args.skipPermissions,
      agentName: args.agentName,
    });
  } catch (e) {
    console.error('sesh-falcon error:', e.message);
    printHelp();
    process.exit(1);
  }

  if (args.dryRun || args.json) {
    const out = { harness: launcher.harness, ...built };
    if (args.json) { console.log(JSON.stringify(out)); }
    else { console.log(`🦅 sesh-falcon would run:\n  cwd: ${built.cwd}\n  command: ${built.command}`); }
    if (args.dryRun) return;
  }

  execSync(built.command, { cwd: built.cwd, stdio: 'inherit' });
}

main().catch(e => { console.error('sesh-falcon error:', e.message); process.exit(1); });
