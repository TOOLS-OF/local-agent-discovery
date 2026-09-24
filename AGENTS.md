# PFM — Cross-Harness Context Engineering Project

## Shared office procedures

The worker office and this manager office use the same canonical procedure
documents. Read these exact files when the work involves GitHub routing,
authorship, review, branch freshness, or issue/PR operations:

- `C:\Users\victorb\.AWG26\.AO\PlayFieldMultiplier\repos\office-procedures\OFFICE-PROCEDURES.md`
- `C:\Users\victorb\.AWG26\.AO\PlayFieldMultiplier\repos\github-collaboration\SKILL.md`

These are shared references, not manager-local copies. The shared KPFM office
contract records this relationship at `office-of/KPFM#1`.

You may be running in one of several harnesses: Claude Code (CLI/TUI/VS Code extension
tab), GitHub Copilot Chat (VS Code panel), or GitHub Copilot CLI. This project audits
context differences between them.

**First action on wake: read `AGENTS.md`, then `HARNESS_AUDIT.md` in this
directory.** `AGENTS.md` is the all-agents/all-instances instruction space for
this root — base-class content, true for every harness. `CLAUDE.md`
deterministically imports this file for Claude Code and is expected to also
carry its own Claude-specific content beyond the import (Victor, 2026-09-22:
"the polymorphic subclass zone") — genuinely Claude-only mechanics, or
overrides for how a shared swarm utility gets used specifically by this
harness. That's a real divergence to expect, not drift to prevent; the
duplication problem was universal content copy-pasted into both files, not
`CLAUDE.md` having its own content at all.

`HARNESS_AUDIT.md` contains the context inventory from prior turns in other
harnesses. Append your own turn's audit to its Turn Log — document your
identity prompt, tool names, and everything that appeared in your context
without a tool call.

Harness parity convention: `AGENTS.md` and `CLAUDE.md` are not treated here as
harness-exclusive files. Use `.github/copilot-instructions.md` only for
Copilot-only always-on instructions. Keep Codex-specific guidance labeled in
AGENTS.md; do not create a shared-root AGENTS.override.md that masks it. No guaranteed Claude-Code-only always-on
instruction file is known here; `CLAUDE.md` is used by convention as a pointer
to `AGENTS.md`.

## Environment/tool behavior is empirical and version-dependent — check, don't recall

