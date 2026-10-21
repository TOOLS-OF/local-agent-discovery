# Offline drive discovery audit

Investigation branch: `ottobot-00q/offline-transfer-audit`, based on main commit
`06551ee15db274f5900d04078bc07491eebe8731`.

## Requirements

An offline source must have explicit, authoritative storage roots independent of
the workspace path being matched. Running from another drive must not be treated
as selecting that drive's user profile. Report chosen stores and per-store errors;
never silently substitute current-host state when an explicit root is missing.

Keep three distinct paths: the workspace path recorded in history, its mounted
source location, and its proposed destination. Preserve the raw history and apply
relocation mappings outside it. Handle extended Windows paths, compressed tapes,
archived tapes, and multiple filename candidates per session without deleting
variants. Filename UUIDs alone do not establish the identity of every resumed or
converted artifact.

## Findings from inspected code

- Main's package and BAT entrypoints invoke `sesh-hound.js`; its extended script
  is separate. Validate behavior through the actual installed command.
- Default discovery roots derive from the running user's home. Main's Claude
  `--config-dir` adds roots rather than isolating an offline store.
- Offline development worktrees can contain absolute `.git` pointers to the old
  machine. Preserve the common Git directory and dirty files before repair.
- A separate source-drive worktree with native Codex support has `--codex-db`,
  but its `findDb` implementation sorts overrides together with home defaults by
  modification time. A newer host database can win over an explicit source.
- Some JSONL readers load the full file before slicing a small prefix. Use
  bounded reads and streaming, especially when a source drive has I/O problems.
- Real source indexes can name `.jsonl` paths whose tapes are now `.jsonl.zst`.
  Report compressed counterparts and preserve all variants.

## Proposed implementation order

1. Reconcile native-edge and nested-closet branch changes with current main,
   retaining provenance and tests before adopting either as the runtime default.
2. Add a source profile or explicit roots for Codex, Claude, VS Code profiles,
   and other supported harnesses. Explicit selection must exclude host defaults
   unless mixing stores was separately requested.
3. Make missing roots and schema errors visible; expose the source identity and
   path mappings in JSON results. Keep discovery read-only at the source.
4. Replace unbounded prefix reads and add compressed-tape metadata discovery.
5. Test using isolated fixture stores: newer C: DB versus explicit D: DB, missing
   explicit root, old C: workspace metadata on mounted D:, extended paths,
   duplicate/resumed tapes, compressed children, and native graph cycles.
6. Pack and install into an isolated prefix, verify every entrypoint and sibling
   dependency, then promote a reviewed integrated commit using the shared
   dogfooded-repository policy. Record the actual resolved command and revision.

No raw user logs, credentials, local indexes, or private manifests belong in this
repository. This audit does not claim the proposed implementation has landed.

## Bounded recovery experiment

A three-session family was successfully continued on a second Windows host using
separate runtime copies and the installed app-server protocol. The workflow first
validated a parent resume by explicit rollout path in an isolated harness home.
On the live destination, `thread/read` indexed each copied family member before
the parent and children were resumed in order. Attempting to resume an unindexed
child failed despite the tape existing; indexing it and loading the parent first
allowed the original native child to resume. A parent validation message then
reached both exact existing children through native handles. This is evidence
for that bounded migration, not a universal cross-version restart guarantee.

One child tape can contain both its own opening session metadata and inherited
parent metadata later in the file. Do not overwrite a child's identity with a
later inherited parent ID, or flatten its native source relationship to make a
peer session easier to import. Preserve raw tapes and use official runtime
operations to reconstruct state where possible.

The current history renderer emitted warnings for some historical tool items
with unknown turn IDs. Keep complete raw evidence and distinguish readable
recent history from verified full historical UI fidelity.
