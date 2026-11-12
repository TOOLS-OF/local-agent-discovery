#!/usr/bin/env node
// sesh-falcon — builds and executes a session launch command with every
// required parameter enforced explicitly. No silent defaults: a falcon
// released without its jesses handled correctly doesn't fly true, and a
// session launched without an explicit model/cwd/permission-mode doesn't
// either - it stalls on the first prompt, or the first compaction, with no
// one watching.
const fs = require('node:fs');
const path = require('node:path');

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
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a === '--preflight') args.preflight = true;
    else if (a === '--config') args.config = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-falcon — launch a session with every required parameter enforced explicitly

Usage:
  sesh-falcon --preflight --config <config.json>

  sesh-falcon --session <id-or-path> --cwd <folder> --model <model> (--skip-permissions | --no-skip-permissions)
              [--harness claude-code|codex] [--dry-run] [--json]

  --preflight           Offline comparison only; never discovers or launches a session
  --config              Expected paths/digests/provenance JSON for --preflight
  --session             Session id or transcript path to resume (required)
  --cwd                 Working directory for the launched session (required)
  --model               Model to run at (required - see lib/session-launch.js for why this
                         is never optional on either harness)
  --skip-permissions    Launch with permission prompts bypassed (required: choose this or --no-skip-permissions)
  --no-skip-permissions Launch with normal permission prompting
  --harness             Target harness (default: claude-code)
  --dry-run             Print the command that would run, don't execute it
  --json                Print machine-readable output

There is deliberately no default for --model or the permission-mode flags -
omitting them is an error, not a fallback, because the failure modes they
prevent (a stalled compaction on an undersized default model, a stalled
session on an unhandled permission prompt, a silently forked Codex thread)
are worse than forcing the caller to decide.`);
}

async function main(argv = process.argv.slice(2), runtime = {}) {
  const args = parseArgs(argv);
  const stdout = runtime.stdout || ((line) => console.log(line));
  const stderr = runtime.stderr || ((line) => console.error(line));
  if (args.help) { printHelp(); return 0; }

  if (args.preflight) {
    if (!args.config) {
      stderr(JSON.stringify({ schemaVersion: 'tools-of.fleet-preflight.cli-error.v1', status: 'UNKNOWN', reason: '--config is required with --preflight', commandExecuted: false, mutationPerformed: false }));
      return 2;
    }
    try {
      const configPath = path.resolve(args.config);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const loadPreflight = runtime.loadPreflight || (() => require('../../fleet-preflight/lib/check.cjs'));
      const result = loadPreflight().checkConfig(config, { baseDir: path.dirname(configPath) });
      stdout(JSON.stringify({ mode: 'preflight', ...result }));
      return result.status === 'MATCH' ? 0 : 1;
    } catch (e) {
      stderr(JSON.stringify({ schemaVersion: 'tools-of.fleet-preflight.cli-error.v1', status: 'UNKNOWN', reason: e.message, commandExecuted: false, mutationPerformed: false }));
      return 2;
    }
  }

  let launcher, built;
  try {
    const loadLauncher = runtime.loadLauncher || (() => require('../../../lib/session-launch.js'));
    const { createSessionLauncher } = loadLauncher();
    launcher = createSessionLauncher(args.harness);
    built = launcher.buildLaunchCommand({
      sessionRef: args.sessionRef,
      cwd: args.cwd,
      model: args.model,
      skipPermissions: args.skipPermissions,
    });
  } catch (e) {
    console.error('sesh-falcon error:', e.message);
    printHelp();
    return 1;
  }

  if (args.dryRun || args.json) {
    const out = { harness: launcher.harness, ...built };
    if (args.json) { console.log(JSON.stringify(out)); }
    else { console.log(`🦅 sesh-falcon would run:\n  cwd: ${built.cwd}\n  command: ${built.command}`); }
    if (args.dryRun) return;
  }

  const execSync = runtime.execSync || require('child_process').execSync;
  execSync(built.command, { cwd: built.cwd, stdio: 'inherit' });
  return 0;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch(e => { console.error('sesh-falcon error:', e.message); process.exitCode = 1; });
}

module.exports = { main, parseArgs };
