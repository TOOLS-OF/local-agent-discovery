# Local Container Contract

This is the shared operational contract for the local LeagueOS review grids.
It defines the reproducible Red and Blue topology, source and data boundaries,
startup/shutdown rules, verification commands, and failure diagnosis. Live
health is never inferred from this document; inspect the owning WSL distro.

## Team-qualified identity

Red and Blue are separate address spaces, even when they use the same base
agent name or card designation.

- A card designation may be team-qualified with a leading `🟥` or `🟦` marker.
  For example, `🟥🔱3♣️` and `🟦🔱3♣️` are different addresses.
- An agent name may be team-qualified with a suffix: `Galileo_red` and
  `Galileo_blue` are different agents, not aliases for one agent.
- The same base name or card ID across colors is never evidence of shared
  session state, permissions, worktree, runtime, or ownership.
- Preserve the qualified identity in handoffs, GitHub attribution, worktree
  names, Compose project names, container labels, and incident reports.

The qualified identity used in the current documentation handoff is
`Galileo_red`.

## Reproducibility inputs

Both teams use the same reviewed source and operating procedures, but each team
has an independent WSL2 distro, Docker daemon, native checkout, data volumes,
Compose projects, ports, and agent operations.

| Input | Required authority |
| --- | --- |
| Application source | `PlayFieldMultiplier/LeagueOS`, pinned to an exact reviewed commit or branch ref |
| Native checkouts | `/var/lib/leagueos/staging` and `/var/lib/leagueos/candidate` inside the owning distro |
| Shared operating contract | This file, plus the loaded root/repository agent instructions |
| Blue distro | `LeagueOS` |
| Red distro | `LeagueOS_Red` |
| Team identity | A qualified card/name such as `🟥🔱3♣️` / `Galileo_red` or `🟦🔱3♣️` / `Galileo_blue` |

Do not use Docker Desktop, the retired `KPFM` distro, or `/mnt/c/` bind mounts
for LeagueOS application source. A distro may use Windows-hosted tooling to
invoke `wsl.exe`, but its Docker daemon and application mounts remain native to
that distro.

Before setup, confirm both distro names and WSL version:

```powershell
wsl.exe -l -v
```

If a distro or its native checkout is missing, stop and record the missing
provisioning artifact. Do not silently substitute another distro or checkout.

## Runtime authority

The owning distro's Docker daemon is authoritative:

```powershell
wsl.exe -d LeagueOS -- docker ps
wsl.exe -d LeagueOS -- docker compose ls --all

wsl.exe -d LeagueOS_Red -- docker ps
wsl.exe -d LeagueOS_Red -- docker compose ls --all
```

The Windows Docker Desktop daemon is not part of either review grid. A Windows
port-forward task can expose a service to the host, but it does not prove that
the service is healthy. Inspect containers, mounts, and the endpoint separately.

## Required 2x2 review grids

Each team owns four independent Compose projects. Each project has two
containers: one WordPress `league-instance` service and one MariaDB
`instance-db` service. Therefore a compliant distro has eight containers total,
not nine: four application containers and four database containers.

### Blue: `LeagueOS`

| Lane | Compose project | Port | Data lane | Native source mount |
| --- | --- | ---: | --- | --- |
| staging anon | `leagueos-staging-anon` | 8207 | Anonymized PPL staging data | `/var/lib/leagueos/staging` |
| staging synth | `leagueos-staging-synth` | 8208 | Synthetic role/season fixtures | `/var/lib/leagueos/staging` |
| candidate anon | `leagueos-candidate-anon` | 8209 | Copy of anonymized staging-shaped data | `/var/lib/leagueos/candidate` |
| candidate synth | `leagueos-candidate-synth` | 8210 | Synthetic integration fixtures | `/var/lib/leagueos/candidate` |

### Red: `LeagueOS_Red`

Red uses a separate host-port block and team-qualified Compose project names:

