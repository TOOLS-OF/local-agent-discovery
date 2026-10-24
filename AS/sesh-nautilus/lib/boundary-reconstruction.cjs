// Polymorphic boundary extraction/insertion: reconstructs compaction/context
// chamber structure across harness session-file formats. Mirrors the
// SessionDiscovery pattern in session-discovery.js (one abstract concept,
// one concrete subclass per harness).
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');

// ---- Extraction: pull real compaction boundary events out of a source session ----

class BoundaryExtractor {
  // Returns [{ ordinal, timestamp, readableMessages, opaqueCount }] sorted by
  // timestamp. readableMessages are real, verbatim content the source
  // harness itself preserved across the boundary - never synthesized.
  async extractBoundaries(sessionFile) { throw new Error('impl'); }
}

class CodexBoundaryExtractor extends BoundaryExtractor {
  constructor() { super(); this.harness = 'codex'; }

  // Codex's replacement_history mixes two kinds of entries: real
  // message/user and message/developer items with plain-text content (what
  // Codex itself chose to carry forward across the compaction), and a
  // "compaction" item whose actual summary is `encrypted_content` -
  // genuinely opaque, not decodable by this tool. We carry the former
  // forward verbatim and count-but-never-fabricate-a-substitute-for the
  // latter. Never invent replacement text for what we can't read.
  _splitReplacementHistory(replacementHistory) {
    const readableMessages = [];
    let opaqueCount = 0;
    for (const item of replacementHistory || []) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        const text = item.content
          .filter(c => typeof c.text === 'string')
          .map(c => c.text)
          .join('\n');
        if (text) readableMessages.push({ role: item.role || 'user', text });
      } else {
        // e.g. type "compaction" carrying only encrypted_content - real
        // data exists here, but this tool cannot read it. Count it, don't
        // guess at it.
        opaqueCount++;
      }
    }
    return { readableMessages, opaqueCount };
  }

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
          const { readableMessages, opaqueCount } = this._splitReplacementHistory(obj.payload?.replacement_history);
          boundaries.push({
            ordinal: obj.ordinal,
            timestamp: obj.timestamp,
            readableMessages,
            opaqueCount,
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
        readableMessageCount: boundary.readableMessages?.length || 0,
        opaqueContentCount: boundary.opaqueCount || 0,
        opaqueContentNote: boundary.opaqueCount
          ? `${boundary.opaqueCount} item(s) of the source compaction's own summary were encrypted at the source and are not recoverable by this tool - not fabricated, genuinely missing.`
          : undefined,
      },
    };
  }

  // Real, verbatim messages the source harness itself preserved across this
  // boundary - never a synthesized recap. Emitted as their own events
  // immediately after the marker, each with its original role intact, so a
  // reader can tell "this is what Codex chose to carry forward" apart from
  // "this is the live conversation resuming."
  _makeReadableMessageEvents(sessionId, boundary) {
    return (boundary.readableMessages || []).map(m => ({
      type: 'user',
      isSidechain: false,
      sessionId,
      timestamp: boundary.timestamp,
      uuid: crypto.randomUUID(),
      message: {
        role: m.role === 'developer' ? 'user' : m.role,
        content: [{
          type: 'text',
          text: `[sesh-nautilus: verbatim content Codex itself preserved across this compaction, role=${m.role}]\n\n${m.text}`,
        }],
      },
    }));
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
        const boundary = sorted[nextIdx];
        out.write(JSON.stringify(this._makeMarker(sessionId, boundary, charsSinceLastBoundary)) + '\n');
        for (const ev of this._makeReadableMessageEvents(sessionId, boundary)) {
          out.write(JSON.stringify(ev) + '\n');
        }
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
          readableMessageCount: b.readableMessages?.length || 0,
          opaqueContentCount: b.opaqueCount || 0,
          note: 'Boundary timestamp fell after the last event in the target file; appended at tail.',
        },
      }) + '\n');
      for (const ev of this._makeReadableMessageEvents(sessionId, b)) {
        out.write(JSON.stringify(ev) + '\n');
      }
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
