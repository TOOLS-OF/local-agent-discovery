// Polymorphic boundary extraction/insertion: reconstructs compaction/context
// chamber structure across harness session-file formats. Mirrors the
// SessionDiscovery pattern in session-discovery.js (one abstract concept,
// one concrete subclass per harness).
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');

// ---- Extraction: pull real compaction boundary events out of a source session ----

class BoundaryExtractor {
  // Returns [{ ordinal, timestamp, replacementHistoryLen }] sorted by timestamp.
  async extractBoundaries(sessionFile) { throw new Error('impl'); }
}

class CodexBoundaryExtractor extends BoundaryExtractor {
  constructor() { super(); this.harness = 'codex'; }

  async extractBoundaries(sessionFile) {
    const boundaries = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(sessionFile, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.includes('"type":"compacted"')) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'compacted') {
          boundaries.push({
            ordinal: obj.ordinal,
            timestamp: obj.timestamp,
            replacementHistoryLen: obj.payload?.replacement_history?.length || 0,
          });
        }
      } catch (e) { /* skip malformed line */ }
    }
    boundaries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return boundaries;
  }
}

// ---- Insertion: impose boundaries onto a target session in another harness's format ----

class BoundaryInserter {
  // Streams sourceFile -> outputFile, inserting a boundary marker immediately
  // before the first event whose timestamp reaches each pending boundary's
  // timestamp. Returns { totalLines, insertedCount, totalBoundaries }.
  async insertBoundaries(targetFile, boundaries, outputFile) { throw new Error('impl'); }
}

class ClaudeBoundaryInserter extends BoundaryInserter {
  constructor() { super(); this.harness = 'claude-code'; }

  _estimateTokens(charCount) { return Math.round(charCount / 4); }

  _makeMarker(sessionId, boundary, charsSinceLastBoundary) {
    return {
      type: 'system',
      subtype: 'compact_boundary',
      content: 'Conversation compacted',
      level: 'info',
      sessionId,
      timestamp: boundary.timestamp,
      uuid: crypto.randomUUID(),
      compactMetadata: {
        trigger: 'auto',
        source: 'sesh-nautilus-reconstructed',
        sourceOrdinal: boundary.ordinal,
        preTokensEstimate: this._estimateTokens(charsSinceLastBoundary),
        charsSinceLastBoundary,
        replacementHistoryLen: boundary.replacementHistoryLen,
      },
    };
  }

  async insertBoundaries(targetFile, boundaries, outputFile) {
    const sorted = [...boundaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let nextIdx = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(targetFile, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    const out = fs.createWriteStream(outputFile, { encoding: 'utf8' });

    let sessionId = null;
    let charsSinceLastBoundary = 0;
    let insertedCount = 0;
    let lineNo = 0;

    for await (const line of rl) {
      lineNo++;
      if (!line.trim()) { out.write('\n'); continue; }

      let obj;
      try { obj = JSON.parse(line); } catch (e) { out.write(line + '\n'); continue; }

      if (!sessionId && obj.sessionId) sessionId = obj.sessionId;
      const ts = obj.timestamp;

      while (nextIdx < sorted.length && ts && new Date(ts) >= new Date(sorted[nextIdx].timestamp)) {
        out.write(JSON.stringify(this._makeMarker(sessionId, sorted[nextIdx], charsSinceLastBoundary)) + '\n');
        insertedCount++;
        charsSinceLastBoundary = 0;
        nextIdx++;
      }

      charsSinceLastBoundary += line.length;
      out.write(line + '\n');
    }

    // Any boundaries whose timestamp never arrived (past end of file) - append at tail, flagged.
    while (nextIdx < sorted.length) {
      const b = sorted[nextIdx];
      out.write(JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        content: 'Conversation compacted',
        level: 'info',
        sessionId,
        timestamp: b.timestamp,
        uuid: crypto.randomUUID(),
        compactMetadata: {
          trigger: 'auto',
          source: 'sesh-nautilus-reconstructed-tail-overflow',
          sourceOrdinal: b.ordinal,
          note: 'Boundary timestamp fell after the last event in the target file; appended at tail.',
        },
      }) + '\n');
      insertedCount++;
      nextIdx++;
    }

    out.end();
    return { totalLines: lineNo, insertedCount, totalBoundaries: sorted.length };
  }
}

function createBoundaryExtractor(harness) {
  switch (harness.toLowerCase()) {
    case 'codex': return new CodexBoundaryExtractor();
    default: throw new Error('No BoundaryExtractor for harness: ' + harness);
  }
}

function createBoundaryInserter(harness) {
  switch (harness.toLowerCase()) {
    case 'claude-code': case 'claude': return new ClaudeBoundaryInserter();
    default: throw new Error('No BoundaryInserter for harness: ' + harness);
  }
}

module.exports = {
  BoundaryExtractor, CodexBoundaryExtractor,
  BoundaryInserter, ClaudeBoundaryInserter,
  createBoundaryExtractor, createBoundaryInserter,
};
