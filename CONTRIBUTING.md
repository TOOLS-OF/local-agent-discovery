# Contributing to shared local tooling

Follow the [shared dogfood repository policy](docs/DOGFOOD_REPOSITORY_POLICY.md). Keep the integration checkout, each contributor branch/worktree, and installed runtime separate. Record the remote/default branch, exact commits, command resolution and existing worktrees before changes. Preserve local state and audit relocated Git pointers. Never develop through another contributor's checkout or a global command linked to a mutable worktree.

## Validate transfer preparation tools

Use Node 20 or newer and PowerShell 7. Zstandard support depends on the Node runtime; gzip and plain-JSONL paths work without it. CI exercises Node 20 and 24 on Linux and Windows.

```powershell
./scripts/validate-transfer-tools.ps1 -OutputRoot <new-absolute-validation-directory>
```

The script installs locked source/test dependencies, checks formatting, runs behavioral and schema tests, packs Evidence/Bloodhound/Relocator/Nautilus, installs their complete dependency closure into an isolated prefix, invokes installed wrappers, and runs synthetic installed workflows. It contacts the package registry for dependencies but never contacts a live agent harness. It creates only its explicitly new validation directory and ignored development dependencies. Review the resulting `validation.json`, package tarballs and fixtures. Output remains separate from the repository and canonical runtime.

Formatting is pinned through `scripts/package-lock.json`:

```powershell
npm ci --prefix scripts --ignore-scripts
npm run --prefix scripts format
```

Use synthetic fixtures in committed tests. Keep private transcripts, account IDs, real repository inventories, credentials, network paths and machine-specific migration receipts out of pull requests. A source invocation is not an installed-package check. Public tests must not depend on D:, a particular user home, or live model calls.

## Review and promotion

Open a PR against the discovered integration branch with the concrete problem, supported behavior, validation and remaining gaps. Arrange independent review and resolve reproduced defects. Record the reviewed head: later changes need appropriate follow-up review. Agent review is distinct from a separate GitHub account's formal approval.

After integration, stage a revision-identified immutable installation and validate the installed entrypoints and dependencies before switching the machine default. Serialize promotion, retain the prior working installation, and update the machine-local registry. Branches, PRs, review, merge, package installation, PATH availability and target-harness acceptance are separate states. This workflow does not create an automatic updater.
