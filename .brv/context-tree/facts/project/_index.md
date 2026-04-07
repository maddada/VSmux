---
children_hash: 532c1003679dc9399d6340e78c4ab117adfcd154d6db45d08a7f3612f95cd3b0
compression_ratio: 0.15547465695883506
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration_facts.md,
    agent_manager_x_focus_path_without_sidebar_rehydration_facts.md,
    context.md,
    default_agent_commands_override_facts.md,
    git_text_generation_low_effort_provider_facts.md,
    restty_terminal_font_probing_defaults_facts.md,
    session_rename_title_auto_summarization_facts.md,
    sidebar_active_sessions_sort_mode_facts.md,
    sidebar_active_sessions_sort_mode_persistence_facts.md,
    sidebar_active_sessions_sort_toggle_group_ordering_facts.md,
    sidebar_browsers_empty_state_facts.md,
    sidebar_debug_console_suppression_facts.md,
    sidebar_double_click_session_creation_setting_facts.md,
    sidebar_drag_indicators_explicit_dnd_drop_targets_facts.md,
    sidebar_drag_reorder_debug_logging_facts.md,
    sidebar_drag_reorder_large_group_preservation_facts.md,
    sidebar_drag_reorder_recovery_facts.md,
    sidebar_fork_session_behavior_facts.md,
    sidebar_group_full_reload_facts.md,
    sidebar_session_card_last_interaction_timestamp_facts.md,
    sidebar_session_card_timestamp_compact_display_facts.md,
    sidebar_session_fork_support_facts.md,
    simple_grouped_session_workspace_state_facts.md,
    t3_managed_runtime_upgrade_facts.md,
    terminal_activity_timestamp_reset_facts.md,
    terminal_persistence_across_vs_code_reloads_facts.md,
    terminal_persistence_reload_facts.md,
    terminal_title_normalization_facts.md,
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    viewer_search_and_resume_actions_facts.md,
    vsmux_2_7_0_release_facts.md,
    vsmux_ai_devtools_integration_facts.md,
    vsmux_packaging_and_embed_validation_facts.md,
    vsmux_search_rename_facts.md,
    workspace_browser_t3_integration_facts.md,
    workspace_debug_console_suppression_facts.md,
    workspace_focus_and_drag_runtime_facts.md,
    workspace_focus_debugging_facts.md,
    workspace_panel_focus_hotkeys_facts.md,
    workspace_panel_startup_bootstrap_facts.md,
    workspace_panel_startup_without_loading_placeholder_facts.md,
    workspace_panel_startup_without_placeholder_facts.md,
    workspace_session_sleep_wake_support_facts.md,
    workspace_sidebar_interaction_facts.md,
  ]
covers_token_total: 35710
summary_level: d1
token_count: 5552
type: summary
---

# Project Facts Overview

This topic collects stable implementation facts for VSmux, centered on terminal workspace behavior, sidebar interaction rules, persistence/runtime constants, agent command handling, T3/browser integration, chat-history search/resume, packaging, and release metadata. The entries are mostly companion fact sheets for deeper architecture topics under `architecture/*`.

## Core patterns across entries

- **Workspace + sidebar split**:
  - Workspace behavior is driven by `workspace/workspace-app.tsx`, `workspace/terminal-pane.tsx`, `extension/workspace-panel.ts`, and `extension/native-terminal-workspace/controller.ts`.
  - Sidebar behavior is driven by `sidebar/sidebar-app.tsx`, `sidebar/session-group-section.tsx`, and `sidebar/sortable-session-card.tsx`.
- **Stable message contracts recur throughout**:
  - Sidebar reorder/action messages: `syncGroupOrder`, `syncSessionOrder`, `moveSessionToGroup`, `createSession`, `fullReloadGroup`, `forkSession`, `toggleActiveSessionsSortMode`, `sidebarDebugLog`.
  - Workspace/webview messages: `focusSession`, `syncPaneOrder`, legacy `syncSessionOrder`, `reloadWorkspacePanel`, `fullReloadSession`, `ready`.
