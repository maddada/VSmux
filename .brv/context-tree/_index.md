---
children_hash: 7c9d878138d99badbd566b1908b96c097de0f3c194f9a5cc64a54d85d783438d
compression_ratio: 0.3859266754884409
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 12847
summary_level: d3
token_count: 4958
type: summary
---

# Structural Summary

This level combines three child entries into a compact map of VSmux’s architecture and quick-recall invariants:

- `architecture/_index.md` — long-form architectural overview across conversation viewer, git text generation, releases, and terminal workspace
- `facts/_index.md` — condensed implementation facts, constants, settings, and capability matrices
- `terminal-workspace-current-state.md` — current authoritative statement of terminal workspace behavior and runtime goals

## Top-level system shape

VSmux is organized around a **webview + extension-host split** with a **detached per-workspace daemon** for terminal continuity. The largest subsystem is `terminal_workspace`, supported by:

- `chat_history` / `VSmux Search` for conversation inspection and resume flows
- `git_text_generation` for provider-backed commit/PR/title generation
- `releases` for packaged product snapshots and publishing constraints

Cross-cutting decisions repeated across the entries:

- webviews often use `retainContextWhenHidden: false`
- terminal continuity depends on daemon lifetime, not webview lifetime
- session UX favors **normalized visible titles** while preserving raw/live title state for activity logic
- grouped session state, sidebar ordering, and workspace pane projection are treated as first-class architecture, not incidental UI

## 1. Terminal workspace: core runtime and current state

Primary drill-down:

- `architecture/terminal_workspace/_index.md`
- `terminal-workspace-current-state.md`
- facts companions such as `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`

### Runtime model

The workspace renderer is **Restty**, not xterm. Frontend runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`, with generation-based invalidation via `renderNonce`. This ensures a stable frontend runtime/transport pair per session and prevents old transcript reuse when a `sessionId` is recycled.

Key implementation files repeatedly referenced:

- `workspace/terminal-runtime-cache.ts`
- `workspace/terminal-pane.tsx`
- `workspace/workspace-app.tsx`
- `extension/native-terminal-workspace/workspace-pane-session-projection.ts`
- `extension/daemon-terminal-workspace-backend.ts`

### Pane projection and visibility model

The workspace projects sessions from **all groups**, not just the active one, so cross-group switching keeps terminals warm. Inactive panes remain mounted behind the active pane in the same layout slot, with active/hidden behavior managed by stacking and pointer suppression rather than teardown/recreate.

Important invariants:

- visible split order comes from `activeGroup.snapshot.visibleSessionIds`
- `localPaneOrder` is only a temporary visible-set override
- hidden panes should avoid size churn and reflow
- switching active panes inside a split should preserve passive pane slot stability

### Focus ownership

Focus is centralized:

- `TerminalPane` emits activation intent
- `WorkspaceApp` owns actual focus state and decides whether to send `focusSession`

This separation is reinforced in both `architecture/_index.md` and `terminal-workspace-current-state.md` as a deliberate architectural rule.

### Startup and bootstrap

Workspace startup reveals the sidebar first, creates a session if needed, then reveals the panel. Bootstrap payload is embedded as `window.__VSMUX_WORKSPACE_BOOTSTRAP__`, with replay ordered as:

1. latest renderable state (`hydrate` / `sessionState`)
2. transient message if distinct

One-shot focus payloads such as `autoFocusRequest` are stripped or deduplicated carefully so reload/bootstrap restores state without replaying stale intent.

### Lag recovery

`terminal-workspace-current-state.md` sharpens the current live behavior:

- lag detection currently runs only when `debuggingMode` is enabled
- it uses `terminal.schedulerWindow` during the first 10 seconds after workarea boot
- average overshoot threshold is `1000ms`
- `AUTO_RELOAD_ON_LAG` is enabled
- reload is limited to once per boot
- focus is preserved by carrying the active `sessionId` through `reloadWorkspacePanel`

This is a current-state refinement of the broader lag-recovery notes summarized in `architecture/_index.md` and `facts/_index.md`.

## 2. Persistence, daemon lifecycle, and reattach semantics

Primary drill-down:

- `terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `terminal_workspace/terminal_persistence_across_reloads.md`
- facts: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`

### Persistence stack

The persistence architecture is consistently described as a three-part model:

1. `SessionGridStore` workspace state
2. detached per-workspace Node.js daemon
3. restored webview with cached Restty runtimes

Stable identifiers and files:

- workspace snapshot key: `VSmux.sessionGridSnapshot`
- daemon state prefix: `terminal-daemon-${workspaceId}`
- files:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`

### Timeouts and protocol constants

Recurring operational constants include:

