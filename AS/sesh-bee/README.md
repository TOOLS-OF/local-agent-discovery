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

## Usage

```bash
node slurp-splat.mjs <path-to-session.jsonl> [output.md] [maxLines]
```

**Parameters:**
- `path-to-session.jsonl`: Path to Claude Code session JSONL file
- `output.md` (optional): Output markdown file path (default: `microfiche-output.md`)
- `maxLines` (optional): Maximum lines to process from JSONL (default: entire file)

**Example:**
```bash
node slurp-splat.mjs ~/.claude/projects/session-id.jsonl microfiche.md 50000
```

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
