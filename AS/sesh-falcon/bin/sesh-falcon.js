#!/usr/bin/env node
// sesh-falcon — builds and executes a session launch command with every
// required parameter enforced explicitly. No silent defaults: a falcon
// released without its jesses handled correctly doesn't fly true, and a
// session launched without an explicit model/cwd/permission-mode doesn't
// either - it stalls on the first prompt, or the first compaction, with no
// one watching.
//
// config_dir enforcement (2026-10-08):
//   Agent class definitions (.claude/agents/<name>.md) can declare:
//     config_dir: cwd_auto   -> require isolated config; auto-detect from $CWD/.claude
//     config_dir: shared     -> use global ~/.claude (rabbit, meridian, etc.)
//     config_dir: explicit   -> only explicit --config-dir accepted, no auto-detect
//   When the agent declares cwd_auto and no --config-dir is given:
//     - If $CWD/.claude exists -> use it automatically
//     - If not -> HARD ERROR, not a silent fallback to global ~/.claude
//   Launching a cwd_auto agent against global ~/.claude creates a "shadow session"
//   (qlippoth): it inherits the workspace primary account's credentials regardless of
//   card name, appearing to be a separate account while sharing its budget.
//   Real incident: instance 75 created qlippoth housecats. Victor caught via /status audit.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createSessionLauncher } = require('../../../lib/session-launch.js');

// --- Agent frontmatter reading ---

// Reads the YAML frontmatter from a .claude/agents/<name>.md file.
// Search order: explicit agentsDir > ~/.claude/agents > <cwd>/.claude/agents
// Returns a plain object of frontmatter keys, or null if not found.
function readAgentFrontmatter(agentName, cwd, agentsDir) {
  const searchDirs = agentsDir
    ? [agentsDir]
    : [
        path.join(os.homedir(), '.claude', 'agents'),
        path.join(cwd, '.claude', 'agents'),
      ];

  for (const dir of searchDirs) {
    const mdPath = path.join(dir, `${agentName}.md`);
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, 'utf8');
      const frontmatter = {};
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (match) {
        for (const line of match[1].split(/\r?\n/)) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            if (key && !key.startsWith('#')) frontmatter[key] = val;
          }
        }
      }
      return frontmatter;
    }
  }
  return null;
}

// --- Config dir resolution ---

// Determines the CLAUDE_CONFIG_DIR to use for this launch, enforcing the
// agent class's config_dir strategy from its frontmatter.
//
// Resolution order:
//   1. Explicit --config-dir arg always wins.
//   2. Agent frontmatter declares config_dir: cwd_auto -> check $CWD/.claude.
//      Found: use it. Not found: HARD ERROR.
//   3. Agent frontmatter declares config_dir: explicit -> no auto-detect; --config-dir required.
//   4. Agent frontmatter declares config_dir: shared (or not set) -> no isolation needed.
//   5. No agent profile -> no config dir (caller is responsible).
//
// Returns the resolved config dir path, or null if no isolation needed.
// Throws on enforcement violations.
function resolveConfigDir(agentProfile, cwd, explicitConfigDir, agentsDir) {
  if (explicitConfigDir) return explicitConfigDir;

  if (!agentProfile) return null;

  const fm = readAgentFrontmatter(agentProfile, cwd, agentsDir);
  const strategy = fm ? fm.config_dir : null;

  if (!strategy || strategy === 'shared') {
    // No isolation required for this agent class.
    return null;
  }

  if (strategy === 'explicit') {
    throw new Error(
      `sesh-falcon: agent "${agentProfile}" declares config_dir: explicit, which requires ` +
      `--config-dir to be provided. No auto-detection from CWD.\n` +
      `Use: sesh-falcon ... --config-dir <path>`
    );
  }

  if (strategy === 'cwd_auto') {
    const cwdDotClaude = path.join(cwd, '.claude');
    if (fs.existsSync(cwdDotClaude)) {
      return cwdDotClaude;
    }
    throw new Error(
      `sesh-falcon: agent "${agentProfile}" declares config_dir: cwd_auto, ` +
      `but no .claude directory found in CWD "${cwd}" and no --config-dir override provided.\n\n` +
      `This is a hard error, not a fallback to global ~/.claude. Launching without an isolated ` +
      `config dir creates a shadow session (qlippoth): the agent inherits the workspace primary ` +
      `account's credentials regardless of its card name or CWD, silently sharing its quota budget.\n\n` +
      `Fix one of:\n` +
      `  a) Create ${cwdDotClaude} with valid credentials for the target account.\n` +
      `  b) Pass --config-dir <path> to an existing isolated config dir.\n` +
      `  c) Use a different CWD whose .claude folder is already set up.`
    );
  }

  // Unknown strategy - warn but don't block.
  process.stderr.write(
    `sesh-falcon: warning: agent "${agentProfile}" declares unknown config_dir strategy ` +
    `"${strategy}" - no config dir isolation applied. Known strategies: cwd_auto, shared, explicit.\n`
  );
  return null;
}

