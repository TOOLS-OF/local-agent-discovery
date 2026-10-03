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
sesh-hound .                     # compact terminal-friendly inventory
sesh-hound . --json              # machine-readable output
sesh-hound . --subagent          # only sessions with subagent evidence
sesh-hound . --routes routes.json # merge a local, authoritative route map
```

Pointing at a parent folder also finds sessions from every subfolder underneath it.

## Rancor Monster routeability view

This branch adds a readable inventory row with display name, session ID, scope,
route classification, parent route, compaction count, and last activity. It
does **not** infer that every stored Codex session is a top-level chat: a local
session record is historical evidence, not proof of an addressable endpoint.

For authoritative identity and return routes, provide a local route map with
`--routes`. The file is intentionally external to the repository so that
private handles and local agent relationships are never published by accident:

```json
{
  "routes": {
    "session-id": {
      "displayName": "optional display name",
      "kind": "native-subagent",
      "parent": "parent-session-or-handle",
      "summon": "through-parent"
    }
  }
}
```

Without an override, sesh-hound labels a Codex record only as a
`subagent-candidate` when its own metadata contains parent/subagent evidence.
Candidates still require verification through the parent or Codex app.

The cache defaults to the platform cache directory (or can be supplied with
`--cache <file>`). It keys records by path, size, and modification time. Codex
compaction counts are updated by scanning only appended bytes when a rollout
grows, rather than repeatedly reading the entire transcript.

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
