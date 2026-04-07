---
children_hash: 2400603098ecb7a185fb510d2c432811e6f639b0722acb8dd97aaacc4798eb1e
compression_ratio: 0.7767628205128205
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 6240
summary_level: d2
token_count: 4847
type: summary
---

# Facts Domain Structural Summary

## Domain role

The `facts` domain stores quick-recall repository facts: technology choices, configuration defaults, behavioral invariants, operational thresholds, and release/package metadata. Long-form rationale lives in architecture topics; `facts/project/_index.md` is the main aggregation point for stable implementation details.

## Main topic: `project`

`project/_index.md` consolidates project facts across terminal workspace behavior, sidebar interaction rules, persistence/runtime constants, agent command handling, T3/browser integration, chat-history search/resume, packaging, and release metadata. Most entries are fact companions to `architecture/*` topics.

## Cross-cutting patterns

- **Workspace vs sidebar split**
  - Workspace/UI runtime centers on `workspace/workspace-app.tsx`, `workspace/terminal-pane.tsx`, `extension/workspace-panel.ts`, `extension/native-terminal-workspace/controller.ts`.
  - Sidebar/UI ordering logic centers on `sidebar/sidebar-app.tsx`, `sidebar/session-group-section.tsx`, `sidebar/sortable-session-card.tsx`.
- **Recurring message contracts**
  - Sidebar/action messages include `syncGroupOrder`, `syncSessionOrder`, `moveSessionToGroup`, `createSession`, `fullReloadGroup`, `forkSession`, `toggleActiveSessionsSortMode`, `sidebarDebugLog`.
  - Workspace/webview messages include `focusSession`, `syncPaneOrder`, legacy `syncSessionOrder`, `reloadWorkspacePanel`, `fullReloadSession`, `ready`.
- **Shared thresholds/constants**
  - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
  - `SIDEBAR_STARTUP_INTERACTION_BLOCK_MS = 1500`
  - pointer reorder threshold `8px`
  - non-touch drag distance `6px`
  - touch delay/tolerance `250ms` / `5`
  - session-card drag hold/tolerance `130ms` / `12`
- **Persistence model**
  - Workspace snapshot key: `VSmux.sessionGridSnapshot`
  - PTYs persist through a detached per-workspace daemon.
  - Webviews commonly use `retainContextWhenHidden: false`.
- **Agent capability matrix**
  - Resume/copy-resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - Fork/full reload: `codex`, `claude`
  - Browser sessions are excluded from many terminal-only actions.

## Terminal workspace runtime

Drill down: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `workspace_focus_debugging_facts.md`

- Renderer is **Restty**.
- Frontend runtime cache is keyed by `sessionId`; runtimes persist until explicit invalidation.
- Hidden panes stay mounted/painted instead of re-rendering on visibility flips.
- PTY attach waits for appearance completion and stable size.
- Visible pane order comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only temporary.
- `WorkspaceApp` is authoritative for focus; `TerminalPane` emits activation intent only.
- T3 iframe focus message type: `vsmuxT3Focus`.
- Lag detection uses 50ms probes over 5000ms windows; visible/focused lag thresholds are around 1000ms average overshoot; `AUTO_RELOAD_ON_LAG` is enabled.
- Scroll/typing heuristics:
  - show/hide scroll-to-bottom: `200px` / `40px`
  - typing auto-scroll: 4 printable keys within `450ms`

## Workspace panel startup and bootstrap

Drill down: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_panel_focus_hotkeys_facts.md`

- `openWorkspace` reveals sidebar first.
- Startup flows:
  - no-session: sidebar -> create session -> reveal workspace panel
  - existing-session: sidebar -> refresh workspace panel -> reveal panel -> refresh sidebar
- `WorkspacePanelManager` keeps `latestMessage` and `latestRenderableMessage`.
- Renderable message types are `hydrate` and `sessionState`.
- Bootstrap source is `window.VSMUX_WORKSPACE_BOOTSTRAP`.
- Ready replay order preserves latest renderable state first, then transient message if distinct.
- Duplicate stable state is suppressed unless `autoFocusRequest.requestId` changes.
- Panel metadata:
  - type `vsmux.workspace`
  - title `VSmux`
  - `retainContextWhenHidden: false`
  - local resource roots include `out/workspace` and `forks/t3code-embed/dist`
  - focus context key `vsmux.workspacePanelFocus`
  - broad hotkey clause `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`

## PTY persistence and daemon lifecycle

Drill down: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`

