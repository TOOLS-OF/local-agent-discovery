# Human bootstrap checklist

Complete these steps outside the repository's tracked files:

1. Create or select a dedicated WSL2 distro and an unprivileged ottobot user.
2. Disable broad Windows-drive mounts and Windows interop unless explicitly
   needed.
3. Create the agent's GitHub identity/card assignment and initial LOA cap.
4. Provision a vault entry for approved credentials; do not paste secret
   material into issues, commits, chat, or shell history.
5. Grant a local helper read-only access to only the required vault item.
6. Keep a passkey and recovery codes under human control as break-glass
   methods.
7. Run the read-only boot, capability, and connectivity checks.
8. Record only non-secret evidence in the project issues.

The first implementation milestone is a read-only boot/check-in harness.
Deployment, organization administration, and model execution are later,
separately gated milestones.