- control connect: `3000ms`
- daemon ready: `10000ms`
- owner heartbeat: `5000ms`
- owner heartbeat timeout: `20000ms`
- startup grace: `30000ms`
- attach ready: `15000ms`
- replay history cap: `8 MiB`
- replay chunk size: `128 KiB`

The daemon exposes token-authenticated `/control` and `/session` WebSocket endpoints, and response-bearing requests must include `requestId`.

### Reattach vs resume

`terminal-workspace-current-state.md` explicitly calls out the contract:

- `createOrAttach` returns `didCreateSession`
- if a live daemon PTY exists, VSmux must **reattach**
- resume commands run only when a backend terminal was actually recreated

This distinction is one of the most important behavioral invariants preserved across the summaries.

### Daemon ownership rule

The daemon is **per workspace**, not global. Sidebar-listed sessions should remain alive while VS Code is running even if the VSmux sidebar or workarea closes. Persisted terminal presentation state retains `agentName`, `agentStatus`, and `title` so the sidebar can show meaningful metadata on cold start even without a live daemon.

## 3. Grouped state, sleep/wake, sidebar ordering, and DnD

Primary drill-down:

- `simple_grouped_session_workspace_state.md`
- `workspace_session_sleep_wake_support.md`
- `sidebar_active_sessions_sort_mode.md`
- `sidebar_drag_indicators_explicit_dnd_drop_targets.md`
- `sidebar_drag_reorder_recovery.md`

### Grouped state model

Normalization rules from architecture and facts align:

- at least one group always exists
- browser sessions are removed during normalization
- canonical IDs use `session-${formatSessionDisplayId(displayId ?? 0)}`
- duplicate display IDs are repaired
- empty groups are preserved after last-session removal
- active-group fallback prefers nearest previous populated group

### Sleep/wake semantics

Sleeping sessions persist `isSleeping` and are excluded from focus and visible split calculations. Focusing a sleeping session wakes it. Sleep disposes live terminal surfaces while preserving resume/card metadata.

### Sorting model

Sidebar sort modes are:

- `manual`
- `lastActivity`

Critical invariant: **group order remains manual in all sort modes**. In `lastActivity`, only sessions within a group reorder by `lastInteractionAt`, with missing timestamps treated as `0`. DnD reorder is disabled outside manual mode.

### Drag/drop architecture

The authoritative reorder path uses explicit drop targets and message contracts:

- message types:
  - `syncSessionOrder`
  - `moveSessionToGroup`
  - `syncGroupOrder`
- target shapes:
  - session `before` / `after`
  - group `start` / `end`

Important thresholds and protections:

- startup interaction block: `1500ms`
- pointer reorder threshold: `8px`
- pointer drag activation: distance `6`
- touch activation: `250ms`, tolerance `5`
- session-card hold delay: `130ms`, tolerance `12px`

`terminal-workspace-current-state.md` adds the user-facing safety rule: ordinary clicking must not mutate order; reorder requires real pointer movement from the original interaction target.

### Recovery/debugging

Recovery logic sanitizes duplicate/unknown IDs, restores omitted sessions, and emits `session.dragRecoveredOmittedSessions` in debug mode. Logging is gated by `VSmux.debuggingMode` and mirrored to `VSmux Debug` output plus `~/Desktop/vsmux-debug.log`.

## 4. Titles, activity, rename summarization, and session actions

Primary drill-down:

- `terminal_title_normalization_and_session_actions.md`
- `title_activity_and_sidebar_runtime.md`
- `session_rename_title_auto_summarization.md`
- facts companions for rename/fork/full reload/default commands

### Title normalization

The canonical sanitizer is `normalizeTerminalTitle()`. It strips leading glyph/status markers and hides normalized titles beginning with `~` or `/`. Persistence stores normalized titles, while raw `liveTitle` stays in memory for activity derivation.

Regex preserved in facts:

- `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`

### Activity/timestamp model

Visible title precedence:

1. manual title
2. terminal title
3. alias

Timestamp UI buckets:

- `0–15m` bright green
- `15–30m` faded green
- `30–60m` muted green
- `1h+` gray

Compact display uses value-only strings like `5m`, `3h`, with per-second refresh.

Agent-specific activity glyph/state rules are preserved in `architecture/_index.md` for Claude, Codex, Gemini, and Copilot, including the “working stops if glyphs stop changing for 3 seconds” logic and the `1000ms` completion sound delay.

### Rename summarization

Summarization applies only when trimmed title length exceeds `25`.

Key constants:

- `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
- `GENERATED_SESSION_TITLE_MAX_LENGTH = 24`

Prompt/output rules: plain text, no quotes/markdown/commentary, generally 2–4 words. This ties directly to `git_text_generation` provider infrastructure.

### Session action capability matrix

Agent command/settings entry points:

- `VSmux.defaultAgentCommands`
- built-in keys: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`

Capabilities:

