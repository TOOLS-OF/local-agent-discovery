# Sesh beaver

`sesh-beaver` exposes a bounded Codex standalone-session delivery/repair route. It delegates native delivery to Stork rather than editing live session classifications. A general filesystem-graph executor remains proposed. Source code, an isolated packaged installation, a merged release and a canonical command on PATH are separate states.

## Standalone delivery and repair

On Node 24+, use the registered scoped scripts in this package, or the corresponding installed `sesh-beaver <verb> request.json` command:

```sh
npm run sesh:beaver:check
npm run sesh:beaver:preflight -- request.json
npm run sesh:beaver:prepare -- request.json
npm run sesh:beaver:repair -- request.json
npm run sesh:beaver:activate -- commissioning.json
npm run sesh:beaver:verify -- verification.json
```

`prepare` forks an explicit preserved tape before migration. `repair` forks an already migrated native session through an explicit completed `lastTurnId`. Both require `disposition: "standalone"`, `strategy: "native-fork-new-id"`, `acceptNewIdentity: true`, an exact source ID/path/SHA-256, explicit Codex executable/home/cwd/evidence paths and a recent attributed source-boundary observation. See [request example](examples/standalone.json). The executable must be installed independently; no credentials are copied. The offline adapter refuses unresolved `history_base` dependencies. Native repair preserves paginated lineage and records its required source rather than flattening or rewriting history.

The supported API allocates a **new ID**. Original ID, parent/source category, complete snapshot and digest remain provenance in `operation.sqlite`; no current source category or parent edge is rewritten. The original chat and its assignments remain intact. Optional `createWorkspace: true` creates only a new operating folder with scoped identity guidance, not a product checkout. The boundary observation is not an OS writer lock. Native completed-turn selection and source-path/digest binding protect the snapshot; later source work remains on the original chat.

A fork can have correct interactive source classification and still be absent from lists because its index has no user event/title. In that case the operation records its allocated ID and reports incomplete acceptance. **Never refork to retry.** Run `activate` on that same recorded ID, explicitly accepting one minimal commissioning turn with a model and delegated parent turn. It uses the supported turn API, read-only/no-network sandbox and disabled environments; it does not resume product work. `activate` is a reusable commissioning step, not direct SQLite repair. It refuses to start a second commissioning turn if one is already recorded. A timed-out/failed turn remains an explicit reconciliation task.

Acceptance independently checks default interactive-source listing, requested-name search and historical-preview search. Requested-name failure remains pending; historical search never substitutes for it. The native result `native-verified-desktop-pending` does not claim desktop acceptance. `accept` reconciles an externally observed exact `codex_app.list_threads` result into the current SQLite record; rendered sidebar search remains a separately unverified surface. No pointer, keyboard or window focus is used.

Retries reverify the same native destination. Evidence directories are exclusive to an operation; incomplete/unknown forks are never duplicated automatically. The ledger holds current structured state, not an accumulating agent diary. There is no automatic destructive rollback: choose the untouched original identity. Preserve both native lineage bases and snapshots. Archive/delete APIs can cascade to descendants and are deliberately excluded.

## Package and development checks

`sesh:beaver:test` runs synthetic behavioral checks. `sesh:beaver:package` takes explicit npm/Codex executable paths and a new output directory, packs Beaver and Stork, installs their complete dependency closure, checks both installed entrypoints and exercises native pre/post delivery plus idempotence without model inference. It uses an isolated test home; that home is test evidence, not an agent workspace or a default installation. `sesh:beaver:schema` generates the installed protocol schema. `operations.json` declares ownership, governing issue, inputs/effects and namespace; the dispatcher rejects unknown verbs before execution. This scoped dispatcher is not fleet-wide enforcement.

## Responsibility

Accept a resolved resource/path graph and carry out its filesystem bindings: copy/link/rebuild where supported, verify integrity and actual targets, record operations, and clean task-owned unconsumed staging. Report unsupported mechanisms and collisions. Beaver does not decide system membership, scan chats, choose action filters, slice history, select continuity intent, deliver tapes, or launch sessions.

The proposed humanoid **agent-relocator** owns that policy and coordination, composing focused animals and retaining the system journal. **agent-sleuth** composes hound/bloodhound for evidence; **agent-archaeologist** interprets context continuity. See [composed operations](../../docs/transfer-model/COMPOSED_OPERATIONS.md) for boundaries, bounded scans, action-based selection, multiple instruction roots, and slim history.

The [configuration-space contract](../../docs/transfer-model/CONFIGURATION_SPACE.md) includes nine candidate profiles and a JSON schema. Its checks establish structural consistency, not runtime support.

The [transfer-unit contract](../../docs/transfer-model/TRANSFER_UNIT.md) defines one journaled agent transfer and how system manifests compose units, native relationships, and shared resources. A completed filesystem copy, a continued conversation, a portable workspace, and cleaned scratch are separate outcomes.

## Place in the kingdom

- `sesh-hound` supplies discovery evidence.
- `sesh-bloodhound` supplies bounded recorded-file-access evidence; its source/package/release status must be checked separately.
- `sesh-bee` supplies readable conversation extracts where its adapter applies.
- `sesh-nautilus` handles boundary reconstruction when needed.
- `sesh-stork` handles session delivery where the target adapter fits.
- `sesh-falcon` handles explicit launch configuration where the target adapter fits.
- `sesh-beaver` realizes approved filesystem bindings and reports their effects.
- `agent-relocator` owns the surrounding habitat policy, system graph, lifecycle sequencing, and integrated acceptance evidence.

Adapters must retain their own tested boundaries. The planner must not claim a supported fork, coordinated shared history, native child restoration, or complete workspace merely because files were copied or a chat appeared.

## Durable pattern

Keep durable workspace and preservation records distinct from disposable test state. Place isolated test harness homes in task-owned scratch storage outside the durable transfer package. Retain compact receipts and remove those test homes once their runtime independence is verified. Cleanup should be agent-owned, exact in scope, reviewable, and subject to the normal execution checks.
