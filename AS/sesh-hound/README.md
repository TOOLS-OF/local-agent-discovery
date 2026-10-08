# 🐕 sesh-hound

Sniff out every **Claude Code**, **Codex**, and **VS Code Copilot Chat** session ever
spawned from a given folder — across Windows, macOS, and Linux.

## Install

```bash
npm install -g .          # from inside this folder
# or, once published:
npm install -g sesh-hound
```

## Use

```bash
sesh-hound                       # sniff the current directory
sesh-hound /path/to/some/project # sniff a specific folder
sesh-hound . --json              # machine-readable output
sesh-hound . --harness codex     # only scan one harness (faster, see below)
sesh-hound . --config-dir /path/to/other/claude/config  # also scan a CLAUDE_CONFIG_DIR root
```

Pointing at a parent folder also finds sessions from every subfolder underneath it.

### `--harness` — skip the other two scanners entirely

`--harness claude-code|codex|vscode-copilot` only runs that one scanner. Real
need: a full Codex rollout-file scan alone can run past a minute on a loaded
machine, and most of the time you already know which tool you're hunting a
session in. When you don't need all three, don't pay for all three.

### Real display names, not just session ids

Every result now carries a real `title` field — Codex sessions show their
`agent_nickname` (or the thread's own title text if no nickname was set);
Claude Code sessions show their session `slug`. Finding "which one is the
agent I'm thinking of" by eye used to mean opening transcripts one at a time
to decode a bare UUID; now the first result screen just says "Archimedes" or
"Cicero" directly.

### Codex is fast by default — a real indexed DB query, not a directory walk

Codex sessions are looked up via `~/.codex/state_5.sqlite` — the same
`threads` table the Codex app-server daemon itself maintains (id, cwd,
title, agent_nickname, updated_at, archived) — queried once via the real
`sqlite3` CLI instead of recursively walking every rollout `.jsonl` file
and reading its first 4KB off disk. This is the difference between a
sub-second lookup and a minute-plus full-tree scan. If `sqlite3` isn't on
PATH, or the DB is missing/locked/an unexpected shape, sesh-hound falls
back to the original file-walk automatically — the fast path is a pure
speed optimization, never a hard dependency, and both paths produce
identical real results.

### `--config-dir` — a real blind spot, not a cosmetic option

`CLAUDE_CONFIG_DIR` is a real Claude Code env var (verified empirically,
2026-10-07: `CLAUDE_CONFIG_DIR=/x claude mcp list` writes `.claude.json`
there AND relocates the entire `projects/` tree to `/x/projects/...`, not
just the top-level config file). Any session launched with a custom
`CLAUDE_CONFIG_DIR` — the mechanism this swarm's per-account "housecat"
isolation uses — stores its transcript entirely outside the default
`~/.claude/projects/`, so without `--config-dir` sesh-hound would never
find it at all, not just fail to label it. Pass `--config-dir <dir>`
(repeatable) for every additional config root you want scanned alongside
the default; each matching result's `configDir` field records which root
it came from (`"<home>"` for the default).

## What it actually does

No single tool tracked "which AI coding sessions came from this folder" across all three
agentic coding tools — the storage conventions are all different, and none of them index by
folder directly. `sesh-hound` reads each tool's real on-disk format and cross-references by
the `cwd` each one actually recorded at session start:

| Tool | Where sessions live | How cwd is found |
|---|---|---|
| Claude Code | `~/.claude/projects/<escaped-cwd>/*.jsonl` | plain `"cwd"` field in event content |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (date-based dirs) | `"cwd"` in the first `session_meta` line |
| VS Code Copilot Chat | `<vscode-config>/User/workspaceStorage/<hash>/chatSessions/*.jsonl` | `file://` URI in the matching `workspace.json` |

Two non-obvious gotchas found and fixed while building this, worth knowing if you extend it:

1. A `"session_id"` field found by grepping Codex file *content* can be stale — it may
   reference a parent/original session after a resume or fork. The file's own UUID (from its
   filename) is the reliable session id for that file.
2. VS Code's chat session files are `.jsonl`, not `.json` — a filter that only matches
   `.json` silently excludes every real session with no error.

## License

MIT