- **Common UI/runtime thresholds recur in many entries**:
  - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
  - `SIDEBAR_STARTUP_INTERACTION_BLOCK_MS = 1500`
  - sidebar pointer reorder threshold `8px`
  - non-touch drag distance `6px`
  - touch drag delay `250ms`, tolerance `5`
  - session-card drag hold `130ms`, tolerance `12`
- **Persistence strategy is deliberate**:
  - Workspace snapshots persist under `VSmux.sessionGridSnapshot`.
  - Terminal PTYs survive reloads via a detached per-workspace daemon.
  - Webviews commonly use `retainContextWhenHidden: false` to reduce memory.
- **Agent capability matrices are consistent**:
  - Resume/copy-resume support: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - Fork/full reload support: `codex`, `claude`
  - Browser sessions are excluded from many terminal-only actions.

## Terminal workspace and runtime

See: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `workspace_focus_debugging_facts.md`

### Runtime architecture

- Terminal renderer is **Restty**.
- Frontend runtime cache is keyed by `sessionId`; runtimes are reused until invalidated by render nonce or explicit destruction.
- Hidden panes remain mounted/painted behind the active pane rather than being redrawn on visibility flips.
- PTY attach waits for appearance completion and stable terminal size.
- Visible pane order comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only a temporary local override.

### Focus and lag handling

- `WorkspaceApp` owns authoritative focus state; `TerminalPane` only emits activation intent (`pointer` / `focusin`).
- T3 iframe focus messages use `type: vsmuxT3Focus`.
- Lag detection uses 50ms probes, 5000ms probe windows, and visible/focused lag thresholds around 1000ms average overshoot; `AUTO_RELOAD_ON_LAG` is enabled.
- Scroll/typing behavior is standardized:
  - scroll-to-bottom show/hide thresholds: `200px` / `40px`
  - typing auto-scroll: 4 printable keys within `450ms`

## Workspace panel startup and bootstrap

See: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_panel_focus_hotkeys_facts.md`

### Startup contract

- `openWorkspace` always reveals the sidebar first.
- No-session flow: reveal sidebar -> create session -> reveal workspace panel.
- Existing-session flow: reveal sidebar -> refresh workspace panel -> reveal panel -> refresh sidebar.

### Bootstrap and replay

- `WorkspacePanelManager` stores both `latestMessage` and `latestRenderableMessage`.
- Renderable message types are `hydrate` and `sessionState`.
- New workspace HTML bootstraps from `window.VSMUX_WORKSPACE_BOOTSTRAP`.
- Ready replay order is preserved: latest renderable state first, then latest transient message if distinct.
- Duplicate stable state is suppressed unless a new `autoFocusRequest.requestId` appears.

### Panel metadata

- Panel type: `vsmux.workspace`
- Panel title: `VSmux`
- `retainContextWhenHidden: false`
- local resource roots include `out/workspace` and `forks/t3code-embed/dist`
- Hotkey context key: `vsmux.workspacePanelFocus`
- Broad workspace hotkey clause: `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`
- Directional focus hotkeys remain terminal-only.

## Terminal persistence and daemon lifecycle

See: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`

### Persistence architecture

- Three-part persistence stack:
  - `SessionGridStore`
  - detached per-workspace terminal daemon
  - restored webview/Restty frontend
- PTYs are kept alive across extension reloads by a **per-workspace Node.js daemon** using `ws` and `@lydell/node-pty`.

### Storage and files

