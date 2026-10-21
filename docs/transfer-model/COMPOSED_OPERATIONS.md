# Composed archaeology and relocation operations

Design status: proposed interfaces and selection contract, not an implemented scan/transfer pipeline. This extends the transfer-unit model without turning beaver into an orchestrator. Preserve existing animal responsibilities and reuse their adapters. The request schema and synthetic example describe configuration, not installed commands or working harness capabilities.

## Animals and trades

| Piece | One responsibility | Status and seam |
| --- | --- | --- |
| sesh-hound | Locate sessions and stores | Existing discovery tools; offline source-root behavior needs adapter validation |
| sesh-bloodhound | Extract recorded provenance events from transcripts | Open design/develop issues; reported whodunnit prototype not yet located or validated in this investigation |
| sesh-bee | Render readable dialogue | Existing extract; omits tool blocks, so it cannot replace bloodhound evidence |
| sesh-nautilus | Describe and transform context-chamber structure | Existing Codex boundary extraction / Claude insertion; propose boundary indexing and valid retained-chamber projection here |
| sesh-beaver | Realize a resolved filesystem resource graph | Proposed copy/link/rebuild binding executor, integrity and owned-resource cleanup; no session search, migration policy, history surgery or launch orchestration |
| sesh-stork | Deliver a finished tape into a target store and verify delivery | Existing Claude delivery adapter; file supplied as-is; does not choose retained history |
| sesh-falcon | Apply supported launch configuration | Existing launch tools; proposed explicit multi-root adapter validation |
| agent-sleuth | Interpret discovery/provenance evidence | Existing persona design #25; commands hound and bloodhound |
| agent-archaeologist | Interpret context continuity and knowledge carried across boundaries | Existing persona design #26; composes provenance and nautilus chamber evidence |
| agent-relocator | Scope and coordinate system relocation | Proposed humanoid trade; composes sleuth/archaeologist work, beaver, stork, falcon and acceptance checks |
| agent-auditor | Judge evidence against the requested policy | Existing persona design #34; separate conclusions for coverage, history, resources, instructions and cleanup |

