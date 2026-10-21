# Sesh bloodhound

Recorded transcript provenance extraction: file actions and tool-call spawn lineage, with source-event citations and explicit coverage gaps.

**Status: specification only in this directory. There is no executable, package or installed command here.** [Design #23](https://github.com/TOOLS-OF/local-agent-discovery/issues/23) and [development #24](https://github.com/TOOLS-OF/local-agent-discovery/issues/24) describe a reported prototype at `hazrat-rabbit/cmd/whodunnit.js`. That prototype has not been located or validated in this investigation. Preserve its attribution and audit/reuse it if recovered; do not imply an implementation was promoted.

The [composed-operations contract](../../docs/transfer-model/COMPOSED_OPERATIONS.md) specifies bounded tape scans, normalized evidence, action/outcome distinctions and how agent-sleuth supplies evidence to agent-relocator. Bloodhound does not choose what to migrate, copy folders, mutate history, add project roots or launch sessions.

Required events distinguish read, edit, create, unresolved create-or-overwrite, delete, rename, search and mention. Preserve requested/succeeded/failed/unknown outcomes. A shell inference or path mention must not be presented as a proven file access. Generic transcript analysis cannot guarantee every indirect filesystem operation is visible.

Reuse shared tape/compression readers and harness/path adapters with nautilus and hound. Keep the raw evidence independent of a migration's eventual action filters or retained runtime-history window.