- Persistence stack: `SessionGridStore` + detached daemon + restored Restty/webview frontend.
- PTYs survive extension reloads via a per-workspace Node daemon using `ws` and `@lydell/node-pty`.
- State directory prefix: `terminal-daemon-${workspaceId}` with:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`
- Protocol/timing:
  - control connect timeout `3000ms`
  - daemon ready timeout `10000ms`
  - stale launch lock `30000ms`
  - heartbeat `5000ms` / timeout `20000ms`
  - startup grace `30000ms`
  - idle shutdown `5 * 60_000ms`
  - replay buffer `8 * 1024 * 1024`
  - replay chunk `128 * 1024`
  - attach ready timeout `15000ms`
- WebSocket upgrade endpoints `/control` and `/session` are token-authenticated.
- Requests requiring responses must include `requestId`.
- Restore order: reload -> workspaceState restore -> daemon reconnect -> session reconnect -> `terminalReady` -> replay -> flush pending output.
- Fallback metadata can come from persisted session files.
- PTYs use `xterm-256color`; `LANG` normalizes to `en_US.UTF-8` if needed.

## Grouped workspace state and sleep/wake

Drill down: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`, `sidebar_drag_reorder_large_group_preservation_facts.md`

- Normalization lives in `shared/simple-grouped-session-workspace-state.ts`.
- Invariants:
  - at least one group always exists
  - browser sessions are removed during normalization
  - canonical IDs use `session-${formatSessionDisplayId(displayId ?? 0)}`
  - new sessions take the first free display ID
- Empty groups are retained after last-session removal.
- Active-group fallback prefers nearest previous populated group.
- Focus/visible session behavior is deterministic across split/fullscreen transitions.
- Group reorder appends omitted existing groups after requested order.
- Same-group reorder fix preserves sessions even when group size exceeds 9.
- Reorder only succeeds when incoming IDs match current exact or canonical sets.
- Sleep/wake:
  - `isSleeping` persists in grouped workspace state
  - sleeping sessions are excluded from focus/visible split calculations
  - focusing a sleeping session wakes it
  - group sleep/wake applies to all non-browser sessions
  - sleep disposes live runtime/surface but keeps card/resume metadata

## Sidebar sorting, ordering, and drag/drop

Drill down: `sidebar_active_sessions_sort_mode_facts.md`, `sidebar_active_sessions_sort_mode_persistence_facts.md`, `sidebar_active_sessions_sort_toggle_group_ordering_facts.md`, `sidebar_drag_indicators_explicit_dnd_drop_targets_facts.md`, `sidebar_drag_reorder_recovery_facts.md`, `sidebar_drag_reorder_debug_logging_facts.md`

- `activeSessionsSortMode` values: `manual` or `lastActivity`, persisted per workspace in `workspaceState`.
- Key invariant: **group order remains manual in all sort modes**.
- `lastActivity` only reorders sessions within a group by `lastInteractionAt`.
- Missing/invalid activity timestamps resolve to `0`.
- Drag-and-drop reorder is disabled outside manual mode.
- `SessionGroupSection` must render `orderedSessionIds` from `SidebarApp`, not raw store order.
- Explicit DnD model:
  - explicit payloads are primary; DOM hit-testing is fallback
  - session cards expose `before` / `after` targets
  - empty groups expose `group/start`
  - `SidebarSessionDropTarget` supports group `start`/`end` and session `before`/`after`
  - target ID formats:
    - `session-drop-target:<groupId>:group:<position>`
    - `session-drop-target:<groupId>:<sessionId>:<position>`
- `moveSessionIdsByDropTarget` is the authoritative reorder algorithm.
- Recovery logic can restore omitted sessions and emits `session.dragRecoveredOmittedSessions` in debug mode.
- Debug logging is gated by `VSmux.debuggingMode`; output uses message type `sidebarDebugLog`, channel `VSmux Debug`, file `vsmux-debug.log`, mirrored to `~/Desktop/vsmux-debug.log`.

## Sidebar UI details

Drill down: `sidebar_browsers_empty_state_facts.md`, `sidebar_double_click_session_creation_setting_facts.md`, `sidebar_debug_console_suppression_facts.md`, `workspace_debug_console_suppression_facts.md`, `sidebar_session_card_last_interaction_timestamp_facts.md`, `sidebar_session_card_timestamp_compact_display_facts.md`

- Empty browser groups suppress `.group-sessions`; non-browser empty groups still show the “No sessions” drop target.
- Double-click session creation:
  - setting `VSmux.createSessionOnSidebarDoubleClick`
  - default `false`
  - HUD includes `createSessionOnSidebarDoubleClick`
  - only triggers on empty sidebar space when interaction is allowed
  - reuses `createSession`
