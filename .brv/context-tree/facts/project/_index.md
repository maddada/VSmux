---
children_hash: 38831bfc07da1874cbf2fc28e5ffcc68d1b7bd1b78875938c0199536f3136aa2
compression_ratio: 0.18553979372733992
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
    sidebar_browsers_empty_state_facts.md,
    sidebar_debug_console_suppression_facts.md,
    sidebar_fork_session_behavior_facts.md,
    sidebar_session_card_last_interaction_timestamp_facts.md,
    sidebar_session_fork_support_facts.md,
    simple_grouped_session_workspace_state_facts.md,
    t3_managed_runtime_upgrade_facts.md,
    terminal_persistence_across_vs_code_reloads_facts.md,
    terminal_persistence_reload_facts.md,
    terminal_title_normalization_facts.md,
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    viewer_search_and_resume_actions_facts.md,
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
covers_token_total: 28409
summary_level: d1
token_count: 5271
type: summary
---

# Facts / Project Structural Summary

## Scope

This topic captures stable, recall-oriented implementation facts for VSmux terminal workspace, sidebar, packaging, chat-history/viewer, T3 integration, and agent command behavior. It complements deeper architecture entries by preserving constants, IDs, message contracts, file paths, and support matrices.

## Major clusters

### 1. Terminal workspace runtime, persistence, and startup

Primary drill-down:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `terminal_persistence_reload_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`
- `workspace_panel_startup_bootstrap_facts.md`
- `workspace_panel_startup_without_loading_placeholder_facts.md`
- `workspace_panel_startup_without_placeholder_facts.md`

Key structure:

- Renderer/runtime:
  - Workspace terminal renderer is **Restty**.
  - Frontend runtime cache is keyed per `sessionId` in `workspace/terminal-runtime-cache.ts`.
  - `releaseCachedTerminalRuntime` removes host only when refcount hits zero; `destroyCachedTerminalRuntime` fully destroys transport/Restty/cache entry.
- Persistence architecture:
  - Three-part model: `SessionGridStore` + detached per-workspace daemon + restored workspace webview.
  - Workspace snapshot persists under `VSmux.sessionGridSnapshot`.
  - Detached daemon is per-workspace, not global, and keeps PTYs alive across extension reloads.
  - Daemon metadata/state files include `daemon-info.json`, `daemon-launch.lock`, `terminal-daemon-debug.log`.
- Daemon/runtime constants:
  - Control socket timeout `3000ms`, daemon ready timeout `10000ms`.
  - Owner heartbeat interval `5000ms`, timeout `20000ms`, startup grace `30000ms`.
  - Idle shutdown default `5 * 60_000ms`.
  - Replay/history limits: `8 * 1024 * 1024` bytes max, `128 * 1024` replay chunks.
  - Session attach waits up to `15000ms` for `terminalReady`.
  - PTY env normalizes `LANG` to `en_US.UTF-8`; terminal name is `xterm-256color`.
  - Daemon WebSockets require token-authenticated upgrades on `/control` and `/session`.
- Restore/replay flow:
  - `reload -> workspaceState restore -> daemon reconnect -> session reconnect -> terminalReady -> replay -> pending output flush -> active attachment`.
  - Output during replay is buffered in a pending attach queue.
  - Persisted session-state files preserve title/agent metadata when live daemon data is unavailable.
- Workspace panel startup/bootstrap:
  - `openWorkspace` reveals the sidebar first.
  - No-sessions path: reveal sidebar -> create session -> reveal panel.
  - Existing-sessions path: reveal sidebar -> refresh workspace panel -> reveal panel -> refresh sidebar.
  - Bootstrap renderable state is embedded into HTML via `window.VSMUX_WORKSPACE_BOOTSTRAP`.
  - Renderable buffered messages are `hydrate` and `sessionState`; replay sends renderable state before transient state like `terminalPresentationChanged`.
  - Stable-state duplicate suppression uses stripped JSON signatures, except new `autoFocusRequest.requestId` values still apply.
  - Workspace webview uses `retainContextWhenHidden: false`.

### 2. Workspace focus, pane ordering, lag handling, and interaction model

Primary drill-down:

- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_panel_focus_hotkeys_facts.md`
- `terminal_workspace_runtime_facts.md`

Key structure:

- Focus ownership:
  - `WorkspaceApp` is authoritative for focus decisions; `TerminalPane` emits activation intent.
  - Activation sources are `pointer` and `focusin`.
  - Auto-focus guard constant is consistently `400ms` (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
  - T3 iframe focus event type is `vsmuxT3Focus`.
- Pane ordering:
  - Visible pane order derives from `activeGroup.snapshot.visibleSessionIds`.
  - `localPaneOrder` is only a temporary override within visible sessions.
  - Hidden connected panes stay mounted/painted and should not redraw on visibility flips.
- Lag detection and recovery:
  - `AUTO_RELOAD_ON_LAG` is true.
  - Lag probing uses 50ms probe interval, 5000ms probe window, 10000ms monitor window.
  - Avg scheduler overshoot >= `1000ms` counts as lag; warn threshold is `250ms`.
  - Reload-on-lag only posts when document visibility is visible and only once per lag event.
- Hotkeys/context:
  - Context key: `vsmux.workspacePanelFocus`.
  - Panel hotkeys use `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`.
  - Directional focus hotkeys remain terminal-only with `terminalFocus`.

### 3. Sidebar drag, sorting, debug suppression, and timestamp rendering

Primary drill-down:

- `sidebar_active_sessions_sort_mode_persistence_facts.md`
- `sidebar_debug_console_suppression_facts.md`
- `workspace_debug_console_suppression_facts.md`
- `sidebar_session_card_last_interaction_timestamp_facts.md`
- `sidebar_browsers_empty_state_facts.md`

Key structure:

- Drag/interaction thresholds:
  - Startup interaction block `1500ms`.
  - Reorder threshold `8px`.
  - Non-touch drag activation distance `6px`.
  - Touch drag activation delay `250ms` with tolerance `5`.
  - Session-card drag hold `130ms` with tolerance `12`.
- Sort mode:
  - Sidebar active-sessions sort mode values: `manual | lastActivity`.
  - Persisted per workspace in VS Code `workspaceState`.
  - `lastActivity` sort is display-only, preserves manual order, and disables dragging.
  - Invalid/missing `lastInteractionAt` falls back to `0`.
  - Toggle message: `toggleActiveSessionsSortMode`.
- Debug suppression:
  - `sidebar/sidebar-debug.ts` now makes `logSidebarDebug(...)` effectively a no-op.
  - Message flow remains intact: `sidebarDebugLog` still posts through the app/harness.
  - Regression coverage exists in `sidebar/sidebar-debug.test.ts`.
  - Storybook still captures debug messages without browser console echo.
- Timestamp rendering:
  - Relative timestamps rerender on a 1-second tick.
  - Color buckets:
    - 0–15 min bright green
    - 15–30 min slightly faded green
    - 30–60 min muted green
    - > 1 hour gray
  - Terminal activity now seeds/refreshes from persisted session-state file mtimes when useful.
- Empty browser groups:
  - Browser groups suppress `.group-sessions` entirely when empty to avoid layout gaps.
  - Non-browser groups still render the “No sessions” drop target.

### 4. Session actions: rename, resume, fork, full reload, sleep/wake

Primary drill-down:

- `terminal_title_normalization_facts.md`
- `session_rename_title_auto_summarization_facts.md`
- `sidebar_session_fork_support_facts.md`
- `sidebar_fork_session_behavior_facts.md`
- `workspace_session_sleep_wake_support_facts.md`
- `default_agent_commands_override_facts.md`

Key structure:

- Title normalization/persistence:
  - `normalizeTerminalTitle` trims and strips leading glyph/status markers using pattern:
    - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
  - `getVisibleTerminalTitle` hides titles starting with `~` or `/`.
  - Preferred title precedence: visible terminal title -> visible primary session title -> undefined.
  - Persisted session state normalizes whitespace and title values; writes are atomic via temp-file + rename.
  - Persisted status accepts only `idle | working | attention`.
  - Controller stores raw daemon terminal titles in `terminalTitleBySessionId` for activity handling.
- Session rename summarization:
  - Summarization happens only when `title.trim().length > 25`.
  - Threshold constant `SESSION_RENAME_SUMMARY_THRESHOLD = 25`.
  - Output max length `24` (`GENERATED_SESSION_TITLE_MAX_LENGTH = 24`).
  - Titles are sanitized/clamped; truncation prefers whole words.
  - Prompt rules: plain text only, no quotes/markdown/commentary/ending punctuation; prefer 2–4 words.
  - Codex uses `gpt-5.4-mini` with high reasoning effort; Claude uses `haiku` with high effort.
- Fork/full reload/resume support matrix:
  - Copy resume supports: `codex`, `claude`, `copilot`, `gemini`, `opencode`.
  - Fork and full reload support: `codex`, `claude` only.
  - Browser sessions cannot rename, fork, copy resume, or full reload from sidebar menus.
  - Detached resume auto-executes only for Codex/Claude; Gemini/Copilot/Opencode/custom are prefill-only.
- Fork implementation:
  - Sidebar message contract adds `{ type: "forkSession", sessionId: string }`.
  - Dispatch path runs through `extension/native-terminal-workspace/sidebar-message-dispatch.ts`.
  - Fork creates a sibling terminal in the same group directly after the source session.
  - Command formats:
    - Codex: `codex fork <preferred title>`
    - Claude: `claude --fork-session -r <preferred title>`
  - Delayed rename command follows after `FORK_RENAME_DELAY_MS = 4000` with `/rename fork <preferred title>`.
  - Quoting uses single-quote wrapping with embedded quote escaping.
- Full reload:
  - Restarts the terminal session and replays the generated resume command.
- Sleep/wake:
  - `isSleeping` persists in grouped workspace state.
  - Sleeping sessions are excluded from focus and visible split calculations.
  - Focusing a sleeping session wakes it.
  - Group sleep/wake applies to all sessions in the group.
  - Sleeping terminal sessions dispose live runtime/surface but retain card and resume metadata.
  - Sidebar messages include `setSessionSleeping`, `setGroupSleeping`, and `focusSession`.

### 5. Grouped workspace state model

Primary drill-down:

- `simple_grouped_session_workspace_state_facts.md`

Key structure:

- Core file: `shared/simple-grouped-session-workspace-state.ts` with tests in `.test.ts`.
- Normalization:
  - Undefined snapshot defaults via `createDefaultGroupedSessionWorkspaceSnapshot()`.
  - Ensures at least one group with `DEFAULT_MAIN_GROUP_ID`.
  - Normalizes display IDs before per-group normalization.
  - Browser sessions are stripped during normalization.
  - Canonical session IDs derive from display IDs as `session-${formatSessionDisplayId(displayId ?? 0)}`.
- Behavior invariants:
  - Empty groups are retained after removing last session.
  - Active-group fallback prefers nearest previous populated group before later groups.
  - Group-local `visibleSessionIds` are preserved/restored on group switching.
  - If visible count is 1, normalized visible IDs are `[focusedSessionId]`.
  - New session creation allocates first free display ID, appends to active group, focuses it, recomputes visible IDs.
  - Destination groups become active and focused after session moves.
  - Fullscreen stores/restores `fullscreenRestoreVisibleCount`.
  - Group indexing for focus-by-index is 1-based.
  - T3 metadata updates only touch `kind === t3` sessions.
- Limits/examples:
  - Group creation aborts at `MAX_GROUP_COUNT`.
  - Tests validate duplicate display ID repair, active-group fallback, split visibility behavior, canonical drag removal, and stable T3 metadata identity.

### 6. Agent Manager X bridge and focus path

Primary drill-down:

- `agent_manager_x_bridge_integration_facts.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