| Lane | Compose project | Port | Data lane | Native source mount |
| --- | --- | ---: | --- | --- |
| staging anon | `leagueos-red-staging-anon` | 8307 | Red-owned anonymized PPL staging copy | `/var/lib/leagueos/staging` |
| staging synth | `leagueos-red-staging-synth` | 8308 | Red-owned synthetic role/season fixtures | `/var/lib/leagueos/staging` |
| candidate anon | `leagueos-red-candidate-anon` | 8309 | Red-owned anonymized candidate copy | `/var/lib/leagueos/candidate` |
| candidate synth | `leagueos-red-candidate-synth` | 8310 | Red-owned synthetic integration fixtures | `/var/lib/leagueos/candidate` |

The Red `leagueos-red` single-project setup is legacy and non-conforming. It
provides only one instance lane, uses `8307`, and must not be reported as a
Red 2x2 grid. A conforming Red setup creates the four projects above from the
same reviewed Compose source and verifies them independently. Do not repair a
Red gap by editing, reusing, or attaching to the Blue runtime.

### Per-lane source mounts

For every application container, the plugin and theme mounts must resolve to
the owning distro's native checkout and be read-only:

```text
/var/lib/leagueos/<lane>/packages/league-os -> /var/www/html/wp-content/plugins/league-os:ro
/var/lib/leagueos/<lane>/themes/league-os  -> /var/www/html/wp-content/themes/league-os:ro
```

The exact host-side Compose file may live in an operations checkout, but its
resolved bind sources must be the native paths above. Never accept a relative
mount that can resolve against an agent's incidental working directory, and
never use `/mnt/c/...` for application code.

## Data and database preservation

Each lane has its own named database, WordPress, and uploads volumes. Volume
names must be scoped by the distro/team and Compose project; no volume may be
shared between Red and Blue or between staging and candidate.

- Code-only rebuilds and container recreation preserve database and uploads
  volumes.
- A normal shutdown uses `docker compose stop`, or `docker compose down`
  without `-v` when container removal is necessary.
- `docker compose down -v`, `docker volume rm`, database reset, and cross-distro
  volume copying are destructive operations and require a separate explicit
  authorization. They are never part of startup or routine diagnosis.
- Blue anon refresh is a data operation only. It must use the approved
  anonymized export path and must not be replaced with SSH scraping or a direct
  remote database write.
- Red data is a separate copy. It may be seeded from an approved anonymized or
  synthetic fixture artifact, but it must never mount or mutate Blue's volumes.
- Staging and candidate code may differ, but their data and upload volumes
  remain independent so a candidate test cannot rewrite staging state.

## Code and branch invariants

Apply these invariants independently inside each distro:

1. The staging checkout is the exact reviewed/deployed staging SHA.
2. The candidate checkout is a real branch downstream of `devline` and is
   intentionally distinct from staging when pooled work is under review.
3. Staging and candidate never check out the same mutable branch.
4. The four lane projects use only their assigned source mount and port.
5. A Red checkout may have the same source commit as Blue, but it remains a
   separate checkout, Docker daemon, volume set, project set, and qualified
   agent address.

Record the exact source SHA before validation:

```powershell
wsl.exe -d LeagueOS -- git -C /var/lib/leagueos/staging rev-parse HEAD
wsl.exe -d LeagueOS -- git -C /var/lib/leagueos/candidate rev-parse HEAD

wsl.exe -d LeagueOS_Red -- git -C /var/lib/leagueos/staging rev-parse HEAD
wsl.exe -d LeagueOS_Red -- git -C /var/lib/leagueos/candidate rev-parse HEAD
```

## Health and restart policy

Every lane must implement the same dependency contract:

- MariaDB uses `restart: unless-stopped`.
- MariaDB exposes a healthcheck using `mariadb-admin ping`.
- WordPress uses `restart: on-failure:3`.
- WordPress depends on the MariaDB service reaching `healthy`; a merely
  running database container is not sufficient.
- A WordPress container that exits after three retries is a failure to diagnose,
  not a reason to add an infinite restart loop.

Check container state and database health from the owning distro:

