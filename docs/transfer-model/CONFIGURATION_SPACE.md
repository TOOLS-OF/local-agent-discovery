# Sesh beaver configuration space

Agent transfer changes a running system's history, relationships, files, path namespace, instructions, tools, and authority. A reusable planner must expose those choices independently. The user's distinction between forking consciousness and extending it is represented operationally as branching future history versus providing continued access to one lineage. Filesystem mechanics alone do not establish either outcome.

`sesh-beaver` is the chosen name for this transfer planner and habitat reconstruction coordinator. This is a proposed contract, not an implemented transport. Session discovery should supply evidence to the planner and retain its read-only role. The JSON schema describes choices and some consistency rules; it does not establish harness support, enforce leases, create links, or certify readiness.

The `examples/` directory contains eight synthetic profiles. Rebuild them with `python docs/transfer-model/build_examples.py` from the repository root. Run `docs/transfer-model/test_schema.ps1` in PowerShell to exercise 20 structural acceptance and rejection cases. The fixtures deliberately remain unready; test-only readiness assertions are declarations in synthetic examples, not runtime evidence.

## Independent axes

| Axis | Choices to record | Resulting dynamics |
| --- | --- | --- |
| Continuity intent | Exclusive continuation; independent fork; extended access to one lineage; archive | Determines whether one future trajectory continues or multiple trajectories are intended |
| Source writer | Stopped; active; unknown | An old dormant copy can be a recovery checkpoint. Reactivating it creates another potential writer, even if IDs match |
| Session identity | Retain with exclusive ownership; obtain a native fork ID; retain IDs within distinct store namespaces | A UUID alone does not identify a unique runtime across cloned stores. Record source store, destination store, lineage, instance, and fork/checkpoint |
| History binding | Snapshot copy; native harness fork; shared live store; coordinated service; none | Independent files can diverge. A shared store needs a supported access and writer protocol |
| Resource materialization | Snapshot copy; symlink; junction; copy-on-write overlay; Git clone; Git worktree; service reference; rebuild; omit | Apply separately to workspace, identity/memory files, instructions, tools, attachments, caches, Git metadata, and services |
| Resource access | Read-only; read/write; unavailable | A link to read/write memory couples agents; a link to read-only reference material couples access without allowing mutual edits |
| Logical cwd | Original path string; remapped path | Preserving the string can satisfy some absolute references. A new string need not break intact relative structure |
| Path namespace | Current host; isolated original namespace | Two systems may each see the same C: string but reach different bytes in isolated environments. On one host namespace, an exact path has one binding at a time |
| Workspace extent | Entire source cwd; selected dependency closure; selected unverified subset | A copied agent subtree can omit a shared office dependency. Completeness must be demonstrated per required component |
| Reference resolution | Preserve layout; restore exact location; alias; explicit configuration; patch active code; unresolved | Track cwd-relative, file-relative, ancestor-relative, repository-relative, home-relative, environment-rooted, absolute, and URI references separately |
| Instructions | Preserve; overlay; replace | Moving cwd changes possible ancestor instruction discovery. A new AGENTS.md is a behavioral change that needs provenance and a recorded delta |
| Runtime tools | Pin source versions; validate destination versions; explicit mixture; unavailable | Existing filenames do not establish compatible runtimes, hooks, wrappers, extensions, or services |
| Native topology | Preserve history only; request native restoration; require verified native restoration | Historical child IDs, visible chats, and live native handles are distinct observations |
| External effects | Shared endpoints/accounts; isolated endpoints/accounts; unavailable | An isolated history and workspace can still mutate the same GitHub repo, service, cloud document, or database |
| Writer authority | Destination owns writes; a single-owner lease; supported coordinated writers; no writer | Express ownership for history and each shared mutable resource. A filesystem link is not a writer handoff protocol |

Resource binding needs a graph, because the same agent may copy history, share a repository object store, link read-only references, rebuild caches, and retain access to a shared external service. A single global copy/link switch cannot describe this system.

## Named profiles are configurations, not guarantees

| Profile | History and identity | Workspace and paths | Expected behavior |
| --- | --- | --- | --- |
| Exclusive move with original paths | Copy checkpoint, retain identity, source stopped | Independent files at original logical paths | One authorized future continuation; substantial path compatibility if required surrounding dependencies are present |
| Original-path replica with linked workspace portal | Copy checkpoint, retain identity, source stopped | Physical replica at the original path; transfer folder's workspace is a symlink to it | The link and canonical path reach one replica. Launch at the original path for the first probe; test alias-path launch and instruction ancestry separately |
| Exclusive move with relocation | Copy checkpoint, retain identity, source stopped | Selected or complete layout at a new cwd, explicit repairs | One authorized continuation with measured environmental changes |
| Independent fork | Native fork or copied checkpoint with distinct identity namespace | Independent workspace, old paths in an isolated namespace or new mapped paths | Independent future histories; shared services remain coupled unless separately isolated |
| Fork with shared embodiment | Independent histories and identities | Link selected read/write workspace or memory resources | Histories diverge while artifacts and external effects can influence both agents |
| Extended access | One lineage through a supported coordinated store or service | Original or remapped cwd; resource access can be local or shared | A second access point, subject to the harness's actual coordination semantics |
| Read-only lens | Frozen or shared read-only history, no writer | Reference-only resources | Inspection of a lineage without continuing it |

