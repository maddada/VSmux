---
children_hash: b03f80df670ebe3523c4927020aca014291eb0d17d91ef8e803e1017457fc07d
compression_ratio: 0.750085645769099
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 5838
summary_level: d2
token_count: 4379
type: summary
---

# Facts Domain Structural Summary

## Purpose and scope

The `facts` domain is the repository’s quick-recall layer for stable implementation facts rather than long-form architectural explanation. It centralizes technology choices, configuration defaults, operational constants, behavioral invariants, and support matrices, with most concrete detail concentrated under `project/_index.md`.

## Primary topic: `project`

`project/_index.md` summarizes the main fact clusters for VSmux, especially terminal workspace behavior, sidebar interaction, T3/browser integration, packaging identity, viewer/search behavior, and agent command defaults.

## Major fact clusters

### Terminal workspace runtime, persistence, and startup

Drill down:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `terminal_persistence_reload_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`
- `workspace_panel_startup_bootstrap_facts.md`
- `workspace_panel_startup_without_loading_placeholder_facts.md`
- `workspace_panel_startup_without_placeholder_facts.md`

Key facts:

- Workspace terminal rendering is based on Restty.
- Runtime caching is keyed by `sessionId`, with separate “release” vs full “destroy” semantics for terminal runtime hosts.
- Persistence uses a three-part model: `SessionGridStore`, a detached per-workspace daemon, and restored workspace webview state.
- Snapshot state persists under `VSmux.sessionGridSnapshot`.
- Detached daemon state is per-workspace and survives extension reloads; metadata/state files include `daemon-info.json`, `daemon-launch.lock`, and `terminal-daemon-debug.log`.
- Important constants include:
  - control socket timeout `3000ms`
  - daemon ready timeout `10000ms`
  - owner heartbeat `5000ms`
  - owner timeout `20000ms`
  - startup grace `30000ms`
  - idle shutdown `5 * 60_000ms`
  - terminal ready attach wait `15000ms`
  - replay/history caps `8 * 1024 * 1024` bytes and `128 * 1024` chunks
- PTY environment normalizes `LANG=en_US.UTF-8` and terminal name `xterm-256color`.
- Daemon WebSocket upgrades are token-authenticated on `/control` and `/session`.
- Restore flow is ordered around reconnect, `terminalReady`, replay, pending output flush, and active attachment.
- Workspace bootstrap embeds state in `window.VSMUX_WORKSPACE_BOOTSTRAP`, prioritizes renderable state before transient state, suppresses duplicate stable-state replays by JSON signature, and uses `retainContextWhenHidden: false`.

### Workspace focus, ordering, lag handling, and hotkeys

Drill down:

- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_panel_focus_hotkeys_facts.md`
- `terminal_workspace_runtime_facts.md`

Key facts:

- `WorkspaceApp` is the authority for focus; `TerminalPane` only emits activation intent.
- Activation sources are `pointer` and `focusin`.
- Shared focus guard constant: `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400ms`.
- T3 iframe focus uses event `vsmuxT3Focus`.
- Visible pane ordering comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only a temporary visible-session override.
- Hidden connected panes remain mounted and should avoid redraw churn when visibility changes.
- Lag recovery is enabled by default with `AUTO_RELOAD_ON_LAG = true`.
- Lag detection uses 50ms probe interval, 5000ms probe window, 10000ms monitor window, with warning at `250ms` and reload threshold at average overshoot `>= 1000ms`.
- Panel focus context key is `vsmux.workspacePanelFocus`; panel hotkeys combine `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`, while directional focus shortcuts remain terminal-only.

### Sidebar interaction, sorting, debug suppression, and timestamps

Drill down:

- `sidebar_active_sessions_sort_mode_persistence_facts.md`
- `sidebar_debug_console_suppression_facts.md`
- `workspace_debug_console_suppression_facts.md`
- `sidebar_session_card_last_interaction_timestamp_facts.md`
- `sidebar_browsers_empty_state_facts.md`

Key facts:

- Sidebar interaction thresholds:
  - startup block `1500ms`
  - reorder threshold `8px`
  - non-touch drag activation `6px`
  - touch activation delay `250ms`, tolerance `5`
  - session-card drag hold `130ms`, tolerance `12`
- Sort mode is `manual | lastActivity`, persisted per workspace in `workspaceState`.
- `lastActivity` sorting changes display order only, preserves manual ordering, and disables drag reordering.
- Missing/invalid `lastInteractionAt` falls back to `0`.
- Toggle message contract: `toggleActiveSessionsSortMode`.
- `sidebar/sidebar-debug.ts` suppresses console logging by making `logSidebarDebug(...)` effectively no-op, while preserving message flow such as `sidebarDebugLog`.
- Storybook still captures debug messages without browser console noise.
- Relative timestamps rerender every second and use age-based color buckets.
- Terminal activity timestamps may seed from persisted session-state file mtimes.
- Empty browser groups hide `.group-sessions`; non-browser empty groups still show the “No sessions” drop target.

### Session actions: rename, fork, resume, reload, sleep/wake

Drill down:

- `terminal_title_normalization_facts.md`
- `session_rename_title_auto_summarization_facts.md`
- `sidebar_session_fork_support_facts.md`
- `sidebar_fork_session_behavior_facts.md`
- `workspace_session_sleep_wake_support_facts.md`
- `default_agent_commands_override_facts.md`

Key facts:

- Title cleanup uses `normalizeTerminalTitle` with glyph/status stripping regex `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`.
- `getVisibleTerminalTitle` hides titles beginning with `~` or `/`.
- Preferred title precedence is visible terminal title -> visible primary session title -> `undefined`.
- Persisted session state normalizes whitespace/title values and writes atomically; allowed persisted status values are `idle | working | attention`.
- Raw daemon terminal titles remain stored in `terminalTitleBySessionId` for activity tracking even when user-visible titles are normalized.
- Session rename summarization activates only when `title.trim().length > 25`, using:
  - `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
  - `GENERATED_SESSION_TITLE_MAX_LENGTH = 24`
- Prompt rules for generated titles require plain text only, no quotes/markdown/commentary/final punctuation, typically 2–4 words.
- Provider choices for generated titles:
  - Codex: `gpt-5.4-mini` with high reasoning effort
  - Claude: `haiku` with high effort
- Support matrix:
  - copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - fork and full reload: `codex`, `claude`
  - browser sessions: no rename, fork, copy resume, or full reload from sidebar menus
- Fork message contract adds `{ type: "forkSession", sessionId: string }`, routed through `extension/native-terminal-workspace/sidebar-message-dispatch.ts`.
- Fork creates a sibling session after the source in the same group.
- Fork command formats:
  - `codex fork <preferred title>`
  - `claude --fork-session -r <preferred title>`
- Post-fork rename is delayed by `FORK_RENAME_DELAY_MS = 4000` and uses `/rename fork <preferred title>`.
- Sleep/wake persists `isSleeping` in grouped workspace state; sleeping sessions are excluded from focus and visible split calculations, but focusing a sleeping session wakes it.

### Grouped workspace state model

Drill down:

- `simple_grouped_session_workspace_state_facts.md`

Key facts:

- Canonical implementation lives in `shared/simple-grouped-session-workspace-state.ts`.
- Undefined snapshots normalize through `createDefaultGroupedSessionWorkspaceSnapshot()` and always ensure at least one group with `DEFAULT_MAIN_GROUP_ID`.
- Display IDs are normalized before per-group normalization; browser sessions are stripped during normalization.
- Canonical session IDs derive from display IDs as `session-${formatSessionDisplayId(displayId ?? 0)}`.
- Important invariants:
  - empty groups are retained
  - active-group fallback prefers nearest previous populated group
  - per-group `visibleSessionIds` are preserved/restored
  - single visible pane normalizes to `[focusedSessionId]`
  - new sessions get first free display ID, append to active group, focus immediately, and recompute visibility
  - moved sessions activate/focus destination groups
  - fullscreen preserves `fullscreenRestoreVisibleCount`
  - group indexing for focus-by-index is 1-based
  - T3 metadata updates only affect `kind === t3`
- Group creation is capped by `MAX_GROUP_COUNT`.

### Agent Manager X bridge and focus-path behavior

Drill down:

