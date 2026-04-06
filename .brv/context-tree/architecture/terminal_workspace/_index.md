---
children_hash: 80eb5d4c6a49d4a006e7b796696108fea755c59635fe529f5f07ed88c1a583a7
compression_ratio: 0.14965280909008927
condensation_order: 1
covers:
  [
    context.md,
    current_state.md,
    t3_managed_runtime_upgrade_and_recovery.md,
    terminal_pane_runtime_thresholds_and_behaviors.md,
    terminal_persistence_across_reloads.md,
    terminal_persistence_across_vs_code_reloads.md,
    terminal_titles_activity_and_completion_sounds.md,
    terminal_titles_activity_and_sidebar_runtime.md,
    title_activity_and_sidebar_runtime.md,
    vsix_packaging_and_t3_embed_validation.md,
    workspace_browser_t3_integration.md,
    workspace_focus_and_sidebar_drag_semantics.md,
    workspace_focus_debugging.md,
    workspace_sidebar_interaction_state.md,
  ]
covers_token_total: 22178
summary_level: d1
token_count: 3319
type: summary
---

# terminal_workspace

## Overview

`context.md` defines the topic as the current-state architecture for workspace terminal rendering, pane retention, session projection, daemon lifecycle, and disconnected-state fallback. The core architecture is: Restty-based frontend terminal panes, sessionId-keyed runtime caching, projection of sessions from all groups, a per-workspace detached daemon, and persisted presentation state when live daemon state is unavailable.

## Core Architecture

Primary drill-down entries:

- `current_state.md`
- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

### Frontend runtime model

From `current_state.md`:

- Workspace renderer is **Restty**.
- Runtime cache key is the **sessionId** via `workspace/terminal-runtime-cache.ts`.
- Runtimes are reused per session and invalidated by `renderNonce` changes.
- `releaseCachedTerminalRuntime()` detaches/removes host DOM when refcount hits zero but does **not** destroy runtime.
- `destroyCachedTerminalRuntime()` fully destroys transport, Restty, and cache entry.

### Pane lifecycle

From `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`:

- Hidden connected panes remain **mounted and painted** behind the active pane; visibility flips should not trigger redraw.
- PTY connect waits for:
  1. appearance application,
  2. stable size resolution,
  3. transport readiness / connect.
- Stable size logic waits up to **20 attempts** and resolves after **2 identical measurements**.
- Startup visuals/background are bootstrap-only; startup background is `#121212`.

### Workspace projection and ordering

From `current_state.md`, `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_focus_and_sidebar_drag_semantics.md`:

- Workspace projects sessions from **all groups**, not just active panes.
- Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`.
- `localPaneOrder` is only a temporary override within currently visible session ids.
- This preserves passive split-slot stability when active sessions change.

### Backend daemon model

From `current_state.md`, `terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`:

- Terminal backend is **per-workspace**, not global.
- PTYs live in a detached daemon process, allowing survival across VS Code reloads.
- Daemon communication uses loopback WebSocket `/control` and `/session` endpoints.
- Managed/sidebar sessions stay alive through **lease renewal**.
- Background timeout is controlled by `VSmux.backgroundSessionTimeoutMinutes`, default **5 minutes**, `<= 0` disables timeout.

## Persistence Across Reloads

Primary drill-down entries:

- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

### Persistence layers

These entries describe a 3-part reload model:

1. `extension/session-grid-store.ts` persists grouped layout and session metadata in workspaceState under `VSmux.sessionGridSnapshot`.
2. Detached daemon (`extension/daemon-terminal-runtime.ts`, `extension/terminal-daemon-process.ts`) keeps PTYs alive.
3. Restored webview reconstructs panes and reattaches transports.

### Webview and restore behavior

- `WebviewPanelSerializer` restores the workspace panel.
- `retainContextWhenHidden: false` is intentional; reconstruction must come from persisted layout + daemon session state, not hidden webview memory.
- Session presentation fallback can come from persisted per-session state files when daemon state is absent.

### Replay and reconnect

- Reattach sends `terminalReady` before live attach.
- Replay history max buffer: **8 MiB**.
- Replay chunk size: **128 KiB**.
- Output produced during replay is queued, then flushed before switching to live streaming.
- Attach readiness timeout: **15_000 ms**.

### Daemon timing/state files

From both persistence entries:

- Control socket connect timeout: **3_000 ms**
- Daemon ready timeout: **10_000 ms**
- Owner heartbeat every **5_000 ms**
- Owner timeout: **20_000 ms**
- Startup grace / launch-lock stale timeout: **30_000 ms**
- Default idle shutdown: **5 \* 60_000 ms**
- State files: `daemon-info.json`, `daemon-launch.lock`
- Debug log: `terminal-daemon-debug.log`

## Focus, Activation, and Drag Semantics

Primary drill-down entries:

- `workspace_focus_debugging.md`
- `workspace_focus_and_sidebar_drag_semantics.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `workspace_sidebar_interaction_state.md`