Key structure:

- Bridge endpoint and transport:
  - WebSocket broker URL: `ws://127.0.0.1:47652/vsmux`.
  - Handshake timeout `3000ms`.
  - `perMessageDeflate` disabled.
  - Reconnect backoff starts at `1000ms`, doubles to a `5000ms` cap.
- Snapshot behavior:
  - Snapshots are memory-only, not persisted to disk.
  - Snapshot publish requires latest snapshot, open socket, and changed serialized content.
  - Incoming `ping` messages are ignored.
- Controller integration:
  - `NativeTerminalWorkspaceController` constructs the bridge and logs via `logVSmuxDebug`.
  - `initialize()` publishes an Agent Manager X snapshot.
  - `focusSession` only executes when incoming `workspaceId` matches latest snapshot workspaceId.
- Focus-path adjustment:
  - `focusSessionFromAgentManagerX` now focuses target session directly.
  - Broker-driven jumps no longer force sidebar container re-open first.
  - Visible sidebar reload/re-hydration artifact was eliminated.
  - Existing workspace focus behavior is preserved.
  - Related constants preserved in the same controller:
    - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
    - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
    - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
    - `FORK_RENAME_DELAY_MS = 4000`
    - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### 7. T3 runtime and workspace/browser integration

Primary drill-down:

