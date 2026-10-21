# Sprint 02: history windows and resource provenance

Contributor implementation and dry-run tooling. No global promotion, MERIDIAN import or continuation is implied.

## Composable operations

- Bloodhound emits file observations linked to source tape checkpoint, byte/line location, request/result, scoped actor, compaction chamber and turn. Codex uses native turn IDs. Claude prompts provide an explicitly inferred turn index; tool-result and compaction-summary envelopes do not become turns. Unknown attribution is retained as unknown.
- Nautilus `inspect`, `plan` and `project` preserve raw native records in a derived candidate. Latest two context intervals retain their incoming checkpoint and intervening boundary, required native envelopes and preceding context. Structural request/result closure is checked. An unfinished tail either blocks source-end projection or is explicitly excluded by `last-completed-turn`. Candidate output is not proof of successful harness continuation. Claude inspection works; parent-chain projection remains blocked.
- Relocator `select` compiles evidence filters. Its independent temporal window can select accesses from ten turns even when the delivered tape retains only two context intervals. Read-only exclusions apply within the chosen access window. Omit `temporal` to use the supplied whole evidence set.
- Relocator `expand` previews exact files, immediate parent-folder contents, or recursive trees at explicit depth/null depth. It records budgets, missing files, links, physical-root escapes, collisions and incompatible bindings. It creates no workspaces. Exclusion patterns can prune separately preserved harness tapes. Beaver remains responsible for later filesystem realization.
- `expand-tape` derives bounded lossless gzip/Zstandard snapshots with source/output hashes. Zstandard requires a capable Node runtime; no transcript code is evaluated.

## Example independent scopes

In the existing composed relocation request, retain `historyProjection.retainedIntervals: 2` and `includeIncomingCheckpoint: true`. Add:

```json
{
  "selection": {
    "temporal": {
      "sourceTape": "<exact checkpoint.realpath from evidence>",
      "sessionId": "<recorded session ID>",
      "localAgentId": null,
      "lastTurns": 10,
      "completion": "completed"
    }
  }
}
```

This is an excerpt to merge into a complete request. `observed` includes a final unfinished observed turn; `completed` requires a recorded completion, so it currently provides no completed-turn guarantee for inferred Claude turns. The temporal query requires fresh, contiguous whole-tape turn-indexed pages. It explicitly identifies one tape and actor. Ordering several tapes requires a future verified lineage adapter; file timestamps and directory names are not an ordering rule. An insufficient turn count is reported, not padded. Tool effects remain bounded by the adapter's evidence coverage.

Resource rules independently specify `extent.mode` (`explicit`, `folder`, `tree`), `anchor` and `maxDepth`. `folder` depth zero includes immediate files and directory metadata. A recursive whole folder is `tree` with `maxDepth: null`, still subject to file/byte/entry/time budgets. Exceeding a budget produces a partial preview. Copy/link binding is a separate axis; a link is not a filesystem permission boundary.

## Traceability and version meaning

The reusable join is `resource.scopeIds -> expansionScopes.seedIds -> seeds.evidence`. Each evidence item retains source tape, event offsets, chamber and turn. `directSeedIds` and `inclusion` distinguish selected references from siblings included by folder expansion. Shared folder scopes merge their seeds without losing the access links. A history projection's source ranges can be joined with those same offsets, including accesses whose evidence remains only in pristine history.

Recorded access at time T does not establish the bytes present at T. Filesystem previews stat current files and report `contentHashed: false`. Copying later retrieves current bytes; a historical resource snapshot requires Git, backup or another version adapter. Missing old files and guest/WSL namespaces remain gaps. Ambient instructions/skills/hooks are inventoried separately for deliberate post-transfer reconciliation; they are not activated by these operations.

## Packaging

Evidence, Bloodhound and Relocator are version 0.2.0; Nautilus is 1.1.0. Nautilus now packages its boundary library rather than reaching outside its installed package. The root library path remains a compatibility proxy. Validate the complete tarball closure, including pinned Acorn, through installed entrypoints before recording a development installation. Source tests, installed validation, merge and canonical PATH promotion are separate states.