### Focus ownership

A repeated architectural decision across these entries:

- `TerminalPane` emits **activation intent only**.
- `WorkspaceApp` owns authoritative focus decisions, guard logic, local focus visuals, and `focusSession` postMessage routing.

### Activation sources and guards

- Activation sources are `onActivate("pointer")` and fallback `onActivate("focusin")`.
- `focusin` should only fire after `:focus-within`.
- Auto-focus guard window is **400 ms** (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
- If another session is guarded during that window, competing activation is ignored.
- Header drag state can suppress terminal activation during workspace drag interactions.

### T3 iframe focus routing

From `workspace_focus_debugging.md`:

- T3 iframe focus messages use `type === "vsmuxT3Focus"`.
- Hidden panes are ignored.
- Auto-focus guard applies to iframe-originated focus too.
- Already-focused panes are ignored.
- Stale pending local focus is cleared when server focus changes to a different session.

### Sidebar reorder semantics

From `workspace_focus_and_sidebar_drag_semantics.md`, `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_sidebar_interaction_state.md`:

- Ordinary clicking must **not** reorder sessions.
- Reorder only occurs after real pointer movement for that same interaction.
- Meaningful reorder threshold: **8 px**.
- Non-touch drag activation distance: **6 px**.
- Touch drag activation: **250 ms** delay, **5 px** tolerance.
- Session-card hold-to-drag: **130 ms** delay, **12 px** tolerance.
- Startup interaction block: **1500 ms**.

### Message types

Key VS Code/webview message surfaces preserved across entries:

- Workspace: `ready`, `focusSession`, `closeSession`, `fullReloadSession`, `syncPaneOrder`, `syncSessionOrder`, `reloadWorkspacePanel`
- Sidebar reorder: `syncGroupOrder`, `moveSessionToGroup`, `syncSessionOrder`

## Terminal Runtime Thresholds and Input Behavior

Primary drill-down entries:

- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `workspace_sidebar_interaction_state.md`
- `current_state.md`

### Runtime thresholds

- Typing auto-scroll burst window: **450 ms**
- Trigger after **4 printable keypresses**
- Scroll-to-bottom button shows when distance from bottom exceeds **200 px**
- Hides below **40 px**
- Scheduler probe interval: **50 ms**
- Probe window: **5000 ms**
- Warning threshold: **250 ms** overshoot
- Lag threshold: average overshoot **>= 1000 ms** during first / monitor **10000 ms**, while visible and focused
- Reconnect performance probe window: **5000 ms**

### Hidden-pane and lag behavior

- Hidden panes stay painted behind active pane after PTY startup.
- Maintenance/redraw work is skipped for hidden connected panes.
- `AUTO_RELOAD_ON_LAG` is documented as `true`.

### Search lifecycle

From `terminal_pane_runtime_thresholds_and_behaviors.md`:

- Search open/update is per active pane.
- Closing search or zero-length query must call `clearSearch`.
- Empty search state constant: `{ resultCount: 0, resultIndex: -1 }`.
- Search close refocuses terminal on next animation frame.

### Keyboard mappings

Preserved mappings across runtime/interaction entries:

- `Shift+Enter` → `\x1b[13;2u`
- macOS `Meta+ArrowLeft` → `\x01`
- macOS `Meta+ArrowRight` → `\x05`
- Word navigation left/right:
  - macOS `Alt+ArrowLeft` / `Alt+ArrowRight` → `\x1bb` / `\x1bf`
  - non-Mac `Ctrl+ArrowLeft` / `Ctrl+ArrowRight` → `\x1bb` / `\x1bf`

## Titles, Activity, and Completion Sounds

Primary drill-down entries:

- `terminal_titles_activity_and_completion_sounds.md`
- `title_activity_and_sidebar_runtime.md`

### Title presentation

These entries establish terminal titles as first-class presentation state:

- Daemon snapshot/presentation updates carry live terminal titles.
- Visible title precedence:
  1. manual user title
  2. terminal title
  3. alias
- Generated `Session N` titles are not preferred visible primary titles.
- Visible terminal title sanitization strips leading spinner/braille/bullet characters and hides path-like titles beginning with `~` or `/`.

### Agent activity derivation

`extension/session-title-activity.ts` and related runtime/controller code infer activity from title markers:

- **Claude**
  - working: `⠐`, `⠂`, `·`
  - idle: `✳`, `*`
- **Codex**
  - working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- **Gemini**
  - working: `✦`
  - idle: `◇`
- **GitHub Copilot**
  - working: `🤖`
  - idle/attention: `🔔`

### Activity rules

Across both title/activity entries:

- Claude and Codex require **observed title transitions** before spinner glyphs count as working.
- Claude and Codex stop counting as working if spinner glyphs stop changing for **3 seconds**.
- Gemini and Copilot do not use the stale-spinner guard.
- Attention can surface only if there was a prior working phase of at least **3 seconds**.
- Title/activity changes use **targeted presentation patch messages**, not full rehydrates.
- Full reload is supported only for **Claude** and **Codex** sessions.

### Completion sounds

- Completion sounds are delayed **1 second** after attention appears.
- Sidebar embeds audio as data URLs in webview HTML.
- Playback uses unlocked `AudioContext`; delayed `HTMLAudio` and fetch-based decoding were unreliable in VS Code webviews.

## Workspace Panel, Browser Tabs, and T3 Integration

Primary drill-down entries:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`

### Workspace/browser integration

From `workspace_browser_t3_integration.md`:

- Workspace panel type: `vsmux.workspace`
- Visible title: `VSmux`
- Icon: `media/icon.svg`
- Browser sidebar group id: `browser-tabs`
- Internal VSmux/T3-owned tabs are excluded using explicit panel types, `vsmux.` viewType prefix, and localhost URL filtering for `/workspace` or `/t3-embed`.

### T3 activity integration

- T3 activity is websocket-backed, not always-idle.
- Default websocket URL: `ws://127.0.0.1:3774/ws`
- Snapshot RPC method: `orchestration.getSnapshot`
- Domain-event subscription: `subscribeOrchestrationDomainEvents`
- Request timeout: **15000 ms**
- Reconnect delay: **1500 ms**
- Refresh debounce: **100 ms**
- Ping/Pong handling is required.

### Managed T3 runtime upgrade model

From `t3_managed_runtime_upgrade_and_recovery.md`:

- Updated managed runtime runs on **127.0.0.1:3774**.
- Legacy runtime remains **127.0.0.1:3773**.
- Managed entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Request IDs for Effect RPC must be **numeric strings** (`"1"`, `"2"`, `"3"`), not UUIDs/labels.
- Required websocket route is `/ws`.
- Build path uses vendored upstream + overlay + rebuilt `forks/t3code-embed/dist`.
- Recovery for mixed installs: sync `forks/t3code-embed/upstream`, `overlay`, and `dist` from tested worktree into main, reinstall, restart managed runtime.

### VSIX packaging and validation

From `vsix_packaging_and_t3_embed_validation.md`:

- Extension version: **2.5.0**
- VS Code engine: `^1.100.0`
- Package manager: `pnpm@10.14.0`
- Main packaged surfaces include `forks/t3code-embed/dist/**`, `out/workspace/**`, `out/**`, `media/**`
- Packaging/install script: `scripts/vsix.mjs`
- Modes: `package`, `install`
- Optional flag: `--profile-build`
- Build step: `pnpm run compile`
- Package command: `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
- Install command: `<vscodeCli> --install-extension <vsixPath> --force`

### T3 embed validation pattern

A repeated operational rule across `vsix_packaging_and_t3_embed_validation.md` and `t3_managed_runtime_upgrade_and_recovery.md`:

- Reinstall the intended VSIX.
- Verify the installed T3 embed asset hash under `~/.vscode/extensions/maddada.vsmux-*/forks/t3code-embed/dist/assets/index-*.js`.
- Only then debug UI behavior.
- This prevents mismatch between localhost/browser checks and the actual installed VS Code webview bundle.

## Key Cross-Cutting Decisions

Repeated across many child entries:

- **SessionId is the stable identity** for terminal runtime caching.
- **Hidden pane freeze/preserve** is intentional for smooth pane switching.
- **Focus is centralized in `WorkspaceApp`**, with `TerminalPane` kept intent-only.
- **Visible pane order is derived from active group visibility**, not global filtered order.
- **Detached per-workspace daemon** is the persistence backbone across reloads.
- **Persisted presentation state** preserves titles/agent metadata when daemon state is absent.
- **Title-derived activity** drives sidebar/workspace session state, with stricter Claude/Codex spinner rules.
- **T3 integration is now managed, websocket-backed, and tied to the 3774 runtime**, with packaging/version alignment treated as operationally critical.
