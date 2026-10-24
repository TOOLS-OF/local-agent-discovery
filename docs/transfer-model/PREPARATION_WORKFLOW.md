# Transfer preparation workflow

The current implementation gathers evidence and writes derived previews/candidates. It does not realize workspace copies, import sessions, reconstruct Created Tasks UI links, launch agents, or certify continuation. Native Codex reload trials are the immediate migration target; Claude delivery/conversion improvements remain separate future work.

## Supported commands and independent axes

| Step | Command | Result |
|---|---|---|
| Expand preserved compression | `agent-relocator expand-tape` | New lossless gzip/Zstandard snapshot and hash receipt |
| Scan recorded provenance | `sesh-bloodhound` | Bounded page, gaps and continuation cursor; scoped actor, turn, chamber, request/result and path evidence |
| Inspect native history | `sesh-nautilus inspect` | Bounded boundary, envelope and tool-dependency map |
| Choose history | `sesh-nautilus plan` | Incoming checkpoint, retained intervals, intervening boundaries and structural blockers |
| Derive candidate | `sesh-nautilus project` | Verbatim byte-range copy plus receipt; not delivered or boot-validated |
| Choose resources | `agent-relocator select` | Action/evidence/path/session filters; optional independent last-N-turn window |
| Expand resources | `agent-relocator expand` | Metadata-only explicit-file, folder or depth-bounded tree preview; no workspace creation |
| Prepare ambient handoff | `agent-relocator ambient` | Fingerprints, comparison and agent-local reconciliation assignment; no settings applied |

Run each command's documented help (`agent-relocator --help`, `sesh-bloodhound --help`, `sesh-nautilus inspect|plan|project --help`) for flags. Every output must be a new path. CLI paths to page arrays are resolved relative to the page-list file; explicit source/allowed roots remove dependence on the current user's home. A source-mount mapping is not a destination rewrite.

All four packages must be installed together with their required dependency closure. Use the [contributor validation script](../../CONTRIBUTING.md) for an isolated development installation. Current versions are Evidence/Bloodhound/Relocator 0.2.1 and Nautilus 1.1.1, with Acorn pinned for static analysis. Never evaluate recorded commands to discover paths.

## Minimal dry-run sequence

1. Preserve/hash the inactive source tape on healthy storage. Expand compressed input into a new derived file if needed. Keep pristine source and working candidates distinct.
2. Scan from offset zero with explicit harness and path mappings. Continue pages using the previous page's cursor until complete or a declared bound stops progress. Retain pages in source order. Increasing a bound is an explicit scope decision; an empty page is not completion.
3. Inspect history independently and plan the desired context intervals. Source-end projection blocks unfinished calls; `last-completed-turn` explicitly records excluded tail bytes. Do not silently discard the tail or substitute a synthesized summary. Reused IDs are correlated by ordered occurrence, with overlapping requests treated as ambiguous.
4. Compile a complete relocation-request selection. For “two history instances, files accessed over the last ten completed turns,” keep history retainedIntervals at two and add `selection.temporal` as shown in [Sprint 02](SPRINT_02.md). This window requires fresh full-record evidence from one identified tape and actor; cross-tape ordering needs a verified lineage adapter. File-action exclusions apply within the chosen window.
5. Expand selected paths with explicit allowed roots, destination preview root, exclusions and budgets. `folder` depth zero includes immediate files and directory metadata. `tree` with a depth cap traverses that depth; `maxDepth: null` requests a full tree, still bounded by file/byte/entry/time budgets. Exclusions prune separately preserved tape stores. Link targets are not followed.
6. Preserve receipts. Review missing files, path collisions, unresolved namespaces, Git restoration choices, ambient guidance delivery and exact runtime dependencies before any future import.

The resource provenance join is `resource.scopeIds -> expansionScopes.seedIds -> seeds.evidence`. `directSeedIds` distinguishes referenced files from siblings included only through expansion. The same tape offsets join access observations to a history candidate's copied ranges, even when that access window extends beyond delivered history.

## Boundaries of evidence

- Complete JSONL byte coverage does not prove all filesystem effects were captured. Shell/static wrapper operations remain candidates; failed/unknown outcomes are distinct.
- Cursors and plans are trusted local artifacts tied to source checkpoints. The checkpoint is file metadata plus a 16 KiB head hash; per-page hashes cover consumed records. Preserve full-file hashes separately. Do not mix altered pages or cursor state.
- Metadata previews describe current source files and do not hash every expanded resource. Historical access time does not establish historical file bytes; Git/snapshots are a separate version source.
- A candidate that passes range/tool-closure checks may still fail native checkpoint applicability, rendering, instruction loading, target identity or continuation. `executionReady` remains false.
- Git/source/branch/worktree/path choices are [validated contracts](GIT_AND_CREATED_TASKS.md), not implemented clone executors. Copying a shared source checkout does not establish ownership of every dirty file.
- Created standalone tasks require creator evidence and an identity map; native children, messaged peers and co-located chats remain different edge types. App-visible reconstruction is unvalidated.
- Ambient instructions/skills/hooks are inventoried for reasoning after transfer. No hooks execute, no global guidance is replaced, and ancestor links are not followed during inventory.

## Cleanup and operational acceptance

Keep durable transfer records under source-session IDs; keep disposable harness homes/test databases in owned scratch storage. Record consumers and dependency paths before cleaning only owned inactive scratch, with Windows resolved-path and reparse-point checks. Recovery originals and active workspaces are not disposable test state.

A usable reload must be visible/openable, continue under its intended identity, report its actual cwd and loaded guidance, resolve its required tools, and complete a representative development task on its own branch/worktree. Phone access additionally requires an awake connected host and an end-to-end phone check; source tests and a local transcript cannot establish that acceptance.
