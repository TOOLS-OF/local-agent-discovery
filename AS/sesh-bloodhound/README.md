# Sesh bloodhound

Recorded transcript provenance extraction: file actions and tool-call spawn lineage, with source-event citations and explicit coverage gaps.

**Status: first-sprint development implementation, v0.1.0; not merged or globally promoted.** The CLI scans one explicit plain JSONL tape per invocation, with byte/line/event/time bounds, resumable page state, Codex and Claude Code adapters, recorded policy fingerprints, file actions and tool-request provenance. [Design #23](https://github.com/TOOLS-OF/local-agent-discovery/issues/23) and [development #24](https://github.com/TOOLS-OF/local-agent-discovery/issues/24) describe a reported prototype at `hazrat-rabbit/cmd/whodunnit.js`. It has not been located or validated here; this implementation does not claim to reuse its source. Reconcile it if recovered.

```text
sesh-bloodhound --tape <snapshot.jsonl> --harness codex --out <new-page.json>
sesh-bloodhound --tape <same-snapshot.jsonl> --harness codex --cursor <prior-page.json> --out <new-next-page.json>
```

Use `--mappings <json-array>` for explicit source namespace mappings, e.g. C: logical paths to a D: mount. Output preserves both logical and mapped paths; it does not prove physical file identity. Defaults: 64 MiB input page, 16 MiB maximum line, 50,000 records, 60 seconds. Output files are created exclusively and existing paths are refused. Large records can stop a page without progress; explicitly raise the relevant budget or record that coverage blocker. Compression is not yet implemented: provide a lossless expanded snapshot. The checkpoint uses metadata and a 16 KiB head hash, plus a consumed-page hash, not a full-file content hash; use immutable preserved source snapshots for stronger provenance.

The sibling `@tools-of/sesh-evidence@0.1.0` is a required packaged dependency. It pins Acorn for static parsing of literal nested JS tool references without evaluating code. Conditional/dynamic wrapper execution and indirect shell effects remain unverified; gap records prevent a complete-access claim. Pending calls are carried across pages with a bounded state budget. Do not edit cursor state or mix scanners, mappings, source revisions or out-of-order page sets.

The [composed-operations contract](../../docs/transfer-model/COMPOSED_OPERATIONS.md) specifies bounded tape scans, normalized evidence, action/outcome distinctions and how agent-sleuth supplies evidence to agent-relocator. Bloodhound does not choose what to migrate, copy folders, mutate history, add project roots or launch sessions.

Required events distinguish read, edit, create, unresolved create-or-overwrite, delete, rename, search and mention. Preserve requested/succeeded/failed/unknown outcomes. A shell inference or path mention must not be presented as a proven file access. Generic transcript analysis cannot guarantee every indirect filesystem operation is visible.

Reuse shared tape/compression readers and harness/path adapters with nautilus and hound. Keep the raw evidence independent of a migration's eventual action filters or retained runtime-history window.