- Sidebar browser-console debug logging is effectively suppressed; extension-side `sidebarDebugLog` flow remains intact.
- Storybook echo is also suppressed; regression coverage exists in `sidebar/sidebar-debug.test.ts`.
- Last-activity timestamps use age buckets:
  - 0–15m bright green
  - 15–30m slightly faded green
  - 30–60m muted green
  - > 1h gray
- UI ticks every second for relative updates.
- Compact timestamp moved into `.session-head` and uses value-only text like `5m`, `3h`.

## Session actions: rename, fork, full reload, command overrides

Drill down: `session_rename_title_auto_summarization_facts.md`, `terminal_title_normalization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `sidebar_group_full_reload_facts.md`, `default_agent_commands_override_facts.md`

- Terminal title normalization strips leading glyph/status prefixes matched by:
  - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- Titles starting with `~` or `/` are treated as non-visible.
- Session rename summarization only runs when `title.trim().length > 25`.
- Constants:
  - `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
  - `GENERATED_SESSION_TITLE_MAX_LENGTH = 24`
- Summary output rules favor plain 2–4 word text with no quotes/markdown/commentary/punctuation.
- Provider/model defaults:
  - Codex: `gpt-5.4-mini`, high reasoning effort
  - Claude: `haiku`, high effort
- Browser sessions cannot rename, fork, copy resume, or full reload from sidebar context menus.
- Fork behavior:
  - sidebar posts `forkSession`
  - controller inserts fork in same group directly after source session
  - metadata reused from `sidebarAgentIconBySessionId` and `sessionAgentLaunchBySessionId`
  - commands:
    - `codex fork <preferred title>`
    - `claude --fork-session -r <preferred title>`
  - delayed rename command `/rename fork <preferred title>`
  - `FORK_RENAME_DELAY_MS = 4000`
- Group full reload is shown for any non-browser group with sessions, but execution filters to sessions supported by `getFullReloadResumeCommand`; unsupported sessions are skipped and partial success is reported.
- Default command overrides:
  - setting `VSmux.defaultAgentCommands`
  - built-in keys default to `null` for `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
  - only trimmed non-empty overrides apply
  - explicit stored commands remain authoritative
  - resume/fork generation may upgrade legacy stock commands to aliases
  - launch resolution supports all listed agents except `t3`

## Git text generation facts

Drill down: `git_text_generation_low_effort_provider_facts.md`, `session_rename_title_auto_summarization_facts.md`, `vsmux_2_7_0_release_facts.md`

- Setting: `VSmux.gitTextGenerationProvider`
- Default provider: `codex`
- Supported values: `codex`, `claude`, `custom`
- Built-in low-effort configs:
  - Codex -> `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude -> `haiku` with `--effort low`
- Timeout: `180000ms`
- Codex mode uses stdin and disables interactive shell mode.
- Custom commands may return output via stdout or temp file.
- Provider migration preserved user-edited numeric session rename limits.
- `VSmux.gitTextGenerationAgentId` is deprecated in favor of provider/custom-command settings.

## Agent Manager X bridge

Drill down: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

- Broker URL: `ws://127.0.0.1:47652/vsmux`
- Handshake timeout `3000ms`, `perMessageDeflate` disabled.
- Reconnect backoff: `1000ms` doubling to `5000ms` max.
- Snapshots are memory-only and publish only when a latest snapshot exists, socket is open, and serialized snapshot changed.
- Ping messages are ignored.
- `focusSession` executes only when incoming `workspaceId` matches the latest snapshot `workspaceId`.
- Controller constructs `AgentManagerXBridgeClient` and routes logs through `logVSmuxDebug`.
- Broker-driven session jumps no longer force sidebar rehydration first; `focusSessionFromAgentManagerX` focuses the target session directly.
- Related constants surface here too:
  - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
  - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
  - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
  - `FORK_RENAME_DELAY_MS = 4000`
  - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

## T3, browser, and managed runtime

