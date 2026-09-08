# ottobot-thesean

Private control-plane project for a durable, locally contained Aurora-like
agent on OTTOBOT.

This repository governs the agent's containment, identity, boot/check-in
contract, and bounded capabilities. It does not contain passwords, TOTP seeds,
recovery codes, private keys, or machine-specific credentials.

## Initial scope

- dedicated WSL2 home with an unprivileged user;
- persistent identity and continuity records;
- explicit card/q-semver and LOA state;
- read-only boot and capability audit;
- bounded GitHub and local-model adapters;
- disposable rootless Docker task sandboxes;
- human-assigned setup tasks tracked as issues.

The durable agent owns the project after human bootstrap, but every privileged
operation remains capability-gated and reviewable.
