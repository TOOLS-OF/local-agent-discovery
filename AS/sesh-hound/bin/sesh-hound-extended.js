#!/usr/bin/env node
const { createSessionDiscovery } = require('../lib/session-discovery');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`sesh-hound extended — address book for agent sensing

Usage:
  sesh-hound [cwd]                    Find sessions spawned from folder
  sesh-hound --by-title <name>       Find session by agent title
  sesh-hound --subagents <sessionId> Sense subagents in session
  sesh-hound --json [...]            Output as JSON (works with any mode)
  sesh-hound --help                  Show this help`);
  process.exit(0);
}

async function run() {
  let mode = 'by-cwd';
  let queryArg = null;

  if (args.includes('--by-title')) {
    mode = 'by-title';
    queryArg = args[args.indexOf('--by-title') + 1];
  } else if (args.includes('--subagents')) {
    mode = 'subagents';
    queryArg = args[args.indexOf('--subagents') + 1];
  } else {
    queryArg = args.find(a => !a.startsWith('-')) || process.cwd();
  }

  try {
    const results = [];

    if (mode === 'by-title') {
      for (const harness of ['codex', 'claude-code']) {
        const discovery = createSessionDiscovery(harness);
        const sessions = await discovery.findSessionByTitle(queryArg);
        results.push(...sessions);
      }
    } else if (mode === 'subagents') {
      for (const harness of ['codex', 'claude-code']) {
        const discovery = createSessionDiscovery(harness);
        const subagents = await discovery.getSubagents(queryArg);
        if (subagents.length > 0) {
          const title = await discovery.getSessionTitle(queryArg);
          results.push({ sessionId: queryArg, title, subagents, harness });
          break;
        }
      }
      if (results.length === 0 && !jsonOut) {
        console.error(`Session ${queryArg} not found.`);
        process.exit(1);
      }
    } else {
      for (const harness of ['codex', 'claude-code']) {
        const discovery = createSessionDiscovery(harness);
        const sessions = await discovery.findSessionByPath(queryArg);
        results.push(...sessions);
      }
    }

    if (jsonOut) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const modeLabel = { 'by-cwd': 'by folder', 'by-title': 'by title', 'subagents': 'subagents' }[mode];
      console.log(`🐕 sesh-hound sensing (${modeLabel}): ${queryArg}\n`);
      if (results.length === 0) {
        console.log('  Nothing sensed.');
      }
      for (const r of results) {
        console.log(`  [${r.harness || r.tool}] ${r.sessionId}`);
        if (r.title) console.log(`      title: ${r.title}`);
        if (r.cwd) console.log(`      cwd:   ${r.cwd}`);
        if (r.subagents && r.subagents.length > 0) {
          console.log(`      subagents:`);
          r.subagents.forEach(s => console.log(`        - ${s.name}`));
        }
      }
      console.log(`\n${results.length} result${results.length === 1 ? '' : 's'} sensed.`);
    }
  } catch (err) {
    if (!jsonOut) console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

run();
