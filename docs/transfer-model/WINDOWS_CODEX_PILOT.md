# Windows Codex configuration pilot

Observed on 2026-10-21 UTC using Windows build 26200 and the bundled Codex app-server reporting `0.163.0-alpha.10.2`. This is local experimental evidence, not a supported-platform guarantee. Private session IDs, tapes, instruction contents and machine paths remain in machine-local manifests.

The subjects were six existing peer sessions in one small system, plus one deliberately created native fork. A previously migrated parent and its two genuine native children supply the topology reference. The peers' historical names described them as subagents, but the native relationship and corrected instructions identify them as peers. The experimental fork is an additional branch, not a replacement member.

## Measured configurations

| Configuration | Observation | Limit |
| --- | --- | --- |
| Copied history and workspace, original launch path | Original IDs continued; original absolute and relative instruction paths reached the replica; probe writes reached the intended directory and were removed | Bounded workspace tests; historical tool/service closure remains unaudited |
| Copied history, remapped copied workspace | Original IDs continued at the new cwd; relative reads/writes worked | Original absolute cwd was absent, so its absolute references were not restored |
| Transfer workspace portal to local original-path replica | Portal and canonical launch path reached one directory; alias launch after archive/unarchive and fresh server resume passed | Potential instruction ancestors and requested versus resolved paths must be recorded separately |
| Copied history, original-path junction to a D: workspace fixture | Continuation and intended D: writes passed; lexical aliases referred to the same target | Harness thread cwd resolved to the D: target, even where resume response cwd retained a lexical alias |
| Copied workspace, history directory junction into D: fixture | Filesystem existence and identity passed; stored-thread read and explicit resume failed with `no rollout found` | This linked-history configuration failed; a subsequent normal C: copy passed as a separate fallback |
| Both workspace and history linked with directory junctions | Workspace binding worked; history lookup failed | No successful linked-history continuation or compaction was established |
| True file/directory symbolic links | Creation failed with WinError 1314, privilege not held | Capability-blocked. A junction is a distinct mechanism; true file-link behavior remains untested |
| Read-only history lens in disposable home | Stored history and turn inspection passed, ordinary append-open denied, history hash unchanged | Windows file read-only attribute is not a security boundary against its owner changing the attribute |
| Native fork, shared copied workspace | Distinct runtime ID and future history; source could see the fork's temporary workspace write | Shared artifacts remain coupled despite distinct conversation histories |
| Same native fork, independent copied workspace | Independent cwd; source could not see fork's temporary write | Workspace instructions used an explicit fork overlay with source bytes retained |
| Independent fork with linked read-only reference | Reference readable, ordinary append denied, hash unchanged | Same read-only attribute limitation; sharing was explicit and on C: |
| Compaction and continuation of experimental fork | Completed `contextCompaction` item and successful turn completion; a later turn retained the fork ID, independent cwd and readable reference | Copied local history only; not evidence for linked-history compaction |
| Second writer on an already loaded thread | Resume rejected with `already has an active writer` | Extended multiwriter access has no validated adapter or coordination protocol here |

All six original peers completed bounded destination turns. Workspace and history bindings were subsequently materialized on C:, with original IDs retained. Eighteen source file/hash/timestamp records and their preserved snapshots were verified unchanged. Source peer history remained unchanged across the fork probes and compaction.

## Lifecycle and failure handling

Archiving and unarchiving through the desktop API released history writer ownership for a fresh server resume. Archive moves history storage, so a sessions-path existence check while archived is invalid: inspect the current harness binding or unarchive before testing that path. Do not remove runtime lock files to force handoff.

Idle workspace handles survived archiving and fresh resume. Renaming a whole D: fixture workspace was denied. Renaming only a disposable instruction file demonstrated that the corresponding C: alias lost access while the separately copied history remained readable; the fixture file was immediately restored. This is a file-disappearance probe, not a full volume-disconnect test.

The tested D: workspace junctions were replaced by verified physical C: copies. Final agent-executed probes confirmed C: cwd and C: history. Failed history junctions and the entire disposable C: harness home were removed. Cleanup removed D: fixture files but left two empty workspace directories and their ancestors locked by open process handles. That residual cleanup is a recorded lifecycle blocker; no process was forcibly killed and no cleanup was scheduled.

## Adapter requirements learned

1. Probe symbolic-link privileges before planning that mechanism. Keep junction capabilities separate from file-link capabilities.
2. Verify both filesystem identity and harness discovery. A valid filesystem alias can still fail the harness's stored-thread lookup.
3. Record requested cwd, response cwd, persisted thread cwd, process cwd and resolved physical directory separately.
4. Use supported writer release and lifecycle APIs. Record moved archive paths and stale workspace handles.
5. Preserve failed-profile evidence when a copied fallback succeeds. Requested `history_linked` and current `history_linked` cannot share one mutable truth field.
6. Check actual instruction delivery; an ancestor AGENTS file merely existing on disk does not prove the harness loaded it. Preserve instruction deltas for forks and relocation.
7. Separate source fixture dependence from recovery-source access. Test against disposable replicas and leave original recovery data unchanged.
8. Treat harness/model/runtime drift as part of the experiment. Resuming without an explicit model can select the destination default; these probes do not establish model/configuration equivalence to the source.
9. Gate cleanup on current consumers, then report OS handle failures independently from successful conversation migration.

The [transfer-unit contract](TRANSFER_UNIT.md) turns these observations into required journal/checkpoint fields. No general `sesh-beaver` executor, installed command, coordinated history service, or complete dependency collector is implemented by this pilot.