- `workspace_browser_t3_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`

Key structure:

- Workspace/browser/T3 integration:
  - Browser sidebar excludes internal VSmux workspace and T3-owned tabs.
  - Workspace panel identity: type `vsmux.workspace`, title `VSmux`.
  - Local resource roots include `out/workspace` and `forks/t3code-embed/dist`.
  - T3 activity comes from `T3ActivityMonitor` over WebSocket, not hardcoded idle.
  - Monitor responds to Ping with `pong` and debounces refreshes on domain-event chunks.
  - T3 focus acknowledgement is completion-marker-aware.
  - Workspace groups render from authoritative `sessionIdsByGroup` payload.
- Managed runtime upgrade facts:
  - Updated managed T3 runtime endpoint is `127.0.0.1:3774`; legacy notes still mention `127.0.0.1:3773`.
  - Real WebSocket endpoint is `/ws`.
  - Effect RPC request IDs are numeric strings, not UUIDs.
  - Managed runtime source entrypoint:
    - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - Mixed-install recovery requires syncing upstream, overlay, and dist from tested refresh worktree into main.

### 8. Packaging, extension identity, and AI DevTools/chat-history integration

Primary drill-down:

- `vsmux_packaging_and_embed_validation_facts.md`
- `vsmux_ai_devtools_integration_facts.md`
- `viewer_search_and_resume_actions_facts.md`
- `vsmux_search_rename_facts.md`

Key structure:

- Extension/package identity:
  - Display name: **VSmux - T3code & Agent CLIs Manager**
  - Publisher: `maddada`
  - Main entry: `./out/extension/extension.js`
  - Repository: `https://github.com/maddada/VSmux.git`
  - Icon: `media/VSmux-marketplace-icon.png`
  - Version: `2.6.0`
  - VS Code engine: `^1.100.0`
  - Package manager: `pnpm@10.14.0`
- Containers and activation:
  - Primary Activity Bar container: `VSmuxSessions`
  - Primary view: `VSmux.sessions`
  - Secondary container: `VSmuxSessionsSecondary`
  - Activation events: `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`
- Build/dependencies:
  - Root build runs sidebar, debug-panel, workspace, chat-history webview build, TS compile, vendor runtime deps.
  - Chat-history outputs to `chat-history/dist`; asset roots are `chat-history/dist` and `chat-history/media`.
  - Extension TS compile includes `extension`, `shared`, and `chat-history/src/extension`.
  - TS target `ES2024`; chat-history webview targets `es2020` with `iife`.
  - `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`.
  - pnpm overrides `vite` and `vitest` to `@voidzero-dev` packages.
- AI DevTools integration:
  - VSmux remains the single shipped extension host.
  - `aiDevtools.conversations` is registered under `VSmuxSessions`, below `VSmux.sessions`.
  - Viewer panels use `retainContextWhenHidden: false`.
  - `ai-devtools.suspend` disposes current panel, clears provider cache, and marks suspended state for memory release.
- Conversation viewer search/resume:
  - Search shortcut: `Cmd/Ctrl+F`.
  - Search implementation uses native `window.find`.
  - Search controls: `Enter`, `Shift+Enter`, `Escape`.
  - Resume button requires inferred source and parsed `sessionId`.
  - Source inference maps:
    - `/.codex/`, `/.codex-profiles/` -> Codex
    - `/.claude/`, `/.claude-profiles/` -> Claude
  - Webview posts `resumeSession` with `source`, `sessionId`, optional `cwd`.
  - Resume commands:
    - Claude: `claude --resume <sessionId>`
    - Codex: `codex resume <sessionId>`
  - Shell quoting uses `quoteShellLiteral`.
  - Invalid JSONL/schema failures become `x-error` records.
- VSmux Search rename:
  - Search view id `VSmuxSearch.conversations`, label `VSmux Search`.
  - Standalone package name `vsmux-search-vscode`, publisher `vsmux-search`, activitybar container `vsmux-search`.
  - Viewer panel type `vsmuxSearchViewer`.
  - Export filenames prefix `vsmux-search-export-`.
  - Recent cutoff is 7 days; filter debounce is `150ms`.
  - Unknown tools are exported by default if they do not map to an option key.

### 9. Git text generation and default agent command settings

Primary drill-down:

- `git_text_generation_low_effort_provider_facts.md`
- `default_agent_commands_override_facts.md`

Key structure:

