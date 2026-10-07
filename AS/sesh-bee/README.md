# sesh-bee: slurp-splat tool

Extract real dialogue turns from Claude Code session JSONL and format as scannable markdown microfiche.

## Provenance

This tool is subclassed from `slurp-splat-microfiche.mjs`, a one-shot test script found in Meridian's own identity tree (`_/AS/👽8♥️/AS/q1.0.4/.../trek-of/meridian-ottobot/`). That script demonstrated the core concept as a proof-of-concept; this tool generalizes it into a reusable component for `TOOLS-OF/local-agent-discovery`.

## Spec

**Slurp**: Given a session JSONL file, extract real dialogue turns (user + assistant messages) by filtering out tool_use, tool_result, thinking, and internal noise.

**Splat**: Format extracted turns into readable markdown microfiche:
```
### [ISO timestamp] Speaker (instance)

[Turn body text]
```

## Install

```bash
npm install -g .          # from inside this folder
```

## Usage

```bash
sesh-bee --session <path-to-session.jsonl> [--output <path.md>] [--max-lines N]
```

**Flags:**
- `--session` (required): path to the Claude Code session JSONL file. No
  default — see "Fixed 2026-10-07" below for why.
- `--output` (optional): output markdown file path (default: `./microfiche-output.md`)
- `--max-lines` (optional): maximum lines to process from the JSONL (default: entire file)

**Example:**
```bash
sesh-bee --session ~/.claude/projects/session-id.jsonl --output microfiche.md --max-lines 50000
```

## Fixed 2026-10-07: no more silent personal-path default

The original version of this tool defaulted `--session` to one specific
person's real session path when the argument was omitted — the exact
"silent default" failure shape every other sesh-kingdom tool
(`sesh-falcon`, `sesh-hound`, `sesh-nautilus`, `sesh-stork`) explicitly
refuses: a caller who forgets the argument doesn't get an error, they
silently slurp a *different* real session than the one they meant to.
`--session` is now a required named flag with no fallback. This version
also adds the standard `bin/`/`package.json` install shape the rest of the
kingdom uses — the original shipped as a bare `.mjs` script with no `npm
install -g` path at all.

## Output

Markdown file with:
- Header showing extracted turn count and wall-clock time span
- One block per dialogue turn with ISO timestamp and speaker
- Suitable for grep/search to find specific incidents or patterns

## Real-world use: login-dance archaeology

This tool was built to surface login-dance attempt history from rabbit-0's session (e4044d15-130d-4593-9ad8-d37a48525f5f.jsonl):
- Extracted 868 dialogue turns across 2026-09-18 to 2026-09-30
- Confirmed multiple Remote Control disconnect/reconnect patterns
- Verified login-dance history is discoverable via grep on output

Tested 2026-09-30. Tool is production-ready for general use.

---

Built by: hazrat-rabbit (rabbit-1, pilot-of/meridian-ottobot-00q)
Date: 2026-09-30
