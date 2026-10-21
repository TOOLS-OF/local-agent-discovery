# Git restoration and explicitly created sidecars

These extend the relocation configuration model. The schema validates requests; it is not a Git executor or a harness relationship importer.

## Repository state is separate from directory layout

Detect the repository enclosing cwd, not only a `.git` entry directly inside cwd. Record cwd relative to the repository root so a nested launch directory survives a new clone/worktree. Handle `.git` directories, gitfiles, bare common repositories, submodules and worktrees. Audit physical Git/common/object paths before running discovery against a relocated repo: an old gitfile can silently lead into the current machine's unrelated C repository. Never repair the recovery source.

| Axis | Choices |
|---|---|
| Acquisition | Preserved complete repository copy; independent local clone; bundle; remote clone; audited existing destination repository |
| Starting state | Source HEAD at inventory; an agent-recorded historical commit; an explicit commit; an observed remote tip |
| Branch | Same branch name in an independent repository; new named contributor branch; audited existing destination branch; detached inspection |
| Layout | Standalone checkout; new worktree; audited existing worktree |
| Location | Original-path replica; remapped path; local portal to a replica |
| Local changes | Restore exact state; reconcile an overlay; clean checkout while preserving all local state separately |

These are independent choices with compatibility checks, rather than one large list of migration types. A fresh clone may be pinned to the source commit. The same branch name can refer to different commits. A newer remote tip is an explicit environment upgrade: capture remote observation time, source/target commits, diff and changed instruction/tool manifests. Never silently substitute it when the requested source commit is unavailable.

No configured remote is required for a preserved copy, independent local clone or bundle. A configured remote is not proof of reachability, credentials, required commit/object availability, or completeness. Avoid object alternates/shared clones and source-dependent hardlinks for a portable transfer. Local clones and bundles do not inherently preserve dirty files, all refs, stashes, reflogs, ignored assets or worktree metadata; preserve those separately before constructing a clean checkout. Full source preservation remains available even if the selected working reconstruction is small.

Inventory staged and unstaged changes separately, untracked and required ignored files, unpublished refs, stashes/reflogs, shallow/sparse/partial clone state, object alternates, submodule Git directories, LFS objects, config/includes, hooks and absolute worktree pointers. Remote/network operations and hook activation are explicit choices. A copied config is evidence, not permission to execute its hooks or external helpers.

Create worktrees against a destination-owned common Git directory. Registering a worktree in the D recovery repository mutates recovery metadata and creates an unwanted source dependency. Git's branch occupancy rules still apply. Each active contributor uses its own branch/worktree; reproducing a branch name for historical inspection does not authorize switching another checkout or developing on another contributor's branch. Distinguish a shared runtime installation from any restored integration/development checkout under the dogfood policy.

The optional transfer-plan `repositoryRestoreRef` points to a request validated by [git-restore.schema.json](git-restore.schema.json). Semantic acceptance must also verify refs, source/target identity, repository occupancy, path collisions, available objects, local-state closure and instruction/tool changes. Structural validation cannot certify those filesystem facts.

## Sidecars are directed relationships

Record separate edge kinds: `native-child`, `created-task`, `fork`, `explicit-sidecar`, `messaged-peer` and `co-located-candidate`. Only a verified creator relationship or an explicit user selection makes a sidecar part of the requested system; a title, folder or message exchange alone does not.

The inspected Codex index distinguishes `thread_source: agent_created_thread` from `subagent` and `user`. This establishes creation category, not the parent creator's ID. The inspected index's `thread_spawn_edges` describes native children. Its `thread_attachments` contains worktrees/PRs, so attachments alone are not the created-task graph. Do not invent a creator-parent column or infer it from creator_user_id/account_id.

Find recorded `create_thread`/equivalent requests and their returned thread IDs, including nested tool wrappers and yielded-cell continuations. Preserve request/result source offsets and call/cell correlation. A blocked request is not a created task. A `clientThreadId` is a pending client identity, not a usable destination thread ID. A send/read/wait operation on an existing task does not prove creation. Mixed wrapper output and dynamic control flow require explicit ambiguity/confidence reporting; never execute transcript code to resolve them. Corroborate the returned ID with the indexed creation category and actual tape header.

Bloodhound owns this recorded relationship evidence, Hound locates each resulting chat/store, and the relocator selects system closure. Beaver restores selected working resources; Stork's future delivery adapter must preserve a source-to-destination ID map and explicitly reconstruct or report missing native created-task relationships. A copied manifest does not make the app's Created Tasks panel show the relation, and restoring native subagent edges is not an equivalent substitute.

Each selected sidecar is its own atomic transfer unit with history, cwd/Git plan, instruction guidance, resources and validation state. Sidecars may share a project root yet require independent branches/worktrees. Keep their transfer records under their source IDs and link them from a common system manifest. Select immediate sidecars or bounded transitive created-task closure explicitly. Preserve references to old IDs and provide a destination routing map; do not globally replace UUIDs in historical tape text.
