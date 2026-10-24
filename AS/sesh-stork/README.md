# 🕊️ sesh-stork

Deliver a finished session file into a target harness's storage convention
for a chosen folder, and verify it actually boots there.

## The problem

Session converters and reconstruction tools (transession, sesh-nautilus)
produce a valid session file, but that file still has to end up in the right
place on disk — inside the target harness's own storage layout, addressable
by the right session id, resumable from the right working directory — before
it's actually usable. Getting that placement wrong (or skipping the
"does it actually boot" check) is a separate class of mistake from getting
the *content* wrong.

## Install

```bash
npm install -g .          # from inside this folder
```

## Use

```bash
sesh-stork --session <finished-session-file> \
           --cwd <destination-folder> \
           --session-id <id>
           [--to-harness claude-code] [--no-verify] [--json]
```

`--session` is delivered as-is — sesh-stork doesn't inspect or care how many
compaction chambers it contains, from a completely fresh zero-history session
to a full N-chamber lineage. That's a content decision made upstream by
whatever produced the file. sesh-stork's only two jobs are: place it where
the target harness expects it, and confirm it's alive.

## What it actually does

Polymorphic design in `lib/session-delivery.js`, mirroring `SessionDiscovery`
and `BoundaryExtractor`/`BoundaryInserter`: one abstract `SessionDelivery`
concept, one concrete class per target harness.

`ClaudeSessionDelivery`:
- **`computeDestinationDir(cwd)`** — Claude Code's real project-folder slug,
  verified empirically against a live installation: `'-' + cwd.replace(/[^a-zA-Z0-9]/g, '-')`.
  The leading `-` is not part of the character-replace pass; Claude appears
  to POSIX-ify the path (an implicit leading separator) before slugging it.
- **`deliver(sessionFile, cwd, sessionId)`** — creates that directory if
  needed, copies the session file in as `<sessionId>.jsonl`. Refuses to run
  if source and destination resolve to the same file (a no-op copy-onto-self
  is a footgun, not a delivery).
- **`verifyBoot(sessionId, cwd)`** — actually launches
  `claude --resume <id> -p "..."` with a unique probe token and checks the
  probe comes back, from the real target `cwd`. Existence of the file on
  disk is not proof it works; a successful, on-topic response is.

## Native Codex standalone adapter

`lib/codex-standalone.cjs` is the narrow native delivery adapter composed by
the registered [Beaver route](../sesh-beaver/README.md). It uses app-server
fork/resume/turn/list APIs, preserves original provenance and snapshots, and
records explicit new-ID mappings. It does not convert source types in place.
An empty inherited user-event index can require an explicitly authorized
commissioning turn before listing; opening by ID alone is not acceptance.
Native default listing, requested-name search, desktop API listing and rendered
sidebar behavior are distinct results. The legacy Claude CLI remains separate;
it is not used by the Codex route. Both installed entrypoints are checked when
Beaver's complete package closure is validated.

The delivery library now lives inside this package. The repository-root
`lib/session-delivery.js` is a compatibility import, not an installation dependency.

## License

MIT