- Workspace snapshot key: `VSmux.sessionGridSnapshot`
- Daemon state directory prefix: `terminal-daemon-${workspaceId}`
- Files:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`

### Timing/protocol

- Control connect timeout: `3000ms`
- Daemon ready timeout: `10000ms`
- Launch lock stale threshold: `30000ms`
- Heartbeat interval/timeout: `5000ms` / `20000ms`
- Startup grace: `30000ms`
- Idle shutdown default: `5 * 60_000ms`
- Replay buffer cap: `8 * 1024 * 1024`
- Replay chunks: `128 * 1024`
- Session attach ready timeout: `15000ms`
- WebSocket upgrade endpoints `/control` and `/session` are token-authenticated.
- Requests that expect responses must include `requestId`.

### Restore semantics

- Restore flow: reload -> workspaceState restore -> daemon reconnect -> session reconnect -> `terminalReady` -> replay -> pending output flush.
- Persisted session files provide fallback title/agent metadata if live daemon data is missing.
- PTYs are spawned with `xterm-256color`; `LANG` is normalized to `en_US.UTF-8` if needed.

## Session/group workspace state and sleep/wake

See: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`, `sidebar_drag_reorder_large_group_preservation_facts.md`

### State normalization

- Implemented in `shared/simple-grouped-session-workspace-state.ts`.
- Ensures at least one group exists.
- Browser sessions are removed during normalization.
- Canonical session IDs use `session-${formatSessionDisplayId(displayId ?? 0)}`.
- New sessions allocate the **first free display ID**.

### Group/session behavior

- Empty groups are retained after removing their last session.
- Fallback active-group selection prefers the nearest previous populated group.
- Focus/visible session behavior is deterministic across split/fullscreen transitions.
- Group reordering appends omitted existing groups after requested order.

### Same-group reorder fix

- `sidebar_drag_reorder_large_group_preservation_facts.md` documents migration to a shared reorder helper.
- Important invariant: same-group reorder no longer loses sessions when group size exceeds 9.
- Reorder only succeeds when incoming IDs exactly match current exact or canonical session sets.

### Sleep/wake

- `isSleeping` is persisted in grouped workspace state.
- Sleeping sessions are excluded from focus and visible split calculations.
- Focusing a sleeping session wakes it.
- Group sleep/wake applies to all non-browser sessions in the group.
- Sleeping disposes live runtime/surface but preserves card/resume metadata.

## Sidebar sorting, ordering, and drag/drop

See: `sidebar_active_sessions_sort_mode_facts.md`, `sidebar_active_sessions_sort_mode_persistence_facts.md`, `sidebar_active_sessions_sort_toggle_group_ordering_facts.md`, `sidebar_drag_indicators_explicit_dnd_drop_targets_facts.md`, `sidebar_drag_reorder_recovery_facts.md`, `sidebar_drag_reorder_debug_logging_facts.md`

### Sort mode model

- `activeSessionsSortMode` values: `manual` or `lastActivity`.
- Persisted per workspace in `workspaceState`.
- Critical invariant: **workspace group order remains manual in all sort modes**.
- `lastActivity` only reorders sessions _within_ each group by `lastInteractionAt`.
- Missing/invalid activity timestamps resolve to `0`.
- Drag-and-drop reorder is disabled outside manual mode.

### Rendering/source-of-truth

- `SessionGroupSection` must render `orderedSessionIds` from `SidebarApp`, not always raw store order.
- Storybook fixture intentionally keeps manual order different from activity order for verification.

### Explicit DnD redesign

- Explicit droppable payloads are primary; DOM hit-testing is fallback only.
- Session cards expose explicit `before` and `after` droppable surfaces.
- Empty groups expose a `group/start` session drop target.
- `SidebarSessionDropTarget` supports:
  - group targets: `start`, `end`
  - session targets: `before`, `after`
- Drop target IDs:
  - group: `session-drop-target:<groupId>:group:<position>`
  - session: `session-drop-target:<groupId>:<sessionId>:<position>`

### Reorder semantics

- `moveSessionIdsByDropTarget` defines authoritative same-group and cross-group behavior.
- Same-group moves preserve identity on no-op/self-drop and adjust insertion index after removal.
- Cross-group moves remove from source and insert into target at clamped index.
- Recovery logic can restore omitted sessions from authoritative order and emits `session.dragRecoveredOmittedSessions` in debug mode.

