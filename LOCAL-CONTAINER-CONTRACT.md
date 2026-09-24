# Local Container Contract

This is the durable runtime boundary for local LeagueOS review. It records
the topology and safe operating rules; live health still comes from the
LeagueOS WSL inspection commands below.

## Runtime authority

The approved engine is the **`LeagueOS` WSL2 distro's Docker daemon**. The
former `KPFM` distro is retired and must not be used for LeagueOS review,
resets, imports, or verification. Windows Docker Desktop is also out of
scope.

Before any local operation, inspect the authoritative daemon:

```powershell
wsl.exe -d LeagueOS -- docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
wsl.exe -d LeagueOS -- docker compose ls
```

## Four-container review grid

The replacement runtime has two data lanes and two code lanes. Do not create
another project for an existing lane.

| Project | Port | Data | Code source |
| --- | ---: | --- | --- |
| `leagueos-staging-anon` | 8207 | One anonymized copy of remote PPL staging | `/var/lib/leagueos/staging` |
| `leagueos-staging-synth` | 8208 | Synthetic role/season fixture data | `/var/lib/leagueos/staging` |
| `leagueos-candidate-anon` | 8209 | Same anonymized staging-shaped data | `/var/lib/leagueos/candidate` |
| `leagueos-candidate-synth` | 8210 | Same synthetic fixture shape | `/var/lib/leagueos/candidate` |

Plugin and theme mounts must be native WSL paths. Do not bind code from
`/mnt/c/`; that path was part of the KPFM crash-loop failure mode.

The Windows LAN forwarding task is `LeagueOS-LAN-worker`, backed by
`C:\ProgramData\LeagueOS-LAN\maintain-lan.ps1`. Its presence does not prove
application health: verify the WSL containers and then request each endpoint.

## Current transition state

The replacement grid recovered on 2026-09-23 after the restart loop: all nine
expected containers are running with healthy MariaDB dependencies, and 8207,
8208, 8209, and 8210 each returned HTTP 200 in the latest probe. The 8207
browser check rendered the anonymized Portland Pinball League schedule, match
links, stylesheets, and the visible `v1.0.4.5` footer. Meridian_Blue and the
AO_WSL runtime lane own further runtime repair and revalidation. Meridian must
not restart, rebuild, or replace that runtime concurrently. A stable normal
response from all four lanes remains the prerequisite for feature
validation; a transient `docker ps` presence is not sufficient.

## Data refresh and code promotion

Refreshing the anonymized lane is a data operation only. Use the approved
encrypted export workflow from the documented refresh-repair checkout:

```powershell
Set-Location C:\.______\.KADMON\PLAY__\FIELD_\MULTI_\PLIER_\_\AS\PFM___\_scratch\ppl-refresh-repair
npm run local:sync-anonymized-staging
```

Do not replace it with SSH scraping, a direct remote database write, or the
old PR #347 path. Record the command's completion output and verify 8207
before claiming the refresh succeeded.

Code-only candidate changes preserve the existing local database and uploads.
They must deploy the complete selected tree, never a diff manifest. A
candidate becomes eligible for remote staging only after Victor reviews the
exact candidate commit served locally and explicitly authorizes promotion.
Remote staging is currently frozen.

## Candidate discipline

When pooled work is ahead of real staging, the candidate checkout must be a
real branch downstream of `devline` (for example,
`integration/1.0.5-candidate`), not `devline` itself. Verify the exact SHA
from the candidate mount before validation. Compare it with the canonical
remote `devline`, and stop if the branches differ in an unreviewed way.

All LeagueOS PR merges use `scripts/pfm-merge.sh`; never use raw `gh pr merge`.

## Synthetic dataset seeders

The 8208 and 8210 synthetic containers (`:8208` staging-synth, `:8210` candidate-synth) start with a fresh WordPress install and empty database. Use the following seeders to populate them with test fixtures matching real-world data patterns.

### Seeder overview

Located in `packages/league-os/tests/seed-*.php`:

1. **seed-view-as-dogfood.php**: Creates identity/privacy patterns for view-as testing
   - Creates demo users spanning 3 visibility patterns (officials/players/public)
   - Creates 4 identity display patterns (random/card/initials/pronouns-initials)
   - Links users to existing teams as captain/players

2. **seed-local-integration.php**: Full integration fixtures (schedule, teams, matches, scores)
   - Creates a complete season with schedule, teams, venues, matches
   - Supports rapid validate-test-fix cycles for full-stack features

3. **seed-user-role-matrix.php**: User role and permission testing
   - Creates users spanning every role (captain, scorekeeper, referee, organizer, commissioner)
   - Suitable for testing access-control and permission-gated features