- `agent_manager_x_bridge_integration_facts.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

Key facts:

- Bridge broker URL: `ws://127.0.0.1:47652/vsmux`.
- Handshake timeout is `3000ms`; `perMessageDeflate` is disabled.
- Reconnect backoff starts at `1000ms` and caps at `5000ms`.
- Snapshots are memory-only and publish only when a latest snapshot exists, socket is open, and serialized content changed.
- `ping` messages are ignored.
- `NativeTerminalWorkspaceController` owns bridge integration and publishes snapshots from `initialize()`.
- `focusSession` from Agent Manager X only acts when `workspaceId` matches the current snapshot.
- `focusSessionFromAgentManagerX` now focuses the target session directly, removing prior sidebar reopen/rehydration artifacts.
- Related preserved constants in the same controller include:
  - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
  - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
  - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
  - `FORK_RENAME_DELAY_MS = 4000`
  - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### T3 runtime and browser/workspace integration

Drill down:

- `workspace_browser_t3_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`

Key facts:

- Browser sidebar excludes internal VSmux workspace tabs and T3-owned tabs.
- Workspace panel identity is type `vsmux.workspace`, title `VSmux`.
- Local webview resource roots include `out/workspace` and `forks/t3code-embed/dist`.
- T3 activity is supplied by `T3ActivityMonitor` over WebSocket rather than hardcoded idle behavior.
- Monitor responds to Ping with `pong` and debounces refreshes during domain-event bursts.
- T3 focus acknowledgement is completion-marker-aware.
- Workspace group rendering uses authoritative `sessionIdsByGroup`.
- Managed runtime endpoint moved to `127.0.0.1:3774` from legacy references to `127.0.0.1:3773`; actual WebSocket path is `/ws`.
- Effect RPC request IDs are numeric strings rather than UUIDs.
- Managed runtime source entrypoint is `forks/t3code-embed/upstream/apps/server/src/bin.ts`.
- Recovery after mixed installs requires syncing upstream, overlay, and dist from a tested refresh worktree.

### Packaging, extension identity, AI DevTools, viewer search, and VSmux Search

Drill down:

- `vsmux_packaging_and_embed_validation_facts.md`
- `vsmux_ai_devtools_integration_facts.md`
- `viewer_search_and_resume_actions_facts.md`
- `vsmux_search_rename_facts.md`

Key facts:

- Extension identity:
  - display name: `VSmux - T3code & Agent CLIs Manager`
  - publisher: `maddada`
  - main: `./out/extension/extension.js`
  - repo: `https://github.com/maddada/VSmux.git`
  - icon: `media/VSmux-marketplace-icon.png`
  - version: `2.6.0`
  - VS Code engine: `^1.100.0`
  - package manager: `pnpm@10.14.0`
- Activity/view containers:
  - `VSmuxSessions`
  - `VSmux.sessions`
  - `VSmuxSessionsSecondary`
- Activation events include `onStartupFinished`, `onView:VSmux.sessions`, and `onWebviewPanel:vsmux.workspace`.
- Root build composes sidebar, debug-panel, workspace, chat-history webview, TS compile, and vendor runtime dependencies.
- Chat-history outputs to `chat-history/dist`; extension TS compile includes `extension`, `shared`, and `chat-history/src/extension`.
- TS target is `ES2024`; chat-history webview targets `es2020` with `iife`.
- `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`; pnpm overrides `vite` and `vitest` to `@voidzero-dev` packages.
- AI DevTools integration remains inside the single VSmux extension host; `aiDevtools.conversations` lives under `VSmuxSessions`.
- Viewer panels also use `retainContextWhenHidden: false`.
- `ai-devtools.suspend` disposes the current panel, clears provider cache, and records suspended state to free memory.
- Conversation viewer search uses native `window.find`, shortcut `Cmd/Ctrl+F`, and controls `Enter`, `Shift+Enter`, `Escape`.
- Resume requires inferred source and parsed `sessionId`; source inference maps Codex/Claude from `.codex`, `.codex-profiles`, `.claude`, `.claude-profiles`.
- Resume webview posts `resumeSession` with `source`, `sessionId`, and optional `cwd`.
- Resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Shell escaping uses `quoteShellLiteral`; invalid JSONL/schema parses become `x-error` records.
- VSmux Search rename facts define:
  - view id `VSmuxSearch.conversations`
  - label `VSmux Search`
  - package `vsmux-search-vscode`
  - publisher `vsmux-search`
  - activitybar container `vsmux-search`
  - viewer panel type `vsmuxSearchViewer`
  - export filename prefix `vsmux-search-export-`
  - recent cutoff `7 days`
  - filter debounce `150ms`
  - unknown tools export by default if they do not map to an option key

