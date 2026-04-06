---
children_hash: 5a8b8e822aa306c38b6086eba0dc85dd4f65ad2bad9941b347d34e50797e167c
compression_ratio: 0.3705411307934967
condensation_order: 1
covers:
  [
    context.md,
    t3_managed_runtime_upgrade_facts.md,
    terminal_persistence_across_vs_code_reloads_facts.md,
    terminal_persistence_reload_facts.md,
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    vsmux_packaging_and_embed_validation_facts.md,
    workspace_browser_t3_integration_facts.md,
    workspace_focus_and_drag_runtime_facts.md,
    workspace_focus_debugging_facts.md,
    workspace_sidebar_interaction_facts.md,
  ]
covers_token_total: 8242
summary_level: d1
token_count: 3054
type: summary
---

# Project Facts Structural Summary

## Overview

The `project` topic is a fact-only layer over the broader `architecture/terminal_workspace/*` notes. It captures stable implementation constants, identifiers, endpoints, thresholds, lifecycle rules, and packaging details for the terminal workspace, detached daemon persistence, sidebar/workspace interaction model, browser/T3 integration, and embedded T3 runtime upgrade flow.

## Major Fact Clusters

### 1. Terminal workspace runtime and rendering

Primary drill-down:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`

Core decisions:

- Terminal renderer is **Restty**.
- Frontend terminal runtimes are cached **per `sessionId`**.
- Runtime reuse is keyed by stable session identity and invalidated by **`renderNonce`** changes.
- `releaseCachedTerminalRuntime` only removes the host when `refCount` reaches zero; it does **not** destroy the runtime.
- `destroyCachedTerminalRuntime` fully destroys transport, Restty, host, and cache entry.

UI/runtime behavior:

- Hidden connected panes remain mounted/painted behind the active pane rather than being redrawn on visibility flips.
- PTY connection waits for appearance completion and stable size detection.
- Size stabilization allows up to **20 attempts** and returns after **2 identical measurements**.
- Startup visuals stop after first successful canvas reveal.

Ordering and projection:

- Visible pane order comes from **`activeGroup.snapshot.visibleSessionIds`**.
- `localPaneOrder` is only a temporary override within currently visible sessions.
- Session projection flattens all group session arrays into the workspace projection.
- Passive split-slot stability is intentionally preserved when switching active sessions.

### 2. Focus ownership, activation, and lag handling

Primary drill-down:

- `workspace_focus_debugging_facts.md`
- `terminal_workspace_runtime_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`

Focus model:

- **`WorkspaceApp`** is the authoritative owner of focus state and terminal activation decisions.
- `TerminalPane` only emits activation intent:
  - `onActivate("pointer")` from pointer capture on terminal root
  - `onActivate("focusin")` only as fallback after `:focus-within`
- Auto-focus guard constant is **400 ms** (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
- T3 iframe focus messages use type **`vsmuxT3Focus`**.
- Workspace-to-extension message types include **`focusSession`** and **`syncPaneOrder`**.

Lag detection:

- Auto reload on lag is enabled: **`AUTO_RELOAD_ON_LAG = true`**.
- Lag probe interval is **50 ms**.
- Probe window is **5000 ms**.
- Monitor window is **10000 ms**.
- Lag threshold is average overshoot **>= 1000 ms** under visible/focused conditions.
- Warning threshold begins at **250 ms**.
- Reconnect performance probes run for **5000 ms** and track frame count, max frame gap, and long-task metrics.

### 3. Detached daemon persistence across reloads

Primary drill-down:

- `terminal_persistence_reload_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`

Architecture:

- Persistence is a three-part system:
  1. `SessionGridStore`
  2. Detached per-workspace terminal daemon
  3. Restored webview using Restty renderers
- Snapshot persistence key in VS Code `workspaceState` is **`VSmux.sessionGridSnapshot`**.
- Daemon is **per-workspace**, not global.
- PTYs are owned by a detached daemon using **`ws`** and **`@lydell/node-pty`**.
- Daemon communicates over WebSocket endpoints:
  - **`/control`**
  - **`/session`**
  - host: **`127.0.0.1`**

Timing and limits:

- Control connect timeout: **3000 ms**
- Daemon ready timeout: **10000 ms**
- Owner heartbeat interval: **5000 ms**
- Owner heartbeat expiry: **20000 ms**
- Startup owner adoption grace: **30000 ms**
- Session attach `terminalReady` timeout: **15000 ms**
- Default idle shutdown timeout: **5 × 60_000 ms**
- Replay history max: **8 × 1024 × 1024 bytes**
- Replay chunk size: **128 × 1024 bytes**

Files and persistence artifacts:

- `daemon-info.json`
- `daemon-launch.lock`
- `terminal-daemon-debug.log`
- Per-session persisted state files preserve title and agent metadata when daemon is unavailable.

Lifecycle rules:

- Daemon shuts down on startup owner timeout, idle timeout, lease expiry with no sessions, `SIGTERM`, or `SIGINT`.
- Reattach is used when live daemon PTY still exists; recreation is distinguished by `didCreateSession`.

### 4. Session leases, background lifetime, and disconnected state

Primary drill-down:

- `terminal_workspace_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`

Session lifetime:

- Managed sidebar-listed sessions stay alive through synchronized and renewed leases while VS Code runs.
- Background timeout is controlled by **`VSmux.backgroundSessionTimeoutMinutes`**.
- Default background timeout is **5 minutes**.
- Values `<= 0` disable timeout.

Disconnected fallback:

- When daemon is unavailable, disconnected snapshots are populated from persisted session state.
- Sidebar can continue showing:
  - title
  - `agentName`
  - `agentStatus`

Title/activity behavior:

- Title-derived activity transitions include **working** and **attention**, and can be acknowledged back to **idle**.

### 5. Sidebar drag, interaction thresholds, and capability gates

Primary drill-down:

- `terminal_workspace_runtime_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`

Interaction safeguards:

- Startup interaction block: **1500 ms**
- Pointer reorder threshold: **8 px**
- Non-touch sensor activation distance: **6 px**
- Touch drag activation: **250 ms** delay with **5 px** tolerance
- Session-card drag hold: **130 ms** with **12 px** tolerance

Session card behavior:

- Click focuses session.
- Meta-click closes session.
- Middle click closes session.

Sidebar reorder messages:

- `syncGroupOrder`
- `moveSessionToGroup`
- `syncSessionOrder`

Context menu sizing:

- Width: **156 px**
- Item height: **34 px**
- Margin: **12 px**
- Vertical padding: **12 px**

Capability matrix:

- Resume command copy supported for agent icons:
  - `codex`
  - `claude`
  - `copilot`
  - `gemini`
  - `opencode`
- Full reload supported only for:
  - `codex`
  - `claude`

### 6. Terminal input, scroll, and typing behavior

Primary drill-down:

- `terminal_workspace_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`

Scroll behavior:

- Scroll-to-bottom button shows when distance from bottom exceeds **200 px**.
- It hides below **40 px**.

Typing auto-scroll:

- Uses **450 ms** burst window.
- Triggers after **4 printable keystrokes**.

Keyboard mappings:

- `Shift+Enter` → raw terminal input **`\x1b[13;2u`**
- On macOS:
  - `Meta+ArrowLeft` → **`\x01`**
  - `Meta+ArrowRight` → **`\x05`**
  - `Alt+ArrowLeft` → **`\x1bb`**
  - `Alt+ArrowRight` → **`\x1bf`**
- On non-mac control navigation:
  - `Ctrl+ArrowLeft` → **`\x1bb`**
  - `Ctrl+ArrowRight` → **`\x1bf`**

### 7. Workspace/browser/T3 integration

Primary drill-down:

- `workspace_browser_t3_integration_facts.md`

Panel and resource identity:

- Workspace panel type is **`vsmux.workspace`**.
- Workspace panel title is **`VSmux`**.
- Local resource roots:
  - `out/workspace`
  - `forks/t3code-embed/dist`
- `retainContextWhenHidden` is **false**.

Browser integration decisions:

- Browser sidebar excludes internal VSmux workspace tabs and T3-owned tabs.
- Workspace groups render from authoritative **`sessionIdsByGroup`** payload.

T3 activity integration:

- T3 activity state is websocket-backed via **`T3ActivityMonitor`**.
- Focus acknowledgement uses completion-marker-aware **`acknowledgeThread`** behavior.
- Protocol responds to **Ping** with **pong**.
- Refreshes are debounced on domain-event chunks.

### 8. Embedded T3 runtime upgrade and recovery invariants

Primary drill-down:

- `t3_managed_runtime_upgrade_facts.md`

Critical runtime facts:

- Updated embedded T3 client must talk to runtime at **`127.0.0.1:3774`**.
- Legacy `npx --yes t3 runtime` remains associated with **`127.0.0.1:3773`**.
- Real websocket endpoint is **`/ws`**, not bare origin.
- Effect RPC request IDs are **numeric strings**, not UUID strings.
- Managed runtime source entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`

Recovery rule:

- Mixed-install recovery requires syncing **upstream**, **overlay**, and **dist** from the tested refresh worktree into main, then reinstalling and restarting the managed runtime.

### 9. VSIX packaging, extension identity, and embed validation

Primary drill-down:

- `vsmux_packaging_and_embed_validation_facts.md`

Extension/package identity:

- Display name: **`VSmux - T3code & Agent CLIs Manager`**
- Publisher: **`maddada`**
- Repository: **`https://github.com/maddada/VSmux.git`**
- Main entry: **`./out/extension/extension.js`**
- Icon: **`media/VSmux-marketplace-icon.png`**

Containers and activation:

- Activity Bar container id: **`VSmuxSessions`**
- Primary view id: **`VSmux.sessions`**
- Secondary container id: **`VSmuxSessionsSecondary`**
- Activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`

Dependency/package constraints:

- `pnpm` overrides:
  - `vite` → `npm:@voidzero-dev/vite-plus-core@latest`
  - `vitest` → `npm:@voidzero-dev/vite-plus-test@latest`
- `restty@0.1.35` is patched by:
  - `patches/restty@0.1.35.patch`

Configuration defaults:

- `VSmux.gitTextGenerationProvider` defaults to **`codex`** and supports `codex`, `claude`, `custom`.
- `VSmux.sendRenameCommandOnSidebarRename` defaults to **`true`**.

Operational packaging insight:

- Installed VSIX contents are the authoritative source when diagnosing embed drift.
- The documented 2026-04-06 mismatch was between refreshed worktree asset `index-DCV3LG5L.js` and stale installed extension asset `index-BbtZ0IEL.js`.

## Cross-Entry Patterns

### Repeated stable constants

Several entries reinforce the same implementation constants, indicating they are foundational:

- **400 ms** auto-focus guard
- **1500 ms** sidebar startup block
- **8 px** sidebar reorder threshold
- **130 ms** session-card hold
- **5000 / 20000 / 30000 ms** daemon heartbeat/expiry/startup grace
- **8 MiB** replay buffer
- **128 KiB** replay chunks
- **5-minute** default timeout values for background or idle persistence contexts

### Architectural through-line

The child entries consistently describe a system with:

- **Per-workspace daemon ownership**
- **Per-session runtime reuse**
- **Authoritative `WorkspaceApp` focus control**
- **Persisted layout/session metadata for restoration**
- **Strict UI thresholds to avoid accidental drag/focus churn**
- **Websocket-backed T3/live state rather than synthetic state**

## File/Area Ownership Map

Frequently referenced source areas:

- Workspace UI/runtime:
  - `workspace/workspace-app.tsx`
  - `workspace/terminal-pane.tsx`
  - `workspace/terminal-runtime-cache.ts`
- Sidebar behavior:
  - `sidebar/sidebar-app.tsx`
  - `sidebar/sortable-session-card.tsx`
- Persistence/daemon:
  - `extension/session-grid-store.ts`
  - `extension/daemon-terminal-runtime.ts`
  - `extension/terminal-daemon-process.ts`
  - `extension/daemon-terminal-workspace-backend.ts`
- Workspace panel / browser / T3 integration:
  - `extension/workspace-panel.ts`
  - `extension/live-browser-tabs.ts`
  - `extension/t3-activity-monitor.ts`
- Packaging/runtime update:
  - `extension/t3-runtime-manager.ts`
  - `scripts/build-t3-embed.mjs`
  - `scripts/vsix.mjs`
  - `package.json`

## Recommended Drill-Down Paths

- For runtime/render/cache semantics: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`
- For reload persistence and daemon thresholds: `terminal_persistence_reload_facts.md`, `terminal_persistence_across_vs_code_reloads_facts.md`
- For focus/drag/input rules: `workspace_focus_debugging_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`
- For browser/T3 integration: `workspace_browser_t3_integration_facts.md`
- For embedded T3 upgrade and packaging: `t3_managed_runtime_upgrade_facts.md`, `vsmux_packaging_and_embed_validation_facts.md`