The trade names are provisional. These are role specifications, not created agent sessions or installed personas. A person or agent can fulfill several trades. The animal registry should reference the contracts; this document does not replace the proposed sesh-king governance spec (#22).

Shared streaming JSONL readers, compression handling, harness record adapters, path mapping and receipt formats belong in reusable libraries. Bloodhound and nautilus should consume shared parsing primitives rather than independently guessing formats. Bloodhound emits recorded tool/lineage facts; nautilus owns context-chamber structure; the archaeologist interprets what those facts mean.

## Bounded discovery before mutation

Use separate artifacts and invocations:

1. **System selection:** root session/store/checkpoint; include native children, explicit peers and sidecars through typed edges. Each edge expansion has a depth and session budget. A matching title alone does not establish membership.
2. **Scan request:** explicit closet roots and mount mappings; session/date/chamber filters; byte, decompressed-byte, line-size, event, time and session budgets. No recursive disk-wide search or executing recorded commands.
3. **Evidence:** append-only normalized events plus coverage per source tape and parser. Stop cleanly at a budget with a source fingerprint and cursor, not a misleading complete result. Resuming against a changed checkpoint requires reconciliation. Record unsupported tools, malformed/oversized records, truncated results, opaque content, external services, and missing child tapes.
4. **Selection preview:** aggregate path evidence and candidate folder roots; apply user rules; list exact resulting resources, estimated bytes, expansion reasons, excluded and unresolved paths, collisions, shared consumers and instruction changes. Filesystem expansion has its own budgets; a cheap transcript scan cannot authorize an unlimited directory walk.
5. **Resolved plan:** immutable/versioned plan tied to evidence, policy and source fingerprints; explicit per-resource actions and destinations, history derivative, launch roots and instruction requirements. Changing the policy or checkpoint invalidates that preview. A new scope expansion needs an updated plan rather than hidden execution-time widening.
6. **Execution and acceptance:** relocator sequences the focused animals, uses supported writer handoff, records each receipt, and checks the destination's actual behavior. Existing user authorization governs execution; these artifacts do not impose an additional blanket confirmation requirement.

Transcript scope, filesystem expansion scope, retained runtime history, and system membership are independent. Scan the full pristine history within budgets even if only two chambers will be delivered, or explicitly select a narrower archaeology window and expose the resulting coverage gap. A tail scan does not justify claiming the agent's lifetime filesystem inventory is complete.

## Bloodhound evidence contract

Each observation needs source store/session/tape fingerprint, event offset and line, call ID and result ID, timestamp, tool/schema adapter, context-chamber/instance locator when known, lexical path, base cwd/root and path namespace, mapped/resolved path when justified, action, outcome, and evidence strength. Evidence must link back to the original event; do not store secrets or entire tool payloads merely to cite an offset.

Actions include `read`, `edit`, `create`, `write` (create-or-overwrite unresolved), `delete`, `rename-source`, `rename-destination`, `scan`, `mention` and `unknown`. Distinguish a directory search from reading every file below it. Distinguish requested, succeeded, failed and unknown outcomes; even a successful shell exit does not prove each inferred file access succeeded. Mark inferred shell effects separately from explicit file-tool effects.

An explicit new-file patch with a successful result can establish creation. A generic Write call usually establishes a write request, not whether the file was newly created or overwritten. Shell commands, nested JavaScript tool wrappers, scripts, globs, environment variables, changing cwd, remote paths and linked resources can leave unresolved effects. Never upgrade ambiguity to a proven creation or a complete resource list. No generic transcript parser can prove all indirect OS-level file accesses.

File groups are not mutually exclusive: one path can have read, edit and create evidence across its lifetime. Aggregate each action without erasing its provenance. Queries can select `ever-read`, `ever-edited`, `ever-created`, `read-without-any-write`, time windows, chosen agents or evidence classes. Normalize aliases only with namespace and identity evidence; retain the original lexical references.

Incorporate the work tracked in [bloodhound design #23](https://github.com/TOOLS-OF/local-agent-discovery/issues/23) and [Level 0 development #24](https://github.com/TOOLS-OF/local-agent-discovery/issues/24). First recover/audit whodunnit if available; otherwise retain that provenance and implement missing adapters openly. Do not rename our absolute-path regex helper as a completed bloodhound implementation.

## Selection and expansion policy

Keep action filters separate from materialization. For example:

| Predicate | Selected extent | Requested action |
| --- | --- | --- |
| Proven created files | Explicit files | Copy to an independent working destination |
| Proven edited files, excluding proven created files | Explicit files | Copy |
| Read files with no recorded mutation | Explicit files | Link to declared live/reference storage with read-only access required |
| Selected generated-output directory | Folder tree to depth 2 | Copy |
| Known repository root | Git worktree / reconstruction | Preserve dirty/untracked assets and required Git metadata |

These are example preferences, not defaults silently applied to a real agent. Read-only link access needs enforcement separate from the link. Linking reference files on D: retains source-volume dependence. Recovery and preserved evidence cannot become writable targets.

Extent choices:

- **Explicit:** only selected paths; do not imply their parent directory contents were selected.
- **Folder:** immediate files of an explicitly named directory (depth 0); subdirectories can be listed as empty entries without selecting their contents.
- **Tree:** the folder's files plus descendant files up to the configured depth. Depth 1 includes files in immediate child directories. `null` means unlimited depth only when explicitly selected; file/byte/time budgets still apply.

A file-to-parent expansion records the exact parent chosen and the rule that selected it. A reference to a directory, a search scope and an inferred project root are separate candidates, not automatic authorizations to copy whole trees. Default link traversal is off; bounded explicit traversal records final targets, cycles and volume/network dependencies. Followed links may not escape the authorized source roots. Changes between preview and copy are detected rather than absorbed into a different unreviewed plan.

Rules carry IDs and predicates. If two rules select the same resource with incompatible actions or destinations, default to a visible conflict. An explicit ordered-priority policy can resolve it; report both matches and the winner. Tree expansion can conflict with more specific file rules, so resolve operations over the final concrete resource graph, including copy/link ancestor conflicts and shared-resource consumers. Selected exact files do not imply a complete runnable project; dependency exceptions remain visible.

## Multiple folder roots and instruction effects

Derive candidate project roots from explicit cwd changes, tool working directories, repeated path clusters, repository roots and instruction-file references, retaining the derivation evidence. Let the user choose roots and roles. Distinguish:

1. Files preserved/materialized.
2. Folders exposed to the harness as runtime project roots.
3. Read/write filesystem grants and external service permissions.
4. Instruction roots whose guidance must be loaded, with scope, precedence and source hashes.

None implies the others. Copying an AGENTS.md file or granting directory access is not evidence it became active guidance. The [Codex AGENTS guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) documents project-root-to-cwd discovery; the [CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli) describes `--add-dir` as extra write access. Those pages do not establish that every additional directory becomes an instruction root. The locally generated app-server protocol exposes `runtimeWorkspaceRoots` and returned `instructionSources`; exact behavior still requires a version-specific probe.

Falcon's adapter should emit requested roots, effective roots, requested instruction sources, effective instruction sources, scope/merge order and content hashes. If native multi-root guidance is unsupported, report the capability gap or use an explicitly selected scoped instruction overlay. An overlay changes delivery/precedence and must not be represented as verified native loading. Do not flatten several projects' conflicting instructions into global guidance silently. Adding/removing roots needs instruction refresh/restart semantics to be tested separately from access grants.

## Slim history as a derived artifact

The selected policy is: retain the incoming checkpoint before the older retained context instance, the latest two context instances, and their intervening compaction boundary. A context instance here means a context interval/chamber, not an OS process, source session UUID, filename or inferred q-semver. Prefer verified source order and record offsets over timestamps alone. A single session can contain many intervals, while a converted lineage can span several tapes.

This is a proposed nautilus **projection** operation. Nautilus currently reconstructs Codex boundaries into converted Claude history without pruning the tape. Stork currently delivers a supplied finished tape unchanged; it is not the place to decide what to retain.

Required projection inputs are source checkpoint, verified chamber map, retained intervals, incoming checkpoint policy, target harness/format, identity policy and output path. Required results include source hash, output hash, retained event ranges, checkpoint/boundary provenance, excluded ranges, any dependency closure added beyond the selected intervals, opaque/unsupported items and validation status.

Always retain required native envelope metadata, session/lineage fields, message/call/result relationships, and valid turn boundaries. Follow reply/parent/reference chains; if those dependencies cannot be satisfied, block projection or explicitly expand its scope and show the change. Fewer than two verified intervals means retain all available intervals and report their count. Unknown boundaries block a claim that exactly two intervals were preserved. An in-flight final turn requires a settled checkpoint before continuation-oriented projection.

An opaque native compaction payload may be reusable by the same harness only if its adapter demonstrates that behavior. It cannot be translated by inventing a readable summary. Cross-harness projections must report missing state or use a separately requested, labeled summary regeneration policy. Preserving a marker alone does not preserve the context it represents. The two-interval profile is a useful candidate, not proof of suitability until the exact target resumes and passes continuity/resource probes.

Directory roles:

```text
preserved/                         unchanged source bytes
expanded/                          lossless decompression / inspection derivative
derived/history/<recipe-id>/        slim or converted tape + recipe + provenance
receipts/                          parse, projection, delivery and continuation results
```

Keep `expanded/` lossless and put truncation in `derived/`: this makes the distinction visible and lets older audits continue to cite expanded event positions. A derived tape is never linked back as a writable view of the pristine source. It can become the input to stork after validation; the new live tape belongs to the destination store. Scope/history changes do not secretly change continuity intent or allocate a replacement UUID; use the configured supported identity mechanism and preserve the source lineage.

## Staged implementation and experiments

1. Shared bounded tape reader and normalized provenance contract; Codex and Claude adapters with truthful unsupported-tool coverage. Recover/audit the reported prototype and reconcile it with #24 before claiming reuse.
2. Sleuth read-only inventory on the preserved three-aces parent and children. Compare known authored worktrees, memory folder and tools against extracted evidence; add cross-folder fixtures and parser tests.
3. Pure selection compiler: action predicates, explicit/file-parent/folder/tree extents, depth/budget semantics, deterministic conflicts and preview. No mutation in this stage.
4. Narrow beaver graph realization with no policy inference; retain existing Windows capability limits and source protections.
5. Nautilus chamber map and projection: synthetic native envelopes, opaque checkpoint cases, dangling call/result and parent-chain rejection; preserve source hashes; prove target resume on a disposable small fork before MERIDIAN.
6. Falcon multi-root experiment with two different scoped instruction markers; measure effective sources, permissions, reload behavior and conflict precedence in each harness adapter.
7. Relocator composes individual transfer units; auditor checks collection topology and shared consumers. MERIDIAN's large pristine tapes are scanned with resumable budgets before selecting its mutation scope or delivering any slim history.

The synthetic request in `examples/relocation/bounded-two-instance-request.json` and `relocation-request.schema.json` make the proposed controls reviewable. Structural checks are not an extractor, selection compiler, slicer, installed command or operational readiness evidence.
