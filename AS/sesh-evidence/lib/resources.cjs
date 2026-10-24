const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { contains, glob } = require('./selection.cjs');
const { positive } = require('./tape.cjs');
async function expandResourcePreview(selected, options) {
  const { allowedSourceRoots, destinationRoot } = options;
  if (!allowedSourceRoots?.length || !destinationRoot)
    throw new Error('Explicit source roots and destination root required');
  const limits = {
    maxFiles: 10000,
    maxBytes: 1024 ** 3,
    maxEntries: 100000,
    maxSeconds: 60,
    ...options.budgets,
  };
  Object.entries(limits).forEach(([k, v]) => positive(v, k));
  const start = Date.now(),
    resources = [],
    gaps = [],
    excluded = [],
    seen = new Map(),
    expanded = new Set(),
    seeds = [],
    expansionScopes = [],
    scopeMap = new Map();
  let entries = 0,
    bytes = 0,
    fileCount = 0,
    stopped = false;
  const roots = [];
  for (const root of allowedSourceRoots) {
    try {
      roots.push({
        lexical: path.resolve(root),
        physical: await fs.realpath(root),
      });
    } catch (e) {
      gaps.push({ path: root, kind: 'unavailable-source-root', code: e.code });
    }
  }
  async function add(file, anchor, origin, depth) {
    if (stopped) return;
    const exclusions = (options.excludePaths || []).filter(
      (pattern) =>
        glob(pattern, file) ||
        (pattern.endsWith('/**') && contains(pattern.slice(0, -3), file)),
    );
    if (exclusions.length) {
      excluded.push({ path: file, patterns: exclusions });
      return;
    }
    if (
      ++entries > limits.maxEntries ||
      Date.now() - start > limits.maxSeconds * 1000
    ) {
      stopped = true;
      gaps.push({ kind: 'entry-or-time-budget' });
      return;
    }
    const scope = roots.find((r) => contains(r.lexical, file));
    if (!scope) {
      gaps.push({ path: file, kind: 'outside-allowed-roots' });
      return;
    }
    let stat;
    try {
      stat = await fs.lstat(file);
    } catch (e) {
      gaps.push({ path: file, kind: 'missing-or-unreadable', code: e.code });
      return;
    }
    if (stat.isSymbolicLink()) {
      gaps.push({
        path: file,
        kind: 'link-not-followed',
        target: await fs.readlink(file),
      });
      return;
    }
    const physical = await fs.realpath(file);
    if (!contains(scope.physical, physical)) {
      gaps.push({ path: file, kind: 'ancestor-link-escapes-root', physical });
      return;
    }
    if (!stat.isFile() && !stat.isDirectory()) {
      gaps.push({ path: file, kind: 'unsupported-file-type' });
      return;
    }
    const relative = path.relative(anchor, file),
      destination = path.resolve(destinationRoot, relative);
    if (!contains(destinationRoot, destination))
      throw new Error('Destination escaped preview root');
    const destinationKey =
      process.platform === 'win32' ? destination.toLowerCase() : destination;
    const existing = seen.get(destinationKey);
    const physicalKey = (value) =>
      process.platform === 'win32' ? value.toLowerCase() : value;
    if (
      existing &&
      physicalKey(existing.physicalSource) !== physicalKey(physical)
    ) {
      gaps.push({
        path: file,
        kind: 'destination-collision',
        destination,
        otherSource: existing.source,
      });
      return;
    }
    if (!existing) {
      if (
        stat.isFile() &&
        (fileCount >= limits.maxFiles || bytes + stat.size > limits.maxBytes)
      ) {
        stopped = true;
        gaps.push({ path: file, kind: 'file-or-byte-budget' });
        return;
      }
      let destinationExists = false;
      try {
        await fs.lstat(destination);
        destinationExists = true;
      } catch (e) {
        if (e.code !== 'ENOENT')
          gaps.push({
            path: destination,
            kind: 'destination-stat-error',
            code: e.code,
          });
      }
      const record = {
        source: file,
        physicalSource: physical,
        destination,
        kind: stat.isFile() ? 'file' : 'directory',
        bytes: stat.isFile() ? stat.size : 0,
        mtimeMs: stat.mtimeMs,
        dev: stat.dev,
        ino: stat.ino,
        scopeIds: [origin.scopeId],
        ruleIds: [origin.ruleId],
        requestedAction: origin.binding?.action || 'copy',
        requestedAccess: origin.binding?.access || 'read-write',
        destinationExists,
        contentHashed: false,
      };
      seen.set(destinationKey, record);
      resources.push(record);
      if (stat.isFile()) {
        bytes += stat.size;
        fileCount++;
      }
    } else {
      if (
        existing.requestedAction !== (origin.binding?.action || 'copy') ||
        existing.requestedAccess !== (origin.binding?.access || 'read-write')
      )
        gaps.push({
          path: file,
          kind: 'incompatible-resource-bindings',
          destination,
          rules: [...existing.ruleIds, origin.ruleId],
        });
      if (!existing.ruleIds.includes(origin.ruleId))
        existing.ruleIds.push(origin.ruleId);
      if (!existing.scopeIds.includes(origin.scopeId))
        existing.scopeIds.push(origin.scopeId);
    }
    if (!stat.isDirectory() || origin.extent.mode === 'explicit') return;
    const limit = origin.extent.mode === 'folder' ? 0 : origin.extent.maxDepth;
    if (limit !== null && depth > limit) return;
    const expansionKey = JSON.stringify([
      file,
      origin.scopeId,
      limit === null ? null : limit - depth,
    ]);
    if (expanded.has(expansionKey)) return;
    const directory = await fs.opendir(file);
    for await (const entry of directory) {
      if (stopped) break;
      await add(
        path.join(file, entry.name),
        anchor,
        origin,
        stat.isDirectory() && entry.isDirectory() ? depth + 1 : depth,
      );
    }
    if (!stopped) expanded.add(expansionKey);
  }
  let selectionsVisited = 0;
  for (const origin of selected) {
    const p = path.resolve(origin.path),
      mode = origin.extent.mode;
    if (!['explicit', 'folder', 'tree'].includes(mode))
      throw new Error('Unknown extent');
    if (
      mode === 'tree' &&
      origin.extent.maxDepth !== null &&
      (!Number.isSafeInteger(origin.extent.maxDepth) ||
        origin.extent.maxDepth < 0)
    )
      throw new Error('Invalid tree depth');
    const root = roots
      .filter((r) => contains(r.lexical, p))
      .sort((a, b) => b.lexical.length - a.lexical.length)[0];
    if (!root) {
      gaps.push({ path: p, kind: 'outside-allowed-roots' });
      continue;
    }
    const input =
      origin.extent.anchor === 'explicit-root'
        ? path.resolve(origin.extent.root)
        : origin.extent.anchor === 'file-parent'
          ? path.dirname(p)
          : p;
    const seed = {
      id: `seed-${seeds.length + 1}`,
      path: p,
      ruleId: origin.ruleId,
      evidence: origin.evidence || [],
    };
    seeds.push(seed);
    const scopeKey = JSON.stringify([
      process.platform === 'win32' ? input.toLowerCase() : input,
      origin.ruleId,
      origin.extent,
      origin.binding,
      process.platform === 'win32' ? root.lexical.toLowerCase() : root.lexical,
    ]);
    let scope = scopeMap.get(scopeKey);
    if (!scope) {
      scope = {
        id: `scope-${expansionScopes.length + 1}`,
        anchor: input,
        sourceRoot: root.lexical,
        extent: origin.extent,
        binding: origin.binding,
        seedIds: [],
        origin,
      };
      scopeMap.set(scopeKey, scope);
      expansionScopes.push(scope);
    }
    scope.seedIds.push(seed.id);
  }
  for (const scope of expansionScopes) {
    if (stopped) break;
    selectionsVisited += scope.seedIds.length;
    await add(
      scope.anchor,
      scope.sourceRoot,
      { ...scope.origin, scopeId: scope.id },
      0,
    );
  }
  for (const scope of expansionScopes) delete scope.origin;
  const direct = new Map();
  for (const seed of seeds) {
    const k =
      process.platform === 'win32' ? seed.path.toLowerCase() : seed.path;
    if (!direct.has(k)) direct.set(k, []);
    direct.get(k).push(seed.id);
  }
  for (const resource of resources) {
    resource.directSeedIds =
      direct.get(
        process.platform === 'win32'
          ? resource.source.toLowerCase()
          : resource.source,
      ) || [];
    resource.inclusion = resource.directSeedIds.length
      ? 'selected-reference'
      : 'folder-expansion';
  }
  resources.sort((a, b) => a.destination.localeCompare(b.destination));
  return {
    schema: 'sesh-resource-expansion-preview/v1',
    resources,
    seeds,
    expansionScopes,
    gaps,
    excluded,
    bytes,
    entries,
    selectionsVisited,
    selectionsRequested: selected.length,
    complete: !stopped && gaps.length === 0,
    fingerprint: crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          resources,
          seeds,
          expansionScopes,
          excludePaths: options.excludePaths || [],
        }),
      )
      .digest('hex'),
    executionReady: false,
    scope:
      'Metadata-only bounded expansion, no source writes or destination creation. Links not followed; source bytes and target capabilities remain unverified.',
  };
}
module.exports = { expandResourcePreview };
