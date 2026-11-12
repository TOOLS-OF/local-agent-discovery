# Fleet preflight

`fleet-preflight` is a read-only source-level checker for installed command
paths, SHA-256 digests, and local/cached Git-object provenance. It emits
`MATCH`, `MISMATCH`, `MISSING`, or `UNKNOWN` as machine-readable JSON.

```sh
fleet-preflight --config ./expected-tools.json
```

Paths may be absolute or relative to the configuration file. Optional Git
expectations bind a repository, ref, source path, revision, and blob. Offline
mode never starts a child process, so configured Git provenance is reported
`UNKNOWN` with an explicit reason. The tool does not fetch, install, switch
branches, execute a configured command, or claim remote freshness.

Both the source contribution's `git` field and the inventory-bound
`gitProvenance` field are recognized. The latter is preserved in diagnostics
instead of being silently ignored.

Example component:

```json
{"id":"target","path":"./installed/tool.js","sha256":"...","git":{"repository":"./repo","ref":"origin/main","repoPath":"AS/tool/bin/tool.js","revision":"...","blob":"..."}}
```

`MISMATCH` is evidence for an owner decision, not mutation authority.
