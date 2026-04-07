---
children_hash: f2f8d686d69de7d4c4b5e89185ed3b2b3d44055144669be3e6f37fcc9accfbc5
compression_ratio: 0.08807821734107917
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration.md,
    agent_manager_x_focus_path_without_sidebar_rehydration.md,
    context.md,
    current_state.md,
    default_agent_commands_overrides.md,
    restty_terminal_font_probing_defaults.md,
    session_rename_title_auto_summarization.md,
    sidebar_active_sessions_sort_mode.md,
    sidebar_active_sessions_sort_mode_persistence.md,
    sidebar_active_sessions_sort_toggle_group_ordering.md,
    sidebar_browsers_empty_state.md,
    sidebar_double_click_session_creation_setting.md,
    sidebar_drag_indicators_explicit_dnd_drop_targets.md,
    sidebar_drag_reorder_debug_logging.md,
    sidebar_drag_reorder_large_group_preservation.md,
    sidebar_drag_reorder_recovery.md,
    sidebar_fork_session_behavior.md,
    sidebar_group_full_reload.md,
    sidebar_session_card_last_interaction_timestamps.md,
    sidebar_session_card_timestamp_compact_display.md,
    sidebar_session_fork_support.md,
    simple_grouped_session_workspace_state.md,
    t3_managed_runtime_upgrade_and_recovery.md,
    terminal_pane_runtime_thresholds_and_behaviors.md,
    terminal_persistence_across_reloads.md,
    terminal_persistence_across_vs_code_reloads.md,
    terminal_title_normalization_and_session_actions.md,
    terminal_titles_activity_and_completion_sounds.md,
    terminal_titles_activity_and_sidebar_runtime.md,
    title_activity_and_sidebar_runtime.md,
    vsix_packaging_and_t3_embed_validation.md,
    vsmux_ai_devtools_integration.md,
    workspace_browser_t3_integration.md,
    workspace_debug_console_suppression.md,
    workspace_focus_and_sidebar_drag_semantics.md,
    workspace_focus_debugging.md,
    workspace_panel_focus_hotkeys.md,
    workspace_panel_startup_without_loading_placeholder.md,
    workspace_panel_startup_without_placeholder.md,
    workspace_session_sleep_wake_support.md,
    workspace_sidebar_interaction_state.md,
  ]
covers_token_total: 59731
summary_level: d1
token_count: 5261
type: summary
---

# Terminal Workspace Structural Summary

## Topic Scope

`terminal_workspace` documents the current VSmux workspace architecture across:

- terminal runtime and pane lifecycle
- grouped workspace/session state
- sidebar ordering, drag/drop, and interaction rules
- title/activity propagation
- persistence across reloads
- T3/browser integration
- Agent Manager X bridge integration
- packaging and embedded webview/runtime behavior

Core baseline: see `context.md` and `current_state.md`.

---

## 1. Core Runtime and Workspace Architecture

### Current architecture

`current_state.md` is the anchor entry for the implemented model:

- **Restty** is the terminal renderer.
- Runtime cache keys are **stable per `sessionId`**.
- Hidden panes remain **mounted and painted** rather than being torn down on pane switches.
- Workspace projects sessions from **all groups**, not just currently active panes.
- Backend daemon is **per-workspace**, renews managed-session leases, and falls back to **persisted disconnected session state** when daemon state is unavailable.

Key files:

- `workspace/terminal-runtime-cache.ts`
- `workspace/terminal-pane.tsx`
- `workspace/workspace-app.tsx`
- `extension/native-terminal-workspace/workspace-pane-session-projection.ts`
- `extension/daemon-terminal-workspace-backend.ts`

### Terminal pane runtime behavior

`terminal_pane_runtime_thresholds_and_behaviors.md` adds the detailed thresholds:

- PTY connect waits for appearance application and stable terminal size.
- Stable size resolution: up to **20 attempts**, requiring **2 identical measurements**.
- Hidden panes stay painted after connection starts.
- Typing auto-scroll: **4 printable keypresses** within **450ms**.
- Scroll-to-bottom button hysteresis: show after **200px**, hide below **40px**.
- Scheduler lag: average overshoot **>= 1000ms** within **10000ms** window, sampled every **50ms**, warning threshold **250ms**.
- Search lifecycle and raw keyboard mappings are centralized here.

See also:

- `workspace_sidebar_interaction_state.md`
- `workspace_focus_and_sidebar_drag_semantics.md`

### Font behavior

