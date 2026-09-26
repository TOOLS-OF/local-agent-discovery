# sesh-rabbit

**Agent sensorium**: reads a live session tape and produces structured
self-awareness data — timeline density, role distribution, response latencies,
compaction count, instance number, context-fill estimates.

Part of [TOOLS-OF/local-agent-discovery](https://github.com/TOOLS-OF/local-agent-discovery).
Conceptual basis: [SKILL-OF/local-agent-discovery](https://github.com/SKILL-OF/local-agent-discovery).

## What it does

Where `sesh-hound` *discovers* sessions and `sesh-falcon` *launches* them,
`sesh-rabbit` *inhabits* one from the inside.

The primary consumer is the agent itself — you hand it your own tape path and
it tells you what you've been doing, how long you've been doing it, and how
full your context window is getting.

## Usage

```sh
sesh-rabbit [tape-path] [options]

# Auto-detect tape from ~/.claude/current-tape-path.txt:
sesh-rabbit

# JSON output (machine-readable, for other agents):
sesh-rabbit --json

# Single statusline bar (for wmux / tmux):
sesh-rabbit --statusline [--mode 0-3]

# 4-zoom context map:
sesh-rabbit --ctx-map

# Specific harness (codex, copilot adapters are stubs pending tape samples):
sesh-rabbit --harness claude-code
```

## Output modes

| Flag | Output |
|------|--------|
| *(default)* | Multi-line HUD: role bars, latency sparkline, instance info |
| `--json` | Structured JSON — safe for piping to other agents |
| `--statusline` | Single ANSI bar (44 chars): τ timeline, ρ recent, % ratio, λ latency |
| `--ctx-map` | 4-zoom context structure: A auto-loaded, B depth-1 refs, C full graph, D token window |

## Statusline modes (cycle every 9s by default)

| Mode | Symbol | Content |
|------|--------|---------|
| 0 | τ | Full session timeline — each char = session\_span/44, colored by dominant role |
| 1 | ρ | Recent 44-min zoom — each char = 1 min |
| 2 | % | Role ratio bar — proportional user/agent/tool/system split |
| 3 | λ | Response latency sparkline — last 44 user→agent times, log scale |

## Adapter status

| Harness | Status |
|---------|--------|
| `claude-code` | ✅ Implemented — verified on OTTOPOET-00Q (2026-09-25) |
| `codex` | 🔲 Interface stub — needs tape format samples |
| `copilot` | 🔲 Interface stub — needs tape format samples |

To add an adapter: implement `AgentSensorium` from `lib/interface.js` and
register it in `lib/factory.js`.

## Architecture

```
AS/sesh-rabbit/
  bin/
    sesh-rabbit.js    ← CLI entry point (auto-detects tape, delegates to adapter)
    sesh-rabbit       ← POSIX shim
    sesh-rabbit.bat   ← Windows shim
  lib/
    interface.js      ← AgentSensorium abstract class + contract docs
    factory.js        ← createSensorium(harness) factory
    adapters/
      claude-code.js  ← Claude Code JSONL parser + all rendering methods
      codex.js        ← stub
      copilot.js      ← stub
  package.json
  README.md
```

## wmux integration

`sesh-rabbit --statusline` is wired into
`~/.claude/tape-statusline.mjs` on the host machine (OTTOPOET-00Q).
The statusline script calls the wmux statusline first, then appends the
rabbit's tape bar + instance number (`🤖N`) prefix.

## Author

`hazrat-rabbit` (rabbit-3.0.Q) — branch `hazrat-rabbit/sesh-rabbit`
Worktree: `~/_/AS/tools-of/AS/sesh-rabbit`
