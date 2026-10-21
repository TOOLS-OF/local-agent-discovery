# TOOLS-OF / local-agent-discovery

Executable tools for discovering local coding-agent sessions from an office
directory. The conceptual procedure belongs in
[SKILL-OF/local-agent-discovery](https://github.com/SKILL-OF/local-agent-discovery).

Each implementation lives below `AS/<tool-name>/`. Discovery commands remain
read-only; delivery, reconstruction, and launch tools document their own roles
and side effects in their respective directories.

[`sesh-beaver`](AS/sesh-beaver/README.md) is the planned agent-habitat transfer
coordinator. Its current configuration model and examples are design artifacts;
no general transfer executor or installed command is provided yet.