`restty_terminal_font_probing_defaults.md` documents font source selection in `workspace/restty-terminal-config.ts`:

- Default built-in font stack: **MesloLGL Nerd Font Mono, Menlo, Monaco, Courier New**.
- If font family is unset or matches the bundled default stack, Restty uses only the bundled **Meslo fallback URL source**.
- Local probing remains enabled for custom families like `"Fira Code"`.

---

## 2. Workspace Focus, Pane Ordering, and Startup

### Focus ownership model

Across `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, and `workspace_sidebar_interaction_state.md`:

- `TerminalPane` emits **activation intent** only (`pointer` / `focusin`).
- `WorkspaceApp` owns **stateful focus decisions**.
- Visible split-pane order comes from the **active group’s `visibleSessionIds`**, not global pane order.
- `localPaneOrder` is only a temporary override within the currently visible set.
- Auto-focus guard duration is **400ms**.

`workspace_focus_debugging.md` adds:

- stale pending local focus requests are cleared if server focus changes to another session
- T3 iframe focus messages use type **`vsmuxT3Focus`**
- hidden panes and auto-focus-guarded panes ignore iframe focus requests with explicit debug events

### Workspace panel startup and bootstrap

`workspace_panel_startup_without_placeholder.md` and `workspace_panel_startup_without_loading_placeholder.md` describe the startup path:

- `openWorkspace` reveals the sidebar first.
- If no sessions exist, it creates a session before panel reveal.
- `WorkspacePanelManager` buffers:
  - `latestRenderableMessage`
  - `latestMessage`
- Renderable state (`hydrate` / `sessionState`) is embedded into HTML via:
  - `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- Replay order is:
  1. latest renderable state
  2. later transient message (for example `terminalPresentationChanged`)
- One-shot `autoFocusRequest` fields are stripped from replay buffers.
- `retainContextWhenHidden` is **false**.

### Focus hotkeys

`workspace_panel_focus_hotkeys.md` adds panel-focus-aware keybindings:

- context key: **`vsmux.workspacePanelFocus`**
- synced from `panel.active && panel.visible`
- workspace/session/layout hotkeys use:
  - `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`
- directional focus hotkeys remain `terminalFocus` only

---

## 3. Persistence, Daemon Lifecycle, and Recovery

### Persistence across VS Code reloads

`terminal_persistence_across_vs_code_reloads.md` and `terminal_persistence_across_reloads.md` describe the 3-part persistence architecture:

1. `SessionGridStore` in workspace state
2. detached **per-workspace Node.js daemon**
3. restored webview with cached Restty runtimes

Important facts:

- Workspace snapshot key: **`VSmux.sessionGridSnapshot`**
- Daemon state uses:
  - `daemon-info.json`
  - `daemon-launch.lock`
- PTYs survive reload because they live in the daemon, not the webview.
- Reattach path: `terminalReady` handshake -> replay ring buffer -> flush pending attach queue -> promote to live attachment.

Key thresholds:

- control connect timeout: **3000ms**
- daemon ready timeout: **10000ms**
- owner heartbeat interval: **5000ms**
- owner heartbeat timeout: **20000ms**
- startup grace: **30000ms**
- attach ready timeout: **15000ms**
- replay history cap: **8 MiB**
- replay chunk size: **128 KiB**

### Runtime cache semantics

From `current_state.md` and `terminal_persistence_across_reloads.md`:

- `releaseCachedTerminalRuntime()` detaches DOM / decrements refs without destroying the runtime
- `destroyCachedTerminalRuntime()` fully destroys transport, Restty, and cache entry

---

## 4. Session and Grouped Workspace State

### Simple grouped workspace state

`simple_grouped_session_workspace_state.md` defines the grouped snapshot normalization and mutation model in `shared/simple-grouped-session-workspace-state.ts`:

- ensures at least one group exists
- drops browser sessions during normalization
- canonicalizes session IDs from display IDs:
  - `session-${formatSessionDisplayId(displayId ?? 0)}`
- repairs duplicate display IDs
- preserves emptied groups when the last session is removed
- fallback active-group selection prefers the **nearest previous non-empty group**, then next
- visible session restoration is **group-local**
- split-mode creation preserves visible sessions
- fullscreen stores/restores `fullscreenRestoreVisibleCount`

### Sleep/wake support

`workspace_session_sleep_wake_support.md` extends that state model:

- sessions persist `isSleeping`
- sleeping sessions are excluded from focus and visible split calculations
- focusing a sleeping session wakes it
- group sleep/wake toggles all sessions
- sleeping disposes terminal surfaces while preserving resume metadata

