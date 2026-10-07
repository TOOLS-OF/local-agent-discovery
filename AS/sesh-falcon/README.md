# 🦅 sesh-falcon

Launch a session with every required parameter enforced explicitly — no
silent defaults, across both Claude Code and Codex.

## The problem

An agent launch that omits the wrong parameter doesn't fail loudly — it
fails quietly, hours later, in a way that looks like the agent stopped
working rather than like a launch mistake:

- **No permission-bypass flag:** the agent stalls at the first permission
  prompt and does no further work until a human happens to notice. Real
  incident: an agent burned real session time stuck on a single `npm list`
  approval prompt.
- **No explicit model on Claude Code:** if the harness's own default model
  has a smaller context window than the session actually being resumed (a
  200k-context default resuming a session built on a 1M-context model), the
  very first turn can trigger a compaction the smaller model can't complete
  cleanly — stalling the session on its first action.
- **No explicit model on Codex:** resuming with a *different* model than
  the one currently active for that thread in the GUI can silently fork the
  thread. Messages sent into that CLI fork never appear in the GUI the user
  is actually watching, and never reach that thread's own next compaction
  summary — silent data loss, not a cosmetic mismatch.
- **An `--agent` name that sounds right but isn't:** Claude Code does not
  error on an invalid `--agent` value — it silently launches as something
  other than the intended agent. Real incident: a relaunch used
  `--agent hazrat-rabbit-pineapple`, a plausible identity-description label
  with no real spec file behind it, and nothing failed loudly.
- **A first-launch trust dialog that can't be driven from a meta-harness:**
  Claude Code's "Quick safety check" TUI, on first launch in a new `--cwd`,
  could not be navigated by any simulated keypress from inside wmux — a
  literal character landed on the OUTER shell prompt instead of reaching
  the dialog, proving the input never got there at all.

## Install

```bash
npm install -g .          # from inside this folder
```

## Use

```bash
sesh-falcon --session <id-or-path> --cwd <folder> --model <model> \
            (--skip-permissions | --no-skip-permissions) \
            [--harness claude-code|codex] [--agent <name>] [--check-trust] \
            [--dry-run] [--json]
```

There is deliberately no default for `--model` or the permission-mode
flags. Omitting them is an error, not a fallback — the failure modes
above are worse than forcing the caller to decide every time.

`--agent` and `--check-trust` are optional extensions (Claude Code only) —
most launches need neither:

- **`--agent <name>`**: validates `<cwd>/.claude/agents/<name>.md` is a real
  file on disk before appending `--agent <name>` to the launch command.
  Refuses with the real list of candidate agent files found in that folder
  if the name doesn't match one — never launches with an unverified
  identity.
- **`--check-trust`**: before building the launch command, reads (and if
  needed, mechanistically fixes) `~/.claude.json`'s
  `projects["<cwd>"].hasTrustDialogAccepted` for the target `--cwd`. This is
  a direct, non-interactive fix for a dialog that cannot be reliably driven
  by simulated keypresses from a meta-harness — it edits only that one
  boolean field, nothing else in the file.

## What it actually does

Polymorphic design in `lib/session-launch.js`, mirroring `SessionDiscovery`,
`boundary-reconstruction.js`, and `session-delivery.js`: one abstract
`SessionLauncher` concept, one concrete class per harness, each validating
its own required parameters and building the exact command with real,
verified flags:

- **`ClaudeSessionLauncher`**: `claude --resume "<sessionRef>" --model <model> [--dangerously-skip-permissions]`
- **`CodexSessionLauncher`**: `codex resume <sessionRef> --model <model> --cd "<cwd>" [--dangerously-bypass-approvals-and-sandbox]`
  (flags verified directly against real `codex resume --help` output, not assumed)

## License

MIT