4. **seed-legacy-prefix-fixtures.php**: Legacy player_key prefix migration patterns (NEW)
   - Creates roster entries with modern 'roster:' prefixes
   - Simulates stored game scores with legacy prefixes (indigo:, juniper:, copper:, etc.)
   - Required to regression-test #568, #572, #575 player label-flip bugs
   - Verifies that key resolution correctly unites legacy and modern prefixes by triple match

### Seeder usage (synthetic containers)

Run any seeder against a synthetic container:

```bash
# Fresh dogfooding data on port 8208 (staging-synth)
wsl.exe -d LeagueOS -- docker exec leagueos-staging-synth-league-instance-1 wp --allow-root eval-file /var/lib/leagueos/staging/packages/league-os/tests/seed-view-as-dogfood.php

# Full integration fixtures on port 8210 (candidate-synth)
wsl.exe -d LeagueOS -- docker exec leagueos-candidate-synth-league-instance-1 wp --allow-root eval-file /var/lib/leagueos/candidate/packages/league-os/tests/seed-local-integration.php

# Legacy prefix fixtures for #575 regression testing
wsl.exe -d LeagueOS -- docker exec leagueos-candidate-synth-league-instance-1 wp --allow-root eval-file /var/lib/leagueos/candidate/packages/league-os/tests/seed-legacy-prefix-fixtures.php
```

Most seeders are idempotent: running them multiple times against the same database preserves existing data and updates/extends fixtures (e.g., seed-view-as-dogfood.php skips user creation if the login already exists). A fresh reset of a synthetic container requires a manual `docker-compose down && docker-compose up` of that container's services.

### Seeder design principles

- **No PII in terminal output**: Seeded roster data never prints player real names to logs (team names only, for safety)
- **Idempotent by design**: Seeders check for existing records and skip re-creation (use `--season-id` etc. to target specific data)
- **Fixture discovery**: Seeders that need existing data (e.g., seed-view-as-dogfood.php needs existing teams) search for them rather than failing when not found
- **Documented output**: All seeders report their actions as JSON via WP_CLI::log() so automation can detect success/failure

## Code matrix invariants and alarmed check

The 2×2 grid has three non-negotiable invariants. Any violation is a hard
failure; stop and fix before running any feature validation.

**Rule 1 — Staging worktree SHA must equal the live-deployed commit.**

`/var/lib/leagueos/staging` must be checked out to exactly the same commit
that was last deployed to remote staging. The `leagueos_local_code_sha` WP
option in the 8207 container is the canonical marker (written by
`sync-local-staging.ps1` on each successful refresh). If they diverge, local
staging is not representative of what's live.

**Rule 2 — Candidate worktree SHA must differ from staging.**

`/var/lib/leagueos/candidate` must always be on a different commit than
`/var/lib/leagueos/staging`. The candidate exists to preview code not yet
deployed; pointing both at the same commit collapses the review grid to two
identical pairs and defeats its purpose.

**Rule 3 — NEVER check the same branch out to both worktrees.**

Putting both `/var/lib/leagueos/staging` and `/var/lib/leagueos/candidate` on
the same branch (even if their HEADs happen to differ at that moment) silently
makes them convergent: any `git pull` or `git fetch+merge` on either will sync
them. Always use a real named integration branch for the candidate:
`integration/<version>-candidate` (e.g. `integration/1.0.5-candidate`), branched
from `devline`.

**Rule 4 — All bind mounts must use native WSL paths.**

Container plugin/theme mounts must be under `/var/lib/leagueos/staging` or
`/var/lib/leagueos/candidate`. Never `/mnt/c/` — that was the root cause of
the prior 9P filesystem crash loop.

### Alarmed check command

```powershell
Set-Location C:\.______\.KADMON\PLAY__\FIELD_\MULTI_\PLIER_\_\AS\PFM___\_scratch\ppl-refresh-repair
npm run local:check-matrix
```

Or directly: `pwsh -File scripts/check-code-matrix.ps1`

Exits 0 if all checks pass, exits 1 with specific FAIL lines if any rule is
violated. Run this before any candidate validation session, and run it again
after any worktree checkout or container recreate.

### Dual-anon sync

Both anon containers (8207 + 8209) must carry the same anonymized PPL data at
all times. 8207 syncs directly from the live backup; 8209 is populated by
propagating 8207's anonymized DB:

```powershell
# Full dual sync (triggers backup download, runs anonymize, propagates to 8209):
npm run local:sync-both-anon

# Propagate 8207 -> 8209 only (when 8207 is already current):
npm run local:sync-candidate-from-staging
```

After `sync-candidate-from-staging` completes, the `leagueos_local_code_sha`
in 8209 will be the candidate code SHA (from `/var/lib/leagueos/candidate`),
not the staging SHA. This is correct: 8209 runs candidate code against
anonymized PPL data, so its code SHA reflects the candidate worktree.

Run `npm run local:check-matrix` after any sync to verify the matrix.