```powershell
wsl.exe -d LeagueOS -- docker ps -a
wsl.exe -d LeagueOS -- docker inspect <container-name>
wsl.exe -d LeagueOS -- docker logs --tail 200 <container-name>

wsl.exe -d LeagueOS_Red -- docker ps -a
wsl.exe -d LeagueOS_Red -- docker inspect <container-name>
wsl.exe -d LeagueOS_Red -- docker logs --tail 200 <container-name>
```

## Startup and shutdown

Startup is lane-by-lane and fail-closed:

1. Confirm the target distro is running and is the correct team-qualified
   address.
2. Confirm the native source checkout and exact SHA.
3. Confirm the lane's project name and host port are unique inside that distro
   and do not collide with the other team's block.
4. Run the resolved Compose file's configuration check before creating
   containers.
5. Start only the selected lane with its explicit project name and port.
6. Wait for MariaDB health, then verify WordPress responds and the expected
   source mounts are read-only.
7. Record project, container, volume, port, source SHA, and qualified agent
   identity in the handoff.

The conceptual commands are:

```powershell
wsl.exe -d <distro> -- docker compose -p <team-qualified-project> -f <compose-file> config --quiet
wsl.exe -d <distro> -- docker compose -p <team-qualified-project> -f <compose-file> up -d
```

Use `stop` for a temporary pause. Use `down` without `-v` only when removing
containers/networks while retaining data. Never include `-v` in a routine
startup retry or failure-recovery command.

## Verification checklist

For each team, verify all four lanes rather than inferring one from another:

1. `wsl.exe -l -v` shows the correct distro as WSL version 2.
2. `docker compose ls --all` shows the four expected team-qualified projects.
3. `docker ps` shows eight running containers: four WordPress plus four
   healthy MariaDB containers.
4. Ports are unique and match the table: Blue `8207–8210`, Red `8307–8310`.
5. `docker inspect` confirms native source mounts and persistent named volumes.
6. Staging and candidate source SHAs are recorded and satisfy the branch
   invariants.
7. Each endpoint returns a normal HTTP response from the Windows host:

```powershell
8207,8208,8209,8210,8307,8308,8309,8310 | ForEach-Object {
    $url = "http://localhost:$_/"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        "$_ $($response.StatusCode) $url"
    } catch {
        "$_ FAILED $($_.Exception.Message)"
    }
}
```

An endpoint response is not sufficient by itself: the matching container,
mount, volume, project, and source SHA must also be verified.

## Failure diagnosis

### Distro or daemon mismatch

Run `wsl.exe -l -v` and then `docker ps` through the named distro. If the
containers appear only in Docker Desktop or another distro, stop. Do not
recreate the grid until the correct daemon is selected.

### Missing or exited lane

Run `docker compose ls --all`, `docker ps -a`, and `docker logs --tail 200` in
the owning distro. Confirm the project name and resolved Compose file before
restarting. Do not start a second project with a similar name.

### Port collision or missing forwarding

Check the assigned block with `Get-NetTCPConnection -State Listen` and inspect
the container's published port. Blue forwarding is owned by the
`LeagueOS-LAN-worker` task and `C:\ProgramData\LeagueOS-LAN\maintain-lan.ps1`;
the Red forwarding task and target WSL address remain an explicit setup item
until recorded by the Red runtime owner. A forwarding-task presence does not
prove that the application is healthy.

### Wrong or stale source

Inspect the container mounts and run `git rev-parse HEAD` in the mounted native
checkout. A container built from `/mnt/c/`, a relative path, or an unexpected
SHA is invalid for feature validation. Correct the checkout/mount contract
before changing application code.

### Database health or restart loop

Inspect MariaDB health, WordPress dependency state, restart counts, and logs.
Preserve the named volumes while diagnosing. Do not use `down -v` or reset the
database to make a failed health check disappear.

### Data mismatch

Confirm the lane's data class and volume names. Blue 8207/8209 may share the
same anonymized *data contents* after the approved sync, but they do not share
live volumes; Red data remains separate. Synthetic lanes must be seeded with
fixtures appropriate to the feature under test.

## Cloned-distro failure and Red bootstrap

