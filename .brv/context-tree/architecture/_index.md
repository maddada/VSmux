---
children_hash: 13af65fc9a0c5e8a1178231c57e4307046ee40ef7e29a3bf32140e563d7fc14b
compression_ratio: 0.5296285520318107
condensation_order: 2
covers:
  [
    chat_history/_index.md,
    context.md,
    git_text_generation/_index.md,
    releases/_index.md,
    terminal_workspace/_index.md,
  ]
covers_token_total: 10311
summary_level: d2
token_count: 5461
type: summary
---

# architecture

Architectural knowledge for VSmux is organized into four main topics: `chat_history`, `git_text_generation`, `releases`, and `terminal_workspace`. Together they describe the shipped product surface, the terminal-workspace runtime model, integrated conversation viewing/search, provider-backed text generation, and release-time packaging/publishing constraints. The domain purpose in `context.md` frames this as the source of truth for terminal workspace frontend behavior, workspace projection logic, and backend daemon behavior.

## Topic map

- `chat_history/_index.md` — conversation viewer architecture, search/resume flow, and VSmux Search rename
- `git_text_generation/_index.md` — provider command construction, low-effort defaults, parsing/sanitization, and session-title generation constraints
- `releases/_index.md` — shipped release snapshots, especially `vsmux_2_7_0_release.md`
- `terminal_workspace/_index.md` — core runtime, persistence, focus, grouped state, sidebar ordering, activity/title handling, T3/browser integration, packaging, and Agent Manager X bridge

## Cross-cutting architectural patterns

Several decisions recur across the topic set:

- VSmux uses a **webview + extension-host split** for both workspace and conversation-viewer features.
- Hidden webview contexts are often intentionally **not retained**:
  - conversation viewer uses `retainContextWhenHidden: false` in `chat_history/_index.md`
  - workspace bootstrap/replay behavior also assumes explicit rehydration in `terminal_workspace/_index.md`
- Terminal session continuity relies on a **detached per-workspace daemon** rather than webview lifetime, documented in `terminal_workspace/_index.md`.
- Session-facing UX favors **normalized visible titles**, while raw/live titles are still preserved for activity derivation and runtime logic.
- Product features are increasingly surfaced through a single extension/package identity, with `releases/_index.md` showing how `VSmux Search`, terminal workspace, AI DevTools integration, and git text generation all ship together.

## 1. Conversation viewer and VSmux Search

`chat_history/_index.md` defines the conversation-inspection architecture.

### Core structure

- Webview UI:
  - `chat-history/src/webview/App.tsx`
  - `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- Extension host:
  - `chat-history/src/extension/extension.ts`
  - `chat-history/src/extension/SidebarViewProvider.ts`
- Export branding:
  - `chat-history/src/webview/lib/export-utils.ts`

### Main behaviors

- Conversation files are loaded from JSONL, parsed, and normalized; parse failures become `x-error` records.
- Search is intentionally lightweight and browser-native:
  - uses `window.find`
  - `Cmd/Ctrl+F` opens the custom bar
  - `Enter` / `Shift+Enter` navigate results
  - `Escape` closes
- Resume behavior is a strict contract between webview and extension:
  - message: `resumeSession`
  - payload includes `source`, `sessionId`, optional `cwd`
- Source inference rules:
  - `/.codex/`, `/.codex-profiles/` → `Codex`
  - `/.claude/`, `/.claude-profiles/` → `Claude`
- Resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Terminal naming for resumed sessions:
  - `AI DevTools Resume (<source>)`

### Rename and packaging

`vsmux_search_rename` is summarized inside `chat_history/_index.md`:

- command namespace: `VSmuxSearch.*`
- view ID: `VSmuxSearch.conversations`
- activation event: `onView:VSmuxSearch.conversations`
- viewer panel type: `vsmuxSearchViewer`
- package metadata includes:
  - package name `vsmux-search-vscode`
  - display name `VSmux Search`
  - publisher `vsmux-search`
  - version `1.1.0`
- export filename pattern:
  - `vsmux-search-export-${sessionId}.md`

### Relationships

- `chat_history` depends on broader runtime availability from `terminal_workspace/current_state.md` and `terminal_workspace/workspace_browser_t3_integration.md`.
- `terminal_workspace/vsmux_ai_devtools_integration.md` shows these conversation tools are shipped within the main VSmux extension host.

## 2. Git text generation architecture

`git_text_generation/_index.md` covers provider-backed generation of commit messages, PR content, and session titles.

### Core implementation

- `extension/git/text-generation-utils.ts` — provider command construction, shell-safe handling, parsing helpers
- `extension/git/text-generation.ts` — prompt assembly, execution, result handling
- `extension/git/text-generation.test.ts` — tested constraints and parsing rules
- `package.json` — provider settings surface

### Execution flow

The stable pipeline is:

1. build prompt
2. append output instructions
3. build provider shell command
4. execute shell command
5. read temp-file output or stdout
6. parse and sanitize
7. return commit message / PR content / session title

Custom commands support:

- `{outputFile}`
- `{prompt}`

If `{prompt}` is missing, the quoted prompt is appended automatically.

### Provider decisions

From `low_effort_provider_settings` via the summary:

- built-in providers are pinned to **low-effort** behavior as of `2026-04-06`
- default provider:
  - `VSmux.gitTextGenerationProvider = codex`
- Codex command shape:
  - `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