- resume/copy-resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- fork/full reload: `codex`, `claude`
- browser sessions cannot rename, fork, copy resume, or full reload

Command forms preserved:

- Codex resume: `<command> resume '<title>'`
- Claude resume: `<command> -r '<title>'`
- Codex fork: `<command> fork '<title>'`
- Claude fork: `<command> --fork-session -r '<title>'`

Fork behavior inserts a sibling session immediately after the source in the same group, reuses metadata, and schedules delayed rename via `/rename fork <preferred title>` after `4000ms`. Group full reload is group-visible but execution only applies to sessions supporting `getFullReloadResumeCommand`, with partial success allowed.

## 5. Chat history / VSmux Search / AI DevTools

Primary drill-down:

- `chat_history/_index.md`
- `viewer_search_and_resume_actions.md`
- `vsmux_search_rename.md`
- `vsmux_ai_devtools_integration.md`

### Viewer structure and behavior

Conversation viewer architecture spans:

- `chat-history/src/webview/App.tsx`
- `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- `chat-history/src/extension/extension.ts`
- `chat-history/src/extension/SidebarViewProvider.ts`

Conversation files are parsed from JSONL; invalid lines become `x-error` records.

Search is intentionally lightweight:

- `Cmd/Ctrl+F` opens custom bar
- actual matching uses `window.find`
- `Enter` / `Shift+Enter` navigate
- `Escape` closes

### Resume contract

Resume uses message `resumeSession` with payload `{ source, sessionId, cwd? }`. Source inference maps:

- `/.codex/`, `/.codex-profiles/` → `Codex`
- `/.claude/`, `/.claude-profiles/` → `Claude`

Resume commands:

- `claude --resume <sessionId>`
- `codex resume <sessionId>`

Resume terminals are named `AI DevTools Resume (<source>)`.

### Rename/packaging identity

`VSmux Search` metadata preserved across architecture and facts:

- command namespace: `VSmuxSearch.*`
- view ID: `VSmuxSearch.conversations`
- panel type: `vsmuxSearchViewer`
- package: `vsmux-search-vscode`
- publisher: `vsmux-search`
- export prefix/pattern: `vsmux-search-export-` / `vsmux-search-export-${sessionId}.md`

### AI DevTools integration

VSmux remains the single shipped extension host. It registers `aiDevtools.conversations` under `VSmuxSessions`, packages `chat-history/dist` and `chat-history/media`, and activates in this order:

1. `initializeVSmuxDebugLog`
2. `activateChatHistory`
3. construct `NativeTerminalWorkspaceController`

`ai-devtools.suspend` disposes viewer state/cache to release memory.

## 6. Git text generation

Primary drill-down:

- `git_text_generation/_index.md`
- `low_effort_provider_settings.md`
- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`

### Execution pipeline

The pipeline is stable and explicit:

1. build prompt
2. append output instructions
3. build provider shell command
4. execute command
5. read stdout or temp file
6. parse/sanitize
7. return commit message / PR content / session title

Custom commands support placeholders:

- `{outputFile}`
- `{prompt}`

If `{prompt}` is omitted, the quoted prompt is appended automatically.

### Provider defaults and settings

Setting surface:

- `VSmux.gitTextGenerationProvider`
- supported values: `codex`, `claude`, `custom`
- deprecated: `VSmux.gitTextGenerationAgentId`

Default provider is `codex`. As of the low-effort update, built-in providers use:

- Codex: `gpt-5.4-mini` with `model_reasoning_effort="low"`
- Claude: `haiku` with `--effort low`

Timeout is `180000ms`.

### Parsing and validation rules

Preserved regex/patterns:

- conventional commit subject:
  `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch-path extraction:
  `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  `^[a-z0-9._-]+$`

Behavioral invariants:

- empty output is fatal
- non-zero exits are wrapped as provider-specific errors
- session titles are length-clamped and linked to rename summarization constraints

## 7. T3/browser integration and Agent Manager X bridge

Primary drill-down:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`

### T3/browser integration

Important integration facts:

- browser group id: `browser-tabs`
- internal VSmux/T3 tabs are excluded from discovery
- restored workspace panel identity:
  - type `vsmux.workspace`
  - title `VSmux`
  - icon `media/icon.svg`

Managed runtime and websocket details:

- runtime endpoint `127.0.0.1:3774`
- legacy endpoint `127.0.0.1:3773`
- websocket URL `ws://127.0.0.1:3774/ws`
- snapshot RPC `orchestration.getSnapshot`
- subscription `subscribeOrchestrationDomainEvents`
- request timeout `15000ms`
- reconnect delay `1500ms`
- refresh debounce `100ms`
- request IDs must match `^\d+$`

Runtime source/build anchors:

