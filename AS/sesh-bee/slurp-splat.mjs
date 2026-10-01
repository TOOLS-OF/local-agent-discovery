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

async function main() {
  const jsonlPath = process.argv[2] || 'C:\\Users\\victorb\\.claude\\projects\\C--Users-victorb\\e4044d15-130d-4593-9ad8-d37a48525f5f.jsonl';
  const outputPath = process.argv[3] || './microfiche-output.md';
  const maxLines = process.argv[4] ? parseInt(process.argv[4]) : null;

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