- Claude command shape:
  - `exec claude --model haiku --effort low -p ...`
- timeout:
  - `180000 ms`

### Parsing and constraints

Important preserved rules:

- conventional commit subject regex:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch-path extraction:
  - `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  - `^[a-z0-9._-]+$`

Behavioral constraints:

- empty outputs are fatal
- non-zero exits are wrapped with provider-specific errors
- session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tested session-title behavior stays under 25 characters

### Relationships

- This topic intersects directly with `terminal_workspace/session_rename_title_auto_summarization.md`, where generated title length and sanitization are enforced at the workspace/session layer.
- `releases/_index.md` records the migration from deprecated `VSmux.gitTextGenerationAgentId` to:
  - `VSmux.gitTextGenerationProvider`
  - `VSmux.gitTextGenerationCustomCommand`

## 3. Release-history layer

`releases/_index.md` is the productized snapshot layer for architecture and packaging, with `vsmux_2_7_0_release.md` as the main recorded entry.

### VSmux 2.7.0

- version: `2.7.0`
- release date: `2026-04-07`

Referenced release files:

- `package.json`
- `CHANGELOG.md`
- `README.md`
- `scripts/publish-extension.mjs`
- `docs/2026-04-03-how-to-update-t3-code.md`
- `patches/restty@0.1.35.patch`

### Main shipped themes

The release bundles:

- built-in `VSmux Search`
- terminal workspace/sidebar polish
- runtime reliability and focus recovery
- T3 clipboard and embedded-runtime improvements
- default agent command overrides
- activity/timestamp and sorting improvements

### Publish workflow and constraints

Explicit flow:

1. derive notes since `v2.6.0`
2. update `package.json`, `CHANGELOG.md`, `README.md`
3. ensure clean worktree and unique tag
4. run `pnpm run vsix:package`
5. publish with `scripts/publish-extension.mjs`
6. tag release
7. push with follow-tags
8. monitor Marketplace/Open VSX propagation

Hard guardrails preserved:

- no uncommitted changes
- tag must not already exist
- cannot publish from detached `HEAD`

Distribution note:

- Open VSX showed `2.7.0` immediately
- VS Code Marketplace initially still showed `2.6.0`
- interpreted as propagation lag, not failure

### Relationships

This release summary ties together architecture entries including:

- `chat_history/viewer_search_and_resume_actions.md`
- `terminal_workspace/current_state.md`
- `terminal_workspace/default_agent_commands_overrides.md`
- `terminal_workspace/sidebar_active_sessions_sort_mode.md`
- `terminal_workspace/sidebar_session_card_last_interaction_timestamps.md`
- `terminal_workspace/vsmux_ai_devtools_integration.md`

## 4. Terminal workspace architecture

`terminal_workspace/_index.md` is the central runtime topic and the densest architectural layer.

### 4.1 Runtime model and rendering

Anchor entries:

- `current_state.md`
- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `restty_terminal_font_probing_defaults.md`

Key decisions:

- **Restty** is the renderer.
- Runtime cache keys are stable per `sessionId`.
- Hidden panes remain mounted/painted.
- Workspace projects sessions from all groups, not just visible panes.
- Backend daemon is per-workspace and can fall back to persisted disconnected-session state.

Core files:

- `workspace/terminal-runtime-cache.ts`
- `workspace/terminal-pane.tsx`
- `workspace/workspace-app.tsx`
- `extension/native-terminal-workspace/workspace-pane-session-projection.ts`
- `extension/daemon-terminal-workspace-backend.ts`

Thresholds and behaviors:

- stable size resolution: up to 20 attempts, needs 2 identical measurements
- typing auto-scroll: 4 printable keypresses within 450ms
- scroll-to-bottom hysteresis: show after 200px, hide below 40px
- scheduler lag warning thresholds are explicitly tracked

Font behavior:

- bundled stack includes `MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New`
- bundled-default families use Meslo fallback URL source only
- custom families like `"Fira Code"` still allow local probing

### 4.2 Focus ownership and startup

Entries:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging.md`
- `workspace_sidebar_interaction_state.md`
- `workspace_panel_startup_without_placeholder.md`
- `workspace_panel_startup_without_loading_placeholder.md`
- `workspace_panel_focus_hotkeys.md`

