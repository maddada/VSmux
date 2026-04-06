---
children_hash: 73070bc4146a4976a334351bb4defb412ecff6154bafc713f501d30d7b036b6b
compression_ratio: 0.0910322086792675
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
    sidebar_browsers_empty_state.md,
    sidebar_fork_session_behavior.md,
    sidebar_session_card_last_interaction_timestamps.md,
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
covers_token_total: 50949
summary_level: d1
token_count: 4638
type: summary
---

# terminal_workspace

## Overview

`terminal_workspace` captures the implemented VSmux workspace architecture across terminal rendering, grouped session state, sidebar interaction, persistence, T3 integration, Agent Manager X bridging, packaging, and auxiliary webviews. The core shape is: per-session Restty runtimes in the webview, grouped workspace/session state in shared models, a per-workspace detached daemon for PTYs, controller-owned focus/orchestration in the extension host, and sidebar/workspace UIs that derive display state from authoritative session/group snapshots.

## Core Runtime Architecture

Drill down: `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`

- The user-facing terminal renderer is **Restty**.
- Runtime cache identity is **`sessionId`**-based; runtimes are reused across mount/visibility changes and invalidated by `renderNonce` changes (`current_state.md`).
- Hidden panes stay **mounted and painted behind the active pane** rather than being torn down/redrawn on visibility flips (`current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`).
- PTY connect sequence is gated by:
  - appearance application,
  - stable size resolution,
  - then transport readiness / PTY attach (`current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`).
- Stable sizing waits up to **20 attempts** and resolves after **2 identical measurements** (`current_state.md`).
- Thresholds preserved in `terminal_pane_runtime_thresholds_and_behaviors.md`:
  - typing autoscroll: **450ms** burst, **4** printable keys
  - scroll-to-bottom hysteresis: show above **200px**, hide below **40px**
  - lag detection: **50ms** probes, **5000ms** probe window, **10000ms** monitor window, lag at **1000ms** avg overshoot, warn at **250ms**
- Keyboard mappings remain explicit:
  - `Shift+Enter -> \x1b[13;2u`
  - macOS `Meta+ArrowLeft -> \x01`, `Meta+ArrowRight -> \x05`
  - word navigation `\x1bb` / `\x1bf`

## Focus, Pane Ordering, and Drag Semantics

Drill down: `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_sidebar_interaction_state.md`

