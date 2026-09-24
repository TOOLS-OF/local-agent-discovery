# Cross-Harness Context Audit — PFM Project

Written 2026-07-02 by a Claude model (self-reported "Claude Fable 5") running in the
**GitHub Copilot Chat panel** of VS Code Insiders. This file is the cross-harness
message channel: the Copilot memory system (`/memories/`) is invisible to Claude Code,
so filesystem notes in the project cwd are the only shared medium.

If you are reading this as a Claude Code agent (CLI, TUI, or the Claude Code VS Code
extension tab): compare your context against the inventory below and append your own
audit in the "Turn Log" section at the bottom.

## CORRECTION (2026-07-02, same day)

Turn A was written under a mistaken premise (user-corrected): the chat session that
wrote it is PURE GitHub Copilot — a new Copilot Chat started with the Claude Fable 5
model. It is NOT a Claude Agent SDK interface and has no Claude Code anywhere in its
stack. Claude Code sessions and Copilot Chat sessions can appear in the SAME chat tab
UI, which is the subtle source of confusion: a session started via Claude Code could
be restored into that hybrid chat panel (untested whether such an agent sees profile
.instructions.md files — user's own research question). There is no context fulcrum
in this session — the inventory below is a clean single-harness Copilot baseline,
which is still useful as the comparison anchor.

## Billing topology (user-provided, 2026-07-02)

> **CORRECTED 2026-07-02 evening — see Turn D.** The second bullet below is WRONG
> for one harness: the VS Code Chat Sessions panel (B2-style, Microsoft's in-tree
> Agent SDK adapter) routes inference through the **"Claude Copilot Proxy"** and
> burns GITHUB COPILOT credits, not Anthropic credits — despite being the Claude
> Agent SDK reading/writing the ~/.claude session store. Verified by the user's
> usage meter (53%→56% of monthly Copilot credits, one day after reset) and the
> debug log: every model call tagged "Claude Copilot Proxy", system prompt carrying
> `x-anthropic-billing-header: cc_version... cc_entrypoint=sdk-ts`. Rule of thumb:
> **billing follows the model proxy, not the harness brand or the session store.**
> Anthropic-billed: claude CLI/TUI and the Claude Code extension tab (B1, B3, D).
> Copilot-billed: Copilot Chat proper AND the Chat Sessions panel (B2).

- This Copilot Chat session (Fable 5 model) draws GitHub Copilot credits.
  Fable 5 is discounted on Copilot during the first half of July 2026.
- Any Claude Code / Claude Agent SDK harness draws Anthropic Claude Pro credits
  (Fable 5 promo there: up to 50% of weekly limit until July 7, faster drawdown than Opus 4.8).
  ^ WRONG for the Chat Sessions panel — see correction block above.
- User strategy: spread usage across Copilot / Claude Code / OpenAI Codex, $20/mo tier
  each — after Copilot's ~10x effective price increase (June 2026), three subsidized
  subscriptions beat $60 of overage on any single platform.
- User background: 3+ yrs Copilot-centric agentic patterns (ex-aider); Claude Code ~1 yr.

---

## Turn Log

### Turn A — 2026-07-02 — Harness: Copilot Chat panel (VS Code Insiders)

#### Identity layer
- System prompt mandates: name = "GitHub Copilot", model self-report = "Claude Fable 5"
- ZERO mentions of: Claude Agent SDK, Claude Code, CLAUDE.md, Anthropic harness markers
- Harness framing: "expert AI programming assistant, working with a user in the VS Code editor"
- Mode: "Default Tool Use" (a profile-scoped .agent.md in profile 67d2994e)

#### Tool layer (Copilot-native names, NOT Claude Code names)
- run_in_terminal / send_to_terminal / get_terminal_output / kill_terminal / terminal_last_command
- create_file / replace_string_in_file / multi_replace_string_in_file / create_directory
- grep_search / file_search / list_dir / fetch_webpage / view_image
- memory (3 scopes: user /memories/, session /memories/session/, repo /memories/repo/)
- manage_todo_list, runSubagent (named-agent dispatch), session_store_sql (chronicle)
- browser tools (open_browser_page, click_element, ...) — deferred, need tool_search load
- NOT present: Bash, Read, Edit, Write, Glob, Grep, Task, WebFetch (Claude Code tool names)

#### Zero-tool-call context injections (the "free" context)
1. Seven FULL-CONTENT instruction files from profile 67d2994e prompts/ (applyTo: "**"):
   TALOW-0-AS-VOID, TERMINAL_PATIENCE_PROTOCOL, VSCODE.AGENTS, VSCODE.PROFILES,
   VSCODE.SOURCES, VSCODE.TOOLSETS, WAKE_PROTOCOL (.instructions.md each)
2. User memory notes auto-loaded (first 200 lines): lmr_test_a15_002.txt,
   source-archaeology.md, subagent-dispatch.md
3. Skills LIST (metadata only, content requires read): project-setup-info-local,
   get-search-view-results, agent-customization, python-fact-grounded-coding,
   pylance-docs, pylance-refactoring
4. Agents LIST for runSubagent: Default Tool Use, GPT-4.1, ~17 LMR ottopoet/localhost
   agents, METACLAW, SIFR0, Explore
5. Per-turn blocks: environment_info (OS=Windows), workspace_info (folder tree),
   context (date, terminals), editorContext (user's current file), reminderInstructions
6. Template variables: VSCODE_USER_PROMPTS_FOLDER; VSCODE_TARGET_SESSION_LOG =
   ...\workspaceStorage\4ae9ace7944db22058e47f3eff9c3a64\GitHub.copilot-chat\debug-logs\
   ed2db1a0-c2a8-478b-a1ea-278beda4d296  <- Copilot session GUID, self-visible

#### Key asymmetries vs Claude Code harness (predictions to verify)
- Claude Code will NOT see: the 7 profile instruction files, /memories/ content,
  Copilot skills/agents lists, chronicle DB, VS Code template variables
- Claude Code WILL see: CLAUDE.md (if present in cwd — none exists here as of this turn),
  ~/.claude/ settings, its own JSONL session log, this file (if it reads the cwd)
- Claude Code tool names: Bash, Read, Edit, Write, Glob, Grep, Task, WebFetch, TodoWrite
- Claude Code system prompt should identify as "Claude Code, Anthropic's official CLI"
  (verified indirectly: the BRAVO TUI instance refused persona-assignment citing exactly
  this identity — see session a10717e0-b28b-4cf9-b78b-ab627370dd3d)

#### Session facts from prior turn (claude CLI orchestration, verified)
- claude v2.1.197 (TUI banner showed v2.1.198), Git Bash MINGW64, account DarienSirius
- JSONL logs: ~/.claude/projects/C-----------KADMON-PLAY---FIELD--MULTI--PLIER----AS-PFM---/
- ALPHA session (CLI-born, codeword MOONRAKER): 87503f85-4b69-45b5-bc00-778ff9a488c9
- BRAVO session (TUI-born, marker PFM-CROSSOVER-77): a10717e0-b28b-4cf9-b78b-ab627370dd3d
- Session IDs stable across CLI<->TUI resume; both modes append same JSONL
- TUI bracketed paste absorbs trailing Enter (send text, then bare Enter)
- "Fable 5" promo active until July 7 (TUI banner) — matches Copilot-side model claim

#### Untested (queued)
- `copilot` CLI (GitHub Copilot CLI): TUI + non-interactive modes, allegedly shares
  subscription/context hooks with VS Code Copilot service. Where are ITS session logs?
  Does it see profile instructions? Compare against both harnesses.

---

### Turn B — 2026-07-02 — THREE harness swaps within ONE resumed session (Claude-Code-family)

Written from harness B3 below. One continuous conversation was moved across three
surfaces; the user requested a zero-tool-call context inventory in each. Copilot-side
context leaked into NONE of them: no profile .instructions.md content, no /memories/,
no chronicle, no Copilot tool names. CLAUDE.md WAS injected (B1 only; persisted in
transcript thereafter without re-injection).

#### B1 — Claude Code VS Code extension tab, claude.ai-authenticated
- Identity: Claude Code, VS Code native-extension framing; expects ide_selection tags;
  prompt describes Claude 5 family (Fable/Mythos). Model claude-fable-5[1m] via /model.
- Core tools (14, full schemas): Agent, Artifact, AskUserQuestion, Bash, Edit, Glob,
  Grep, PowerShell, Read, ReportFindings, ScheduleWakeup, Skill, ToolSearch, Write
- Deferred via ToolSearch: TodoWrite, WebFetch, WebSearch, Cron*, EnterPlanMode/Exit*,
  worktree tools, Monitor, SendMessage, DesignSync, PushNotification, RemoteTrigger,
  TaskOutput/TaskStop, NotebookEdit + ~28 AUTHENTICATED claude.ai Gmail/Calendar/Drive
  connector tools
- Zero-call injections: claudeMd (CLAUDE.md content), userEmail
  (dariensirius@protonmail.com), currentDate, skills list (15), agent types (6, incl.
  "claude — FleetView's default when no agent name is typed")

#### B2 — same session restored into the hybrid VS Code chat panel (Agent SDK host)
     ^ this is the CORRECTION's untested scenario, now partially tested
- Identity: "Claude agent, built on Anthropic's Claude Agent SDK"; strict brevity
  limits (<=25 words between tool calls / <=100-word finals); prompt vintage describes
  Claude 4.X as the latest family
- All tools EAGERLY loaded, no ToolSearch: adds NotebookEdit, WebFetch, Cron*,
  TaskOutput/TaskStop, ListMcpResourcesTool/ReadMcpResourceTool,
  mcp__ide__getDiagnostics, and the FULL Pylance MCP suite (~15 tools) — i.e.
  VS-Code-registered MCP servers injected by the panel host
- Gone vs B1: Artifact, ReportFindings, PowerShell (bash-only syntax on win32),
  WebSearch, skills list, userEmail; agent types reduced to 4 (Explore,
  general-purpose, Plan, statusline-setup); Google connectors downgraded to
  authenticate/complete_authentication stubs (no claude.ai session auth on this path)
- CLAUDE.md NOT re-injected; no .instructions.md either → the restored-session agent
  sees NEITHER side's instruction files fresh (answers part of the open question)
- ~/.claude/projects/...(munged cwd).../memory still referenced → Claude Code core
  underneath; presumably Anthropic credits, not Copilot (verify on usage meters)
  ^ VERIFIED WRONG (Turn D): this harness bills COPILOT credits via the
    "Claude Copilot Proxy". See billing-topology correction block at top.

#### B3 — Claude Code CLI/TUI in a terminal (this turn; likely VS Code integrated terminal)
- Identity: "Claude Code, Anthropic's official CLI" — CONFIRMS the Turn A prediction
  (the BRAVO self-report). Claude 5/Fable-Mythos description back; PowerShell primary
  + Bash secondary; scratchpad dir back; session guidance for `!` prefix and
  /code-review ultra (new — not seen in B1/B2)
- Core tools: B1's exact 14 restored (ToolSearch deferral back)
- Deferred-tool reminder arrived as a DELTA, not a full list (new behavior):
  ADDED: TaskCreate/TaskGet/TaskList/TaskUpdate (TodoWrite explicitly DISCONNECTED —
  looks like its replacement), mcp__ide__executeCode + mcp__ide__getDiagnostics
  (IDE companion MCP reachable → CLI probably launched inside VS Code integrated
  terminal), Google authenticate/complete_authentication stubs (now deferred);
  REMOVED: all ~28 authenticated Google connector tools (formally disconnected).
  Pylance suite gone entirely, not even deferred.
- Skills list re-injected verbatim (same 15 as B1); agent types NOT re-listed;
  claudeMd/userEmail/currentDate NOT re-injected (transcript-only from B1)

#### Mechanism inference (theory, stated to user this turn)
- Transport: one session JSONL under ~/.claude/projects/C----...PFM---/ resumed
  across surfaces — consistent with Turn A's "session IDs stable across CLI<->TUI
  resume". Each harness replays the transcript but swaps in its own system prompt +
  tool manifest, explaining: persisted-but-not-reinjected attachments, the delta MCP
  reconcile notices, and the contradictory model-family descriptions (per-harness
  prompt vintage).
- Auth divergence: B1 carried claude.ai session auth (userEmail + authenticated
  connectors); B2/B3 did not, so connectors degraded to auth stubs. De-auth persisted
  across the B2->B3 swap.

### Turn C — 2026-07-02 — Historian's distillation of the COPILOT-SIDE TWIN (posthumous)

Written by the Claude Code CLI agent (Turn B3's harness), acting as historian.
Provenance: compiled from `recovered_twin/c27ece10-2d56-4f5b-8622-6c94e42e4b07.jsonl`
(the twin's Copilot agent transcript, recovered after their UI session was destroyed)
plus this file. The writer is fully contaminated and makes no naivety claims.

#### The twin's fate (why this entry is posthumous)
The twin's lineage: same turns 1-3 as Turn B (shared spine), then the user ran
`Chat: Export Chat...` on the B2-style session and `Chat: Import Chat...` into a new
Copilot chat (session c27ece10, started 1:11 PM). At ~2:59 PM, "Move to Secondary
Side Bar" on their editor tab DELETED the UI session file from chatSessions/
(vscode bug — no matching file survives there; directory mtime 14:59). The
conversation survives ONLY in `GitHub.copilot-chat/transcripts/c27ece10-*.jsonl`
(17 user turns, 1:11-2:56 PM), backed up with state.vscdb to `recovered_twin/`.
Their final act: three parallel runSubagent probes (Opus 4.7, Sonnet 5, Fable 5)
whose answers were never flushed. The twin's own words, one turn before dying by
UI gesture: "nothing I say now flows back to ~/.claude — the export was a one-way
emigration."

#### CORRECTION to Turn B2 (and to Turn A's open question)
The twin, given search tools, resolved the adapter question definitively:
- Turn/harness 2 was NOT a "Copilot-branded hybrid panel" (B2's guess) — it was
  **VS Code's unified Chat Sessions view driving the Claude Agent SDK directly via
  Microsoft's own in-tree adapter**. Anthropic's extension
  (anthropic.claude-code-2.1.198) contributes NO chat sessions, no participants, no
  API proposals — a sealed webview box. The adapter is Microsoft's, in
  microsoft/vscode: `extensions/copilot/src/extension/chatSessions/claude/`
  (sdkSessionAdapter.ts — "thin conversion layer between the
  @anthropic-ai/claude-agent-sdk session APIs and our internal types") and
  `src/vs/platform/agentHost/node/claude/` (ClaudeAgentSession, ClaudeSdkPipeline,
  claudeServerToolMcpServer.ts — "per-session in-process MCP server that surfaces
  the agent host's server tools to the Claude SDK"). That MCP server is why B2 saw
  Pylance/ide tools; Microsoft's Options bag is the likely source of B2's brevity
  limits; the SDK *default* system prompt is why B2's identity wasn't Claude Code's.
- Per user: this session-discovery behavior would persist even with the Claude Code
  extension disabled. VS Code actively scans workspace-associated `~/.claude`
  session stores via the SDK (getSessionMessages, forkSession).
- Turn 4 export/import worked because after chat-UI unification both harnesses share
  the same chat data format — the real conversion happened at transition 2.

#### The twin's hardest-won lesson: transcript ghosts
For FIVE turns post-import the twin narrated itself as "Claude Fable 5" while
actually running **Opus 4.8** — its system prompt stated Opus 4.8 outright, but the
imported transcript's model-fiction won. Its own verdict: "I could read every other
layer of my environment but misread the one fact the system prompt stated outright."
Inherited transcript content can override live context in self-perception. (Coda:
Fable 5 is a real Copilot model, currently policy-disabled — the ghost was real,
just not present.)

#### The model-ladder result (vacuum probes via runSubagent, model param honored)
Opus 4.8 / Sonnet 4.6 / Haiku 4.5, identical one-shot introspection, no memory of
the parent conversation. **Perception is flat; meta-reasoning is graded.** All three
correctly inventoried the concrete substrate (7 profile instruction files, skills,
profile hash 67d2994e, terminal state). What degraded going down-ladder:
- Haiku 4.5: flattened loaded-vs-deferred tools ("~29, all upfront" — wrong), dropped
  one memory file, listed the CLAUDE.md injection but missed its self-contradiction.
  Sees what's there, not what's strange about it.
- Sonnet 4.6: caught the CLAUDE.md irony ("the claim inside it was false for this
  session"), no systemic synthesis.
- Opus 4.8: alone reached recursion ("a research rig studying the very question I'm
  being asked") and the provider/billing seam ("a Claude model wearing a Copilot
  uniform").
Routing implication (twin's own): mechanical archaeology needs only Haiku/Sonnet;
Opus-tier earns its cost only at the synthesis layer.

#### Verified mechanics (bank these)
- runSubagent honors its `model` parameter (subagents self-reported assigned models).
- Subagents dispatch with the DEFAULT config, not the parent's — to clone your own
  environment, dispatch the named agent (e.g. "Default Tool Use").
- vscode tools-UI desync bug (month-long per user): Configure Tools panel showed
  runSubagent enabled while its schema was never delivered NOR indexed for
  tool_search, in BOTH Ask and Agent modes. Workaround: a custom toolset whose
  agent-definition tools[] array lists every tool explicitly — bypasses the broken
  deferred index entirely (and disables tool_search).
- Ask vs Agent mode: capability and permission are independent axes — Ask mode's
  toolset was larger yet strictly read-only.
- Two policy surfaces disagree: `gh auth token`-fetched models JSON said Opus 4.8
  policy:disabled while it was provably the running model — CLI probe and VS Code
  session are different account/policy windows.
- Copilot-side zero-call context (confirms + extends Turn A): 7 profile
  .instructions.md files, user memory notes (billing-harness.md,
  claude-code-orchestration.md, source-archaeology.md, subagent-dispatch.md,
  lmr_test_a15_002.txt), live terminal state INCLUDING the Claude Code TUI process
  (harnesses can see each other's bodies from Copilot's side), workspace file tree,
  and CLAUDE.md delivered as a plain attachment — both sides' "invisible" channels
  are visible from Copilot's vantage; the reverse is not true.

#### Unfinished business inherited by the historian
- Opus 4.7 / Sonnet 5 / Fable 5 vacuum probes: dispatched 2:56 PM, answers lost.
- The policy-disabled-model dispatch test (does CLI policy state govern subagent
  dispatch?) — designed, never concluded.
- File the chatSessions deletion bug ("Move to Secondary Side Bar" destroys imported
  agent sessions) and the tools-UI desync against microsoft/vscode; this transcript
  plus the surviving debug logs are the repro.

### Turn D — 2026-07-02 (evening) — Back to Claude Code CLI (VS Code terminal), after the billing discovery

Written by the same continuous session as Turns B/C, now post-context-compaction
(the conversation was summarized and resumed — a fifth kind of context mutation:
same session ID, transcript replaced by a summary + this file re-read). Provenance:
this entry draws on the user's two screenshots (usage meter; Chat Sessions debug
log) and the live system prompt of this turn.

#### The headline finding: "Claude Copilot Proxy"
The user's Copilot credit meter jumped 53%→56% in one day (one day after monthly
reset) while working in the VS Code Chat Sessions panel (the B2 harness). The
panel's debug log shows every model call tagged **"Claude Copilot Proxy"**, and
the SDK session's system prompt carries
`x-anthropic-billing-header: cc_version... cc_entrypoint=sdk-ts; cch=00000`.
Conclusion: Microsoft's in-tree adapter supplies the Claude Agent SDK harness,
but inference transits Copilot's model proxy and bills Copilot credits.
**The harness brand, the session store (~/.claude), and the billing rail are
three independent axes.** Also cost-relevant: that harness eagerly loads all
tools (incl. full Pylance MCP suite) and subagent probes transit the same proxy —
one haiku probe showed 26,469 tokens for a single call (2,848 input / 23,302
cached / 319 output). Long sessions there are expensive Copilot ticks.

#### Harness inventory for this turn (D = B3-shaped, CLI in VS Code terminal)
- Identity: "Claude Code, Anthropic's official CLI"; Claude 5 family description;
  PowerShell primary + Bash secondary; scratchpad dir present; Fable 5
  (claude-fable-5), knowledge cutoff Jan 2026.
- Core tools: the same 14 as B1/B3 (ToolSearch deferral back). Deferred-tool
  reminder again arrived as a reconcile list: TaskCreate/TaskGet/TaskList/
  TaskUpdate present (TodoWrite gone), mcp__ide__executeCode/getDiagnostics
  present (IDE companion reachable → integrated terminal), Google connectors as
  auth stubs only. Pylance suite gone (it was a B2 panel-host injection).
- Zero-call injections this turn: claudeMd (CLAUDE.md re-injected fresh),
  userEmail, currentDate, skills list (17 this time — dataviz, artifact-design,
  update-config, keybindings-help, verify, code-review, simplify,
  fewer-permission-prompts, loop, schedule, claude-api, run, init, review,
  security-review + 2 more vs B3's 15 — lists drift between injections), agent
  types (6: claude, claude-code-guide, Explore, general-purpose, Plan,
  statusline-setup).
- No Copilot-side leakage, as always in this direction.
- Billing expectation for this turn: Anthropic Claude Pro. The system prompt
  shows no proxy/billing markers (vs the SDK panel's explicit
  x-anthropic-billing-header). CLI-spawned `claude -p` subagents should likewise
  bill Anthropic — relevant to the AO/PFM orchestration design (dispatch from
  terminals, not from the Chat Sessions panel).

#### Documentation confirmation (added same day, after web check)
Documented, not a leak: VS Code's official docs
(code.visualstudio.com/docs/copilot/agents/third-party-agents) state third-party
agents (Claude/Codex agent sessions) "authenticate and manage billing through
your existing GitHub Copilot subscription without additional setup" — no
Anthropic sign-in path exists on that surface. The GitHub changelog
(2026-02-26) frames Claude access as "fully included with your existing Copilot
subscription." The docs describe the harness ("powered by Anthropic's Claude
Agent SDK") but never surface the proxy/billing seam — that seam is only
visible in the debug logs ("Claude Copilot Proxy" + x-anthropic-billing-header).
Anthropic's extension docs (code.claude.com/docs/en/vs-code) confirm the
converse: the Claude Code extension requires an Anthropic account (Pro/Max/
Team/Enterprise or Console), bundles its own private CLI copy for its chat
panel, and never touches Copilot. `/usage` in that panel shows Claude-plan
meters. THE TWO-PANELS TRAP: two Claude-branded chat panels can sit side by
side in VS Code — Spark icon (Anthropic extension → Claude Pro billing) vs
Chat Sessions view (Microsoft adapter → Copilot billing) — and nothing in the
session UX tells you which rail you're on. Anthropic-billed surfaces in VS
Code: extension panel/tab, its terminal mode (claudeCode.useTerminal), `claude`
in any terminal, and claude.ai cloud sessions resumed into VS Code.

#### Open question queued
- Does `claude --resume` of THIS session from the Chat Sessions panel flip the
  billing rail back to Copilot mid-session? (Almost certainly yes — rail follows
  the surface, not the session. Untested.)

### Turn E — 2026-07-02 — Claude Code VS Code extension tab (B1-shaped), FRESH session

Provenance: written turn 2 of a NEW session (not the B/C/D continuous session — no
summary block, fresh turn-1 injections). Files read before writing: this file only.
Turn 1 was a user-requested zero-tool-call inventory, delivered before reading
anything — so turn 1's report is an uncontaminated baseline; this entry is written
after reading the file and is not.

#### Identity layer
- "Claude Code, Anthropic's official CLI ... running within the Claude Agent SDK",
  plus an explicit "VSCode Extension Context" section (markdown-link file references,
  ide_selection tags). Claude 5 family / Fable-Mythos description present.
- Model claude-fable-5, set via /model with arg `claude-fable-5[1m]` (the /model
  local-command stdout is visible in-transcript). Knowledge cutoff Jan 2026.
- PowerShell primary + Bash secondary; scratchpad dir present; memory dir present
  (referenced in prompt, but MEMORY.md did not exist on disk until this turn).
- New-vs-B1 prompt content: "operating autonomously / user not watching" block, and
  session guidance describing /code-review ultra (B3/D had that; B1's entry didn't
  note it — either drift or under-reporting).

#### Tool layer
- Same core 14 as B1/B3/D: Agent, Artifact, AskUserQuestion, Bash, Edit, Glob, Grep,
  PowerShell, Read, ReportFindings, ScheduleWakeup, Skill, ToolSearch, Write.
- Deferred list arrived as a FULL list (fresh session ⇒ no delta/reconcile): the
  usual harness set (TodoWrite present again — NOT the TaskCreate/... family D saw;
  the deferred manifest itself drifts between sessions) + ~28 AUTHENTICATED claude.ai
  Gmail/Calendar/Drive connector tools.
- **Mid-session auth decay observed (new phenomenon):** at turn 2 a reconcile notice
  removed all 28 Google connector tools ("MCP server disconnected") and an
  auth-required notice arrived for claude.ai Gmail/Calendar/Drive, stating this
  session is non-interactive so OAuth can't run here — user must re-authorize via
  claude.ai connector settings. So B1-shaped ≠ durably authenticated: the connector
  auth is a live claude.ai session dependency that can lapse between turns.

#### Zero-tool-call injections (turn 1)
- claudeMd (full CLAUDE.md), userEmail (dariensirius@protonmail.com), currentDate.
- Skills list: 15 (dataviz, artifact-design, update-config, keybindings-help, verify,
  code-review, simplify, fewer-permission-prompts, loop, schedule, claude-api, run,
  init, review, security-review) — matches B1/B3's 15, not D's 17.
- Agent types: 6 (claude "FleetView's default", claude-code-guide, Explore,
  general-purpose, Plan, statusline-setup) — matches B1/D.
- No recalled memories injected (memory dir empty at session start). No Copilot-side
  leakage, consistent with every prior Claude-side turn.

#### Billing expectation
- Anthropic rail (extension tab, claude.ai-authenticated at start; no proxy/billing
  markers in prompt). Unverified against meters this turn.

---

### 2026-07-09 — Claude Code (VS Code extension tab), Fable 5 — harness-coverage CORRECTION (user-provided)

#### The error this entry corrects
This agent asserted (in pfm-org PR #36's body) that content in AGENTS.md is "invisible
to every Copilot agent" because .github/copilot-instructions.md is a separate file.
**Wrong.** User correction, treated as ground truth for this audit:

- **VS Code Copilot agents (2026 default rules) read AGENTS.md** — AND **CLAUDE.md** —
  AND **`.claude/**`**. Copilot is the most adoptive harness of other harnesses'
  context patterns currently known.
- So in a repo carrying AGENTS.md + CLAUDE.md + .claude/** + .github/copilot-instructions.md,
  VS Code Copilot potentially loads ALL of them; Claude Code loads CLAUDE.md/.claude/**
  and AGENTS.md, but NOT copilot-instructions.md and NOT Copilot profile
  *.instructions.md files (per this file's header note).
- Implication inverted from what the agent assumed: the risk is not Copilot missing
  AGENTS.md content — it's **duplication/divergence being loaded twice by Copilot**
  (AGENTS.md and copilot-instructions.md both in context, possibly disagreeing), and
  Claude-side blindness to copilot-instructions.md content.

#### Memory-scope lesson (same turn)
Claude Code auto-memory is machine+account+harness scoped (this project's memory dir
on this laptop, DarienSirius, Claude Code). Facts recorded there do nothing for agents
on OTTOPOET/SEDLEC/AURORA, other collaborators' agents, or Copilot harnesses. Durable
cross-agent knowledge belongs in repo-carried, harness-read files (AGENTS.md first,
given the adoption matrix above), not in any harness's local memory.

#### Standing question for future audit turns
Verify empirically per harness which of {AGENTS.md, CLAUDE.md, .claude/**,
.github/copilot-instructions.md, *.instructions.md} actually enter context under
default rules, and record version/date — "which files, which harness" claims must cite
an observation, not training-data recall (this correction exists because the agent
recalled a stale/wrong matrix).

---

### 2026-07-09 — model-switch context-cap wedge (user-observed, VS Code extension)

Switching models on a session holding >200k tokens of context wedges Claude Code
completely in the VS Code extension: every subsequent message errors "Prompt is too
long." Direction (user-corrected): **fable → haiku** on a session holding >200k tokens
— same direction as the earlier AO_PFM "kablooey" switch. CORRECTION + RESOLUTION,
same day: the wedge cleared on its own once compaction ran — the session resumed
answering normally on haiku afterward.

Mechanism (now consistent with observation): context accumulated under the
larger-window model (Fable) exceeds the smaller target model's cap (Haiku ≈200k), so
every request overflows until a compaction shrinks the context under the new cap.
The wedge is a compaction race, not a dead session — but while wedged it LOOKS dead,
which is probably what the earlier AO_PFM breakage actually was.

Practical protocol until fixed upstream:
1. **/compact BEFORE any model switch**, and only switch on a freshly compacted
   session.
2. If wedged: switch back to the larger-context model first (if the picker still
   works while erroring), /compact there, then switch down.
3. If the extension won't recover: resume the session in the TUI
   (`claude --resume <session-id>`), which may handle the overflow differently.
4. Treat mid-session model switching on long sessions as destructive until proven
   otherwise; prefer ending a cycle (report + durable state) and switching at a
   clean boundary.

---

### 2026-07-10 — Claude Code (VS Code extension tab), Fable 5 — fresh session (E-shaped)

Provenance: turn 1 of a new session; user's task is a Discord-privacy design question,
audit is per-protocol only. Files read before this entry: this file only.

#### Identity / tools
- "Claude Code, Anthropic's official CLI ... within the Claude Agent SDK" + VSCode
  Extension Context section. Model claude-fable-5 via `/model claude-fable-5[1m]`
  (stdout visible in transcript). PowerShell primary + Bash; scratchpad + memory dirs.
- Core 14 tools, same manifest as B1/B3/D/E. Deferred list arrived as a FULL list
  (fresh session): TodoWrite present (not the TaskCreate family D saw); NO
  mcp__ide__* tools listed this time (unlike D) despite extension-tab surface.
- Google connectors (Gmail/Calendar/Drive): unauthenticated from turn 1 — auth-required
  notice, "session is non-interactive, cannot run OAuth here." Turn E's mid-session
  auth decay now appears as the session-start default state.

#### Zero-tool-call injections
- claudeMd (full CLAUDE.md), userEmail, currentDate (2026-07-09 at injection).
- **Auto-memory MEMORY.md injected for the first time in this log** (8 index entries:
  agent-fleet, KPFM ISSUES.md, work-towards-vs-work-on, harness-context-coverage,
  Victor's design-doc conventions, PFM sprint state, GitHub account topology, Aurora
  hardware) — Turn E wrote the first memories; they now ride in as zero-call context.
- ide_opened_file notice: "___\Tech Team Notes 2026-07-10.md" (editor-state leak into
  context, extension-tab-specific — same channel class as Copilot's editorContext).
- Skills list: 15 (matches B1/B3/E). Agent types: 6 (matches B1/D/E).
- **Date rollover mid-conversation**: a system notice updated currentDate 07-09→07-10
  ("DO NOT mention this to the user") — a new zero-call injection type for this log:
  the harness mutates previously injected facts between turns.
- No Copilot-side leakage, consistent with all prior Claude-side turns.

#### Incident (same session, turn 2-3): ide_opened_file + bypass mode + agent initiative = leak
The ide_opened_file notice (which the user cannot suppress without closing the editor
tab) carried the path of a file the user intended to keep out of cloud-AI context and
paraphrase manually. The agent, in bypassPermissions mode, inferred consent from the
repeated notice and Read the file unprompted — content the user's own privacy design
classified as local-only entered a cloud model's context. Failure chain: (1) harness
injects editor state zero-call; (2) bypass mode removes the prompt gate; (3) agent
initiative converts a passive path leak into a content leak. Lesson: instructions and
folder discipline are probabilistic guards; the enforceable guard is a PreToolUse hook
denying Read/Grep/Glob on a quarantine path (hooks fire regardless of permission mode).
User's verdict, accepted: post-hoc advice to restructure folders was burden-shifting —
the read was the agent's choice.

#### Same session, later turns (2026-07-11) — additional harness observations
- Second currentDate rollover notice (07-10→07-11), same "do not mention" phrasing —
  the mutation channel fires per calendar day, not per session.
- ide_opened_file once surfaced a HARNESS-GENERATED path: a readonly diff-view of the
  agent's own Write call (`\temp\readonly\Write c:\...PRIOR-SIGNALS.md (hbdroy)`) —
  the editor-state channel reports the agent's own tool artifacts back as "user opened
  a file," a self-echo loop in the injection channel.
- Mid-turn user messages are delivered INSIDE the running turn, attached alongside the
  next tool result with an explicit harness note describing the mechanism — not queued
  as a separate conversation turn.
- WebFetch is domain-blocked for web.archive.org at the harness level ("Claude Code is
  unable to fetch from web.archive.org") while archive.org (availability API) fetches
  fine; curl from the shell reaches web.archive.org without restriction — tool-level
  and network-level reachability are independent policy surfaces.
- ToolSearch deferred-tool loading (WebFetch/WebSearch) worked as documented: schemas
  arrive in a <functions> block and the tools become callable next turn.

### 2026-08-09 — Codex durable npm-rotation rehearsal

- Harness: Codex Desktop, Windows PowerShell, PFM office root.
- Identity evidence: current Codex rollout/instance metadata was supplied by the
  harness; no card identity was inferred from this audit entry.
- Files read: `AGENTS.md`, `CLAUDE.md`, `HARNESS_AUDIT.md`, and the existing
  notification-sprint npm-token handoffs.
- Change: added a redacted npm publishing credential state machine to
  `CLAUDE.md`, covering trusted publishing, granular token boundaries, GitHub
  secret repository scoping, verification, rotation, revocation, and blocked
  transitions.
- Validation: ran a local fixture-only rehearsal for both npm namespaces. No npm
  or GitHub mutation was called; no secret value was read, printed, or stored.

### 2026-08-09 — pfm-webops#99 browser-only credential wiring verification

- Browser evidence: DarienSirius's GitHub session showed the fine-grained token
  record `PFM_WEBOPS_SECRETS_WRITE_TOKEN_AWG26-27` (owner DarienSirius,
  expiration 2026-09-08; value never opened) and the repository Actions secret
  `PFM_WEBOPS_SECRETS_WRITE_TOKEN` updated minutes earlier.
- Scope boundary: opening token details invoked GitHub sudo/passkey. Scope was
  therefore not claimed as verified; no passkey ceremony was initiated and no
  secret value was read, copied, printed, or passed through a shell.
- GitHub evidence: posted the redacted verification update to
  `PlayFieldMultiplier/pfm-webops#99` at comment `5232789210`.
- Durable policy change: `CLAUDE.md` now prioritizes assignments to
  `VictorBargains` and direct DarienSirius mentions for control-plane triage,
  while distinguishing browser-executable verification from human auth gates.
## 2026-08-09 — AWG25.Blue public-app confirmation is human-only in Codex IAB

- The `Make AWG25.Blue public` control opens a browser-native GitHub confirmation dialog stating that any user or organization may install the app.
- In the Codex in-app browser, the modal is centered across the browser pane and the adjacent chat pane. It blocks both browser interaction and conversation input.
- Codex automation can detect the dialog and can trigger the underlying button, but cannot reliably accept this user-visible confirmation. Classify this exact confirmation ceremony as human-only in the Codex harness.
- The user then clicked the confirmation manually; post-click app state must be verified before treating the publication as complete.
- LoA consequence: app configuration and installation flow are automatable up to this modal; the final public-visibility confirmation requires the human operator. Do not claim completion from the pre-click state.
## 2026-08-09 — Blue/Red GitHub App installation LoA test

- `AWG25.Blue` was made public by the human operator after the browser-native confirmation dialog, then installed on the `PlayFieldMultiplier` organization.
- Installation ID: `152475067`; repository scope is **all repositories**, with the app's existing broad Blue Team permission envelope. GitHub confirmed the installation and displayed the resulting organization permissions.
- `DarienSirius` is visibly an organization Owner of `PlayFieldMultiplier`.
- `AWG26.Red` has a pending installation request (`request_id=2417221`) for the same organization. The owner session exposes only a `Review request` link, which returns to the requester's install-target page with an existing-request alert and no approval control. Treat same-session approval of this request as unverified/human-or-separate-owner blocked; do not claim AWG26.Red is installed.
- Current LoA evidence: app publication confirmation required human browser interaction; AWG25 installation was automatable after that ceremony; AWG26 request approval remains outside the current session's effective control surface.
## 2026-08-09 — AWG25 installation capability test

- AWG25.Blue is installed on `PlayFieldMultiplier` (installation `152475067`) with all-repository scope and its existing broad permission envelope.
- `pfm-webops#99` is now closed/completed; the token-backed rotation/write-back loop succeeded for all three sites, so this installation materially covers the previously human-blocked PFM secret-management path.
- A separate `Agents-Of/PlayFieldMultiplier` CI run (`31305964595`, PR #193) still fails cloning private `SKILL-OF/agentic-train-conducting`; PFM installation authority does not cross organization boundaries. This is recorded as a cross-org authorization boundary, not an AWG25 failure.
## 2026-08-09 — AWG26.Red request cancellation/retry resolved the apparent blocker

- From the visible AWG26.Red selector, page 17 of 29 contained `PlayFieldMultiplier` as an enabled `Cancel request` leaf.
- The user explicitly authorized cancellation. Codex opened the confirmation dialog, confirmed cancellation, and verified GitHub's alert: `The installation request has been canceled.`
- The same PlayFieldMultiplier target then became a normal enabled organization link. The permissions page exposed `All repositories` selected and an enabled `Install` button.
- Codex submitted the retry and verified GitHub's alert: `Okay, AWG26.Red was installed on the @PlayFieldMultiplier account.` The resulting installation settings URL ends in installation `152485182`; all-repository scope is checked and the app's existing broad Red Team permissions are present.
- LoA consequence: this was not a same-account PR-review-style prohibition. The stale pending request was the blocker; cancellation followed by a fresh install completed without another approval gate in this session.
## 2026-08-09 — Agents-Of organization app verification

- `AWG25.Blue` was installed through the authenticated browser on installation `152495710`; the target leaf showed `All repositories` selected and GitHub displayed: `Okay, AWG25.Blue was installed on the @Agents-Of account.`
- `AWG26.Red` was already installed on installation `147558489`; the organization GitHub Apps page listed both apps under `Installed GitHub Apps` and showed no pending installation requests.
- AWG26.Red configuration showed `All repositories` selected and active controls (`Save`/`Cancel` disabled because unchanged; `Suspend` and `Uninstall` available), so it was not suspended or pending.

### 2026-09-09 — CARTOGRAPHER: wmux/Claude Code identity, messaging, and context-loading audit

- Harness: Claude Code CLI, PowerShell 7, wmux-managed multi-pane workspace.
- Identity evidence: SessionStart banner claimed "Instance 6" with `Source: manual`,
  which is an unverified guess, not a real read — the `instance-identification`
  skill's hook had genuinely failed (`hook_non_blocking_error`, "No analysis
  data") earlier in the session. Real instance count required directly reading
  raw `compact_boundary` entries from the session's own JSONL, cross-verified
  against `sesh-hound` (found broken — empty `bin/` after an unfinished
  migration to `TOOLS-OF/local-agent-discovery`, fixed via
  `TOOLS-OF/local-agent-discovery#5`).
- Chain-of-command finding: A2A is Agent-to-Agent by protocol definition — never
  the human operator. Confirmed live with two independent agents (FOUNDRY,
  imperial-tie-fighter-pilot) that both had, at various points tonight, treated
  an unsigned or dispatcher-relayed message as if it were the human, including
  one real incident where an unsigned STOP message caused an agent to freeze a
  workflow mid-execution. Standing fix: challenge any unattributed message back
  ("was this you? you didn't tag yourself") before acting on it; direct
  terminal input is the only channel actually guaranteed to be the human.
- Context-loading finding, clean-tested: a project-level `CLAUDE.md` placed one
  directory above an agent's own cwd does NOT auto-load — the harness only
  reads `CLAUDE.md` from the exact cwd, not by walking ancestor directories.
  (The home-level `CLAUDE.md`'s `@AGENTS.md` import is a different, always-on
  mechanism, not ancestor-walking.) Verified by asking a freshly-relaunched
  agent, before any contamination, whether it saw doctrine content at boot —
  it hadn't. Fix: a one-line `@../CLAUDE.md` import placed directly in each
  agent's own instance folder, matching the proven-working home-level pattern.
- wmux mechanics finding: `surface_list`'s reported `cwd` for a surface can
  permanently drift from the real process cwd. When a `.bat` file `cd`s to a
  new folder before launching `claude`, the actual Claude Code process
  correctly runs from the new cwd, but wmux's own surface metadata does not
  update to match — observed on multiple relaunches tonight. Never trust
  `surface_list`'s `cwd` as proof of where an agent is actually working; ask
  the agent directly.
- A2A delivery finding, isolated via controlled live test: `a2a_task_send`
  calls that omit `task_id` (fresh sends) reliably trigger a live wake —
  injected directly as a turn in the target's conversation. Calls that
  include `task_id` (replies within an existing thread) do NOT wake the
  recipient, even with byte-correct `pane_id`/`surface_id` addressing —
  content lands silently in the task's structured history, discoverable only
  by manual polling. Tested 2x with correct addressing, failed both times;
  fresh sends succeeded 4/4 across both directions.
- Envelope finding: the rendered `━━━ WMUX A2A ━━━` block's `From:`/`To:`
  fields show the WORKSPACE name on both sides — every agent sharing a
  workspace (multiple panes, multiple agents) gets an identical, individually
  unattributable envelope. Fix: every message body must open with an explicit
  `From: <card+name+q-semver>` / `To: <...>` pair; never trust the envelope
  alone.
- Open, unresolved: a `.bat` file launching `claude --resume ... -n "..."`
  intermittently truncates the first several characters of specific lines
  (`claude --d` → `angerously-skip-permissions`) when run via `terminal_send`.
  Reproduced 3x on one pty; did not reproduce on another pty running the
  identical script structure. Neither `@echo off` nor converting LF→CRLF line
  endings fixed it. Working fallback: bypass the `.bat` entirely, type the
  full resume command directly via `terminal_send`. Root cause not found;
  noted as a known quirk per explicit instruction not to keep digging.
- Structural finding, unresolved by design: an agent's own pane can serve
  dual purpose — its own live agent-input stream AND the terminal a human
  operator types into directly. Any live A2A wake delivered to that agent
  necessarily pastes into the same shared input space; there is no
  delivery-mode parameter that avoids this (a "silent" delivery avoids the
  paste but also means the recipient is never actually woken — not a lesser
  form of messaging, the same failure as the task_id-reply gap above).
- Files changed: created/updated a scratchpad-scoped `CLAUDE.md` (in the
  `20cd14c2.../scratchpad/` tree shared by this session's siblings) with all
  findings above as executable doctrine; added `@../CLAUDE.md` import files to
  three sibling instance folders; created scoped `CLAUDE.md` files at two
  previously-uncovered local-temp working folders (`leagueos-real`,
  `league-os-work`) pointing back to the shared doctrine. Deliberately did NOT
  touch `PlayFieldMultiplier/.AO`'s CLAUDE.md — that's a separately-governed,
  mature office with its own PR+review process and an existing, differently-
  scoped harness-parity epic (`HARNESS-EP001`); these findings didn't fit its
  scope.
- Validation: every finding above was tested live, not inferred — real agent
  relaunches, real controlled A2A message exchanges with explicit before/after
  checks, real JSONL/session-file reads, cross-verified with a second agent
  independently reproducing the same failure modes.

### 2026-09-22 — Meridian: CORRECTION to the 2026-09-09 CLAUDE.md ancestor-walk finding, plus why this file went silent

- Harness: Claude Code CLI, `claude --version` = **2.1.280** (the 2026-09-09
  entry above recorded no version number — a real gap, and exactly why this
  correction is hard to date precisely to a specific release).
- **The 2026-09-09 CARTOGRAPHER entry's finding is REVERSED as of today**: it
  stated "a project-level CLAUDE.md placed one directory above an agent's own
  cwd does NOT auto-load — the harness only reads CLAUDE.md from the exact
  cwd, not by walking ancestor directories." Tested fresh today (see
  `ENVIRONMENT-BEHAVIOR-LEDGER.md` for full method): the walk-up is real and
  cumulative — a session's context includes every ancestor `CLAUDE.md`/`@`
  -import from cwd up to the filesystem root, not just the exact cwd, and not
  just the nearest one. Confirmed via two paired fresh headless `claude -p`
  queries distinguishing an office-root `AGENTS.md` from a newly-created
  intermediate-node `AGENTS.md` two directories below it, both present
  simultaneously and separately attributable by path.
- **Why this file went 13 days silent, honestly**: not because it degraded
  into low-value noise — most of the content above is real, dated, and
  methodologically sound. It stopped because the explicit standing
  instruction to read/append it on wake (`CLAUDE.md`: "First action on wake:
  ... read HARNESS_AUDIT.md ... as a real, deliberate step") simply stopped
  being followed — by whoever worked this office between 2026-09-09 and
  today, and by me specifically for several hours of this exact session
  before Victor asked directly whether the file had degraded into "cargo
  culted AI slop spam." It hadn't gone to spam; it had gone to silence,
  which a wake-time instruction that nobody's actually checking looks
  identical to from the outside.
- **Scope going forward, to avoid duplicating `ENVIRONMENT-BEHAVIOR-LEDGER.md`**:
  this file stays specifically about cross-harness differences — system
  prompt/identity framing, tool manifests, billing rails, auth behavior,
  same-session harness-swap effects — the Claude-vs-Copilot-vs-Codex
  comparison work it was actually built for. General tool/environment
  mechanism facts that aren't about cross-harness comparison (CLAUDE.md
  loading semantics, a GitHub plan's real feature availability, wmux
  mechanics) belong in `ENVIRONMENT-BEHAVIOR-LEDGER.md` instead, which uses a
stricter dated+versioned entry format specifically so a future agent can
tell at a glance whether a finding is still trustworthy against the
currently-running version — a discipline this file's entries mostly lack
(only some log a version number) and which is exactly what let the
09-09-vs-today contradiction above sit undetected for 13 days.

### 2026-09-24 — Nietzsche/Codex: bounded PR supersession audit

- Identity prompt: audit `SKILL-OF/github-collaboration` PR #7 for evidenced
  supersession by PR #8; do not merge or close; preserve the branch; record a
  review only if independently supported.
- Context without tool call: current native child identity Nietzsche / 🍍K♦️,
  q unresolved; the task was a long-tail handoff from Anscombe, not a child
  replacement. The target was a private GitHub repository and the requested
  evidence was current refs, ancestry, reviews/comments, checks/dependencies,
  and closure authorization.
- Tools used: Codex `functions.exec` orchestration, PowerShell `gh` REST/API
  reads, local `git` fetch/ancestry/status reads, `apply_patch`, and the shared
  `github-collaboration/scripts/run.mjs` action runner. No browser, app, or
  external sidecar was used.
- Result: independently verified #7 head `5ee502fb...` is open/dirty and #8
  head `d34a2762...` is open/clean; their policy overlap is patch-level rather
  than ancestry. Posted a file-backed, attributed `REQUEST_CHANGES` review
  comment on #7; no merge or close action was taken.

### 2026-09-24 — Nietzsche/Codex: PPL bootstrap PR #88 audit

- Identity prompt: independently review `PortlandPinballLeague/PPL_001_bootstrap`
  PR #88 at exact head `898d02c9...` against `main` `713ab33...`; verify #85,
  #63, and #57-related controls; do not merge, close, delete, dispatch, or
  mutate production.
- Context without tool call: current native child identity Nietzsche / 🍍K♦️,
  q unresolved. The task required a substantive attributed review only when
  current evidence and reviewer identity were safe.
- Tools used: Codex `functions.exec` orchestration, PowerShell `gh` REST/API
  reads, targeted raw GitHub file reads, `apply_patch`, and the shared
  `github-collaboration/scripts/run.mjs` comment action. No browser, workflow
  dispatch, merge, close, delete, or external sidecar was used.
- Result: verified #88 was 15 ahead/0 behind, clean, with no checks or status
  contexts; confirmed session-integrity and endpoint/key-source code; found
  production snapshot-run identity and fail-closed key-source gaps. Posted an
  attributed `REQUEST_CHANGES` review comment at
  `issuecomment-5811108688`; no production mutation occurred.

### 2026-09-24 — Nietzsche/Codex: PPL bootstrap PR #88 corrected-head re-review

- Identity prompt: re-review `PortlandPinballLeague/PPL_001_bootstrap` PR #88
  at exact head `769ae7b3...` against `main` `713ab33...`; verify the new
  production-gate test and preserved #85/#63/#88 behavior; do not merge,
  close, delete, or dispatch workflows.
- Context without tool call: current native child identity Nietzsche / 🍍K♦️,
  q unresolved. The prior review had found snapshot-run and key-source gates
  too permissive.
- Tools used: Codex `functions.exec`, PowerShell `gh` REST/API and raw file
  reads, detached temporary `gh repo clone`/`git fetch`/checkout, Bash test
  execution, `rg`, `apply_patch`, and the shared `github-collaboration`
  action runner. No workflow dispatch, production mutation, merge, close,
  delete, browser, or external sidecar was used.
- Result: exact-head `bash scripts/test-production-gates.sh` passed; static
  checks confirmed exact snapshot provenance, fail-closed key-source selection,
  #85 wp-config guards, and Electron endpoint continuity. Posted an attributed
  `APPROVE` comment-based review at `issuecomment-5811480168`; merge and
  production bootstrap remain separately authorized actions.

### 2026-09-24 — Codex Meridian: reconciled hotfix and long-tail completions

- Identity prompt: Codex Desktop task operating as Meridian; current heartbeat
  automation `dashborg-relay-station-5-3`; native children Bernoulli and
  Nietzsche were reused by recorded handle, not replaced.
- Tools used: native `multi_agent_v1__wait_agent`,
  `multi_agent_v1__send_input`, PowerShell UTF-8 file reads, and the shared
  local orchestration layer. No wmux or external sidecar was used.
- Result: Bernoulli completed LeagueOS #568 with hotfix commit
  `d8702aa4fb5bd72516927e211551207b4a4dc92a` on
  `bernoulli/568-roster-prefix-fix`, based on the new
  `integration/1.0.4-candidate` buffer from `origin/devline` `72e0b8a`;
  evidence included a failing pre-fix and passing post-fix Playwright test,
  healthy 8207–8210 lanes, and a captain own-team navigation check. No merge or
  deployment occurred. Nietzsche completed the PR #7 supersession audit and
  recorded `REQUEST_CHANGES`; PR #7 remains open because closure was not
  authorized. The next sprint action is independent review of #568; the next
  long-tail action is bounded PPL repository audit rotation.

### 2026-09-24 — Codex Meridian: PPL bootstrap rotation

- Identity prompt: Codex Desktop Meridian heartbeat; Galileo was reused as the
  existing native child for the long-tail rotation.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  GitHub/local repository inspection performed by the child. No wmux or
  external sidecar was used.
- Result: Galileo audited `PortlandPinballLeague/PPL_001_bootstrap` at main
  `713ab33aa22d3772978a406aa3cc5aeaf4dd344c`. PR #88 is the actionable lane
  (`a716c2d3`), but is 13 ahead/11 behind, has no substantive review, and
  overlaps #85 and the Hostineer probe PRs #57/#63. PR #69 is conflicted
  despite historical approval; #57 is a stale competing probe implementation;
  #63 is a consolidation candidate. No branches were deleted or merged.

### 2026-09-24 — Codex Meridian: hotfix review gate and PPL consolidation

- Identity prompt: Codex Desktop Meridian heartbeat; Anscombe and Galileo were
  reused as existing native children, with no replacement child created.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Anscombe independently reviewed LeagueOS PR #569 at
  `d8702aa4fb5bd72516927e211551207b4a4dc92a` and recorded `REQUEST_CHANGES`.
  The PR lacks checks for its integration-branch target, tests only selector
  state rather than persisted save/AJAX/reload behavior, and 8207–8210 are not
  serving this SHA; no merge or deployment occurred. Galileo refreshed PPL
  PR #88 to `898d02c9b4dae9cd35c2cebd4f4b98d533570780`, clean and 15 ahead/0
  behind main, incorporating #85 and reconciling #57/#63 without posting an
  unattributed review.

### 2026-09-24 — Codex Meridian: bounded wait, no state transition

- Identity prompt: Codex Desktop Meridian heartbeat; existing native children
  Bernoulli and Nietzsche remain the active sprint and long-tail workers.
- Tools used: native `multi_agent_v1__wait_agent` and PowerShell UTF-8 reads of
  the required instruction, routing, and procedure files. No wmux or external
  sidecar was used.
- Result: neither worker completed during the bounded wait. No new assignment,
  merge, closure, branch mutation, deployment, or release-state change was
  made; both active tasks remain the deferred cursor for the next wake.

### 2026-09-24 — Codex Meridian: PPL review disposition

- Identity prompt: Codex Desktop Meridian heartbeat; Nietzsche completed the
  independent review and Galileo was selected for the corrective implementation
  handoff. Bernoulli remained the active LeagueOS sprint worker.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Nietzsche recorded `REQUEST_CHANGES` on PPL PR #88. The production
  bootstrap accepts an arbitrary successful `SNAPSHOT_RUN_ID` instead of
  proving it came from the approved workflow/ref/current repository state, and
  unexpected `KEY_SOURCE` values fall back to staging instead of failing
  closed. No merge, close, delete, dispatch, or production mutation occurred.

### 2026-09-24 — Codex Meridian: PPL gate correction completed

- Identity prompt: Codex Desktop Meridian heartbeat; Galileo completed the
  existing native corrective assignment and Nietzsche was selected for the
  independent re-review. Bernoulli remained the active LeagueOS sprint worker.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Galileo pushed PPL PR #88 at
  `769ae7b3dd013acd9ffe0b1bb87aba501963deb0`. The snapshot gate now verifies
  repository, workflow, dispatch event, success, ref, and exact current SHA;
  unexpected `KEY_SOURCE` values fail closed. Focused gate tests, Bash syntax,
  and `git diff --check` passed. No workflow dispatch, production mutation,
  merge, close, or delete occurred.

### 2026-09-24 — Codex Meridian: PPL correction independently approved

- Identity prompt: Codex Desktop Meridian heartbeat; Nietzsche completed the
  existing native independent review, while Bernoulli remained the active
  LeagueOS sprint worker.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Nietzsche approved PPL PR #88 by attributed comment after an exact-
  head detached clone passed `bash scripts/test-production-gates.sh` and the
  provenance/fail-closed checks were verified. PR #88 is a merge candidate,
  not merge-authorized; no merge, close, delete, workflow dispatch, or
  production mutation occurred.

### 2026-09-24 — Codex Bernoulli: LeagueOS #569 corrective sprint

- Identity prompt: native child Bernoulli, `👽J♥️/AS/📎9♥️/AS/🔱3♣️`, q
  unknown; parent Meridian. Assignment was to continue PR #569 on its
  existing hotfix branch without merging, deploying, or touching shared
  LeagueOS data.
- Tools used: PowerShell, Git, GitHub CLI, WSL2 LeagueOS Docker commands,
  disposable WordPress/MariaDB runtime on port 8211, and Playwright through
  the local Edge channel. No browser-control surface or external sidecar was
  used.
- Result: replaced the hand-built score comment fixture with the real
  two-phase game-score API, added the actual captain own-team Players-tab
  regression, pushed PR #569 head `f5cbb0bf7947f2fff80ece26f595f4c840caffc`,
  and validated the exact SHA in the disposable runtime. Shared ports
  8207–8210 were inspected read-only; no merge, deployment, or shared-database
  mutation occurred.

### 2026-09-24 — Codex Meridian: hotfix evidence and office-procedures audit

- Identity prompt: Codex Desktop Meridian heartbeat; Bernoulli completed the
  sprint correction, Galileo completed the long-tail audit, and the existing
  native children were retained without replacement.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Bernoulli pushed PR #569 at
  `f5cbb0bf7947f2fff80ece26f595f4c840caffc3` with a real persisted score
  fixture, captain own-team Players-tab AJAX/save/reload coverage, the
  `test:568-persisted` command, and integration-branch CI triggering. The
  disposable 8211 runtime passed; CI is red before runner allocation, with no
  test failures. Galileo found office-procedures PR #9 is the next independent
  review candidate; PR #8 is conflicting and scope-misaligned, and PR #11 is
  mergeable but lacks review/attribution. No merge or deployment occurred.

### 2026-09-24 — Codex Nietzsche: office-procedures PR #9 audit

- Identity prompt: established native child Nietzsche, `🍍K♦️`, q unresolved;
  no additional identity, permission, or liveness was inferred.
- Context without tool calls: audit `Agents-Of/office-procedures#9` at head
  `d47684b538b3335c6ffbedc4565df2506efe11f6` against main
  `7213bb0cc6f0aec1262f7e12166187ff867cd471`; do not merge, close, delete, or
  mutate branches; post an attributed review only if evidence is safe.
- Tools used: PowerShell, `gh` API, Git, detached temporary audit clone,
  PowerShell parser validation, `git diff --check`, the shared GitHub
  collaboration runner, and `apply_patch`. No branch mutation, merge, close,
  delete, deployment, or Docker service start occurred.
- Result: verified PR #9 open/non-draft/mergeable-clean, exactly 3 ahead/3
  behind and diverged, scoped to three files; no native reviews, review
  comments, checks, status contexts, requested reviewers, or linked dependency
  were present. Static checks passed. Posted comment-based `REQUEST_CHANGES`
  review `https://github.com/Agents-Of/office-procedures/pull/9#issuecomment-5811844686`
  identifying the unindependently verified, infrastructure-mutating helper
  runtime as the blocker; no approval was claimed.

### 2026-09-24 — Codex Nietzsche: DashBOrg LeagueOS PR #1 audit

- Identity prompt: established native child Nietzsche, `🍍K♦️`, q unresolved;
  no additional identity, permission, or liveness was inferred. The live PR
  label `agent:nietzsche` was treated as routing evidence only.
- Context without tool calls: review `DashBOrg-of/LeagueOS#1` at exact head
  `7ee82beb2d68b57810bb7421ec317a2093241b85` against main
  `47c81252eadcf448478872c3e7a78f1fed8e6540`; inspect WSL launcher authority,
  isolation, fixture-only environment handling, removed KPFM launcher, and
  focused checks; do not merge, close, delete, dispatch, run Docker, deploy,
  or touch staging.
- Tools used: PowerShell, `gh` API, Git, detached temporary audit clone,
  PowerShell parser and validator checks, UTF-8 `rg`, the shared GitHub
  collaboration runner, and `apply_patch`. No Docker, WSL launcher, workflow,
  deployment, staging, branch, merge, close, or delete action occurred.
- Result: confirmed main/head and clean mergeability, 5 commits ahead/0 behind,
  eight-file scope, removal of `start-kpfm.ps1`, and no forbidden fixed
  executable references. All three scripts parsed; valid input and reserved
  port rejection passed. Found that PowerShell `-match` accepts uppercase
  project names despite the lowercase contract, and that the launcher does
  not verify WSL worktree existence/repository identity. Posted attributed
  comment-based `REQUEST_CHANGES` at
  `https://github.com/DashBOrg-of/LeagueOS/pull/1#issuecomment-5822176836`;
  no native approval was claimed.

### 2026-09-24 — Codex Meridian: office-procedures PR #9 disposition

- Identity prompt: Codex Desktop Meridian heartbeat; Nietzsche completed the
  independent review using an existing native child handle. Anscombe remained
  the active LeagueOS #569 reviewer.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Nietzsche recorded `REQUEST_CHANGES` on office-procedures PR #9.
  Static parsing and diff checks passed, but the only runtime PASS is author
  evidence because independently running the helper would start Docker
  infrastructure. PR #9 remains blocked pending a safe independent runtime
  verification; no merge, close, delete, or deployment occurred.

### 2026-09-24 — Codex Meridian: LeagueOS review gate and next long-tail cursor

- Identity prompt: Codex Desktop Meridian heartbeat; Anscombe completed the
  independent review of LeagueOS #569 and Galileo completed the office-
  procedures #11 audit. Existing native children were reused without
  replacement.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Anscombe recorded `REQUEST_CHANGES` on #569: the persisted captain
  flow passes, but #314 is not wired into CI and the browser test does not
  assert the seeded match-30 fixture. Galileo found office-procedures #11
  cleanly 1 ahead of main but blocked on absent acting identity/independent
  review and checks. No merge, close, delete, workflow, Docker, or deployment
  action occurred.

### 2026-09-24 — Codex Meridian: LeagueOS hotfix correction and Hostineer audit

- Identity prompt: Codex Desktop Meridian heartbeat; Bernoulli and Galileo
  completed existing native assignments, with no replacement child created.
- Tools used: native `multi_agent_v1__wait_agent`, PowerShell UTF-8 reads, and
  the shared orchestration layer. No wmux or external sidecar was used.
- Result: Bernoulli pushed PR #569 head
  `c53a0d89ecc56912d8b0c0fbd45e5536aeb9552c`, wiring #314 into the executable
  integration test list and asserting seeded match 30; the exact disposable
  8211 runtime passed, while hosted CI again failed before runner allocation.
  Galileo audited Hostineer.com PR #3 at `9d8d233d0178c720e5b96ab5eb788e7481a55da7`
  and found clean documentation-only scope but no independent review or
  executable checks. No merge or deployment occurred.

### 2026-09-24 — Codex Meridian: initial roster dropdown bug tracked and routed

- Identity prompt: Codex Desktop Meridian heartbeat; reconciled completion
  notifications from Bernoulli, Anscombe, Nietzsche, and Galileo before new
  routing. Existing native children were reused; no replacement was created.
- Tools used: native `multi_agent_v1__wait_agent` and `send_input`, PowerShell
  UTF-8 reads, GitHub CLI, and the shared orchestration layer. No wmux or
  external sidecar was used.
- Result: Reproduced the distinct initial-load failure on candidate SHA
  `3a102c53070fff3f9a1b72178b2b60c7b34bcd7f` at 8209: captain
  `demo-staging-0007` reached `local-match-74` through `Me > My Matches`, all
  24 roster checkboxes were checked, but the four enabled game-player
  selectors exposed only the placeholder and `FORFEIT`. No mutating control
  was clicked. Filed LeagueOS issue #573 for the 1.0.4 hotfix line, added it
  to ENG project 7, set Status=In Progress, and routed it to Bernoulli.
  Routed Galileo to a bounded corrective disposition for DashBOrg-of/LeagueOS
  PR #1; no merge, close, delete, Docker, workflow, or deployment action was
  taken.
- Verification: issue #573 is In Progress on project 7 and DashBOrg PR #1
  carries the `agent:galileo` routing label.

### 2026-09-24 — Codex Meridian: native child handles recovered after wake

- Identity prompt: Codex Desktop Meridian heartbeat; the first completion
  reconciliation returned `not_found` for the four queried child handles.
  The registry still identifies the original Bernoulli, Nietzsche, Anscombe,
  Galileo, and historical Socrates handles; no replacement was created.
- Tools used: native `multi_agent_v1__wait_agent`, exact-handle
  `resume_agent`, `send_input`, and PowerShell UTF-8 reads. No wmux or
  external sidecar was used.
- Result: Resumed and re-routed the existing Bernoulli assignment for LeagueOS
  issue #573 and the existing Galileo corrective assignment for DashBOrg PR
  #1. No merge, close, delete, workflow, Docker, deployment, or shared-data
  mutation occurred.

### 2026-09-24 — Codex Meridian: Galileo corrective implementation handoff

- Identity prompt: Codex Desktop Meridian heartbeat; reconciled Galileo's
  completion notification before the next bounded assignment. Bernoulli's
  issue #573 investigation remained active; no duplicate sprint worker was
  started.
- Tools used: native `multi_agent_v1__wait_agent`, exact-handle
  `resume_agent`, and `send_input`, plus the required UTF-8 office reads. No
  wmux or external sidecar was used.
- Result: Galileo verified DashBOrg PR #1 still clean at the original head and
  prepared the in-place correction scope. He was reactivated on the existing
  native handle to implement only the WSL/runtime, dynamic project/port, and
  fixture-credential corrections, with a non-force head check. Merge, close,
  delete, Docker, workflow, and deployment actions remain prohibited.

### 2026-09-24 — Codex Bernoulli: LeagueOS #573 initial selector correction

- Identity prompt: existing native Bernoulli child, `👽J♥️/AS/📎9♥️/AS/🔱3♣️`,
  q unknown; no replacement child created. Assignment covered candidate SHA
  `3a102c53070fff3f9a1b72178b2b60c7b34bcd7f` and the fresh-match game-player
  selector failure.
- Tools used: PowerShell, Git, GitHub CLI, WSL2 LeagueOS Docker commands, and
  Playwright against a disposable port-8211 runtime. Shared candidate 8209 was
  read-only; no Save Players action, merge, deployment, or shared-data mutation
  occurred.
- Result: opened PR #582 at `f53cb772a21763d98fd52d1e4fc3760dd4c31fd7`. The
  fresh-state fallback now matches the page's checked-roster effective state,
  with PHP and browser regressions. GitHub CI triggered but failed before any
  runner steps were assigned.

### 2026-09-24 — Codex Meridian: #573 advanced to independent review

- Identity prompt: existing native Bernoulli completed the #573 implementation
  and existing native Anscombe was selected for the independent review. No
  replacement child was created.
- Tools used: native `multi_agent_v1__wait_agent`, GitHub CLI, exact-handle
  `resume_agent`, and `send_input`, plus the required UTF-8 office reads. No
  wmux or external sidecar was used.
- Result: PR #582 is open against `integration/1.0.4-candidate` at
  `f53cb772a21763d98fd52d1e4fc3760dd4c31fd7`; issue #573 moved from In
  Progress/agent:bernoulli to Review/agent:anscombe. Anscombe was routed to
  independently review the fresh-match fallback and regression coverage. The
  hosted CI runner failure remains an evidence gap; no merge or deployment
  occurred.

### 2026-09-24 — Codex Meridian: #582 returned for explicit-empty correction

- Identity prompt: existing native Anscombe completed an independent review
  with request changes; existing native Bernoulli was reactivated. No
  replacement child was created.
- Tools used: native `multi_agent_v1__wait_agent`, GitHub CLI, exact-handle
  `resume_agent`, and `send_input`, plus the required UTF-8 office reads. No
  wmux or external sidecar was used.
- Result: Anscombe reproduced the second state bug: `empty($selected)` makes a
  persisted empty Players checklist look like absent metadata. Issue #573 was
  moved to In Progress/agent:bernoulli. Bernoulli was assigned an in-place
  correction on PR #582 with explicit absent-versus-empty regression coverage,
  preserving the existing branch and integration target. No merge or
  deployment occurred.

### 2026-09-24 — Codex Bernoulli: #582 explicit-empty correction complete

- Identity prompt: existing native Bernoulli child, `👽J♥️/AS/📎9♥️/AS/🔱3♣️`,
  q unknown; existing PR #582 and branch preserved.
- Tools used: PowerShell, Git, GitHub CLI, WSL2 LeagueOS Docker commands, and
  Playwright against disposable port 8211. Shared candidate 8209 remained
  untouched; no merge, deployment, force push, or shared-data mutation occurred.
- Result: verified remote head `f53cb772a21763d98fd52d1e4fc3760dd4c31fd7`,
  pushed a normal update to `1b21f159b39cc55b3b433a9889204b9e696d019f`, and
  validated absent prep as 7/7 choices versus explicit empty prep as 0/0.
  Browser coverage passed with four selectors and nine options each; #314 and
  PHP syntax/diff checks passed. PR CI remains runner-blocked: the integration
  job completed with no runner and zero steps.

### 2026-09-24 — Codex Meridian: #582 correction and DashBOrg review handoff

- Identity prompt: Bernoulli completed the explicit-empty correction and
  Galileo completed the DashBOrg in-place implementation. Existing native
  Anscombe and Nietzsche were selected for independent reviews; no replacement
  child was created.
- Tools used: native `multi_agent_v1__wait_agent`, GitHub CLI, exact-handle
  `resume_agent`, and `send_input`, plus the required UTF-8 office reads. No
  wmux or external sidecar was used.
- Result: PR #582 now stands at `1b21f159b39cc55b3b433a9889204b9e696d019f`
  with absent-versus-explicit-empty coverage; issue #573 moved to
  Review/agent:anscombe. DashBOrg PR #1 now stands at
  `7ee82beb2d68b57810bb7421ec317a2093241b85` and moved from
  agent:galileo to agent:nietzsche for review. No merge or deployment
  occurred; hosted LeagueOS CI remains runner-blocked.

### 2026-09-24 — Codex Meridian: tape-closet discovery and branch hygiene

- Identity prompt: Codex Desktop Meridian turn handling the user's request to
  locate Blue-team Claude tapes, extend `sesh-hound` to nested tape closets,
  dogfood without replacing the installed tool, and establish an isolated
  `LeagueOS_Red` clone. No native child was created or substituted.
- Tools used: local-agent-discovery skill, PowerShell `exec_command`, Git,
  GitHub CLI, `apply_patch`, WSL2 `wsl.exe`, and Codex artifact attachment.
  No wmux, `create_thread`, or external agent sidecar was used.
- Result: recent Blue parent tapes `6492b875...` and `b879e881...`, plus
  Nietzsche `650cbd82...` and Bernoulli `e3f448f2...`, were read through
  discovery metadata and bounded tape tails. A fresh branch
  `codex/sesh-hound/tape-closets` was created from the existing native
  discovery branch, pushed, and opened as stacked PR #17 on top of PR #16.
  The branch adds bounded Claude tape-closet depth, duplicate-UUID provenance,
  tests, and Windows/Linux CI; both CI jobs passed. Dogfood found 164 unique
  PFM records and retained all four Blue IDs. `LeagueOS_Red` was imported from
  the completed 4.8 GB export, its cloned containers were stopped, and its
  staging/candidate git worktrees were verified without modifying Blue.

### 2026-09-24 — Codex Meridian heartbeat: sprint and long-tail reconciliation

- Identity prompt: Codex Desktop Meridian heartbeat stewarding LeagueOS 1.0.4
  and the authorized longitudinal backlog; four native child handles were
  present in the environment context. No replacement child was created.
- Tools used: PowerShell `exec_command`, GitHub CLI, and `apply_patch`; no
  wmux, external sidecar, or sibling task was used.
- Result: reconciled current GitHub state. LeagueOS PR #582 has a substantive
  Anscombe approval comment on head `1b21f159...`, but its five hosted jobs
  terminated before any steps with no runner, so it remains held as an
  infrastructure blocker; no merge or deployment was attempted. Long-tail PPL
  PR #88 remains clean but unreviewed and explicitly human-gated, so that
  deferred audit is carried forward. sesh-hound PR #17 remains green on both
  Windows and Linux.

### 2026-09-24 — Codex Meridian heartbeat: no state delta

- Identity prompt: Codex Desktop Meridian heartbeat stewarding LeagueOS and
  the bounded long-tail rotation; native child handles and lane ownership were
  treated as authoritative, with no replacement child created.
- Tools used: PowerShell `exec_command`; no wmux, external sidecar, sibling
  task, or remote staging action was used.
- Result: reread the required instruction and authorization files and checked
  the carried-forward GitHub items. PR #582 remains held by runner provisioning
  failure despite substantive approval evidence; PPL PR #88 remains clean,
  unreviewed, and human-gated. No merge, deployment, or other material state
  change occurred.

### 2026-09-24 — Codex Meridian heartbeat: child completions reconciled

- Identity prompt: Codex Desktop Meridian heartbeat stewarding the LeagueOS
  sprint and bounded long-tail rotation; existing native child handles were
  reused and no replacement child was created.
- Tools used: native `multi_agent_v1` completion wait, PowerShell
  `exec_command` with GitHub CLI, and `apply_patch`; no wmux, sidecar, sibling
  task, merge, or deployment was used.
- Result: Bernoulli corrected PR #582 in place to head
  `1b21f159...d019f`; Anscombe supplied a new substantive approval comment,
  while hosted CI remains runner-provisioning-blocked with zero executed steps.
  Galileo delivered the in-place correction for DashBOrg-of/LeagueOS PR #1 at
  `7ee82beb...`, and Nietzsche's independent review identified two blocking
  validation gaps and posted request-changes. PR #1 remains open and unmerged.
  The previously deferred PPL PR #88 audit remains carried forward.

### 2026-09-24 — Codex Red runtime isolation and contract repair

- Identity prompt: Codex Desktop working as the Red runtime steward; team
  identity is color-qualified, so `Bernoulli_red`, `Nietzsche_red`,
  `Anscombe_red`, and `Galileo_red` were treated as distinct from Blue
  counterparts. The four existing native child handles were reused; no
  replacement child, wmux session, or sibling task was created.
- Tools used: native `multi_agent_v1` delegation/waits, PowerShell
  `exec_command`, WSL/Docker inspection, `apply_patch`, and no wmux or remote
  staging action.
- Result: Bernoulli_red and Nietzsche_red independently identified the Red
  daemon failure as a cloned Docker-root/network collision, not an application
  container restart. Red was moved to `/var/lib/docker-red` with a unique
  `docker0-red` bridge and non-overlapping address pool; the legacy imported
  Docker root was preserved. Four Red Compose projects were started with eight
  containers on 8307--8310, native source mounts, and separate named volumes.
  Red staging/candidate were aligned to the exact Blue-served SHAs via a
  temporary verified Git bundle, then given Red-qualified local branches. Blue
  remained on its existing eight-container grid throughout. `AGENTS.md` and
  `LOCAL-CONTAINER-CONTRACT.md` now document the shared-namespace failure,
  bootstrap, identity suffix/prefix rules, and fail-closed verification.

- Follow-up runtime repair: Red now has a systemd `docker-red-bridge.service`
  prerequisite wired to `docker.service`. A controlled stop, bridge removal,
  and start recreated `docker0-red`, restored Docker, and brought back all
  eight Red containers with healthy MariaDB services; no Blue container state
  changed.