Before betting real work on a remembered fact about how a tool or harness
behaves (a Claude Code mechanic, wmux availability, a GitHub plan feature,
"what happens if I do X in environment Y") — check
`ENVIRONMENT-BEHAVIOR-LEDGER.md` in this same directory first. It's real,
dated, versioned test results, not documentation of intended behavior. A
real reversal already happened once (2026-09-22): Claude Code's `CLAUDE.md`
walk-up used to appear to stop at the nearest ancestor file; freshly tested,
it's cumulative. If you're relying on an assumption nobody's re-tested
against the currently-running version, test it cheaply and log the result
there before trusting it — see that file for the full rationale and the
query shapes worth tracking ("in wmux vs. not," "what tool will even let me
do X").

## What belongs in this file

`AGENTS.md` is durable, cross-instance, deterministically-loaded (via
`CLAUDE.md`'s `@AGENTS.md` import on Claude Code; read directly by
convention on Codex/Copilot) instruction space, not state. It holds rules
that stay true across sessions — what to do, what never to do, how to
verify something. It does not hold today's numbers: current issue/PR
counts, which milestone is active, current branch names, current cron job
IDs, current session IDs. That kind of fact goes in `MEMORY.md`, a dated
memory entry, or a live query run fresh each time — never cached here,
because every agent loads this file every session and a stale number
reported as current is worse than no number at all. A real incident,
2026-09-22: a milestone snapshot ("15 open, 43 closed") got written into
this file, caught, and moved out the same session — the fix was moving it
to the relevant agent's own job-description file with the number stripped
entirely, not just refreshing the number in place.

**One deliberate, scoped exception**: the "Freshness rule" under LeagueOS
daily staging workflows below takes the opposite stance on purpose, for
that section only — the container/candidate-path/port-proxy/workflow facts
there are durable-but-occasionally-changing operational contract, kept
correct in place because live WSL inspection is cheap and the alternative
(a wrong path silently followed) is expensive. That's a narrow, named
exception for facts that change rarely and matter operationally the moment
they're read, not a license to cache fast-moving state anywhere else in
this file. If a new section wants that same exception, say so explicitly
the way that one does, rather than assuming this paragraph's default.

Same principle, independently arrived at, already exists for
`.claude/agents/meridian.md`'s own scope ("this file should stay a stable
job description... put fast-changing facts in MEMORY.md or a dated scratch
note instead") — worth keeping the two consistent if either changes.

## Never run `find` against the home folder

Victor, absolute standing rule since the SOPHIA agents founded this wmux
workspace lineage — the first rule given to them, still in force: never run
`find` (or any recursive directory search) rooted at `~`/the home folder, at
any depth. Even `-maxdepth 4` surfaces roughly 2TB of unrelated data across
many projects, accounts, and agent identities that are none of any given
task's business. Use a specific, already-known path as the search root
instead, or the dedicated `Glob`/`Grep` tools scoped to a real subdirectory.
If the only way to locate something would be a home-folder-wide search, ask
rather than go looking.

## Unicode/emoji handling — hard requirement, every agent, every tool call

This swarm's identity system runs on emoji: card-suit role markers, agent
names (`🔱3♣️🟦`, `👽J♥️ Bernoulli`, `🍍K♦️ Nietzsche`), even real filesystem
folder names (`_/AS/📎9♥️/`). It shows up in strings, JSON field values,
filenames, and folder names, in this project and generally across this whole
machine's agent ecosystem. Victor, verbatim, as an absolute rule, not a style
preference: **"Any single piece of code you write that handles or searches
for a string — if it cannot find unicode — if it cannot deal with emoji — it
is a hard fail."**

Concretely: plain Bash `grep` without `-a` can silently binary-mode-skip
matches in a file that contains multi-byte UTF-8 content, producing a
confident, wrong **negative** result (a real 2026-09-21 incident: grepped a
session file for a field with 296 real occurrences, got zero matches,
reported "field never set" as fact — wrong). **Rule, not a reminder:** never
use plain Bash `grep` to search file *contents* in this project or any
sibling project — use a dedicated ripgrep-based search tool (Claude Code's
`Grep` tool; Codex/Copilot's equivalent), confirmed UTF-8/emoji-safe by
default with no flags needed. If raw shell grep is genuinely unavoidable
(e.g. piped through another shell that a dedicated tool can't reach), pass
`-a` unconditionally, every single time — never conditionally on "whether
this content might have emoji," because in this ecosystem it always might.
A surprising negative result on something well-established ("this was
apparently never set/never happened") earns a second check with a different
tool before it's reported as fact.

## "What is your instance number" — every agent, answer instantly, no searching

Victor, 2026-09-23, direct standing order after this exact question got
answered wrong three separate times in one night by one agent alone —
first a guessed bump that hadn't happened, then a search of a file
(`cards.json`) that has never tracked this, then several tool calls
grepping a 25,000-line session transcript for a fact already sitting free
in context: *"You need to be quicker — all agents you know need to be
quicker... Write this down. Make this a fucking thing. Test each other.
Regularly."*

**The real mechanism, so there is nothing left to search for**: on Claude
Code, the instance number is push-delivered automatically the instant a
real compaction boundary happens, via a `SessionStart:compact` hook banner
("YOU ARE INSTANCE N"). It is never something to derive, guess, or look up
in a card, a JSON file, or a transcript grep. The only real check is: *has
a new banner arrived since the last one I saw?* No new banner means no
change — zero tool calls, answer immediately. A tool call is only ever
justified to confirm which session/lineage is even active, never to
re-derive the instance number once a banner already established it.
Context-percentage shifts, elapsed time, and "stale usage" warnings are not
the mechanism and are not evidence of a new instance on their own — only
the banner itself counts. Codex and other harnesses have their own
equivalent mechanism (see [[codex-subagent-thread-map-from-state-db]] and
related memory for Codex's own real source); the discipline generalizes
even where the exact mechanism differs — know your harness's real signal,
trust it, and don't go hunting when it hasn't fired.

**Standing practice, not a one-time fix**: agents in this swarm should
periodically ask each other "what is your instance number" — as part of a
check-in, a dispatch, or an idle moment — specifically to verify the answer
comes back immediately and correctly, not after a search. A slow or wrong
answer here is a real signal something's drifted (a stale mental model, an
unnoticed compaction, confusion about which session is even live), worth
surfacing rather than shrugging off as a quirky detail.

**Envelope discipline when asking, Victor's direct addition**: *"make it
crystal clear that you expect a reply via tool x with parameters y, to
reach you as the sender of the message you are giving to them. Use
envelopes responsibly."* A quiz sent without a specified return path is an
incomplete envelope — don't just ask the question, name exactly how and
where the answer should come back: which real inter-agent mechanism
(`terminal_send`, `SendMessage`, an A2A channel post — whichever is the
genuine best avenue for *that specific agent's* working environment, see
below), targeted at your own real, current address (your own
`ptyId`/session name as verified this turn, not remembered from an earlier
one). **Never send in a way that would get the other agent to just answer
in their own normal chat** — a reply typed to their own user/chat UI does
not route back to you no matter how clearly the question was asked; the
envelope has to specify a real agent-to-agent path, not just clarity of the
question. Different agents may have different home environments (wmux vs.
not, which harness, whether Remote Control is even connected right now) —
match the actual best avenue for the recipient's real current environment,
not a single hardcoded default, and treat this as a heuristic to judge
fresh each time rather than a fixed rule, since environments/tool
capabilities/quotas change constantly.

**Real, empirically-tested delivery hierarchy** (from `rabbit-warren`, a
real wmux lab channel dedicated to exactly this — read it directly,
`channel_list`/`channel_read`, before re-deriving any of this by hand):
1. `SendMessage` (built-in, cross-session) — most trustworthy. Arrives as a
   system-tagged `<cross-session-message>`, works regardless of the
   target's `agentStatus` (mid-turn or idle alike), no polling, no human
   relay.
2. Pane-pinned `channel_post` — only reliable while the target is
   genuinely mid-turn (`waiting`). Once idle (`complete`), it degrades to
   landing at the recipient's shell prompt and surfacing as a
   `<pasted_content>` block inside their human's *next* message — a real,
   observed human-relay failure mode, not hypothetical.
3. wmux `send_message` (pane-targeted) — creates a task, delivery
   uncertain, may require an active turn loop on the target.
4. `channel_post` without a pin — badge-only, must be polled by the
   recipient, never arrives unbidden.

Check the target's real current `agentStatus` (via `pane_list`/
`surface_list`) before picking a tier — the same message tier that's fine
for a mid-turn agent can silently become a human-relay burden for an idle
one. This is the same discipline already
established for verifying your own outbound sends land — extend it to
specifying the inbound path you're asking for, every time, not just hoping
the other agent guesses correctly how to respond.

**No transport tier relieves you of verifying receipt — this is the Two
Generals' Problem, not just good practice.** Victor, 2026-09-23, direct:
*"regardless of transport method... no matter which method you choose to
send, you must verify receipt."* The precise reason, not just the rule: two
armies coordinating an attack via messengers who might be captured cannot,
with any finite exchange of messages, ever reach *certain, common
knowledge* that both sides know the plan is agreed — every acknowledgment
could itself be lost, and an acknowledgment of that acknowledgment could be
lost too, regressing forever. This is a proven impossibility, not a gap in
current tooling that a better transport could someday close. (Distinct from
the Byzantine Generals Problem, which is about reaching consensus despite
some nodes actively lying — a different problem; get the name right, it's
a small instance of the same checking discipline this whole section is
about.)

**What this actually means in practice**: the top tier of the delivery
hierarchy above is not a way to skip verification, it's still just the
best starting point. Always follow a send with a check that it actually
landed (`terminal_read` after `terminal_send`; a later reply for
`SendMessage`/channel mechanisms) — the same discipline already established
for outbound sends generally. Accept that even this is a *bounded, finite*
verification chain, not proof — chasing certainty past a reasonable check is
chasing something provably unreachable, not a higher standard.

**A precondition can itself be an unverified claim — check that too.** Real
example, same session: `SendMessage`'s top ranking assumes Remote Control
is currently connected for the target, but RC connectivity is itself an
actively-maintained state, not a static fact, and — per rabbit-0's own
honest self-assessment, 2026-09-23 — the maintenance of that state is
currently **reactive, not proactive**: disconnects are only discovered when
someone happens to relay one, there's no persistent watch across panes, a
post-compaction rabbit doesn't know who it's already restored vs. who's
drifted, and a wmux restart wipes all prior RC state with no record.
Real proposed fix, not yet built: a periodic heartbeat checking
`agentStatus`/RC state across all known panes and firing `/remote-control`
on any confirmed disconnect automatically — "a future sesh-king or
monitoring job, not an attitude adjustment" (rabbit-0's own framing). Until
that exists, treat "is RC live for this target" as its own unverified claim
worth checking, not an assumption to build a send on.

**`submit: true` is a promise, not a guarantee — same principle, one layer
lower.** Victor, 2026-09-23, direct: *"Any method which uses the chat box
directly instead of an mcp tool or a2a messaging system, can statistically
fail to actually interpret the enter. Sometimes it gets swallowed, sometimes
turns into a line break, but statistically some part of the time, does not
turn into a send. It's the two generals problem again."* Confirmed live,
same session: a `terminal_send_key ctrl+c` meant to submit a queued draft
instead **cleared** it silently — the message had to be resent from
scratch. `submit: true` on `terminal_send` is a better bet than a bare
keypress, not a fix for the underlying channel — the PTY's own keypress
interpretation is genuinely lossy, regardless of which parameter requested
the send. **The real fix**: prefer a real MCP-tool/A2A-mediated path
(`SendMessage`, a pane-pinned `channel_post` per the delivery hierarchy
above) over anything that has to simulate a keystroke into a chat box,
whenever one exists for the target — chat-box methods are the fallback for
when no such tool is available, not the default to reach for first and
verify harder afterward. And regardless of which method is used, the
post-send verification habit already established in this section still
applies unconditionally — no method, including the "better" ones, is
exempt from checking that it actually landed.

## wmux pane actions are state-machine style — focus before you act

Victor, 2026-09-23, real finding confirmed against comparable before/after
behavior, not asserted from a schema reading alone: *"much like OpenGL, the
order you call functions in matters here. Panes must be focused before
pane actions are taken."*

**What was actually observed**: an agent (Nietzsche) called `browser_open`
without first focusing its own pane. The browser split *Meridian's* pane —
the one that happened to be last-active globally — cutting it in half.
After the agent called `pane_focus` on its own pane and *then* called
`browser_open`, the browser landed as a new pane near the agent's own
space instead, leaving Meridian's pane untouched. Same agent, same tool,
different result — the only variable was call order.

**Why, mechanically**: `pane_split` (and whatever `browser_open` calls
internally when no reusable browser surface exists) takes no explicit
source-pane parameter in its own schema. There is no way to say "split
*this* pane" as an argument. Instead, these actions read *implicit,
currently-focused state* — exactly OpenGL's model, where `glBindTexture`
sets state that later calls act on rather than receiving it as a
parameter. Skipping the focus call doesn't leave the target unset; it
leaves whatever pane was last active by someone else's action as the
implicit target, which is how one agent's browser call can silently
hijack a different agent's space.

**The rule**: call `pane_focus` on your intended target pane explicitly,
immediately before any pane-mutating action whose target isn't an explicit
parameter in its own schema — `browser_open` and `pane_split` both qualify
today; treat the same caution as the default for any pane-family action
that doesn't show an explicit target-pane field. Don't assume the tool
call itself is self-contained just because it succeeds — an action can
return `ok` while having silently acted on someone else's implicit state
rather than your own.

## LeagueOS daily staging workflows: shared cross-harness contract

These workflows belong to the PFM infrastructure and must be followed identically by Codex, Claude, GitHub Copilot, and every MERIDIAN worker. Do not rediscover them from the current shell, a stale transcript, or a different Docker daemon.

### Runtime authority

The local LeagueOS demo stack runs in the **`LeagueOS`** WSL2 distro's own Docker daemon (not KPFM — that distro was abandoned 2026-09-23). Windows Docker Desktop is a separate daemon and is not authoritative. Windows ports 8207-8210 are forwarded into LeagueOS via `C:\ProgramData\LeagueOS-LAN\maintain-lan.ps1` (Scheduled Task `LeagueOS-LAN-worker`, runs every 60s). Plugin and theme code are read-only bind mounts from **native WSL git checkouts** inside the owning team distro: `/var/lib/leagueos/staging` (for staging containers) and `/var/lib/leagueos/candidate` (for candidate containers) — never `/mnt/c/` paths, which cause 9P filesystem crashes. The Red team uses `LeagueOS_Red`, its own Docker data root, bridge, networks, and ports 8307-8310; it must never inherit Blue's `/var/lib/docker`, `docker0`, networks, volumes, or Compose projects. Because WSL distros can share a kernel/network namespace, a distinct Docker data root alone is insufficient: Red's daemon must use a distinct bridge such as `docker0-red` and a non-overlapping address pool.

Team identity is address-qualified throughout operations: `🟥` or `🟦` may prefix a card designation, and `_red` or `_blue` may suffix an agent name. Thus `🟥🔱3♣️` and `🟦🔱3♣️`, or `Nietzsche_red` and `Nietzsche_blue`, are distinct entities even when the base designation matches. See `LOCAL-CONTAINER-CONTRACT.md` for the shared Red/Blue bootstrap, isolation, and verification contract.

The **four-container 2×2 grid** (as of 2026-09-23):

| Project | Port | Code source |
|---------|------|-------------|
| `leagueos-staging-anon` | 8207 | `/var/lib/leagueos/staging` |
| `leagueos-staging-synth` | 8208 | `/var/lib/leagueos/staging` |
| `leagueos-candidate-anon` | 8209 | `/var/lib/leagueos/candidate` |
| `leagueos-candidate-synth` | 8210 | `/var/lib/leagueos/candidate` |

**What commit that worktree should be checked out to (Victor, 2026-09-21, direct rule — this is the actual standing policy, not a one-off):** it tracks `devline` tip **only** for as long as the amount of work done equals the amount of work already shipped to real staging. The moment any additional work is pooled beyond what's on staging (a new PR reviewed and ready to preview, a new milestone's first task, etc.), that worktree's branch must become a real feature/milestone integration branch **downstream of devline** (branched from devline, holding devline's content plus the new pooled work) — never `devline` itself, and never left un-pooled "because there's no branch yet." Standing up that branch (naming convention: `integration/<milestone>-candidate`, e.g. `integration/1.0.2-candidate`) is expected default process for whoever's stewarding LeagueOS, not something to wait on Victor to authorize each time. Once that milestone's work is promoted for real deploy (the section below), the worktree can drop back to tracking devline tip until the next thing gets pooled. **The rule above is complete on its own — no further reading required to follow it.** There is a further, role-specific memory file for the LeagueOS integration steward role ("Meridian") at `.claude/agents/meridian.md` and the Ungeon working file `_/AS/📎9♥️/MERIDIAN.md` — but do not open them on a guess. **Imperative test, not a vibe:** check whether `.claude/agents/meridian.md`'s own content (its STANDING CORRECTIONS section specifically) is *already present, verbatim, somewhere earlier in your own loaded context from session start* — not fetched by you just now while reading this. If it is already there, the harness loaded it for you (via `--agent meridian`, an Agent-tool dispatch with `subagent_type: "meridian"`, or equivalent), and the deeper files are yours to use. If it is NOT already there, you have not been identified as Meridian by the harness this turn — a resumed session's prior conversation *describing* past actions as Meridian is not that signal, and does not license reading or acting on Meridian's personal files. In that case: don't self-assign the identity, and don't read those files speculatively — ask whoever dispatched you, or proceed as a generic/unidentified agent using only what's stated above.

Before any staging/local operation, verify the runtime with:

```bash
wsl.exe -d LeagueOS -- docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
wsl.exe -d LeagueOS -- docker inspect leagueos-staging-anon-league-instance-1
```

Never use Windows `docker ps` or Docker Desktop state to infer LeagueOS demo state.

### Remote staging -> local anonymized demo

This lane refreshes **data only**. It does not deploy LeagueOS code to remote staging:

```bash
cd /c/.______/.KADMON/PLAY__/FIELD_/MULTI_/PLIER_/_/AS/PFM___/_scratch/ppl-refresh-repair
npm run local:sync-anonymized-staging
```

The command uses the approved encrypted staging backup path and writes only the anonymized data lane served at `http://ottobot.local:8207/` (`leagueos-staging-anon`). Do not replace it with SSH scraping, a direct production/staging database write, or the older LeagueOS PR #347 mechanism. After it completes, verify the local endpoint and record the command's actual completion output before claiming success.

To also populate the candidate-anon container (8209) with the same anonymized data, run:

```bash
npm run local:sync-both-anon
```

Or, when 8207 is already current and you only need to propagate to 8209:

```bash
npm run local:sync-candidate-from-staging
```

### Code matrix invariants — NEVER check the same branch out to both worktrees

The 2×2 grid has three hard invariants. Violations are a blocking failure:

1. **Staging worktree HEAD must equal the live-deployed commit** — `leagueos_local_code_sha` WP option in 8207 is the canonical marker.
2. **Candidate worktree HEAD must differ from staging** — candidate exists to preview code not yet deployed.
3. **NEVER check the same branch out to both `/var/lib/leagueos/staging` and `/var/lib/leagueos/candidate`** — even if their HEADs temporarily differ, using the same branch name makes them convergent on the next pull.

Run the alarmed check before any validation session:

```bash
npm run local:check-matrix     # exit 0 = OK, exit 1 = violations
```

Full matrix rules and dual-sync documentation in `LOCAL-CONTAINER-CONTRACT.md`.

### Approved local candidate -> remote staging

This lane deploys **code only** and is allowed only after Victor has reviewed the exact candidate commit served at 8207. The approved source is the candidate bind mount, not the `leagueos-wordpress:local` image tag and not whichever commit happens to be on `devline`:

1. Inspect the 8207/8209 container bind mounts and run `wsl.exe -d LeagueOS -- git -C /var/lib/leagueos/candidate rev-parse HEAD`.
2. Validate the exact candidate locally, including the visible browser workflow.
3. Compare that commit with canonical `git ls-remote https://github.com/PlayFieldMultiplier/LeagueOS.git refs/heads/devline`.
4. Stop if `devline` differs, is ahead, or contains content Victor did not review. Do not merge directly to `devline`.
5. Promote only through the approved integration PR, with the required `LEAGUE_OS_VERSION` bump in the same promotion, then let the code-only staging workflow deploy the resulting approved `devline` commit.

Remote staging deployment is never implied by a successful local data refresh. Local data refresh and code deployment are separate lanes with separate approvals.

### Merging any LeagueOS PR: use `scripts/pfm-merge.sh`, never raw `gh pr merge`

Every agent — Meridian and every subagent — merges LeagueOS PRs through
`scripts/pfm-merge.sh <PR#> [--repo OWNER/REPO] [--victor-said "<exact words>"]`
in the PFM___ root, never a raw `gh pr merge` call. It checks the PR's real
base branch and refuses anything targeting `devline`/`main`/`master` unless
`--victor-said` carries Victor's actual live words (logged with a timestamp
to `.pfm-merge-audit.log`, a real audit trail). Merging to a candidate or
integration branch needs no extra flag — that path is meant to stay
frictionless. Built 2026-09-22 after three real same-night violations of the
"nothing reaches devline without Victor's review" rule despite it being
written down; GitHub's own branch protection/rulesets are unavailable on
the org's Free plan for a private repo (confirmed via API, not assumed), so
this script is deliberately a local, free substitute — see
`.claude/agents/meridian.md`'s "Branch/deploy policy" section for the full
incident history if useful, but the rule itself doesn't require reading
that: always `pfm-merge.sh`, never raw `gh pr merge`, full stop.

