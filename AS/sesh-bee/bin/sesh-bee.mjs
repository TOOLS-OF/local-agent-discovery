#!/usr/bin/env node

/**
 * slurp-splat: Extract real dialogue turns from Claude Code session JSONL
 * and format as scannable markdown microfiche.
 *
 * Spec (from Meridian's proof-of-concept):
 * - Slurp: filter JSONL by turn type (only user/assistant dialogue)
 * - Drop: tool_use, tool_result, thinking, CompactSummary, internal noise
 * - Splat: format as markdown with [ISO timestamp] Speaker (instance) headers
 */

import * as fs from 'fs';
import * as readline from 'readline';

async function slurpTurns(jsonlPath, options = {}) {
  const turns = [];
  const { maxLines = null, startLine = 0 } = options;

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  let lineNum = 0;
  for await (const line of rl) {
    if (maxLines && lineNum >= startLine + maxLines) break;
    if (lineNum < startLine) { lineNum++; continue; }

    try {
      const record = JSON.parse(line);
      const turn = extractTurn(record);
      if (turn) turns.push(turn);
    } catch (e) {
      // Skip malformed lines
    }
    lineNum++;
  }

  return turns;
}

function extractTurn(record) {
  // Skip non-dialogue records
  if (!record.type || record.type === 'tool-use' || record.type === 'tool-result') {
    return null;
  }

  // Extract user messages
  if (record.type === 'user-message' || record.type === 'user' || !record.type.startsWith('assistant')) {
    if (!record.content) return null;
    return {
      timestamp: record.ts || record.timestamp || new Date().toISOString(),
      speaker: 'User',
      instance: record.instance || '?',
      body: record.content || record.message || ''
    };
  }

  // Extract assistant messages (skip thinking/internal noise)
  if (record.type === 'assistant-message' || record.type === 'assistant') {
    if (!record.content) return null;

    // Filter out pure thinking/internal records
    if (record.isVisibleInTranscriptOnly && !record.content) return null;

    return {
      timestamp: record.ts || record.timestamp || new Date().toISOString(),
      speaker: record.speaker || 'Assistant',
      instance: record.instance || record.model || '?',
      body: record.content || record.text || ''
    };
  }

  return null;
}

function splatToMarkdown(turns, options = {}) {
  const { title = 'Microfiche — Dialogue Turns' } = options;

  let md = `# ${title}\n\n`;
  md += `Extracted ${turns.length} real dialogue turns.\n\n---\n\n`;

  for (const turn of turns) {
    const ts = new Date(turn.timestamp).toISOString();
    md += `### [${ts}] ${turn.speaker} (${turn.instance})\n\n`;
    md += `${turn.body.trim()}\n\n---\n\n`;
  }

  return md;
}

// NOTE (fixed 2026-10-07): the original version of this tool defaulted
// --session to a specific person's real session path
// (C:\Users\victorb\...\e4044d15-....jsonl) when the argument was omitted.
// That's the exact "silent default" failure shape the rest of this toolkit
// (sesh-falcon, sesh-hound, sesh-nautilus, sesh-stork) explicitly refuses to
// allow: a caller who forgets the argument doesn't get an error, they
// silently slurp a DIFFERENT real session than the one they meant to. Now
// --session/--output are explicit named flags; --session is required, with
// no fallback to anyone's personal path.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session') args.sessionPath = argv[++i];
    else if (a === '--output') args.outputPath = argv[++i];
    else if (a === '--max-lines') args.maxLines = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`sesh-bee (slurp-splat) — extract real dialogue turns from a Claude Code
session JSONL and format as scannable markdown microfiche.

Usage:
  sesh-bee --session <path-to-session.jsonl> [--output <path.md>] [--max-lines N]

  --session     Path to the Claude Code session JSONL file (required — no
                default; omitting it is an error, not a fallback to any
                particular prior session).
  --output      Output markdown file path (default: ./microfiche-output.md)
  --max-lines   Maximum lines to process from the JSONL (default: entire file)

Example:
  sesh-bee --session ~/.claude/projects/<slug>/<session-id>.jsonl --output microfiche.md --max-lines 50000`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  if (!args.sessionPath) {
    console.error('sesh-bee error: --session is required (no default — see --help).');
    printHelp();
    process.exitCode = 1;
    return;
  }
  const jsonlPath = args.sessionPath;
  const outputPath = args.outputPath || './microfiche-output.md';
  const maxLines = Number.isInteger(args.maxLines) ? args.maxLines : null;

  console.log(`Slurping ${jsonlPath}...`);
  const turns = await slurpTurns(jsonlPath, { maxLines });

  console.log(`Found ${turns.length} dialogue turns. Splatting to markdown...`);
  const markdown = splatToMarkdown(turns);

  fs.writeFileSync(outputPath, markdown);
  console.log(`✓ Written to ${outputPath}`);
  console.log(`\nFirst turn: ${turns[0]?.speaker} at ${turns[0]?.timestamp}`);
  console.log(`Last turn: ${turns[turns.length-1]?.speaker} at ${turns[turns.length-1]?.timestamp}`);
}

main().catch(console.error);