### Git text generation and default agent commands

Drill down:

- `git_text_generation_low_effort_provider_facts.md`
- `default_agent_commands_override_facts.md`

Key facts:

- `VSmux.gitTextGenerationProvider` defaults to `codex`.
- Supported provider values: `codex | claude | custom`.
- Built-in provider settings:
  - Codex uses `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude uses `haiku` with `--effort low`
- Timeout is `180000ms`.
- Codex execution is stdin-driven and non-interactive; custom commands may write to temp file or stdout.
- Numeric limits for session rename behavior were intentionally preserved during provider changes.
- `VSmux.defaultAgentCommands` is an application-scope object with built-in keys `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`, defaulting to `null`.
- Empty/whitespace values normalize to `null`.
- Sidebar default buttons use configured overrides only when no explicit stored preference exists.
- Stored per-session commands remain authoritative.
- Legacy built-in command strings may upgrade to configured aliases during resume/fork only when the stored command exactly matches the legacy built-in default.
- Legacy string-only launches normalize to `agentId: codex`.
- Built-in launch resolution supports `codex`, `claude`, `copilot`, `gemini`, `opencode`, but not `t3`.

### Terminal font probing defaults

Drill down:

- `restty_terminal_font_probing_defaults_facts.md`

Key facts:

- `workspace/restty-terminal-config.ts` separates bundled default terminal font behavior from custom font families.
- Constants:
  - `DEFAULT_TERMINAL_FONT_FAMILIES = MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New`
  - `DEFAULT_LOCAL_FONT_MATCHERS = MesloLGL Nerd Font Mono, MesloLGL Nerd Font`
- If font family is unset or bundled default, only the Meslo fallback URL source is returned.
- Custom font families may retain optional local font sources with `required: false`.

## Cross-cutting patterns and relationships

- Repeated constants appear across entries, especially:
  - auto-focus guard `400ms`
  - sidebar startup block `1500ms`
  - reorder threshold `8px`
  - fork rename delay `4000ms`
  - generation timeout `180000ms`
  - T3 WebSocket `ws://127.0.0.1:3774/ws`
  - `retainContextWhenHidden: false`
- Repeated architectural decisions:
  - per-workspace daemon ownership instead of a single global runtime
  - renderable-first bootstrap/replay ordering
  - normalized visible titles for UX while retaining raw daemon titles for activity logic
  - browser sessions intentionally excluded from terminal-only actions
  - message contracts preserved even when debug/console side effects are suppressed

## Best drill-down paths

- Session action rules: `terminal_title_normalization_facts.md`, `session_rename_title_auto_summarization_facts.md`, `sidebar_fork_session_behavior_facts.md`, `sidebar_session_fork_support_facts.md`, `default_agent_commands_override_facts.md`
- Workspace bootstrap/focus/runtime: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_focus_debugging_facts.md`
- Sidebar interaction/debug/timestamps: `sidebar_active_sessions_sort_mode_persistence_facts.md`, `sidebar_session_card_last_interaction_timestamp_facts.md`, `sidebar_debug_console_suppression_facts.md`, `workspace_debug_console_suppression_facts.md`
- Integration/identity/runtime surface: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`, `viewer_search_and_resume_actions_facts.md`, `vsmux_search_rename_facts.md`

## Overall structure

At d2, the `facts` domain resolves into a single dense `project` topic that acts as the repository’s implementation reference sheet: workspace runtime and persistence, focus and lag semantics, sidebar interaction rules, session action support matrices, grouped state normalization, Agent Manager X bridge behavior, T3/browser integration, packaging identity, viewer/search contracts, and provider/default-command settings.
