#!/usr/bin/env node
// sesh-name — launch (or resume) an agent by its own name, using its
// .claude/agents/<name>.md definition as the source of truth for model and
// identity, instead of hoping the launch directory's CLAUDE.md surfaces the
// right thing or that whoever launched it remembered every flag by hand.
//
// Built on top of sesh-falcon/lib/session-launch.js: this tool's whole job is
// to derive the parameters sesh-falcon already knows how to turn into a
// correct command, not to reimplement any of that launch logic itself.
//
// Real problem this solves: Meridian's own job description ("integrate,
// review, and groom the feature set...") got dropped for days because there
// was no reliable, repeatable way to launch a session WITH that identity
// attached — it depended on whichever ad-hoc resume happened to carry
// context forward. `.claude/agents/<name>.md` existing is necessary but not
// sufficient: something has to actually load it every time, not just when
// someone remembers to.
//
// Uses claude's own --agent <name> flag (real flag, verified via `claude
// --help`: "Agent for the current session... `claude agents` lists them") to
// point at the agent, rather than reading the file's content and injecting it
// via --append-system-prompt. claude already resolves .claude/agents/<name>.md
// itself — reimplementing that (the first version of this tool did) is both
// unnecessary and, in this case, was silently broken: it built
// `--append-system-prompt "$(cat "<path>")"` as a shell string and relied on
// execSync's default shell to expand it, but Windows execSync defaults to
// cmd.exe, which doesn't support $(...) substitution at all. Verified this
// directly rather than assuming a fix would work — see the 2026-09-20 note
// in lib/session-launch.js.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createSessionLauncher } = require('../../../lib/session-launch.js');

function parseArgs(argv) {
  const args = { harness: 'claude-code', dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') args.project = argv[++i];
    else if (a === '--session') args.sessionRef = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--skip-permissions') args.skipPermissions = true;
    else if (a === '--no-skip-permissions') args.skipPermissions = false;
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--action') args.action = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else positional.push(a);
  }
  args.agentName = positional[0];
  return args;
}

function printHelp() {
  console.log(`sesh-name — launch or resume an agent by name, using its own .claude/agents/<name>.md

Usage:
  sesh-name <agent-name> --project <path>
            [--session <id-or-path> --action resume|attach|fork]
            [--cwd <folder>] [--model <model>] [--title "<display name>"]
            (--skip-permissions | --no-skip-permissions)
            [--harness claude-code|codex] [--dry-run] [--json]

  <agent-name>          Positional. Looks up <project>/.claude/agents/<agent-name>.md.
  --project             Repo root containing .claude/agents/ (required — no silent
                        search, so you always know exactly which agent-definition
                        tree you're pulling from).
  --session, --action   If launching fresh (the common case), omit both — this tool
                        defaults to a "new" launch with claude's own --agent <name>
                        flag pointed at <agent-name>. If resuming/attaching/forking
                        an EXISTING session instead, give --session and you must also
                        give --action explicitly (no default — same reasoning as
                        sesh-falcon: guessing wrong here silently fails or forks).
  --cwd                 Working directory for the launched session. Defaults to
                        --project if omitted (the agent's own definition tree is a
                        reasonable default cwd; override if the agent actually works
                        from somewhere else).
  --model               Overrides the "model:" field read from the agent's own
                        frontmatter. Required if the agent file has no "model:" line.
  --title               Overrides the default display title (the agent name,
                        capitalized). Recommended if the agent has a real card/name
                        peers should see in ListAgents instead of the bare filename.
  --skip-permissions    Same meaning and same "no default" rule as sesh-falcon.
  --no-skip-permissions
  --harness             Target harness (default: claude-code)
  --dry-run             Print the command that would run, don't execute it
  --json                Print machine-readable output`);
}

function readAgentFile(project, agentName) {
  const file = path.join(project, '.claude', 'agents', `${agentName}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`No agent definition at ${file}. sesh-name only launches agents that ` +
      `already have a .claude/agents/<name>.md — create one first (see meridian.md for the format).`);
  }
  const content = fs.readFileSync(file, 'utf8');
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let model = null;
  if (fm) {
    const modelLine = fm[1].split(/\r?\n/).find((l) => /^model:\s*/.test(l));
    if (modelLine) model = modelLine.replace(/^model:\s*/, '').trim();
  }
  return { file, model };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.agentName) { printHelp(); process.exit(args.help ? 0 : 1); }

  if (!args.project) {
    console.error('sesh-name error: --project is required.');
    printHelp();
    process.exit(1);
  }

  let agent;
  try {
    agent = readAgentFile(args.project, args.agentName);
  } catch (e) {
    console.error('sesh-name error:', e.message);
    process.exit(1);
  }

  const model = args.model || agent.model;
  if (!model) {
    console.error(`sesh-name error: no --model given and ${agent.file} has no "model:" line in its frontmatter.`);
    process.exit(1);
  }

  const cwd = args.cwd || args.project;
  const title = args.title || (args.agentName.charAt(0).toUpperCase() + args.agentName.slice(1));

  let action = args.action;
  if (args.sessionRef && !action) {
    console.error('sesh-name error: --session was given without --action. Resuming/attaching/forking ' +
      'requires an explicit choice (same reasoning as sesh-falcon) — pick resume, attach, or fork.');
    process.exit(1);
  }
  if (!args.sessionRef) action = 'new';

  let launcher, built;
  try {
    launcher = createSessionLauncher(args.harness);
    built = launcher.buildLaunchCommand({
      action,
      sessionRef: args.sessionRef,
      cwd,
      model,
      skipPermissions: args.skipPermissions,
      title: action === 'attach' ? undefined : title,
      agent: action === 'attach' ? undefined : args.agentName,
    });
  } catch (e) {
    console.error('sesh-name error:', e.message);
    process.exit(1);
  }

  if (args.dryRun || args.json) {
    const out = { harness: launcher.harness, action, agent: args.agentName, agentFile: agent.file, title: title || null, ...built };
    if (args.json) { console.log(JSON.stringify(out)); }
    else {
      console.log(`🏷️  sesh-name would launch "${args.agentName}" (action=${action}):\n  agentFile: ${agent.file}\n  title:     ${title}\n  cwd:       ${built.cwd}\n  command:   ${built.command}`);
    }
    if (args.dryRun) return;
  }

  execFileSync(built.argv[0], built.argv.slice(1), { cwd: built.cwd, stdio: 'inherit' });
}

main();
