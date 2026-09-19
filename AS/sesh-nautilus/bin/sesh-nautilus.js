#!/usr/bin/env node
// sesh-nautilus — imposes chamber structure (compaction/context boundaries)
// onto a session that lost them during cross-harness conversion.
//
// Session converters (e.g. transession) translate message content between
// harnesses but typically drop harness-native compaction/context-reset
// events, since the target format's equivalent has no source data to map
// from. The result is a single undifferentiated session that can blow past
// request-size or token limits the first time the target harness tries to
// compact it. sesh-nautilus restores the missing structure by extracting
// the source harness's real boundary events and re-inserting them at the
// correct point (by timestamp) in the target harness's converted file.
const path = require('path');
const {
  createBoundaryExtractor,
  createBoundaryInserter,
} = require('../../../lib/boundary-reconstruction.js');

function parseArgs(argv) {
  const args = { fromHarness: 'codex', toHarness: 'claude-code' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') args.source = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--from-harness') args.fromHarness = argv[++i];
    else if (a === '--to-harness') args.toHarness = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-nautilus — reconstruct dropped compaction boundaries after session conversion

Usage:
  sesh-nautilus --source <source-session-file> --target <target-session-file> --output <output-file>
                [--from-harness codex] [--to-harness claude-code] [--json]

  --source        Session file in the ORIGINAL harness (boundaries are extracted from here)
  --target        Session file already converted into the TARGET harness's format
  --output        Where to write the target file with boundaries inserted
  --from-harness  Source harness (default: codex)
  --to-harness    Target harness (default: claude-code)
  --json          Print machine-readable result instead of a summary line
  --help          Show this help

Currently supported: --from-harness codex --to-harness claude-code
(polymorphic by design — add a BoundaryExtractor/BoundaryInserter in
lib/boundary-reconstruction.js for additional harnesses.)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.source || !args.target || !args.output) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const resolvedOutput = path.resolve(args.output);
  const resolvedTarget = path.resolve(args.target);
  const resolvedSource = path.resolve(args.source);
  if (resolvedOutput === resolvedTarget || resolvedOutput === resolvedSource) {
    console.error(
      'sesh-nautilus error: --output must not be the same path as --target or --source.\n' +
      'Reading and writing the same file as a stream truncates it before the read completes.\n' +
      'Write to a different path, then move/rename it into place afterward if needed.'
    );
    process.exit(1);
  }

  const extractor = createBoundaryExtractor(args.fromHarness);
  const inserter = createBoundaryInserter(args.toHarness);

  const boundaries = await extractor.extractBoundaries(path.resolve(args.source));
  const result = await inserter.insertBoundaries(
    path.resolve(args.target),
    boundaries,
    path.resolve(args.output)
  );

  if (args.json) {
    console.log(JSON.stringify({ ...result, output: args.output }));
  } else {
    console.log(`🐚 sesh-nautilus: ${result.insertedCount}/${result.totalBoundaries} chamber boundaries reconstructed`);
    console.log(`   ${result.totalLines} lines processed, output written to ${args.output}`);
  }
}

main().catch(e => { console.error('sesh-nautilus error:', e.message); process.exit(1); });