### Debug logging

- Reorder/debug output is gated by `VSmux.debuggingMode`.
- Debug message type remains `sidebarDebugLog`.
- Store emits debug events like `store.syncSessionOrder`, `store.syncGroupOrder`, `store.moveSessionToGroup`.
- Debug output channel/file:
  - channel: `VSmux Debug`
  - file: `vsmux-debug.log`
  - mirrored path: `~/Desktop/vsmux-debug.log`

## Sidebar UI behaviors and controls

See: `sidebar_browsers_empty_state_facts.md`, `sidebar_double_click_session_creation_setting_facts.md`, `sidebar_debug_console_suppression_facts.md`, `workspace_debug_console_suppression_facts.md`, `sidebar_session_card_last_interaction_timestamp_facts.md`, `sidebar_session_card_timestamp_compact_display_facts.md`

### Browser/empty rendering

- Empty browser groups suppress `.group-sessions` entirely to avoid extra layout gap.
- Non-browser empty groups still show the “No sessions” drop target.

### Double-click creation

- Setting: `VSmux.createSessionOnSidebarDoubleClick`
- Default: `false`
- HUD carries `createSessionOnSidebarDoubleClick`
- Only triggers on empty sidebar space when interaction is allowed.
- Uses the existing `createSession` message.

### Debug console suppression

- `logSidebarDebug(...)` is now effectively a no-op for browser console output.
- `sidebarDebugLog` message flow to the extension remains intact.
- Storybook echo is also suppressed.
- Regression coverage exists in `sidebar/sidebar-debug.test.ts`.

### Last-activity timestamp UX

- Sidebar timestamps use discrete age buckets:
  - 0–15m bright green
  - 15–30m slightly faded green
  - 30–60m more muted green
  - > 1h gray
- UI uses a 1-second tick for live relative updates.
- Terminal activity timestamps now seed/refresh from persisted session-state mtimes and other activity signals.
- Compact display update moved timestamp into `.session-head`; display is value-only (`5m`, `3h`) without “ago”.

## Session actions: rename, resume, fork, full reload

See: `session_rename_title_auto_summarization_facts.md`, `terminal_title_normalization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `sidebar_group_full_reload_facts.md`, `default_agent_commands_override_facts.md`

### Title normalization and rename summarization

- Visible terminal titles are normalized by trimming and stripping leading status/progress glyphs matched by:
  - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- Titles starting with `~` or `/` are treated as non-visible.
- Session rename summarization only occurs when `title.trim().length > 25`.
- Constants:
  - `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
  - `GENERATED_SESSION_TITLE_MAX_LENGTH = 24`
- Output rules prefer plain text, 2–4 words, no quotes/markdown/commentary/punctuation.
- Provider models:
  - Codex: `gpt-5.4-mini`, high reasoning effort
  - Claude: `haiku`, high effort

### Resume/copy-resume/fork/full reload support matrix

- Resume/copy-resume supports `codex`, `claude`, `copilot`, `gemini`, `opencode`.
- Fork/full reload support is restricted to `codex` and `claude`.
- Browser sessions cannot rename, fork, copy resume, or full reload from sidebar context menus.

### Fork details

- Sidebar adds `Fork` action and posts `forkSession`.
- Controller creates forked terminal **in same group directly after source session**.
- Reuses source metadata from `sidebarAgentIconBySessionId` and `sessionAgentLaunchBySessionId`.
- Commands:
  - Codex: `codex fork <preferred title>`
  - Claude: `claude --fork-session -r <preferred title>`
- Delayed rename:
  - `/rename fork <preferred title>`
  - `FORK_RENAME_DELAY_MS = 4000`
- Validation is strict and user-visible error text is preserved.

### Full reload

- Group context menu now shows **Full reload** for any non-browser group with sessions.
- Execution still filters to sessions that produce a resume command from `getFullReloadResumeCommand`.
- Unsupported sessions are skipped, not hidden.
- Partial success messaging reports reloaded vs skipped counts.