Core focus model:

- `TerminalPane` emits focus/activation intent only
- `WorkspaceApp` owns actual focus state
- visible pane order comes from active-group `visibleSessionIds`
- `localPaneOrder` is only a temporary visible-set override
- auto-focus guard: 400ms

Startup/bootstrap:

- sidebar is revealed first
- if no sessions exist, one is created before panel reveal
- bootstrap state is embedded as `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- replay order is renderable state first, then transient messages
- one-shot `autoFocusRequest` fields are stripped before replay

Focus hotkeys:

- context key: `vsmux.workspacePanelFocus`
- non-directional workspace/session/layout hotkeys allow `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`

### 4.3 Persistence, daemon lifecycle, and reload recovery

Entries:

- `terminal_persistence_across_vs_code_reloads.md`
- `terminal_persistence_across_reloads.md`

Three-part persistence architecture:

1. `SessionGridStore` workspace state
2. detached per-workspace Node.js daemon
3. restored webview with cached Restty runtimes

Important persistence facts:

- workspace snapshot key: `VSmux.sessionGridSnapshot`
- daemon files:
  - `daemon-info.json`
  - `daemon-launch.lock`
- PTYs survive reload because they live in the daemon

Reattach flow:

- `terminalReady` handshake
- replay ring buffer
- flush pending attach queue
- promote to live attachment

Key timeouts and caps:

- control connect: 3000ms
- daemon ready: 10000ms
- owner heartbeat: 5000ms
- owner heartbeat timeout: 20000ms
- startup grace: 30000ms
- attach ready: 15000ms
- replay history cap: 8 MiB
- replay chunk size: 128 KiB

Cache semantics:

- `releaseCachedTerminalRuntime()` detaches without full destruction
- `destroyCachedTerminalRuntime()` fully destroys transport, Restty, and cache entry

### 4.4 Grouped workspace state and sleep/wake

Entries:

- `simple_grouped_session_workspace_state.md`
- `workspace_session_sleep_wake_support.md`
- `sidebar_drag_reorder_large_group_preservation.md`

State model decisions:

- normalization guarantees at least one group
- browser sessions are dropped during normalization
- session IDs canonicalize from display IDs like:
  - `session-${formatSessionDisplayId(displayId ?? 0)}`
- duplicate display IDs are repaired
- empty groups are preserved when their last session is removed
- fallback active-group selection prefers nearest previous non-empty group

Sleep/wake extensions:

- sessions persist `isSleeping`
- sleeping sessions are excluded from focus and visible-split calculations
- focusing a sleeping session wakes it
- sleeping disposes terminal surfaces but preserves resume metadata

Large-group reorder preservation:

- same-group reorder bypasses old 9-slot grid normalization
- groups larger than 9 sessions are preserved intact
- helper lives in `shared/session-order-reorder.ts`

### 4.5 Sidebar ordering, DnD, and interaction model

Entries:

- `sidebar_active_sessions_sort_mode.md`
- `sidebar_active_sessions_sort_mode_persistence.md`
- `sidebar_active_sessions_sort_toggle_group_ordering.md`
- `sidebar_drag_indicators_explicit_dnd_drop_targets.md`
- `sidebar_drag_reorder_recovery.md`
- `sidebar_drag_reorder_debug_logging.md`
- `workspace_debug_console_suppression.md`
- `sidebar_browsers_empty_state.md`
- `sidebar_double_click_session_creation_setting.md`

Sort behavior:

- sort modes: `manual`, `lastActivity`
- persisted per workspace
- groups remain manually ordered even in activity sort mode
- only sessions within a group reorder by `lastInteractionAt`
- missing timestamps become `0`
- DnD reorder is disabled outside manual mode

Drag/drop architecture:

- explicit before/after drop surfaces on session cards
- empty groups expose group-start drop targets
- fallback DOM point resolution remains as backup
- messages:
  - `syncSessionOrder`
  - `moveSessionToGroup`
  - `syncGroupOrder`

Thresholds:

- startup interaction block: 1500ms
- pointer reorder threshold: 8px
- touch drag activation: 250ms delay, tolerance 5
- pointer drag activation: distance 6
- per-session hold delay: 130ms, tolerance 12px

Recovery and debugging:

- unknown/duplicate IDs are sanitized out
- omitted authoritative sessions are appended back to original group tail
- recovery debug event: `session.dragRecoveredOmittedSessions`
- debug logging gated by `VSmux.debuggingMode`
- mirrored to `VSmux Debug` output and `~/Desktop/vsmux-debug.log`

Related UX details:

- browser empty groups no longer render `.group-sessions`
- double-click empty-space session creation is controlled by `VSmux.createSessionOnSidebarDoubleClick` and defaults to `false`

### 4.6 Titles, activity, timestamps, and sounds

Entries:

- `sidebar_session_card_last_interaction_timestamps.md`
- `sidebar_session_card_timestamp_compact_display.md`
- `terminal_title_normalization_and_session_actions.md`
- `title_activity_and_sidebar_runtime.md`
- `terminal_titles_activity_and_completion_sounds.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `session_rename_title_auto_summarization.md`