Drill down: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`, `restty_terminal_font_probing_defaults_facts.md`

- Browser sidebar excludes internal VSmux surfaces and T3-owned tabs.
- Workspace restore identity stays `vsmux.workspace` / `VSmux`.
- T3 activity is websocket-backed via `T3ActivityMonitor`.
- T3 focus acknowledgement uses completion-marker-aware acknowledge-thread behavior.
- Workspace groups render from authoritative `sessionIdsByGroup`.
- Panel roots include `forks/t3code-embed/dist`.
- Managed runtime endpoint updated to `127.0.0.1:3774`; migration notes mention legacy `127.0.0.1:3773`.
- Actual websocket endpoint is `/ws`.
- RPC request IDs are numeric strings, not UUIDs.
- Runtime source entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Mixed-install recovery requires syncing upstream, overlay, and dist from a tested worktree.
- Restty font defaults:
  - `DEFAULT_TERMINAL_FONT_FAMILIES`: `MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New`
  - `DEFAULT_LOCAL_FONT_MATCHERS`: `MesloLGL Nerd Font Mono`, `MesloLGL Nerd Font`
  - unset/default font-family uses only bundled Meslo fallback URL source
  - custom fonts may retain optional local source with `required: false`

## Chat history, search, and AI DevTools

Drill down: `viewer_search_and_resume_actions_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`

- Viewer search:
  - custom find bar on `Cmd/Ctrl+F`
  - native `window.find`
  - `Enter` next, `Shift+Enter` previous, `Escape` close
- Resume action requires inferred source and discovered `sessionId`.
- Source inference maps:
  - `/.codex/`, `/.codex-profiles/` -> Codex
  - `/.claude/`, `/.claude-profiles/` -> Claude
- Resume payload: `{ source, sessionId, cwd? }`
- Resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Resume terminal title: `AI DevTools Resume (<source>)`
- Invalid JSONL lines are converted to `x-error` records.
- Packaging/runtime integration:
  - VSmux is the sole shipped extension host
  - `aiDevtools.conversations` registers under `VSmuxSessions`
  - build output `chat-history/dist`
  - assets resolve from `chat-history/dist` and `chat-history/media`
  - build pipeline includes sidebar, debug-panel, workspace, chat-history webviews, TS compile, and vendor runtime deps
  - extension TS target `ES2024`
  - chat-history bundle target `es2020` IIFE
  - `ai-devtools.suspend` disposes panel, clears provider cache, marks suspended for memory release
- Search rename metadata:
  - view id `VSmuxSearch.conversations`
  - label `VSmux Search`
  - package `vsmux-search-vscode`
  - publisher `vsmux-search`
  - activitybar container `vsmux-search`
  - panel type `vsmuxSearchViewer`
  - export prefix `vsmux-search-export-`
  - recent cutoff `7 days`
  - filter debounce `150ms`
  - unknown tools export by default if no option-key mapping exists

## Packaging, VSIX, and release facts

Drill down: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_2_7_0_release_facts.md`

- Marketplace/package metadata:
  - display name `VSmux - T3code & Agent CLIs Manager`
  - publisher `maddada`
  - repository `https://github.com/maddada/VSmux.git`
  - main `./out/extension/extension.js`
  - icon `media/VSmux-marketplace-icon.png`
  - primary container/view `VSmuxSessions` / `VSmux.sessions`
  - secondary container `VSmuxSessionsSecondary`
- Activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`
- Dependency/package constraints:
  - `pnpm@10.14.0`
  - VS Code engine `^1.100.0`
  - overrides:
    - `vite -> npm:@voidzero-dev/vite-plus-core@latest`
    - `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
  - `restty@0.1.35` patched by `patches/restty@0.1.35.patch`
- VSIX/debugging rule: installed VSIX contents are authoritative when checking embed drift; documented mismatch compared `index-DCV3LG5L.js` vs stale `index-BbtZ0IEL.js`.
- Release `2.7.0`:
  - released `2026-04-07`
  - publish requires clean git worktree, non-detached `HEAD`, unique git tag
  - `VSmux Search` became built-in
  - Open VSX updated immediately while VS Code Marketplace initially still showed `2.6.0`

## Drill-down structure

- **Workspace runtime/focus/bootstrap**: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_panel_startup_bootstrap_facts.md`
- **Persistence/daemon**: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`
- **Workspace state/sleep/reorder correctness**: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`, `sidebar_drag_reorder_large_group_preservation_facts.md`
- **Sidebar sorting/DnD**: `sidebar_active_sessions_sort_mode_facts.md`, `sidebar_active_sessions_sort_mode_persistence_facts.md`, `sidebar_drag_indicators_explicit_dnd_drop_targets_facts.md`, `sidebar_drag_reorder_recovery_facts.md`
- **Session actions**: `terminal_title_normalization_facts.md`, `session_rename_title_auto_summarization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_group_full_reload_facts.md`, `default_agent_commands_override_facts.md`
- **Agent Manager X**: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`
- **T3/browser/runtime embed**: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`, `restty_terminal_font_probing_defaults_facts.md`
- **Chat-history/search**: `viewer_search_and_resume_actions_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`
- **Packaging/releases**: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_2_7_0_release_facts.md`
