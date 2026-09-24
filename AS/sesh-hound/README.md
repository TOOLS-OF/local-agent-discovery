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
sesh-hound --by-title Bernoulli  # resolve a title or nickname
sesh-hound --subagents meridian  # resolve a parent and list native children
sesh-hound --codex-native-subagents 019f68b6-7e58-7621-9f32-410588171513 --json
sesh-hound --subagents meridian --depth 2
```

Pointing at a parent folder also finds sessions from every subfolder underneath it.

## What it actually does

No single tool tracked "which AI coding sessions came from this folder" across all three
agentic coding tools — the storage conventions are all different, and none of them index by
folder directly. `sesh-hound` reads each tool's real on-disk format and cross-references by
the `cwd` each one actually recorded at session start. For Codex, current versions use the
indexed native state database first, so ordinary discovery does not recursively open every
rollout file. Override it with `--codex-db`; otherwise the newest `~/.codex/state_*.sqlite`
is selected.

| Tool | Where sessions live | How cwd is found |
|---|---|---|
| Claude Code | `~/.claude/projects/<escaped-cwd>/*.jsonl` | plain `"cwd"` field in event content |
| Codex | `~/.codex/state_*.sqlite` (indexed), rollout files as fallback | `threads.cwd`; native children use `thread_spawn_edges` |
| VS Code Copilot Chat | `<vscode-config>/User/workspaceStorage/<hash>/chatSessions/*.jsonl` | `file://` URI in the matching `workspace.json` |

Two non-obvious gotchas found and fixed while building this, worth knowing if you extend it:

1. A `"session_id"` field found by grepping Codex file *content* can be stale — it may
   reference a parent/original session after a resume or fork. The file's own UUID (from its
   filename) is the reliable session id for that file.
2. VS Code's chat session files are `.jsonl`, not `.json` — a filter that only matches
   `.json` silently excludes every real session with no error.

## Progressive agent discovery

Use the modes in order: folder to find sessions, title to resolve identity, then
`--subagents` to inspect the parent/child graph. `--subagents` accepts either a UUID or a
case-insensitive title, `name`, nickname, or role. `--depth 2` follows one additional
native edge. Results include real Codex thread IDs, edge status, names, titles, and rollout
paths; discovery does not claim that it can contact or resume an agent.

The neighboring tools have deliberately separate jobs:

| Tool | Job |
|---|---|
| `sesh-hound` | discover sessions and native parent/child edges |
| `sesh-falcon` | launch or resume a named agent |
| `sesh-name` | resolve an agent's own instruction identity |
| `sesh-nautilus` | reconstruct dropped compaction boundaries |
| `sesh-stork` | deliver a session artifact to another harness |

Discovery is read-only. It is not a transport or permission mechanism.

## License

MIT
