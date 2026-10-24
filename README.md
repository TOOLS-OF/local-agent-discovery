# TOOLS-OF / local-agent-discovery

Executable tools for discovering local coding-agent sessions from an office
directory. The conceptual procedure belongs in
[SKILL-OF/local-agent-discovery](https://github.com/SKILL-OF/local-agent-discovery).

Each implementation lives below `AS/<tool-name>/`. Discovery commands remain
read-only; delivery, reconstruction, and launch tools document their own roles
and side effects in their respective directories.

The transfer-preparation tools compose focused responsibilities:

| Tool | Current role |
|---|---|
| [sesh-bloodhound](AS/sesh-bloodhound/README.md) | Bounded recorded file/tool provenance, turn/chamber links and coverage gaps |
| [sesh-nautilus](AS/sesh-nautilus/README.md) | History inspection, native Codex candidate projection, legacy boundary reconstruction |
| [agent-relocator](AS/agent-relocator/README.md) | Evidence selection, bounded folder previews and ambient-policy handoff |
| [sesh-beaver](AS/sesh-beaver/README.md) | Filesystem realization contract; general executor pending |

The deterministic preparation commands do not import or launch agents. See the
[workflow guide](docs/transfer-model/PREPARATION_WORKFLOW.md) for supported
operations and gaps, and [CONTRIBUTING.md](CONTRIBUTING.md) for isolated package
validation, review and promotion policy.
