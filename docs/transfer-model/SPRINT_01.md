# Sprint 01: evidence, selection and ambient-policy handoff

Implemented on the contributor branch; not merged, published, installed globally or a complete MERIDIAN migration executor.

## Deliverables

- `@tools-of/sesh-evidence`: shared bounded JSONL reader, Codex/Claude provenance adapters, static JS-wrapper references, pure file selection, bounded ambient inventory, comparison and reconciliation brief. Acorn is pinned at 8.19.0; no recorded code is evaluated.
- `sesh-bloodhound`: explicit-tape scan CLI with page/cursor artifacts and scope gaps. Supports plain JSONL; compressed input is rejected with an expansion instruction.
- `agent-relocator ambient`: compare source/destination user guidance and configuration fingerprints, then generate `source.json`, `destination.json`, `comparison.json`, `RECONCILE_AMBIENT.md` and agent-owned `AGENTS.migration.md` for deliberate post-transfer reasoning.
- `agent-relocator select`: action/evidence/session/path filters with explicit allowed source roots and conflict reporting. It preserves folder/tree/depth requests but does not yet expand them or realize files. Every preview remains unready.
- Optional `ambientPolicy` record in transfer plans: separate inventories, recorded historical-policy references, agent guidance, reconciliation state, no automatic application, and individual hook review.

## Ambient policy is an independent resource and reconciliation task

An agent carries habits learned under user-level instructions, skills, hooks, tools, models, home paths and other settings. Present files, historical policy bytes recorded in tape metadata, current effective policy and inferred learned behavior are different evidence. Do not treat a copied home folder as the historical effective configuration.

The source user-home inventory is bounded and allowlisted. It fingerprints home-level AGENTS/CLAUDE guidance, selected harness config files and skills/hooks/rules/agents trees. It reports skipped depth, entry/byte bounds and links; it does not follow links or traverse auth stores. It records content hashes and source references, not configuration contents. Broader environment variables, registry, VS Code settings, command versions, external configuration roots and historical activation remain gaps. Scope bounds describe the allowlist only, not the entire ambient environment.

The handoff gives the transferred agent a route to the old drive and a reconciliation assignment. It asks the agent to preserve durable preferences, adapt machine-specific details, resolve conflicts with current destination guidance, and record decisions with hashes and before/after edits. Agent-specific preferences should land in agent-owned guidance rather than replacing globals used by other agents. Hook activation is a separate reviewed decision. The generator changes no source/destination settings and runs no hooks or skills. Its agent file is not claimed as loaded until a launch adapter demonstrates delivery.

Old-drive links depend on the drive remaining accessible. Before removing it, preserve the selected policy sources or replace those references with validated archive references. Inventory hashes alone do not preserve their content. A reconciliation deferred until after transfer remains an explicit pending unit requirement.

## Validation

Behavioral tests cover pagination across tool request/results, source/mapping change rejection, line and byte limits, malformed input, compression rejection, action/outcome classification, static code non-execution, selection conflicts, source-root constraints, and ambient hashing without activation. Existing transfer/request schema checks remain separate.

Pack all three sibling packages, then install their tarballs together in an isolated prefix. Validate installed entrypoints and the complete dependency tree, including Acorn. Source tests alone do not validate packaging. Private receipts and package hashes belong in the machine-local sprint evidence directory. Development prefixes never become canonical global installations.

A representative local run scanned preserved parent/child tapes and two bounded pages of the 489 MB MERIDIAN source tape. The pages consumed about 16.1 MB and retained a resume cursor. They surfaced many wrapper/unsupported-tool gaps; this is an initial candidate inventory, not a completed lifetime access trace. A pilot selection produced 21 candidate paths; an out-of-scope tree anchor was rejected before preview. Source/destination ambient inventories fingerprinted 280/306 files under configured bounds and reported their gaps. No MERIDIAN delivery/resume or source-policy mutation occurred.

## Remaining sprint sequence

1. Improve parser coverage using private gap counts and synthetic reproductions; recover the historical whodunnit prototype if found and reconcile attribution/behavior.
2. Extend the implemented ordered-page checks with stronger source checkpoints, compressed expansion with decoded-byte bounds, bounded concrete folder/tree expansion and preview fingerprints. A partial page set must not become a complete inventory.
3. Add native chamber mapping and dependency-safe two-instance projection in nautilus; preserve incoming checkpoint, two intervals, intervening boundary and envelope. Validate on disposable small forks before MERIDIAN. No slicing is implemented in this sprint.
4. Add beaver realization of resolved selected graphs, source/writer protections, portability and cleanup receipts.
5. Validate falcon multi-root instruction delivery; wire agent-owned ambient reconciliation guidance into the chosen launch adapter without global-settings replacement.
6. Assemble MERIDIAN RED/BLUE membership, lineage, resource closure and selected transfer recipe. Reasoned ambient reconciliation follows the agent's successful destination continuation.