An ordinary snapshot copy does not force a fork. A symlink does not establish continuity or distributed execution. Two copied stores with the same IDs and simultaneous writers are divergent instances with a collision problem, not a demonstrated single continuation. A native fork can retain access to the parent's project files; assign it a separate workspace when file isolation is intended.

## Required plan records

`plan.schema.json` separates requested configuration from verification. Every plan identifies the source and destination stores, continuity intent, history and writer model, cwd policy, instruction treatment, topology target, per-resource bindings, reference resolutions, and capability evidence. `executionReady` must remain false until an adapter has validated the required semantics. Some contradictory choices are rejected structurally; a successful schema check is only structural validity.

The history record names its backing resource through `resourceId`; that resource records its materialization, target role, access, and paths. An adapter must also check unique resource IDs, cross-references, actual store identities, session-ID collisions, capability evidence, native fork allocation, complete dependencies, and effective access enforcement. These checks exceed the structural JSON schema. Example paths are synthetic labels, not destinations to create.

The complete implementation also needs append-only observations and decisions:

1. **Snapshot/checkpoint:** source machine and volume identity, store ID, runtime status, cutoff event/offset, database consistency method, hashes, timestamps, and source-writer disposition.
2. **Resource graph:** actual file/store identity, original path, mounted path, destination path, link direction and final target, sharing group, access policy, writer owner, provenance, dependencies, and data needed for reconstruction.
3. **Namespace observations:** requested cwd, reported cwd, canonical path, file identity reached, ancestor instructions, home/config roots, environment variables, and alias resolution. Test both reads and intended write targets.
4. **Behavioral envelope:** effective instructions and diffs, skill/tool versions, native versus historical topology, permission profile, account references, hooks, startup tasks, services, and side-effect destinations. Store account references, never secret values, in the plan.
5. **Acceptance evidence:** history readability, exact IDs and lineage, native child contact, required tool behavior, complete required dependencies, destination append location, instruction delivery, source ownership after handoff, and rollback scope.

For a fork, record the common historical prefix and each future append destination. Future merging of memory or files is a separate operation with a conflict policy; it is not implicit in a shared folder or eventual synchronization.

## Combination rules and capability limits

- An exclusive continuation requires the source writer to be stopped. An active or unknown source writer blocks readiness until handoff or a different intent is established. A dormant backup is allowed and remains labeled as a recovery checkpoint.
- An independent fork requires an independent future history binding and a distinct native ID or explicit isolated store namespace. Keep original evidence IDs intact; record how the runtime fork is addressed. Never simulate a fork by editing UUID strings in raw logs.
- Extended access requires shared-store or service semantics and a demonstrated writer protocol. A generic link to JSONL or SQLite state does not prove supported multi-host operation. Unknown adapter capability blocks readiness while preserving the proposed configuration as a candidate.
- Read-only lenses have no history writer. Read-only is a required access property, not a claim that a symlink enforces it. Establish its enforcement through the adapter, OS permissions, a snapshot, or a read-only service.
- Link targets must distinguish source recovery storage, preserved evidence, destination working storage, and shared live storage. Do not allow readiness with a read/write resource aimed at recovery or preserved evidence.
- A selected unverified workspace cannot be called operationally ready. Each required reference must resolve to the intended resource with its intended read/write behavior; existing files at the wrong destination are a failure.
- Original-path aliases can expose a partial office, alter ancestor discovery, or resolve canonically to a different location. Check these behaviors; do not assume preserving the visible string restores the original environment.
- Git worktrees share repository metadata and object/reference storage. Track that sharing explicitly even when working directories differ. Copy-on-write mechanisms likewise need capability-specific tests rather than an independence claim.
- Pinning or adapting tools, granting service access, and replacing instructions are independent choices. A replicated filesystem may still behave differently under a changed model, harness, tools, accounts, or startup environment.
- Restore subagents through supported native mechanisms. Failure to restore a native handle remains a failed requirement when native restoration is required; a newly created peer does not satisfy it.

## Experiments for the reusable planner

Keep test cases and outcomes by configuration, harness version, OS, and filesystem. At minimum compare: exclusive copied continuation at original paths; exclusive copied continuation at remapped paths; an independent fork with copied workspace; a fork with read-only shared references; a fork with a shared read/write workspace; and coordinated extended access where a harness advertises support. Unsupported combinations remain visible in the matrix with their blocker and required capability, rather than disappearing from the design.

For each case, measure four independent outcomes: **history continuation**, **resource coupling**, **tool/path compatibility**, and **behavioral instruction changes**. Include source disappearance, source reactivation, relocation of a linked target, restart, and concurrent access only as explicit planned experiments against disposable copies.

The observed pilot occupies one point: exclusive copied continuation, retained IDs, source offline, new cwd, selected workspace subset, overlaid migration instructions, reconstructed Git workspaces, verified native children. Conversation continuation passed. Full operational workspace portability remains blocked by known dependencies. It is not evidence about symlinked embodiment, independent forks, or coordinated multi-host history.
