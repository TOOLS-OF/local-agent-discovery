# Sesh beaver

Plan and reconstruct an agent's habitat across computers, drives, and harness stores. `sesh-beaver` is the chosen name; the current implementation consists of a configuration model, synthetic profiles, structural checks, and a separately recorded migration pilot. There is no installed command or general transfer executor yet.

## Responsibility

Coordinate discovery, dependency manifests, explicit continuity/fork choices, per-resource copy/link/rebuild choices, path resolution, delivery, continuation validation, and disposable-state cleanup. Record requested intent separately from observed effects and adapter capabilities.

The [configuration-space contract](../../docs/transfer-model/CONFIGURATION_SPACE.md) includes seven candidate profiles and a JSON schema. Its checks establish structural consistency, not runtime support.

## Place in the kingdom

- `sesh-hound` supplies discovery evidence.
- `sesh-bee` supplies readable conversation extracts where its adapter applies.
- `sesh-nautilus` handles boundary reconstruction when needed.
- `sesh-stork` handles session delivery where the target adapter fits.
- `sesh-falcon` handles explicit launch configuration where the target adapter fits.
- `sesh-beaver` owns the surrounding habitat plan, resource and path graph, lifecycle, and integrated acceptance evidence.

Adapters must retain their own tested boundaries. The planner must not claim a supported fork, coordinated shared history, native child restoration, or complete workspace merely because files were copied or a chat appeared.

## Durable pattern

Keep durable workspace and preservation records distinct from disposable test state. Place isolated test harness homes in task-owned scratch storage outside the durable transfer package. Retain compact receipts and remove those test homes once their runtime independence is verified. Cleanup should be agent-owned, exact in scope, reviewable, and subject to the normal execution checks.