### Same-group reorder preservation

`sidebar_drag_reorder_large_group_preservation.md` introduces shared helper `shared/session-order-reorder.ts`:

- same-group manual reorder now bypasses the old 9-slot grid normalization path
- preserves groups larger than 9 sessions
- accepts exact current IDs or canonical IDs
- browser sessions remain excluded from reorder/normalization
- focus is retained only if still visible after reorder

---

## 5. Sidebar Ordering, Drag/Drop, and Interaction Model

### Active sort modes

The sort-mode family includes:

- `sidebar_active_sessions_sort_mode.md`
- `sidebar_active_sessions_sort_mode_persistence.md`
- `sidebar_active_sessions_sort_toggle_group_ordering.md`

Combined behavior:

- sort modes: **`manual`** and **`lastActivity`**
- persisted per workspace in `workspaceState`
- toggled by `toggleActiveSessionsSortMode`
- **workspace groups remain manually ordered in all modes**
- only sessions within each group reorder by `lastInteractionAt`
- ties fall back to original manual order
- invalid or missing timestamps become **0**
- drag-and-drop reorder is disabled outside manual mode
- `SessionGroupSection` must render the ordered IDs passed from `SidebarApp`

### Drag/drop model

The drag-related entries are:

- `sidebar_drag_reorder_recovery.md`
- `sidebar_drag_indicators_explicit_dnd_drop_targets.md`
- `sidebar_drag_reorder_debug_logging.md`

Key architecture:

- explicit DnD drop targets replaced primarily DOM-hit-tested indicators
- session cards expose before/after droppable surfaces
- empty groups expose explicit group-start drop targets
- fallback DOM point resolution remains as backup
- same-group reorder posts `syncSessionOrder`
- cross-group moves post `moveSessionToGroup`
- group reorder posts `syncGroupOrder`

Important thresholds:

- startup interaction block: **1500ms**
- pointer reorder threshold: **8px**
- top-level touch drag activation: **250ms** delay, tolerance **5**
- pointer drag activation distance: **6**
- per-session drag hold delay: **130ms**, tolerance **12px**

Recovery behavior from `sidebar_drag_reorder_recovery.md`:

- sanitize drag output by ignoring unknown and duplicate IDs
- append omitted authoritative sessions back to their original group tail
- preserve intentional cross-group moves
- debug event: `session.dragRecoveredOmittedSessions`

Debugging from `sidebar_drag_reorder_debug_logging.md`:

- logging gated by `VSmux.debuggingMode`
- mirror output to:
  - output channel **`VSmux Debug`**
  - `~/Desktop/vsmux-debug.log`

### Console suppression

`workspace_debug_console_suppression.md`:

- `sidebar/sidebar-debug.ts` is now effectively a no-op for browser console logging
- message flow for `sidebarDebugLog` remains intact
- Storybook harness still records messages without console noise

### Empty-state and double-click behavior

- `sidebar_browsers_empty_state.md`: empty browser groups no longer render `.group-sessions`, removing layout gap under browser headers
- `sidebar_double_click_session_creation_setting.md`:
  - new setting: **`VSmux.createSessionOnSidebarDoubleClick`**
  - default **false**
  - double-click empty-space session creation is now gated by that setting and blocked on interactive / `[data-empty-space-blocking="true"]` targets

---

## 6. Session Cards, Timestamps, Titles, and Activity

### Last interaction timestamps

`sidebar_session_card_last_interaction_timestamps.md` and `sidebar_session_card_timestamp_compact_display.md` define the timestamp UX:

- discrete age buckets:
  - 0–15 min bright green
  - 15–30 min faded green
  - 30–60 min muted green
  - 1h+ gray
- 1-second UI tick updates relative labels in place
- compact display now renders only `formatRelativeTime(...).value`
  - examples: `3h`, `5m`
- timestamp moved into `.session-head` on the same row as title/actions
- native terminal activity timestamps are seeded/refreshed from persisted session-state file mtimes, plus command lifecycle updates

### Title normalization and session-facing actions

`terminal_title_normalization_and_session_actions.md` centralizes title handling:

- canonical sanitizer: `normalizeTerminalTitle()`
- strips leading glyphs/status markers with unicode-aware pattern
- hides normalized titles that start with `~` or `/`
- persistence stores normalized titles, not raw live daemon titles
- UI/session actions prefer **visible normalized terminal title** over user-entered session title
- raw `liveTitle` is still preserved in memory for activity derivation

