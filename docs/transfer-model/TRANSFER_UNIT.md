# One agent transfer as the reusable unit

A system migration is a collection of individually journaled agent transfers plus a relationship and shared-resource graph. The unit is one source session in one source store at one recorded checkpoint. A session UUID is a suitable folder name, but store identity and checkpoint remain required: cloned stores can contain the same UUID with different futures.

This is a resumable unit of work, not a cross-filesystem atomic transaction. Files, indexes, application writers, workspaces, and external services cannot be committed together by renaming one directory. Keep a journal of completed operations, evidence, remaining dependencies, and compensating actions. After destination continuation, rollback must preserve new events and new files before reversing bindings.

## Contract

Each unit records:

- **Identity:** source store, source session, checkpoint hash or event boundary, destination store/session, continuity intent, native fork provenance when applicable, source writer state, and destination writer owner.
- **Requested configuration:** a versioned configuration-space plan, including independent bindings for history, workspace, instructions, tools, references, caches, and Git metadata.
- **Path graph:** original logical path, mounted source path, destination lexical path, resolved physical path, file identity, mechanism, target role, access, availability, consumers, and required dependencies.
- **Preservation:** unmodified snapshots, hashes, original timestamps, directory inventory including empty directories, and provenance. Preserve source instructions before applying an overlay.
- **Journal:** operations and receipts with before/after observations, failures, recovery actions, active references, and cleanup decisions. Preserve failed attempts; a later fallback must not relabel the requested configuration as passed.
- **Acceptance:** history inspection, identity/lineage, destination appends, workspace coupling, path/tool compatibility, effective instructions, native topology, lifecycle operations, and portability. Each has its own status and evidence.

Suggested durable layout:

```text
transfers/<source-session-id>/
  README.md                 # current state, bindings, gaps, consumers
  unit.json                 # source/store/checkpoint + requested plan
  journal.jsonl             # append-only observations and operations
  preserved/                # unchanged recovery evidence
  expanded/                 # explicitly derived inspection copies, if needed
  workspace                 # active physical directory or explicit portal
  receipts/                 # compact validation and cleanup evidence
```

Disposable homes and fixture replicas belong outside this unit, in task-owned scratch storage. Runtime history normally belongs to the destination harness store; record its actual location rather than creating a second unexplained live tape inside the package. A workspace portal can point to a local original-path replica or another volume. Record that distinction and every remaining source-volume dependency.

## Checkpoints and acceptance gates

| Checkpoint | Required observation | Recovery behavior |
| --- | --- | --- |
| Discovered | Source identity, store, topology, writer state, resource inventory and unknowns recorded | No source mutation |
| Preserved | Source checkpoint and selected resources verified against unchanged snapshots | Restage from evidence |
| Staged | Destination files and bindings match the requested plan; collisions rejected | Remove only owned unconsumed staging |
| Registered | Harness discovers the intended destination ID, lineage and storage | Unregister through supported lifecycle; preserve evidence |
| Continued | A destination event is appended to the intended history with the intended writer ownership | Preserve the new future before rollback |
| Validated | Profile-specific requirements pass with receipts; required unknowns remain blockers | Retain working fallback and failed-profile evidence |
| Cleaned | No active consumer depends on scratch; owned temporary resources removed or blockers recorded | Never delete a live dependency to satisfy cleanup |

The read-only lens stops at inspection and has no continuation gate. An independent fork needs distinct future history and verified workspace sharing or isolation according to its plan. An exclusive continuation needs a writer handoff. An extended-access profile needs a demonstrated coordination protocol; two processes opening one tape is insufficient.

Readiness, completeness, portability and cleanup are separate outcomes. A source-dependent workspace can satisfy a declared dependent profile while failing portability. A chat can continue despite unresolved tool dependencies. A copied fallback can pass after a linked-history configuration failed; both outcomes must remain visible.

## System composition

The system manifest references unit IDs rather than duplicating their private logs. It records native parent/child edges separately from peers, sidecars, historical role claims, and fork provenance. Shared resources have one owner/binding record and a list of consumer units. A unit cannot remove a shared resource while another unit still requires it.

Migrate and validate shared prerequisites before dependent units. Validate relationships after the individual transfers: a readable child transcript does not establish a usable native child handle. A test fork is an experimental branch and must not silently replace an original system member.

System readiness is the conjunction of required unit gates, required relationship gates and required shared-resource gates. Keep partial success visible; do not flatten nine visible chats into a claim that a nine-agent system is operationally restored.