- Git text generation:
  - Setting `VSmux.gitTextGenerationProvider` defaults to `codex`.
  - Supported values: `codex | claude | custom`.
  - Codex built-in uses `gpt-5.4-mini` with `model_reasoning_effort="low"`.
  - Claude built-in uses `haiku` with `--effort low`.
  - Timeout is `180000ms`.
  - Codex execution uses stdin and non-interactive mode.
  - Custom commands may write to temp file or stdout.
  - Session rename numeric limits were intentionally preserved during provider update.
- Default agent command overrides:
  - `VSmux.defaultAgentCommands` is an application-scope object setting.
  - Built-in keys default to `null` for `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`.
  - Empty/whitespace strings normalize to `null`.
  - Sidebar default buttons use configured overrides only when no stored default preference exists.
  - Stored explicit session commands remain authoritative.
  - Legacy stock built-in commands may be upgraded to configured aliases during resume/fork action generation when the stored command exactly matches the built-in default.
  - Legacy string-only session launches normalize to `agentId: codex` with trimmed command.
  - Built-in session launch resolution supports `codex`, `claude`, `copilot`, `gemini`, `opencode`, but not `t3`.

### 10. Terminal font probing defaults

Primary drill-down:

- `restty_terminal_font_probing_defaults_facts.md`

Key structure:

- `workspace/restty-terminal-config.ts` distinguishes bundled defaults from custom font families.
- Constants:
  - `DEFAULT_TERMINAL_FONT_FAMILIES = MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New`
  - `DEFAULT_LOCAL_FONT_MATCHERS = MesloLGL Nerd Font Mono, MesloLGL Nerd Font`
- Behavior:
  - Unset/bundled default font family returns only the Meslo fallback URL source.
  - Custom font family retains optional local font source with `required: false`.

## Cross-cutting patterns

### Repeated stable constants

Repeated across multiple fact entries:

- Auto-focus guard: `400ms`
- Sidebar startup interaction block: `1500ms`
- Sidebar reorder threshold: `8px`
- Fork rename delay: `4000ms`
- Git text generation timeout: `180000ms`
- Workspace/Viewer `retainContextWhenHidden: false`
- T3 websocket URL pattern: `ws://127.0.0.1:3774/ws`

### Repeated architectural decisions

- Per-workspace daemon/runtime ownership instead of global process sharing.
- Sidebar/workspace prioritize replaying renderable state before transient state.
- User-visible titles/actions use normalized visible titles, while raw daemon titles remain for activity detection.
- Browser sessions are intentionally excluded from many terminal-only actions.
- Message flow is often preserved even when console/debug side effects are suppressed.

## Relationships to drill into

- Session actions and title rules are tightly linked across:
  - `terminal_title_normalization_facts.md`
  - `session_rename_title_auto_summarization_facts.md`
  - `sidebar_fork_session_behavior_facts.md`
  - `sidebar_session_fork_support_facts.md`
  - `default_agent_commands_override_facts.md`
- Workspace bootstrap, lag handling, and focus logic are distributed across:
  - `workspace_panel_startup_bootstrap_facts.md`
  - `workspace_panel_startup_without_loading_placeholder_facts.md`
  - `workspace_panel_startup_without_placeholder_facts.md`
  - `workspace_focus_and_drag_runtime_facts.md`
  - `workspace_focus_debugging_facts.md`
- Sidebar interaction/timestamp/debug behavior clusters across:
  - `sidebar_active_sessions_sort_mode_persistence_facts.md`
  - `sidebar_session_card_last_interaction_timestamp_facts.md`
  - `sidebar_debug_console_suppression_facts.md`
  - `workspace_debug_console_suppression_facts.md`
- Integration/identity/package concerns cluster across:
  - `vsmux_packaging_and_embed_validation_facts.md`
  - `vsmux_ai_devtools_integration_facts.md`
  - `workspace_browser_t3_integration_facts.md`
  - `t3_managed_runtime_upgrade_facts.md`
  - `viewer_search_and_resume_actions_facts.md`
  - `vsmux_search_rename_facts.md`

## Overall takeaway

The `facts/project` topic is a compact reference layer for VSmux’s implementation invariants: per-workspace daemon-backed terminal persistence, renderable-first workspace bootstrap, centralized focus ownership, strict session-action support matrices, normalized title-driven UX, memory-conscious webview usage, explicit packaging/runtime identities, and preserved message contracts even when UI/debug side effects are reduced.