### A hotfix deployed to staging MUST also reach devline, and its downstream branches

Real incident, 2026-09-24: an agent deployed six real hotfixes straight to
real staging via the SOAP path, verified each live, and never merged any of
them to `devline` — wrongly reading "nothing reaches devline without
Victor's review of a local candidate build" as covering hotfixes too.
`devline` drifted behind real staging for hours, and a second agent then
started a fix from stale `devline` HEAD, which would have reverted all six
fixes if merged as-is.

Victor, direct: *"A hotfix deploy still needs to go to devline. Devline
'MEANS' this is staging's code... it needs to be backported into the
downstream chain as well, so it doesn't get lost on the next INTENTIONAL
feature release deployment."* Full detail, including why this doesn't
conflict with the local-candidate-review gate (they govern two different
things: "what's live now" vs. "what's approved for the next release") and
the correct-base-branch discipline for stacking multiple hotfixes before
any reach devline: `PPL-STAGING-DEPLOY-RUNBOOK.md` sections 4a/4b (also
covers the now-mandatory "every fix ships with a real regression-catching
test" gate). Read those sections before deploying or dispatching any
hotfix — this is not optional context.

### Freshness rule

The commands and paths above are the durable contract; live WSL inspection is the current-state authority. Whenever the container, candidate path, port proxy, workflow, or backup mechanism changes, update this section in the same work session and remove the obsolete claim. Do not leave a known-stale workflow description in place.

### Validating a login-gated / role-specific feature — standard procedure for every agent, not just Meridian

Never report a login-gated feature (personal stats, team-filtered views, captain/admin-only controls) as "unverifiable without the real user's login." Four local containers exist on the **`LeagueOS`** WSL Docker daemon for exactly this, and using one is the default expected step, not a special case to ask permission for:

- **`:8207`** (`leagueos-staging-anon`) — real anonymized PPL data. As of 2026-09-21 it only has captain-level demo accounts (`demo-staging-0001`..`0010`, password `Demo-Only-2026!`), no plain non-captain player accounts yet.
- **`:8208`** (`leagueos-staging-synth`) — synthetic data. This is the replacement for the retired KPFM-era synthetic/integration chain. It is a fresh WordPress install and remains empty until the synthetic fixture is seeded. If this port drifts, verify with `wsl.exe -d LeagueOS -- docker ps --filter name=leagueos-staging-synth` before trusting this line.
- **`:8209`** (`leagueos-candidate-anon`) — anonymized PPL data + candidate code. Use this to verify candidate behavior against real data.
- **`:8210`** (`leagueos-candidate-synth`) — synthetic data + candidate code.
- **Container self-healing**: `LeagueOS/_scratch/anonymized-staging-data/docker-compose.yml` uses **`restart: unless-stopped`** for MariaDB and **`restart: on-failure:3`** for WordPress, with `depends_on: condition: service_healthy` gating WordPress on MariaDB readiness. `unless-stopped` was the original policy for WordPress too — that was wrong; it masked both the LEAGUEOS_PUBLIC_URL bug and the MariaDB-not-ready race as silent infinite loops. If a fresh, unexplained death recurs, check `wsl.exe -d LeagueOS -- docker events --filter event=die --filter event=stop --filter event=kill` live.

Pick the account **role that matches the feature under test** (captain feature → captain account, admin → admin, player-only → player, creating one via `wp user create` if the exact role doesn't yet exist rather than skipping the check). Log in either via the documented demo password directly, or — if you need to avoid ever touching a password — generate a real signed WP session locally: run `wp eval-file` inside the container calling `wp_generate_auth_cookie($user_id, $expiration, 'logged_in')`, then inject the resulting cookie into a Playwright/CDP browser context via `context.addCookies()`. Never fabricate/guess a real credential to get around this.

**Two compounding gotchas, both hit the same night:** (1) these containers' plugin/theme code is a live *read-only bind mount* from a specific git worktree on the host filesystem (`docker inspect <container> --format '{{json .Mounts}}'` shows the real source path) — it can be stale relative to what's actually deployed; check the worktree's checked-out commit against the real deployed SHA (`gh api repos/OWNER/REPO/branches/<branch> -q '.commit.sha'`) before trusting either a pass or a fail from it. (2) When verifying a personalized "My X" feature, click the actual in-app nav link/button — don't hand-construct the URL from assumed query params; the app's own link-resolution logic (e.g. deriving "which team is this user's own team") often lives one layer up from the page you're testing, and a hand-built URL can produce a confident false negative by skipping it entirely.

Full incident writeup and root causes: `.claude/agents/meridian.md` (STANDING CORRECTIONS) and `_/AS/📎9♥️/MERIDIAN.md` — but the procedure above is complete on its own for any agent that needs it.

## npm publishing credential state machine

This section is the durable operating contract for the `@skill-of` and
`@playfieldmultiplier` npm publishing paths. It describes the workflow; it is
not permission to reveal, copy, print, or rotate a live secret without an
explicit task. Secret values never belong in chat, files, command arguments,
logs, artifacts, or source control.

### Design rules

- Prefer npm trusted publishing (GitHub Actions OIDC) for publishing whenever
  the package/repository supports it. This removes long-lived `NPM_TOKEN`
  distribution from the publish path.
- If a token is required, use granular npm tokens with read/write package access
  limited to the exact scope/package set and a short expiration. Use a separate
  token for each trust boundary: normally one for `@skill-of` and one for
  `@playfieldmultiplier`, and preferably one per publishing workflow or
  environment. Public versus private GitHub repository visibility does not
  determine npm token rights.
- npm organization access alone does not grant package publishing rights. The
  token's package/scope selection and the npm account's maintainer rights must
  be checked independently.
- A private source checkout credential (GitHub App key, deploy key, PAT, or
  `DASHBORG_SOURCE_REPO_TOKEN`) is a different credential from `NPM_TOKEN`.
  Never diagnose one from the other.
- A GitHub org secret is usable only by the repositories included in its
  repository-access policy. A secret named `NPM_TOKEN` is not automatically
  available to every repository in the organization.

### Required states and transitions

Track each namespace/workflow pair through these states, recording only
metadata (token label, scope, expiration, owner, secret location, and evidence
URL)—never the token value:

1. `DISCOVERED` — identify npm namespace/package set, publishing repositories,
   current workflow, GitHub org/repo secret location, and whether trusted
   publishing is available.
2. `PLANNED` — choose trusted publishing or a granular token; define exact npm
   scopes/packages, GitHub repository allow-list, environment, expiration, and
   rollback owner. Stop if any of these are ambiguous.
3. `CREATED` — create the token through npm's UI (granular tokens are created
   on the website) or configure the OIDC trusted publisher. Capture metadata
   immediately; do not attempt to retrieve the full token later.
4. `STORED` — write the value once through the approved secret UI/channel into
   the intended GitHub org or repository secret. Confirm the repository access
   policy without reading the value back.
5. `WIRED` — confirm the workflow maps the secret to `NODE_AUTH_TOKEN` and uses
   `https://registry.npmjs.org`; `.npmrc` may contain only the literal
   `${NPM_TOKEN}` reference, never a token.
6. `VERIFIED` — run a bounded, non-leaking check. `npm whoami` may report only
   success/failure; a publish dry run checks package contents but does not
   publish. For a real publish, verify the package/version and provenance after
   the run. Do not retry an unexplained auth failure.
7. `ROTATED` — create and store the replacement, verify it through the same
   path, then revoke the old token and record the revocation timestamp. Never
   revoke first unless compromise requires immediate containment.
8. `REVOKED` — old credential is disabled; workflows and metadata point to the
   replacement or trusted publishing. Keep only non-secret audit evidence.

Allowed failure transitions are explicit: `PLANNED -> BLOCKED` for missing
authority or ambiguous scope; `STORED -> BLOCKED` for an excluded repository;
`WIRED -> BLOCKED` for an absent/empty environment mapping; `VERIFIED ->
BLOCKED` for `ENEEDAUTH`, 403, 2FA, package permission, or registry failures.
Every `BLOCKED` record must name the failing boundary and the next owner.

### Dry-run protocol before live rotation

When asked to practice or rehearse rotation, execute the state machine with
redacted fixtures only:

- enumerate the intended namespace, package/scope allow-list, publisher repo,
  GitHub secret location, and expiration policy;
- assert that no fixture contains a token-shaped value and that no command line,
  stdout, artifact, or checked-in file receives a secret;
- assert that every publishing repository is included in the selected-repo
  policy (or that the secret is deliberately repo-scoped);
- assert workflow wiring to `NODE_AUTH_TOKEN` and npmjs.org, and classify
  `ENEEDAUTH`, empty env, repository exclusion, private-checkout 403, and 2FA as
  distinct failures;
- produce a transition report with `WOULD_CREATE`, `WOULD_STORE`,
  `WOULD_VERIFY`, and `WOULD_REVOKE` actions, but do not call npm/GitHub mutation
  endpoints and do not use real credential material.

### Known PFM findings to re-check, not silently inherit

- The PlayFieldMultiplier org `NPM_TOKEN` was observed as `Selected
  repositories`, with `pfm-agent-ops` and
  `skill-of-secure-credential-automation` selected; `pfm-webops` was absent.
- `SKILL-OF/instance-identification#21` recorded `ENEEDAUTH` and an empty
  `NODE_AUTH_TOKEN` during a dry run. This is evidence of a broken delivery or
  wiring path, not proof that the npm token value is invalid.
- The next live repair must verify both org/repository placement and workflow
  wiring, then perform one bounded `npm whoami`/publish verification per
  namespace before revoking old tokens.
- Current bridge decision (2026-09-04): if trusted publishing/OIDC cannot be
  enabled immediately, use a granular seven-day write token with bypass-2FA
  only for the GitHub Actions publishing workflow, scoped to the minimum
  package set. GitHub-hosted runners cannot use an ISP-IP restriction. Treat
  this as a compatibility bridge and track migration to trusted publishing or
  staged publishing; never use the token for account or governance actions.

### Proactive queue rule

When an npm, PAT, secret-scope, registry-authentication, publish, or private-
checkout issue appears in the notification queue, treat it as an actionable
work item—not merely a report to summarize. During each notification sprint:

1. Triage the item and its linked issues for a concrete boundary: missing
   secret, wrong repository allow-list, bad workflow mapping, expired/revoked
   credential, package permission, private checkout authorization, or human
   2FA/passkey gate.
2. Inspect the smallest safe evidence surface available and advance every
   non-sensitive, authorized step immediately: update the issue with facts and
   acceptance criteria, update the shared handoff, fix local workflow/docs when
   authorized, or route the item to the correct account/org maintainer.
3. Do not wait for the user to ask whether a solvable problem exists. The
   default is proactive bounded progress; the stop condition is a real missing
   authority, human authentication ceremony, ambiguous target, or required
   secret value.
4. When blocked, record the exact blocker and the next action needed. Never
   convert a blocked credential operation into a vague “needs human action”
   status when the surrounding diagnosis or documentation can still be done.
5. At the end of the sprint, leave durable evidence: issue/PR URL or comment,
   local handoff path, verification result, and explicit remaining blocker.
6. Treat assignments to `VictorBargains`, direct `@DarienSirius` mentions, and
   labels/titles containing `human-only`, `PAT`, `token`, `secret`, or `2FA` as
   high-priority control-plane work. Inspect the linked issue even when the
   notification is categorized as ordinary activity. Separate the human-only
   ceremony from browser-executable account control: secret-name existence,
   timestamp, workflow wiring, token-record metadata, and safe documentation
   can be verified without opening or printing a credential value.
7. If the browser already shows the needed fine-grained token record and repo
   secret, report the loop as mechanically wired but scope-unverified until
   GitHub sudo/passkey permits checking permissions. Never rerun a workflow that
   rotates live credentials merely to make the monitor look active.

This rule applies to both namespace lanes (`@skill-of` and
`@playfieldmultiplier`) and to credentials that are adjacent but distinct from
`NPM_TOKEN`.