### Title-driven activity and sounds

`title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md` describe the runtime activity model:

- terminal titles are first-class presentation state
- visible title precedence:
  1. manual title
  2. terminal title
  3. alias
- title-derived activity is agent-specific:
  - Claude working: `⠐ ⠂ ·`
  - Claude idle: `✳ *`
  - Codex spinner set: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini: `✦` working / `◇` idle
  - Copilot: `🤖` working / `🔔` idle-attention
- Claude/Codex require observed title transitions and stop counting as working if glyphs stop changing for **3 seconds**
- Gemini/Copilot do not use the stale-spinner guard
- attention only surfaces after at least **3 seconds** of prior working
- completion sound is confirmation-delayed by **1000ms**
- sounds are embedded as data URLs and played through `AudioContext`

### Native activity reset

`terminal_titles_activity_and_sidebar_runtime.md` adds backend timestamp refreshes on:

- shell-integration command start
- shell-integration command end
- existing writeText and terminal-state signals remain

---

## 7. Rename, Resume, Fork, Reload, and Agent Command Resolution

### Rename summarization

`session_rename_title_auto_summarization.md` defines session-title summarization:

- summarize only when `title.trim().length > 25`
- short titles (`<= 25`) are returned trimmed unchanged
- generated max output length: **24**
- provider prompt requires:
  - plain text only
  - no quotes / markdown / commentary / ending punctuation
  - prefer 2–4 words
- sanitization uses first non-empty line, strips wrappers, collapses whitespace, removes trailing periods, and truncates at whole-word boundaries when possible

### Default agent command overrides

`default_agent_commands_overrides.md` introduces:

- setting: **`VSmux.defaultAgentCommands`**
- built-in ids: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- values are trimmed; empty values become `null`
- sidebar default buttons use configured override only when no stored default preference exists
- stored explicit custom commands remain authoritative
- legacy stored stock commands can be upgraded to configured aliases during resume/fork resolution

### Fork / resume / reload capabilities

Primary entries:

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `sidebar_group_full_reload.md`

Rules and behavior:

- **Fork** only for **Codex** and **Claude** sessions with a visible preferred title
- **Full reload** only for **Codex** and **Claude**
- **Copy resume** supports `codex`, `claude`, `copilot`, `gemini`, `opencode`
- browser sessions cannot rename, fork, copy resume, or full reload

Commands:

- Codex resume: `<command> resume '<title>'`
- Claude resume: `<command> -r '<title>'`
- Codex fork: `<command> fork '<title>'`
- Claude fork: `<command> --fork-session -r '<title>'`

Fork behavior:

- creates sibling session in same group immediately after source
- reuses icon + stored launch metadata
- schedules delayed rename after **4000ms**
- delayed command format: `/rename fork <preferred title>`

Group full reload:

- UI now shows group Full reload for any non-browser group with sessions
- controller executes only for sessions whose `getFullReloadResumeCommand` returns a command
- mixed-support groups are allowed; skipped sessions produce partial-success info text

---

## 8. Browser and T3 Integration

### Browser + T3 workspace integration

`workspace_browser_t3_integration.md` is the main entry:

- Browser sidebar group id: **`browser-tabs`**
- internal VSmux workspace and T3-owned tabs are excluded from browser discovery
- restored workspace panel is standardized as:
  - panel type: **`vsmux.workspace`**
  - title: **`VSmux`**
  - icon: `media/icon.svg`
- T3 activity is websocket-backed, not always-idle
- sidebar workspace groups render from authoritative `sessionIdsByGroup` to avoid transient empty placeholders

T3 activity connection:

- default URL: **`ws://127.0.0.1:3774/ws`**
- snapshot RPC: `orchestration.getSnapshot`
- domain event subscription: `subscribeOrchestrationDomainEvents`
- request timeout: **15000ms**
- reconnect delay: **1500ms**
- refresh debounce: **100ms**

### Managed T3 runtime and recovery

`t3_managed_runtime_upgrade_and_recovery.md` documents embedded T3 lifecycle:

- managed runtime moved to vendored upstream entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- updated managed runtime uses **127.0.0.1:3774**
- legacy runtime remains on **127.0.0.1:3773**
- websocket route must be `/ws`
- RPC request IDs must be numeric strings (`^\d+$`)
- Ping must be answered with Pong
- streaming subscriptions use Chunk/Ack/Exit
- build flow centered on `scripts/build-t3-embed.mjs`

Recovery pattern:

