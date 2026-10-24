# Agent relocator

Humanoid coordination trade with deterministic preparation commands, version 0.2.1. A general filesystem/session transfer executor and installed agent persona remain pending.

- `ambient`: bounded source/destination guidance, skills/hooks/settings fingerprints, comparison, and agent-local reconciliation brief. Copies no settings and executes no hooks. Ancestor links are not followed.
- `select`: compile provenance pages with action/evidence/session/path filters and an optional independent last-N-turn window. Unknown or incomplete evidence remains explicit.
- `expand`: metadata-only exact-file, immediate-folder or recursive-tree previews with allowed roots, exclusions, budgets, conflicts and seed/event joins. No destination workspaces are created.
- `expand-tape`: bounded lossless gzip/Zstandard snapshot with full compressed/decoded hashes. Refuses existing output; source remains unchanged.

Run `agent-relocator --help` for flags. The required sibling dependency is `@tools-of/sesh-evidence@0.2.1`; validate the complete tarball closure through the [contributor workflow](../../CONTRIBUTING.md). Do not point a global command at a mutable worktree.

See the [preparation guide](../../docs/transfer-model/PREPARATION_WORKFLOW.md), [Sprint 02](../../docs/transfer-model/SPRINT_02.md), and [Git/sidecar contract](../../docs/transfer-model/GIT_AND_CREATED_TASKS.md). Schema-valid Git or relationship plans are not executable importers.