### Default agent command overrides

- Setting: `VSmux.defaultAgentCommands`
- Scope: application-level object
- Built-in keys default to `null` for `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`.
- Overrides only apply when trimmed non-empty values survive normalization.
- Explicit stored commands remain authoritative.
- Legacy stock commands may be upgraded to configured aliases during resume/fork generation.
- Session launch resolution supports `codex`, `claude`, `copilot`, `gemini`, `opencode`, but not `t3`.

## Git text generation

See: `git_text_generation_low_effort_provider_facts.md`, `session_rename_title_auto_summarization_facts.md`, `vsmux_2_7_0_release_facts.md`

- Setting: `VSmux.gitTextGenerationProvider`
- Default provider: `codex`
- Supported values: `codex`, `claude`, `custom`
- Built-ins:
  - Codex uses `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude uses `haiku` with `--effort low`
- Timeout: `180000ms`
- Codex mode uses stdin and disables interactive shell mode.
- Custom commands may emit to stdout or a temp file.
- Low-effort provider update intentionally preserved user-edited numeric session rename limits.
- Release notes deprecate `VSmux.gitTextGenerationAgentId` in favor of provider/custom-command settings.

## Agent Manager X integration

See: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

### Bridge

- Local broker URL: `ws://127.0.0.1:47652/vsmux`
- Handshake timeout: `3000ms`
- `perMessageDeflate` disabled
- Reconnect backoff: `1000ms` doubling to `5000ms` max
- Snapshots are in-memory only, not persisted
- Snapshots publish only when:
  - a latest snapshot exists
  - socket is open
  - serialized snapshot changed
- Ping messages are ignored.
- `focusSession` only runs when incoming `workspaceId` matches latest snapshot `workspaceId`.
- Controller constructs `AgentManagerXBridgeClient` and routes logs through `logVSmuxDebug`.

### Focus-path adjustment

- Broker-driven session jumps no longer force sidebar open/re-hydration first.
- `focusSessionFromAgentManagerX` now focuses target session directly.
- Existing workspace focus behavior is preserved.
- Related constants include:
  - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
  - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
  - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
  - `FORK_RENAME_DELAY_MS = 4000`
  - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

## T3, browser, and managed runtime integration

