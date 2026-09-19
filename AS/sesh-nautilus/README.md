# 🐚 sesh-nautilus

Reconstruct compaction/context-boundary structure that cross-harness session
converters (e.g. [transession](https://github.com/inmzhang/transession)) drop
during translation.

## The problem

A session converter maps message content between harnesses, but it typically
has nowhere to put the *source* harness's compaction/context-reset events,
because the target format's equivalent event has no source data to translate
from. The result is a single undifferentiated session — one continuous
transcript with no internal chamber structure — even if the original had
dozens of real compaction boundaries throughout its life.

This isn't cosmetic. The first time the target harness tries to compact that
flat session, it has to process the *entire* history in one shot instead of
the small tail segment a properly-chambered session would need. On a
long-lived session this can produce token counts an order of magnitude
larger than any real context window, and requests that exceed hard payload
size limits regardless of context window headroom — see "Real-world numbers"
below.

## Install

```bash
npm install -g .          # from inside this folder
```

## Use

```bash
sesh-nautilus --source <original-session-file> \
              --target <converted-session-file> \
              --output <output-file>
              [--from-harness codex] [--to-harness claude-code] [--json]
```

`--source` is the session in its *original* harness (boundaries are extracted
from here). `--target` is the already-converted file in the *new* harness's
format. `--output` gets the target file's content back, with boundary markers
inserted at the correct points.

## What it actually does

Two-part polymorphic design in `lib/boundary-reconstruction.js`, mirroring
`session-discovery.js`'s `SessionDiscovery` pattern:

- **`BoundaryExtractor`** (one per source harness) — pulls real boundary events
  out of the original session. `CodexBoundaryExtractor` reads Codex's native
  `"type":"compacted"` events, each carrying an `ordinal` and a `timestamp`.
- **`BoundaryInserter`** (one per target harness) — streams the converted file
  and inserts a synthetic boundary marker immediately before the first event
  whose timestamp reaches each pending boundary's timestamp.
  `ClaudeBoundaryInserter` emits Claude Code's native
  `{"type":"system","subtype":"compact_boundary",...}` shape.

Correlation is by **timestamp**, not line position — line counts between a
source and converted session can coincidentally match without the two files
being positionally aligned event-for-event, so don't assume ordinal N in the
source maps to line N in the target.

## Real-world numbers (2026-09-19, a genuine repair)

A Codex session with 77 real `"type":"compacted"` events, converted with no
boundary handling at all, became one flat Claude Code session. Its first
auto-compaction reported `preTokens: 9,144,718` — the entire history in one
pass — and two later compactions reported `postTokens` in the 8-8.7 million
range, meaning compaction was producing a *summary marker* but never actually
shrinking the physical file; every future request still had to carry the
full accumulated content, including embedded images, past the harness's
32MB request-size ceiling. After running sesh-nautilus, the same session's
final chamber (content after the last real boundary) was 322KB with zero
embedded images, and resumed without error.

## Gotchas found building this

1. **Line count matching between source and target is coincidental, not
   structural.** A 27,232-line Codex file converting to a 27,232-line Claude
   file does not mean line N ↔ line N — verify with a known timestamp before
   trusting positional alignment for anything.
2. **Compaction boundary presence and physical file size are different
   problems.** A harness's own auto-compaction can produce a boundary marker
   correctly while leaving the underlying file (and any embedded binary
   content) completely unpruned — the marker is model-context guidance, not
   a request-size guarantee on its own.
3. **Token estimates in reconstructed markers are heuristic** (`chars / 4`),
   not authoritative — the source harness didn't record target-harness token
   counts, and there's no honest way to back-fill them precisely.

## License

MIT