- sync `forks/t3code-embed/upstream`, `overlay`, and `dist` from tested worktree into main
- reinstall
- restart managed 3774 runtime

### VSIX packaging and installed-asset validation

`vsix_packaging_and_t3_embed_validation.md`:

- package/install via `scripts/vsix.mjs`
- modes: `package`, `install`
- optional flag: `--profile-build`
- verify installed asset hash under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js` before debugging webview behavior
- distinguishes stale installed embed vs refreshed worktree embed

---

## 9. Agent Manager X Integration

### WebSocket bridge

`agent_manager_x_bridge_integration.md`:

- new bridge client in `extension/agent-manager-x-bridge.ts`
- connected from `NativeTerminalWorkspaceController`
- endpoint: **`ws://127.0.0.1:47652/vsmux`**
- controller publishes normalized `workspaceSnapshot` messages
- bridge accepts inbound `focusSession` commands
- snapshots remain **memory-only**, no disk persistence
- reconnect backoff: **1000ms**, doubling to **5000ms** cap
- socket config includes **3000ms handshake timeout** and per-message deflate disabled
- duplicate snapshot sends are suppressed using serialized payload comparison

### Focus path refinement

`agent_manager_x_focus_path_without_sidebar_rehydration.md`:

- `focusSessionFromAgentManagerX` now focuses the target session directly
- no forced sidebar container open / rehydration first
- workspace focus behavior is preserved
- change avoids visible sidebar reload artifact on broker-driven jumps

---

## 10. AI DevTools / Chat History Integration

`vsmux_ai_devtools_integration.md` adds ai-devtools into the shipped extension:

- VSmux remains the **single extension host**
- registers `aiDevtools.conversations` under the existing `VSmuxSessions` sidebar container
- build adds dedicated `chat-history/dist`
- packaged assets include `chat-history/dist` and `chat-history/media`
- extension activation order:
  1. `initializeVSmuxDebugLog`
  2. `activateChatHistory`
  3. construct `NativeTerminalWorkspaceController`
- chat-history viewer uses `retainContextWhenHidden: false`
- `ai-devtools.suspend` disposes panel, clears cache, and suspends for memory release

---

## Key Cross-Cutting Patterns

### Stable architectural decisions

Repeated across multiple entries:

- **WorkspaceApp owns focus state**; panes emit intent.
- **Visible pane order** comes from active-group `visibleSessionIds`.
- **Hidden panes remain painted** for smooth switching.
- **Detached per-workspace daemon** preserves PTYs across reloads.
- **Renderable-first replay** (`hydrate` / `sessionState`) precedes transient messages.
- **Manual group order is preserved**, even when activity sorting is enabled.
- **Sidebar reorder requires real movement**, not click-shaped interactions.
- **Session-facing titles are normalized**, while raw titles are preserved for activity logic.
- **Codex/Claude are the privileged executable agents** for fork/full-reload flows.
- **T3 and workspace webviews prioritize embedded/runtime-managed assets over localhost debugging assumptions**.

## Drill-Down Map

### Runtime / persistence

- `current_state.md`
- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `terminal_persistence_across_vs_code_reloads.md`
- `terminal_persistence_across_reloads.md`
- `restty_terminal_font_probing_defaults.md`

### Focus / startup / panel

- `workspace_focus_debugging.md`
- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_panel_startup_without_placeholder.md`
- `workspace_panel_startup_without_loading_placeholder.md`
- `workspace_panel_focus_hotkeys.md`

### Sidebar ordering / DnD

- `sidebar_active_sessions_sort_mode.md`
- `sidebar_active_sessions_sort_mode_persistence.md`
- `sidebar_active_sessions_sort_toggle_group_ordering.md`
- `sidebar_drag_indicators_explicit_dnd_drop_targets.md`
- `sidebar_drag_reorder_recovery.md`
- `sidebar_drag_reorder_large_group_preservation.md`
- `sidebar_drag_reorder_debug_logging.md`

### Titles / activity / timestamps

- `terminal_title_normalization_and_session_actions.md`
- `title_activity_and_sidebar_runtime.md`
- `terminal_titles_activity_and_completion_sounds.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `sidebar_session_card_last_interaction_timestamps.md`
- `sidebar_session_card_timestamp_compact_display.md`
- `session_rename_title_auto_summarization.md`

### Session/group actions

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `sidebar_group_full_reload.md`
- `default_agent_commands_overrides.md`
- `workspace_session_sleep_wake_support.md`

### Browser / T3 / packaging / integrations

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_ai_devtools_integration.md`
- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`