- `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- `scripts/build-t3-embed.mjs`

### Agent Manager X bridge

Bridge client lives in `extension/agent-manager-x-bridge.ts`, connected from `NativeTerminalWorkspaceController`.

Preserved protocol details:

- broker URL: `ws://127.0.0.1:47652/vsmux`
- outbound: normalized `workspaceSnapshot`
- inbound: `focusSession`
- handshake timeout: `3000ms`
- reconnect backoff: `1000ms` doubling to `5000ms`
- `perMessageDeflate` disabled
- duplicate snapshots suppressed by serialized-payload comparison
- snapshots are memory-only, not persisted

The newer focus path avoids forced sidebar rehydration: `focusSessionFromAgentManagerX` focuses the target session directly.

## 8. Releases, packaging, and product surface

Primary drill-down:

- `releases/_index.md`
- `releases/vsmux_2_7_0_release.md`
- `vsmux_packaging_and_embed_validation_facts.md`
- `vsmux_2_7_0_release_facts.md`

### Release layer role

The release topic packages architectural decisions into shipped product behavior. `VSmux 2.7.0` is the main recorded snapshot.

Release metadata:

- version `2.7.0`
- release date `2026-04-07`

Referenced files:

- `package.json`
- `CHANGELOG.md`
- `README.md`
- `scripts/publish-extension.mjs`
- `docs/2026-04-03-how-to-update-t3-code.md`
- `patches/restty@0.1.35.patch`

### Main shipped themes

`2.7.0` bundles:

- built-in `VSmux Search`
- terminal workspace/sidebar polish
- runtime reliability and focus recovery
- T3 clipboard/embed improvements
- default agent command overrides
- activity/timestamp and sorting improvements

### Publish workflow and constraints

Release flow:

1. derive notes since `v2.6.0`
2. update `package.json`, `CHANGELOG.md`, `README.md`
3. ensure clean worktree and unique tag
4. run `pnpm run vsix:package`
5. publish with `scripts/publish-extension.mjs`
6. tag release
7. push with follow-tags
8. monitor Marketplace / Open VSX propagation

Hard guardrails:

- no uncommitted changes
- unique tag required
- cannot publish from detached `HEAD`

Marketplace note: Open VSX showed `2.7.0` immediately while VS Code Marketplace initially showed `2.6.0`, interpreted as propagation lag.

### Packaging facts

Important package metadata:

- display name: `VSmux - T3code & Agent CLIs Manager`
- publisher: `maddada`
- repository: `https://github.com/maddada/VSmux.git`
- main: `./out/extension/extension.js`
- icon: `media/VSmux-marketplace-icon.png`

Activation events include:

- `onStartupFinished`
- `onView:VSmux.sessions`
- `onWebviewPanel:vsmux.workspace`

Dependency/package constraints preserved in facts:

- `pnpm@10.14.0`
- VS Code engine `^1.100.0`
- `restty@0.1.35` patched by `patches/restty@0.1.35.patch`

Installed VSIX contents are treated as authoritative when debugging embed drift.

## Relationship map

- `terminal-workspace-current-state.md` is the most direct “current truth” for workspace runtime behavior and sharpens items summarized more broadly in `architecture/_index.md`.
- `facts/_index.md` acts as the fast-recall layer for constants, regexes, settings, message names, and capability matrices referenced by `architecture/_index.md`.
- `chat_history`, `git_text_generation`, T3/browser integration, and Agent Manager X bridge all plug into the terminal workspace platform rather than standing alone.
- `releases/_index.md` is the packaging/productization layer that records when architectural work became shipped behavior.

## Best drill-down path

For implementation detail, start with:

1. `terminal-workspace-current-state.md`
2. `architecture/terminal_workspace/_index.md`
3. `facts/project/_index.md`

Then drill into specific subtopics:

- search/resume: `chat_history/_index.md`
- provider commands: `git_text_generation/_index.md`
- persistence/daemon: `terminal_persistence_across_vs_code_reloads.md`
- sidebar/DnD/order: `sidebar_active_sessions_sort_mode.md`, `sidebar_drag_indicators_explicit_dnd_drop_targets.md`
- T3/browser/embed: `workspace_browser_t3_integration.md`
- release/package state: `releases/vsmux_2_7_0_release.md`

## Overall takeaway

At this level, the repository describes VSmux as a **daemon-backed, grouped-session terminal workspace platform** with:

- stable Restty runtime caching per `sessionId`
- explicit focus ownership in `WorkspaceApp`
- all-groups pane projection to keep sessions warm
- robust sidebar ordering and DnD safety rules
- normalized title/activity/timestamp semantics
- provider-backed git/session-title generation
- integrated conversation search/resume under `VSmux Search`
- T3 embed/runtime orchestration plus external `Agent Manager X` control
- a release layer that captures how these decisions ship as VSmux `2.7.0`
