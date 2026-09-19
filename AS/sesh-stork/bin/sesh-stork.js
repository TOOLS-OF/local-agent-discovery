#!/usr/bin/env node
// sesh-stork — delivers a finished session file into a target harness's
// storage convention for a chosen folder, and verifies it actually boots.
//
// Deliberately indifferent to how much history is in the payload: a
// zero-chamber fresh session and a full N-chamber lineage go through the
// same procedure. Content shape (how many compaction chambers survive) is
// decided upstream by tools like sesh-nautilus/sesh-vulture; sesh-stork's
// only job is "place it correctly, confirm it's alive."
const path = require('path');
const { createSessionDelivery } = require('../../../lib/session-delivery.js');

function parseArgs(argv) {
  const args = { toHarness: 'claude-code', verify: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session') args.session = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else if (a === '--session-id') args.sessionId = argv[++i];
    else if (a === '--to-harness') args.toHarness = argv[++i];
    else if (a === '--no-verify') args.verify = false;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-stork — deliver a session file into a target harness's home, verify it boots

Usage:
  sesh-stork --session <file> --cwd <destination-folder> --session-id <id>
             [--to-harness claude-code] [--no-verify] [--json]

  --session      The finished session .jsonl to deliver (0 to N compaction chambers - stork doesn't care)
  --cwd          The folder this session should live in (destination storage is derived from this)
  --session-id   The session id (must match the id embedded in the file's own sessionId field)
  --to-harness   Target harness (default: claude-code)
  --no-verify    Skip the boot check (deliver only)
  --json         Print machine-readable result

Currently supported: --to-harness claude-code
(polymorphic by design — add a SessionDelivery in lib/session-delivery.js for additional harnesses.)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.session || !args.cwd || !args.sessionId) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const delivery = createSessionDelivery(args.toHarness);
  const destFile = await delivery.deliver(path.resolve(args.session), args.cwd, args.sessionId);

  let bootResult = null;
  if (args.verify) {
    bootResult = await delivery.verifyBoot(destFile, args.cwd);
  }

  if (args.json) {
    console.log(JSON.stringify({ destFile, bootResult }));
  } else {
    console.log(`🕊️  sesh-stork: delivered to ${destFile}`);
    if (bootResult) {
      console.log(bootResult.ok ? '   ✅ boot check passed' : `   ❌ boot check FAILED: ${bootResult.raw || bootResult.error}`);
    }
  }

  if (args.verify && bootResult && !bootResult.ok) process.exit(1);
}

main().catch(e => { console.error('sesh-stork error:', e.message); process.exit(1); });
