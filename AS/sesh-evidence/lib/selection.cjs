const path = require('node:path');
function keyFor(event) {
  const p = event.resolvedPath;
  if (!p) return null;
  const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(p);
  const normalized = (windows ? path.win32 : path.posix)
    .normalize(p)
    .replace(/\\/g, '/');
  return windows ? normalized.toLowerCase() : normalized;
}
function glob(pattern, value) {
  const escape = (c) => (/[.+^${}()|[\]\\]/.test(c) ? '\\' + c : c);
  let regex = '';
  pattern = pattern.replace(/\\/g, '/');
  value = value.replace(/\\/g, '/');
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*';
        i++;
      } else regex += '[^/]*';
    } else if (pattern[i] === '?') regex += '[^/]';
    else regex += escape(pattern[i]);
  }
  return new RegExp(
    '^' + regex + '$',
    /^[A-Za-z]:/.test(value) ? 'i' : '',
  ).test(value);
}
function contains(root, value) {
  const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(root);
  const p = windows ? path.win32 : path.posix;
  const r = p.relative(p.resolve(root), p.resolve(value));
  return (
    r === '' || (!r.startsWith('..' + p.sep) && r !== '..' && !p.isAbsolute(r))
  );
}
function assessCoverage(pages) {
  const tapes = new Map();
  let complete = pages.length > 0;
  for (const page of pages) {
    const c = page.coverage,
      id = c.checkpoint.realpath,
      prior = tapes.get(id);
    if (prior) {
      if (JSON.stringify(prior.checkpoint) !== JSON.stringify(c.checkpoint))
        throw new Error('Mixed source checkpoints');
      if (prior.end !== c.startOffset)
        throw new Error('Missing, duplicated or out-of-order evidence pages');
    } else if (c.startOffset !== 0) complete = false;
    if (page.gaps.length) complete = false;
    tapes.set(id, {
      checkpoint: c.checkpoint,
      end: c.endOffset,
      unresolvedCalls: page.unresolvedCalls,
    });
  }
  for (const t of tapes.values())
    if (t.end !== t.checkpoint.size || t.unresolvedCalls) complete = false;
  return complete;
}
function compileSelection(pages, selection) {
  const coverageComplete = assessCoverage(pages);
  let temporalWindow = null,
    windowKeys = null;
  if (selection.temporal) {
    const q = selection.temporal;
    if (
      !Number.isSafeInteger(q.lastTurns) ||
      q.lastTurns < 1 ||
      !q.sourceTape ||
      !q.sessionId ||
      !['observed', 'completed'].includes(q.completion)
    )
      throw new Error(
        'Temporal query requires lastTurns, sourceTape, sessionId and observed/completed policy',
      );
    const scoped = pages.filter(
      (p) => p.coverage.checkpoint.realpath === q.sourceTape,
    );
    if (!scoped.length || scoped.some((p) => p.turnIndexVersion !== 1))
      throw new Error(
        'Temporal query requires fresh turn-indexed evidence pages',
      );
    if (
      scoped[0].coverage.startOffset !== 0 ||
      scoped.at(-1).coverage.endOffset !==
        scoped.at(-1).coverage.checkpoint.size ||
      scoped.some((p) => p.coverage.gaps.length)
    )
      throw new Error(
        'Temporal query requires complete record coverage for its explicit source tape',
      );
    const turns = new Map();
    for (const p of scoped)
      for (const e of p.events) {
        if (
          e.eventKind !== 'turn-boundary' ||
          e.turn.sessionId !== q.sessionId ||
          (e.turn.localAgentId || null) !== (q.localAgentId || null)
        )
          continue;
        const t = turns.get(e.turn.key) || {
          ...e.turn,
          chambers: [],
          status: 'observed',
        };
        if (!t.chambers.includes(e.chamber)) t.chambers.push(e.chamber);
        if (e.phase === 'completed' || e.phase === 'aborted')
          t.status = e.phase;
        turns.set(e.turn.key, t);
      }
    const eligible = [...turns.values()].filter(
      (t) => q.completion === 'observed' || t.status === 'completed',
    );
    const retained = eligible.slice(-q.lastTurns);
    windowKeys = new Set(retained.map((t) => t.key));
    temporalWindow = {
      ...q,
      turns: retained,
      availableTurns: eligible.length,
      requestedTurns: q.lastTurns,
      windowSatisfied: retained.length === q.lastTurns,
      unknownTurnAccessesExcluded: 0,
      scope:
        'One explicitly identified source tape and actor; no inferred ordering across tapes. File filters operate within this window independently of history projection.',
    };
  }
  if (!['error', 'ordered-priority'].includes(selection.conflicts))
    throw new Error('Explicit conflict policy required');
  if (selection.defaultAction !== 'omit')
    throw new Error('Unmatched files must remain omitted in v0.1');
  if (new Set(selection.rules.map((r) => r.id)).size !== selection.rules.length)
    throw new Error('Duplicate rule IDs');
  if (
    !Array.isArray(selection.allowedSourceRoots) ||
    !selection.allowedSourceRoots.length
  )
    throw new Error('Explicit allowed source roots required');
  for (const r of selection.rules) {
    if (!['explicit', 'folder', 'tree'].includes(r.extent.mode))
      throw new Error('Unknown selection extent');
    if (r.extent.mode !== 'tree' && r.extent.maxDepth !== 0)
      throw new Error('Explicit/folder selection requires depth 0');
    if (
      r.extent.maxDepth !== null &&
      (!Number.isSafeInteger(r.extent.maxDepth) || r.extent.maxDepth < 0)
    )
      throw new Error('Invalid expansion depth');
    if (
      r.extent.anchor === 'explicit-root' &&
      (!r.extent.root ||
        !selection.allowedSourceRoots.some((root) =>
          contains(root, r.extent.root),
        ))
    )
      throw new Error('Expansion anchor outside allowed roots');
    if (
      ['recovery-source', 'preserved-evidence'].includes(
        r.binding.targetRole,
      ) &&
      r.binding.access === 'read-write'
    )
      throw new Error('Writable recovery/evidence target rejected');
  }
  const observations = new Map(),
    unresolved = [];
  // Updates for one call replace its requested observation; independent calls remain independent.
  for (const page of pages)
    for (const event of page.events) {
      if (event.eventKind !== 'file-access') continue;
      if (temporalWindow) {
        if (page.coverage.checkpoint.realpath !== temporalWindow.sourceTape)
          continue;
        if (!event.turn) {
          temporalWindow.unknownTurnAccessesExcluded++;
          continue;
        }
        if (!windowKeys.has(event.turn.key)) continue;
      }
      const key = keyFor(event);
      if (!key) {
        unresolved.push(event);
        continue;
      }
      const identity = `${page.coverage.checkpoint.realpath}:${event.observationId}`;
      observations.set(identity, {
        ...event,
        pathKey: key,
        sourceTape: page.coverage.checkpoint.realpath,
      });
    }
  const groups = new Map();
  for (const e of observations.values()) {
    if (!groups.has(e.pathKey)) groups.set(e.pathKey, []);
    groups.get(e.pathKey).push(e);
  }
  const selected = [],
    omitted = [],
    conflicts = [],
    outOfScope = [];
  for (const [key, events] of groups) {
    if (
      !selection.allowedSourceRoots.some((root) =>
        contains(root, events[0].resolvedPath),
      )
    ) {
      outOfScope.push({
        path: events[0].resolvedPath,
        reason: 'outside explicit allowed source roots',
      });
      continue;
    }
    const matches = [];
    for (const rule of selection.rules) {
      const q = rule.match;
      const relevant = events.filter(
        (e) =>
          (!q.sessions?.length || q.sessions.includes(e.sessionId)) &&
          (!q.paths?.length || q.paths.some((p) => glob(p, e.resolvedPath))) &&
          !q.pathsNone?.some((p) => glob(p, e.resolvedPath)),
      );
      const qualifying = relevant.filter(
        (e) => q.evidence.includes(e.evidence) && e.outcome !== 'failed',
      );
      if (!qualifying.some((e) => q.actionsAny.includes(e.action))) continue;
      // Any nonfailed recorded mutation blocks a read-only selector, even if evidence is weaker.
      if (
        relevant.some(
          (e) => e.outcome !== 'failed' && q.actionsNone.includes(e.action),
        )
      )
        continue;
      matches.push(rule);
    }
    if (!matches.length) {
      omitted.push({
        path: events[0].resolvedPath,
        actions: [...new Set(events.map((e) => e.action))],
      });
      continue;
    }
    const signatures = new Set(
      matches.map((r) =>
        JSON.stringify({ extent: r.extent, binding: r.binding }),
      ),
    );
    if (signatures.size > 1 && selection.conflicts === 'error') {
      conflicts.push({
        path: events[0].resolvedPath,
        rules: matches.map((r) => r.id),
      });
      continue;
    }
    const chosen = matches[0];
    selected.push({
      path: events[0].resolvedPath,
      pathKey: key,
      ruleId: chosen.id,
      matchedRules: matches.map((r) => r.id),
      actions: [...new Set(events.map((e) => e.action))],
      evidence: events.map((e) => ({
        sessionId: e.sessionId,
        localAgentId: e.localAgentId || null,
        sourceStoreId: e.sourceStoreId || null,
        action: e.action,
        outcome: e.outcome,
        evidence: e.evidence,
        sourceTape: e.sourceTape,
        callId: e.callId,
        chamber: e.chamber,
        turn: e.turn || null,
        source: e.source,
        resultSource: e.resultSource,
      })),
      extent: chosen.extent,
      binding: chosen.binding,
    });
  }
  const complete = coverageComplete;
  return {
    schema: 'sesh-selection-preview/v1',
    selected,
    omitted,
    conflicts,
    unresolved,
    outOfScope,
    temporalWindow,
    transcriptCoverageComplete: complete,
    executionReady: false,
    blockers: [
      ...(!complete ? ['Transcript coverage has gaps or partial pages'] : []),
      ...(conflicts.length ? ['Resolve overlapping selection rules'] : []),
      'Filesystem expansion, destinations, collisions, link capabilities, instruction loading and dependency completeness are not yet validated',
    ],
    scope:
      'Pure evidence selector; no filesystem traversal, copy, link, instruction changes or delivery',
  };
}
module.exports = { compileSelection, glob, keyFor, contains, assessCoverage };