// --- Arg parsing ---

function parseArgs(argv) {
  const args = { harness: 'claude-code', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session')      args.sessionRef = argv[++i];
    else if (a === '--cwd')     args.cwd = argv[++i];
    else if (a === '--model')   args.model = argv[++i];
    else if (a === '--skip-permissions')    args.skipPermissions = true;
    else if (a === '--no-skip-permissions') args.skipPermissions = false;
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json')    args.json = true;
    else if (a === '--agent')   args.agent = argv[++i];
    else if (a === '--name' || a === '-n') args.name = argv[++i];
    else if (a === '--config-dir') args.configDir = argv[++i];
    else if (a === '--agents-dir') args.agentsDir = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-falcon — launch a session with every required parameter enforced explicitly

Usage:
  sesh-falcon --cwd <folder> --model <model> (--skip-permissions | --no-skip-permissions)
              [--session <id-or-path>] [--agent <profile>] [--name <card-name>]
              [--config-dir <path>] [--agents-dir <path>]
              [--harness claude-code|codex] [--dry-run] [--json]

  --session             Session id or transcript path to resume (optional if --agent is given)
  --cwd                 Working directory for the launched session (required)
  --model               Model to run at (required - never has a default)
  --skip-permissions    Launch with permission prompts bypassed (required: choose one)
  --no-skip-permissions Launch with normal permission prompting
  --agent               Agent profile name (e.g. hazrat-housecat) — starts a new named session
  --name / -n           Session card name (e.g. "🐈A♥️") — sets the session display name
  --config-dir          Explicit CLAUDE_CONFIG_DIR path for account isolation (overrides auto-detect)
  --agents-dir          Directory to search for agent .md files (default: ~/.claude/agents)
  --harness             Target harness (default: claude-code)
  --dry-run             Print the command that would run, don't execute it
  --json                Print machine-readable output

config_dir enforcement:
  If --agent names an agent whose .md frontmatter declares "config_dir: cwd_auto",
  sesh-falcon checks for a .claude directory inside --cwd and uses it automatically.
  No .claude in --cwd AND no --config-dir provided = hard error (qlippoth prevention).
  Pass --config-dir to override the auto-detected path.

There is deliberately no default for --model or the permission-mode flags.
Omitting them is an error, not a fallback — the failure modes they prevent are
worse than forcing the caller to decide every time.`);
}

// --- Main ---

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  // Resolve cwd first (needed for config-dir auto-detect).
  const cwd = args.cwd || process.cwd();

  // Resolve config dir (may throw if enforcement fails).
  let configDir;
  try {
    configDir = resolveConfigDir(args.agent, cwd, args.configDir, args.agentsDir);
  } catch (e) {
    console.error('sesh-falcon error:', e.message);
    process.exit(1);
  }

  let launcher, built;
  try {
    launcher = createSessionLauncher(args.harness);
    built = launcher.buildLaunchCommand({
      sessionRef: args.sessionRef,
      cwd,
      model: args.model,
      skipPermissions: args.skipPermissions,
      agentProfile: args.agent,
      sessionName: args.name,
      configDir,
    });
  } catch (e) {
    console.error('sesh-falcon error:', e.message);
    printHelp();
    process.exit(1);
  }

  const envDisplay = built.env && Object.keys(built.env).length > 0
    ? Object.entries(built.env).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';

  if (args.dryRun || args.json) {
    const out = { harness: launcher.harness, ...built };
    if (args.json) {
      console.log(JSON.stringify(out));
    } else {
      const envStr = envDisplay ? `\n  env:     ${envDisplay}` : '';
      console.log(`🦅 sesh-falcon would run:\n  cwd:     ${built.cwd}${envStr}\n  command: ${built.command}`);
    }
    if (args.dryRun) return;
  }

  execSync(built.command, {
    cwd: built.cwd,
    env: { ...process.env, ...(built.env || {}) },
    stdio: 'inherit',
  });
}

main().catch(e => { console.error('sesh-falcon error:', e.message); process.exit(1); });