Never treat an imported WSL distro as an isolated Docker host merely because it
has a different distro name. A cloned `/var/lib/docker` can carry the Blue
engine identity, container metadata, named volumes, and a persisted `docker0`
network into Red. When the Red daemon then starts, systemd can retry it every
few seconds with an error such as `networks have same bridge name`; the visible
effect is a 30--60 second application or distro restart cycle. This is an
engine/bootstrap failure, not a WordPress or score-entry symptom.

Before starting any Red Compose project:

1. Preserve the imported Docker root for forensics. Do not delete it and do
   not run `down -v`, prune, or volume cleanup against it.
2. Give Red a fresh Docker data root using the distro's Docker service
   configuration, for example `/var/lib/docker-red`. Restart only the Red
   Docker service after the change.
3. WSL distros may share the host kernel/network namespace. Give Red a unique
   bridge and address pool as well as a unique data root. The effective Red
   daemon configuration in this environment is:

   ```json
   {
     "data-root": "/var/lib/docker-red",
     "bridge": "docker0-red",
     "default-address-pools": [{"base": "172.31.0.0/16", "size": 24}]
   }
   ```

   If this Docker build requires a non-default bridge to exist first, create
   `docker0-red` in the Red distro before starting its Docker service. Never
   make both daemons own `docker0`.
4. Verify the Red engine identity and root differ from Blue:

   ```powershell
   wsl.exe -d LeagueOS -- docker info --format 'id={{.ID}} root={{.DockerRootDir}}'
   wsl.exe -d LeagueOS_Red -- docker info --format 'id={{.ID}} root={{.DockerRootDir}}'
   ```

   A matching engine ID or data root is a blocking failure. Stop Red setup and
   repair isolation before creating containers.
5. Place the reviewed Compose file in a Red-native operations path such as
   `/var/lib/leagueos/ops/docker-compose.yml`. The file may be copied from
   the exact reviewed source, but its resolved application mounts must remain
   `/var/lib/leagueos/staging` or `/var/lib/leagueos/candidate` inside Red.
6. Render the configuration with all required variables before `up`. The
   four projects use distinct project names, ports, networks, and volumes:

   ```powershell
   wsl.exe -d LeagueOS_Red -- docker compose -p leagueos-red-staging-anon -f /var/lib/leagueos/ops/docker-compose.yml config --quiet
   wsl.exe -d LeagueOS_Red -- docker compose -p leagueos-red-staging-synth -f /var/lib/leagueos/ops/docker-compose.yml config --quiet
   wsl.exe -d LeagueOS_Red -- docker compose -p leagueos-red-candidate-anon -f /var/lib/leagueos/ops/docker-compose.yml config --quiet
   wsl.exe -d LeagueOS_Red -- docker compose -p leagueos-red-candidate-synth -f /var/lib/leagueos/ops/docker-compose.yml config --quiet
   ```

7. Start only the requested Red project with its explicit repo root, public
   URL, instance port, and `LEAGUEOS_BIND_ADDRESS`; then wait for the matching
   database healthcheck before testing WordPress. Never use the Blue ports or
   Blue volume names as a shortcut.
8. If the daemon fails, capture the owning distro's Docker journal and event
   stream before restarting it again:

   ```powershell
   wsl.exe -d LeagueOS_Red -- journalctl -u docker --since '15 minutes ago' --no-pager
   wsl.exe -d LeagueOS_Red -- docker events --since 15m --filter type=container --filter event=die
   ```

   Use the first `dockerd` error as the diagnosis. Repeated systemd retries do
   not prove that application containers are restarting.

## Approved Blue anonymized refresh

The Blue anonymized data lane is refreshed only through the approved checkout:

```powershell
Set-Location C:\.______\.KADMON\PLAY__\FIELD_\MULTI_\PLIER_\_\AS\PFM___\_scratch\ppl-refresh-repair
npm run local:sync-anonymized-staging
```

After a refresh, verify 8207 and then propagate anonymized data to 8209 using
the approved local sync tooling. Record the command output and rerun the local
matrix check. No equivalent Red refresh command is declared until the Red
owner documents its approved fixture source.