- **`WorkspaceApp` owns authoritative focus decisions**; `TerminalPane` emits activation intent only.
- Activation sources are `onActivate("pointer")` and fallback `onActivate("focusin")`.
- Visible split-pane order is derived from **`activeGroup.snapshot.visibleSessionIds`**, not by filtering a global order. `localPaneOrder` is only a temporary override within currently visible sessions.
- This preserves **passive split slot stability** when active sessions change.
- Auto-focus guard is **400ms** (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
- T3 iframe focus routing was added so `vsmuxT3Focus` events follow visibility and auto-focus guard checks (`workspace_focus_debugging.md`).
- Sidebar session reorder is intentionally protected from click-like interactions:
  - meaningful movement threshold: **8px**
  - startup interaction block: **1500ms**
  - non-touch drag distance: **6px**
  - touch drag activation: **250ms** delay with **5px** tolerance
  - session-card hold-to-drag: **130ms** delay with **12px** tolerance
- Reorder/move message surface includes `syncPaneOrder`, `syncSessionOrder`, `moveSessionToGroup`, and `focusSession`.

## Grouped Workspace State Model

Drill down: `simple_grouped_session_workspace_state.md`

- The canonical state logic lives in `shared/simple-grouped-session-workspace-state.ts`.
- Normalization guarantees:
  - at least one group exists,
  - browser sessions are dropped,
  - duplicate display IDs are repaired,
  - session IDs are canonicalized from display IDs via `session-${formatSessionDisplayId(displayId ?? 0)}`.
- Active-group fallback preserves emptied groups and prefers the **nearest previous non-empty group** before later groups.
- Per-group `visibleSessionIds` are remembered/restored when group focus changes.
- New sessions allocate the **first free display ID**, append to the active group, focus the new session, and recompute visible sessions.
- Group/session mutation APIs cover:
  - focus
  - remove
  - reorder
  - move between groups
  - create empty group
  - create group from session
  - fullscreen visible-count restore
  - T3 metadata updates while preserving session identity
- Snapshot equality uses `JSON.stringify(left) === JSON.stringify(right)`.

## Sleep/Wake Session Support

Drill down: `workspace_session_sleep_wake_support.md`

- Session records persist **`isSleeping`**.
- Sleeping sessions are excluded from awake focus and visible split calculations.
- Focusing a sleeping session implicitly wakes it.
- Group sleep/wake toggles all sessions in a group.
- Sleeping terminal sessions dispose their live runtime/surface while preserving session card and resume metadata.
- If sleep leaves the active group with no awake sessions, selection falls back to another non-empty group.

## Persistence Across VS Code Reloads

Drill down: `terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`

- Persistence is a 3-part architecture:
  1. `SessionGridStore` in workspace state
  2. detached per-workspace daemon for PTYs
  3. restored webview using cached Restty runtimes
- Workspace snapshot key: **`VSmux.sessionGridSnapshot`**.
- The daemon is per-workspace, not tied to extension-host lifetime.
- Reattach flow:
  - restore snapshot
  - reconnect to daemon
  - session socket waits for `terminalReady`
  - replay ring buffer
  - flush pending attach queue
  - switch to live attachment
- Preserved daemon thresholds:
  - control connect timeout: **3000ms**
  - daemon ready timeout: **10000ms**
  - launch lock stale threshold: **30000ms**
  - owner heartbeat: **5000ms**
  - owner heartbeat timeout: **20000ms**
  - startup grace: **30000ms**
  - session attach ready timeout: **15000ms**
  - replay cap: **8 MiB**
  - replay chunk size: **128 KiB**
- Session state files preserve title and agent metadata when daemon state is unavailable.
- `releaseCachedTerminalRuntime()` detaches DOM without destroying the runtime; full cleanup requires `destroyCachedTerminalRuntime()`.

## Workspace Panel Startup, Restoration, and Hotkeys

Drill down: `workspace_panel_startup_without_placeholder.md`, `workspace_panel_startup_without_loading_placeholder.md`, `workspace_panel_focus_hotkeys.md`

- Startup was redesigned to avoid a loading placeholder:
  - `openWorkspace` reveals sidebar first
  - creates a session or refreshes state before panel reveal
  - embeds latest renderable state in HTML via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- Replay order is structural:
  1. latest renderable state (`hydrate` or `sessionState`)
  2. latest transient message if distinct
- One-shot `autoFocusRequest` values are stripped before buffering so they are not replayed later.
- Duplicate stable state messages are ignored unless a new autofocus request id is present.
- Webview retains **`retainContextWhenHidden: false`**.
- Workspace panel identity is standardized as:
  - type: **`vsmux.workspace`**
  - title: **`VSmux`**
  - icon: `media/icon.svg`
- Focus-scoped hotkeys were extended using context key **`vsmux.workspacePanelFocus`**, synced from `panel.active && panel.visible`.
- Session/group/layout hotkeys now allow `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`; directional focus stays terminal-only.

## Terminal Titles, Activity Detection, and Completion Sounds

Drill down: `title_activity_and_sidebar_runtime.md`, `terminal_titles_activity_and_completion_sounds.md`, `terminal_title_normalization_and_session_actions.md`, `sidebar_session_card_last_interaction_timestamps.md`

- Terminal titles are treated as **first-class presentation state** from daemon/session updates.
- Title visibility/sanitization is centralized in `normalizeTerminalTitle()` and related helpers:
  - strips leading status/progress glyphs
  - hides titles beginning with `~` or `/`
  - generated titles matching `^Session \d+$` are not treated as visible primary titles
- Session-facing flows now prefer normalized visible terminal titles over stored user titles where applicable (`terminal_title_normalization_and_session_actions.md`).
- Raw `liveTitle` is still preserved in controller memory for title-derived activity detection.
- Agent activity is title-driven:
  - Claude/Codex use transition-aware spinner logic and a **3s** stale-spinner timeout
  - Gemini/Copilot use simpler marker-based detection
- Marker sets are preserved in `title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md`:
  - Claude working: `⠐ ⠂ ·`; idle: `✳ *`
  - Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini: `✦` working, `◇` idle
  - Copilot: `🤖` working, `🔔` idle/attention
- Attention is gated: a session must have been working for at least **3000ms** before attention can surface.
- Completion sounds are delayed by **1000ms**, embedded as data URLs, and played through unlocked `AudioContext` paths due to VS Code webview audio constraints.
- Sidebar last-interaction UI now uses discrete age bands:
  - 0–15 min bright green
  - 15–30 min faded green
  - 30–60 min muted green
  - > 1 hr gray
- Relative labels advance via a **1-second tick** hook.
- Terminal activity timestamps now seed/refresh from persisted session-state file mtimes when title or agent status changes.

## Session Rename Auto-Summarization

Drill down: `session_rename_title_auto_summarization.md`

- Rename summarization uses the git text generation subsystem but applies title-specific rules.
- Thresholds:
  - summarize only when `title.trim().length > 25`
  - generated title max length: **24**
- Prompt/output rules preserve:
  - plain text only
  - no quotes, markdown, or commentary
  - no ending punctuation
  - prefer **2–4 words**
  - must be fewer than **25 chars**
- Output handling:
  - first non-empty line
  - strip whole-response code fences
  - remove wrapping quotes
  - collapse whitespace
  - strip trailing periods
  - clamp with whole-word preference
- Provider details:
  - timeout: **180000ms**
  - Codex pinned to **`gpt-5.4-mini`** with high reasoning effort
  - Claude pinned to **haiku** with high effort

## Agent Command Resolution, Resume/Fork/Reload Actions

Drill down: `default_agent_commands_overrides.md`, `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, `terminal_title_normalization_and_session_actions.md`

- `VSmux.defaultAgentCommands` adds application-scope overrides for built-in agent IDs:
  - `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- Override values are trimmed; empty values normalize to `null`.
- Sidebar default-agent buttons use configured overrides only when no stored default agent preference exists.
- Legacy stored stock commands are upgraded to configured aliases during resume/fork resolution, but **explicit non-default stored commands remain authoritative**.
- Legacy string-only stored launch values normalize to `{ agentId: "codex", command }`.
- Supported built-ins for session launch resolution: `codex`, `claude`, `copilot`, `gemini`, `opencode` (not `t3`).
- Sidebar capability matrix:
  - copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - fork: `codex`, `claude`
  - full reload: `codex`, `claude`
  - browser sessions cannot rename/fork/copy-resume/full-reload
- Fork path:
  - context menu -> `forkSession`
  - validate source session/group/title/command
  - create sibling session in same group directly after source
  - reuse agent icon and stored launch metadata
  - attach backend and write fork command
  - delayed rename after **4000ms**
- Command signatures:
  - Codex fork: `<command> fork '<title>'`
  - Claude fork: `<command> --fork-session -r '<title>'`
  - Codex resume: `<command> resume '<title>'`
  - Claude resume: `<command> -r '<title>'`
- Detached resume auto-executes for Codex/Claude, but Gemini/Copilot/OpenCode produce guidance/prefill strings instead.

## Sidebar Rendering and Interaction Features

Drill down: `sidebar_browsers_empty_state.md`, `sidebar_active_sessions_sort_mode.md`, `sidebar_active_sessions_sort_mode_persistence.md`, `workspace_debug_console_suppression.md`

- Empty browser groups no longer render `.group-sessions`, eliminating extra gap beneath browser headers; non-browser groups still render `No sessions`.
- Active Sessions sort mode now supports:
  - `manual`
  - `lastActivity`
- Sort preference is persisted per workspace in `workspaceState` under **`VSmux.sidebarActiveSessionsSortMode`**.
- `lastActivity` mode:
  - sorts sessions by descending `lastInteractionAt`
  - sorts groups by most recent session activity
  - treats invalid/missing timestamps as `0`
  - preserves manual order as tie-breaker
  - does not overwrite stored manual order
  - disables group/session dragging while active
- The Active header exposes a sort toggle button posting `toggleActiveSessionsSortMode`.
- Sidebar debug console echoing was suppressed:
  - `sidebar/sidebar-debug.ts` is effectively a no-op helper
  - `sidebarDebugLog` messaging is preserved
  - Storybook harness still records message flow without browser console noise

## Browser and T3 Integration

Drill down: `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`, `vsix_packaging_and_t3_embed_validation.md`

- Browser sidebar integration excludes internal VSmux/T3-owned tabs by viewType and localhost URL filtering, including URLs matching local `/workspace` or `/t3-embed`.
- Browser sidebar group id: **`browser-tabs`**.
- T3 activity now comes from `T3ActivityMonitor` rather than static idle assumptions.
- T3 RPC/websocket facts:
  - websocket URL: **`ws://127.0.0.1:3774/ws`**
  - snapshot RPC: `orchestration.getSnapshot`
  - event subscription RPC: `subscribeOrchestrationDomainEvents`
  - request timeout: **15000ms**
  - reconnect delay: **1500ms**
  - refresh debounce: **100ms**
- Managed T3 runtime upgrade model (`t3_managed_runtime_upgrade_and_recovery.md`):
  - updated managed runtime on **127.0.0.1:3774**
  - legacy runtime on **127.0.0.1:3773**
  - server entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - protocol requires `/ws`, numeric-string request IDs (`^\d+$`), Ping/Pong, and Chunk/Ack/Exit streaming semantics
- Recovery guidance preserves a worktree-first upgrade flow, syncing `forks/t3code-embed/upstream`, `overlay`, and `dist` back into main only after validation.
- VSIX packaging/validation (`vsix_packaging_and_t3_embed_validation.md`) emphasizes:
  - build with `pnpm run compile`
  - package/install via `scripts/vsix.mjs`
  - verify installed T3 asset hash under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js` before debugging webview behavior

## Agent Manager X Integration

Drill down: `agent_manager_x_bridge_integration.md`, `agent_manager_x_focus_path_without_sidebar_rehydration.md`

- VSmux now includes a live **Agent Manager X WebSocket bridge**:
  - file: `extension/agent-manager-x-bridge.ts`
  - endpoint: **`ws://127.0.0.1:47652/vsmux`**
- `NativeTerminalWorkspaceController` owns a single `AgentManagerXBridgeClient`, publishes initial and changed workspace snapshots, and routes broker focus requests into workspace focus behavior.
- Snapshots include workspace metadata plus per-session:
  - agent
  - alias
  - displayName
  - `isFocused`
  - `isRunning`
  - `isVisible`
  - `kind`
  - `status`
  - optional `terminalTitle`
  - optional `threadId`
- Snapshot send rule:
  - only if a latest snapshot exists
  - socket is `WebSocket.OPEN`
  - serialized payload changed
- Reconnect backoff starts at **1000ms** and caps at **5000ms**.
- Snapshots are in-memory only; no disk persistence.
- Bridge command `focusSession` is accepted only if payload is valid and `workspaceId` matches `latestSnapshot.workspaceId`.
- Focus path was refined so Agent Manager X jumps no longer force sidebar container rehydration:
  - `focusSessionFromAgentManagerX` now focuses the target session directly
  - workspace focus behavior is preserved
  - visible sidebar reload artifact is removed

## Font Source Defaults

Drill down: `restty_terminal_font_probing_defaults.md`

- `workspace/restty-terminal-config.ts` now detects when VSmux is using the bundled default font stack:
  - `MesloLGL Nerd Font Mono`, `Menlo`, `Monaco`, `Courier New`
- If font family is unset or matches the bundled default stack, Restty returns only the bundled Meslo URL fallback and **skips optional local probing**.
- Custom non-generic font families still prepend an optional local source before the bundled fallback.
- Generic families like `monospace` and `serif` are filtered out.

## AI DevTools / Chat History Integration

Drill down: `vsmux_ai_devtools_integration.md`

- VSmux remains the **single shipped VS Code extension host**, but now activates copied chat-history extension code.
- `aiDevtools.conversations` is registered as a webview view under the existing `VSmuxSessions` sidebar container, below `VSmux.sessions`.
- Dedicated build output: **`chat-history/dist`**.
- Packaging now includes chat-history `dist` and media assets.
- Extension build pipeline now includes:
  - sidebar build
  - debug-panel build
  - workspace build
  - `chat-history:webview:build`
  - TypeScript compile
  - runtime dep vendoring
- Chat-history webview uses `retainContextWhenHidden: false` for memory efficiency.
- `ai-devtools.suspend` disposes the panel, clears cache, and enters suspended state.

## Cross-Cutting Patterns and Stable Decisions

Across these entries, several implementation rules recur and form the topic-level architecture:

- **State authority** lives in normalized workspace/group/session snapshots, not ad hoc UI order.
- **Focus authority** lives in `WorkspaceApp` / controller orchestration, not individual panes.
- **Render/runtime reuse** is preferred over teardown for pane switches and reload recovery.
- **Transient UI events** such as title/activity changes use targeted patching instead of full rehydration.
- **Manual order remains source of truth** even when alternate display orderings like `lastActivity` are layered on top.
- **User-facing title flows** use normalized visible titles, while raw titles remain available for activity derivation.
- **Per-workspace scoping** is used repeatedly for daemon lifecycle, sort preferences, and managed state.
- **Bootstrap-first webview restoration** replaces placeholder-first startup throughout the workspace panel path.