See: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`, `restty_terminal_font_probing_defaults_facts.md`

### Browser/T3 integration

- Browser sidebar excludes internal VSmux surfaces and T3-owned tabs.
- Workspace panel restoration identity is `vsmux.workspace` / `VSmux`.
- T3 activity is websocket-backed via `T3ActivityMonitor`.
- T3 focus acknowledgement uses completion-marker-aware acknowledge-thread behavior.
- Workspace groups render from authoritative `sessionIdsByGroup`.
- Workspace panel roots include `forks/t3code-embed/dist`.

### Managed runtime upgrade

- Updated embedded runtime endpoint: `127.0.0.1:3774`
- Legacy runtime in migration notes: `127.0.0.1:3773`
- Real websocket endpoint is `/ws`
- RPC request IDs are numeric strings, not UUIDs.
- Runtime source entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Mixed-install recovery requires syncing upstream, overlay, and dist from tested worktree into main.

### Restty font probing defaults

- `DEFAULT_TERMINAL_FONT_FAMILIES`: `MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New`
- `DEFAULT_LOCAL_FONT_MATCHERS`: `MesloLGL Nerd Font Mono`, `MesloLGL Nerd Font`
- Default/unset font-family emits only bundled Meslo fallback URL source.
- Custom fonts may keep optional local source with `required: false`.

## Chat history / VSmux Search / AI DevTools

See: `viewer_search_and_resume_actions_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`

### Viewer search and resume

- Custom find bar opens on `Cmd/Ctrl+F`.
- Search uses native `window.find`.
- Controls:
  - `Enter` next
  - `Shift+Enter` previous
  - `Escape` close
- Resume button requires inferred source + discovered `sessionId`.
- Source inference:
  - `/.codex/`, `/.codex-profiles/` -> Codex
  - `/.claude/`, `/.claude-profiles/` -> Claude
- Resume message posts `{ source, sessionId, cwd? }`
- Resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Terminal opens as `AI DevTools Resume (<source>)`.
- Invalid JSONL lines are represented as `x-error` records.

### Integration packaging/runtime

- VSmux remains the single shipped extension host.
- `aiDevtools.conversations` is registered under `VSmuxSessions`.
- Chat-history webview build outputs to `chat-history/dist`.
- Assets resolve from `chat-history/dist` and `chat-history/media`.
- Extension build pipeline includes sidebar/debug-panel/workspace/chat-history webview builds, TS compile, and vendor-runtime deps.
- Extension TS target: `ES2024`; chat-history bundle target: `es2020` IIFE.
- `ai-devtools.suspend` disposes panel, clears provider cache, and marks suspended for memory release.

### Search rename metadata

- Search identifiers:
  - view id: `VSmuxSearch.conversations`
  - label: `VSmux Search`
  - standalone package: `vsmux-search-vscode`
  - publisher: `vsmux-search`
  - activitybar container: `vsmux-search`
  - panel type: `vsmuxSearchViewer`
  - export filename prefix: `vsmux-search-export-`
- Recent cutoff: `7 days`
- Filter debounce: `150ms`
- Unknown tools are exported by default if they do not map to an option key.

## Packaging, VSIX, and release metadata

See: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_2_7_0_release_facts.md`

### Extension/package metadata

- Display name: `VSmux - T3code & Agent CLIs Manager`
- Publisher: `maddada`
- Repository: `https://github.com/maddada/VSmux.git`
- Main entry: `./out/extension/extension.js`
- Icon: `media/VSmux-marketplace-icon.png`
- Primary activity-bar container/view: `VSmuxSessions` / `VSmux.sessions`
- Secondary container: `VSmuxSessionsSecondary`
- Activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`

### Dependency/package rules

- `pnpm@10.14.0`
- VS Code engine: `^1.100.0`
- pnpm overrides:
  - `vite -> npm:@voidzero-dev/vite-plus-core@latest`
  - `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
- `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`

### VSIX/embed validation

- Installed VSIX contents are authoritative when debugging embed drift.
- Documented mismatch case: refreshed worktree had `index-DCV3LG5L.js`, installed extension had stale `index-BbtZ0IEL.js`.

### Release 2.7.0

- Version `2.7.0` released on `2026-04-07`.
- Publish script requires:
  - clean git worktree
  - non-detached HEAD
  - unique git tag
- `VSmux Search` is built in as of 2.7.0.
- Open VSX updated immediately; VS Code Marketplace lagged and still showed 2.6.0 right after publish.

## Drill-down map

- **Workspace runtime/focus/bootstrap**: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_panel_startup_bootstrap_facts.md`
- **Persistence/daemon**: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`
- **Workspace state/sleep/reorder correctness**: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`, `sidebar_drag_reorder_large_group_preservation_facts.md`
- **Sidebar sorting and DnD**: `sidebar_active_sessions_sort_mode_facts.md`, `sidebar_active_sessions_sort_mode_persistence_facts.md`, `sidebar_drag_indicators_explicit_dnd_drop_targets_facts.md`, `sidebar_drag_reorder_recovery_facts.md`
- **Session actions**: `terminal_title_normalization_facts.md`, `session_rename_title_auto_summarization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_group_full_reload_facts.md`, `default_agent_commands_override_facts.md`
- **Agent Manager X**: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`
- **T3/browser/runtime embed**: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`, `restty_terminal_font_probing_defaults_facts.md`
- **Chat-history/search**: `viewer_search_and_resume_actions_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`
- **Packaging/releases**: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_2_7_0_release_facts.md`