Timestamp UX:

- age buckets:
  - 0–15 min bright green
  - 15–30 min faded green
  - 30–60 min muted green
  - 1h+ gray
- labels update every second
- compact display renders only `formatRelativeTime(...).value` like `3h`, `5m`

Title normalization:

- canonical sanitizer: `normalizeTerminalTitle()`
- strips leading glyphs/status markers
- hides normalized titles starting with `~` or `/`
- persistence stores normalized titles, not raw daemon titles
- UI prefers normalized terminal title over user-entered session title
- raw `liveTitle` stays in memory for activity logic

Activity model:

- visible title precedence:
  1. manual title
  2. terminal title
  3. alias
- agent-specific glyph/state rules:
  - Claude working `⠐ ⠂ ·`, idle `✳ *`
  - Codex spinner `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini working `✦`, idle `◇`
  - Copilot working `🤖`, idle-attention `🔔`
- Claude/Codex stop counting as working if glyphs stop changing for 3 seconds
- attention requires at least 3 seconds of prior working
- completion sound delay: 1000ms
- sounds are embedded data URLs played via `AudioContext`

Rename summarization:

- only titles with trimmed length `> 25` are summarized
- short titles are returned unchanged
- generated max output length: 24
- prompt requires plain text, no quotes/markdown/commentary, prefer 2–4 words

### 4.7 Session actions, commands, fork/reload

Entries:

- `default_agent_commands_overrides.md`
- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `sidebar_group_full_reload.md`

Agent command override surface:

- setting: `VSmux.defaultAgentCommands`
- built-in ids:
  - `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- trimmed empty values become `null`
- stored explicit custom commands remain authoritative

Fork/resume/reload rules:

- fork only for Codex and Claude sessions
- full reload only for Codex and Claude
- copy-resume supports `codex`, `claude`, `copilot`, `gemini`, `opencode`
- browser sessions cannot rename, fork, copy resume, or full reload

Command forms:

- Codex resume: `<command> resume '<title>'`
- Claude resume: `<command> -r '<title>'`
- Codex fork: `<command> fork '<title>'`
- Claude fork: `<command> --fork-session -r '<title>'`

Fork behavior:

- sibling session inserted immediately after source in same group
- icon and launch metadata reused
- delayed rename after 4000ms
- delayed command: `/rename fork <preferred title>`

Group full reload:

- available for any non-browser group containing sessions
- executes only for sessions that can produce `getFullReloadResumeCommand`
- mixed-support groups are allowed with partial-success reporting

### 4.8 Browser/T3 integration and packaging

Entries:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_ai_devtools_integration.md`

Browser/T3 integration:

- browser group id: `browser-tabs`
- internal VSmux workspace and T3-owned tabs are excluded from browser discovery
- restored workspace panel is standardized as:
  - type `vsmux.workspace`
  - title `VSmux`
  - icon `media/icon.svg`

T3 runtime:

- websocket URL: `ws://127.0.0.1:3774/ws`
- snapshot RPC: `orchestration.getSnapshot`
- event subscription: `subscribeOrchestrationDomainEvents`
- request timeout: 15000ms
- reconnect delay: 1500ms
- refresh debounce: 100ms

Managed runtime recovery:

- vendored entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- managed runtime uses `127.0.0.1:3774`
- legacy runtime remains `127.0.0.1:3773`
- websocket route must be `/ws`
- RPC request IDs must match `^\d+$`
- ping/pong and Chunk/Ack/Exit streaming semantics are required
- build script: `scripts/build-t3-embed.mjs`

VSIX validation:

- package/install script: `scripts/vsix.mjs`
- modes: `package`, `install`
- optional flag: `--profile-build`
- installed asset hash under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js` should be verified before debugging webview issues

AI DevTools integration:

- VSmux remains the single extension host
- registers `aiDevtools.conversations` under `VSmuxSessions`
- packaged assets include `chat-history/dist` and `chat-history/media`
- activation order:
  1. `initializeVSmuxDebugLog`
  2. `activateChatHistory`
  3. construct `NativeTerminalWorkspaceController`
- `ai-devtools.suspend` releases memory by disposing viewer state and cache

### 4.9 Agent Manager X bridge

Entries:

- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`

Bridge architecture:

- client file: `extension/agent-manager-x-bridge.ts`
- connected from `NativeTerminalWorkspaceController`
- endpoint: `ws://127.0.0.1:47652/vsmux`
- outbound messages: normalized `workspaceSnapshot`
- inbound command: `focusSession`
- snapshots are memory-only, not persisted
- reconnect backoff: 1000ms doubling to 5000ms cap
- handshake timeout: 3000ms
- per-message deflate disabled
- duplicate snapshots suppressed by serialized-payload comparison

Focus refinement:

- `focusSessionFromAgentManagerX` directly focuses the target session
- no forced sidebar rehydration/open step first
- avoids visible sidebar reload artifact during broker-driven jumps

## Drill-down guide

Use these entries for detailed implementation:

- Conversation viewer/search/resume:
  - `chat_history/_index.md`
- Provider command construction and low-effort models:
  - `git_text_generation/_index.md`
- Productized release surface:
  - `releases/_index.md`
  - `releases/vsmux_2_7_0_release.md`
- Core runtime and persistence:
  - `terminal_workspace/current_state.md`
  - `terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
  - `terminal_workspace/terminal_persistence_across_reloads.md`
- Focus/startup/sidebar:
  - `terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
  - `terminal_workspace/workspace_panel_startup_without_placeholder.md`
  - `terminal_workspace/sidebar_active_sessions_sort_mode.md`
- Titles/activity/actions:
  - `terminal_workspace/terminal_title_normalization_and_session_actions.md`
  - `terminal_workspace/title_activity_and_sidebar_runtime.md`
  - `terminal_workspace/session_rename_title_auto_summarization.md`
- Integrations:
  - `terminal_workspace/workspace_browser_t3_integration.md`
  - `terminal_workspace/vsmux_ai_devtools_integration.md`
  - `terminal_workspace/agent_manager_x_bridge_integration.md`

## Architectural takeaway

At the d2 level, `architecture` describes a coherent VSmux platform with:

- a daemon-backed terminal workspace that preserves PTYs and UI continuity across reloads,
- a grouped-session/sidebar model with explicit ordering, drag/drop, and activity semantics,
- normalized session-title and provider-driven naming flows,
- integrated conversation search/view/resume as `VSmux Search`,
- embedded T3/browser orchestration and bridge-based external control,
- and a release layer that captures how these runtime decisions are packaged, published, and exposed to users.
