# ottobot-thesean project rules

This is a private, agent-agnostic control-plane repository.

- Never commit secrets, TOTP seeds, recovery codes, passwords, access tokens,
  private keys, or machine-specific credentials.
- Treat GitHub accounts as authorization surfaces, not actors.
- Every durable agent must use an assigned identity and evidence-backed
  q-semver; workers must not invent names or instance numbers.
- Separate observed capability from declared capability.
- Keep the default posture read-only and least-privileged.
- Human setup steps belong in issues or non-secret checklists; secret values
  belong only in an approved vault.
- Local machine paths and WSL details belong in ignored operator-local files,
  never in shared project artifacts unless intentionally generalized.

## Current boundary

The repository defines the control contract. It does not yet install a WSL
distro, create users, configure a vault, or grant GitHub account authority.
