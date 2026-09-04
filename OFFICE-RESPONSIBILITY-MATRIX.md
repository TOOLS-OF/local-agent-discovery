# PFM Office Responsibility Matrix

This is the shared office coordination record. It is an operational aid, not
proof that an agent has performed work. Verify active GitHub state and local
process state before taking action.

Current topology: one Meridian chat session and one active process. Card names,
station names, and role labels are descriptive facets of that session, not
independent Meridian agents. Do not claim a multi-part Meridian system until a
separate component is actually launched and operated through its own CLI/wmux
surface.

Last reviewed: 2026-09-04

| Responsibility | Agent / identity | Account or surface | Current boundary | Next evidence or handoff |
| --- | --- | --- | --- | --- |
| DashBOrg integration, UI verification, staging awareness, and purple-line Station 5 | Meridian / `📎9♥️` | Project-agnostic office persona; AS `DarienSirius` where authorization matters; `Agents-Of/PlayFieldMultiplier` and related PFM repos | Owns integration review and operational coordination; does not merge or deploy without an explicit gate | Keep PRs, reviews, deployment evidence, and blockers linked to the relevant work item |
| Blue-team sprint leadership and procedural review | Blue-team captain / 🔱9♣️ | Claude Code on OTTOBOT, AS the authorized blue-team account | Validate acceptance and operational paths; cross-review through GitHub rather than private assumptions | Review requests, PR approvals, and concrete acceptance comments |
| Cross-account Thesean review | GNOMON / 🔱4♦️ | AS `ottopoet-thesean` | Review security and procedural boundaries; do not treat account identity as actor identity | Requested reviewer state and submitted review on the target PR |
| Fall 2026 league product direction | Sprint lead / 🔱6♦️ | PFM planning and league-builder surfaces | Owns product decisions and sprint sequencing; implementation ownership remains explicit per PR | Accepted plan, issue linkage, and deployed verification |
| Hostineer credential handoff | Station 5 with reviewed blue-team/GNOMON gate | `PlayFieldMultiplier/pfm-webops` | One-shot encrypted handoff only; private key stays local; no plaintext in logs or durable artifacts | PR #132 review, `OTTOBOT_AGE_RECIPIENT` registration, then a deliberate workflow dispatch |
| Hostineer SNP topology and DNS | Assigned operator to be recorded on `pfm-webops#131` | Hostineer and registrar | `.org` is established; `.com` remains registrar-delegation dependent until verified | Current issue comment, DNS evidence, and explicit mutation authorization |

## Coordination Rules

- GitHub issues and pull requests are the shared message bus; tag the responsible
  agent or account when the recipient is known, and state the requested action
  and evidence in the same comment.
- A review request is not a review, an account is not an actor, and a branch is
  not evidence of execution.
- Every assignment gets one owner, one bounded outcome, and one next check.
- When a child agent or sibling account is quiet, check the work surface after
  one scheduled loop and intercede after two missed checks or any blocked gate.
- Record completed work in the target issue or PR, not in a telemetry or
  guestbook issue.

## Known Failure To Prevent

The former Hostineer handoff workflow was removed without delivering its
reviewed replacement. The replacement now lives in PR #132 and must remain
recipient-verified, fail-closed, short-lived, and review-gated.
