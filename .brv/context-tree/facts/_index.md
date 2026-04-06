---
children_hash: 437e33cf3eda9cc97b551f3098150acdbdebf8f64679aac41d8616457f2c8e54
compression_ratio: 0.9696464309539693
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 2998
summary_level: d2
token_count: 2907
type: summary
---

# Facts Domain Structural Summary

## Domain purpose

The `facts` domain is the repository’s quick-recall layer for durable, queryable facts: technology choices, configuration defaults, operational constants, runtime thresholds, behavioral invariants, and extension/package identifiers. It excludes longer architectural explanations, which are delegated to architecture topics.

Primary drill-down:

- `context.md`
- `project/_index.md`

## Main topic: `project`

The `project` topic concentrates on factual invariants around the terminal workspace, daemon persistence, sidebar interaction, T3/browser integration, and VSIX packaging. It acts as a condensed operational companion to the architecture notes.

Primary child entries:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `terminal_persistence_reload_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_browser_t3_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`
- `vsmux_packaging_and_embed_validation_facts.md`

## Fact clusters

### 1. Terminal runtime, rendering, and cache lifecycle

The runtime layer is built around **Restty** with a frontend cache keyed by **`sessionId`**. Runtime reuse depends on stable `sessionId`, while cache invalidation is driven by **`renderNonce`** changes. Hidden connected panes remain mounted and painted behind the active pane to avoid redraw churn and preserve visual continuity.

Lifecycle semantics are sharply separated:

- `releaseCachedTerminalRuntime` detaches/removes the host only when **`refCount === 0`**, but does not destroy the runtime
- `destroyCachedTerminalRuntime` fully destroys transport, Restty, host, and cache entry

Additional rendering/runtime invariants:

- Startup visuals stop after the first successful canvas reveal
- PTY connection waits for appearance completion plus stable size
- Stable size detection allows **20 attempts** and succeeds after **2 identical measurements**

Drill-down:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`

### 2. Focus ownership, pane order, and workspace authority

The authoritative interaction owner is **`WorkspaceApp`**. `TerminalPane` does not directly own focus decisions; it only emits activation intent:

- `onActivate("pointer")` from pointer capture on the terminal root
- `onActivate("focusin")` only after the pane owns `:focus-within`

Core focus/order invariants:

- **`AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`**
- T3 iframe focus message type: **`vsmuxT3Focus`**
- Visible pane order derives from **`activeGroup.snapshot.visibleSessionIds`**
- `localPaneOrder` is only a temporary override limited to currently visible sessions
- Passive split slot stability is preserved while switching active sessions

Workspace-to-extension coordination uses explicit messages:

- `focusSession`
- `syncPaneOrder`
- `syncGroupOrder`
- `moveSessionToGroup`
- `syncSessionOrder`

Drill-down:

- `workspace_focus_debugging_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `terminal_workspace_runtime_facts.md`

### 3. Sidebar interaction, drag thresholds, and session-card behavior

Sidebar reorder and drag behavior is protected by layered thresholds designed to reduce accidental movement and startup instability.

Key thresholds and interaction constants:

- Sidebar reorder mutation threshold: **8 px**
- Startup interaction block: **`SIDEBAR_STARTUP_INTERACTION_BLOCK_MS = 1500`**
- Non-touch drag activation: **6 px**
- Touch drag activation: **250 ms** delay with **5 px** tolerance
- Session-card drag hold: **130 ms** delay with **12 px** tolerance

Context menu dimensions are fixed:

- Width: **156 px**
- Item height: **34 px**
- Margin: **12 px**
- Vertical padding: **12 px**

Session-card capability rules:

- Click focuses session
- Meta-click closes session
- Middle click closes session
- Resume command copy supports **`codex`**, **`claude`**, **`copilot`**, **`gemini`**, **`opencode`**
- Full reload is supported only for **`codex`** and **`claude`**

Drill-down:

- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `terminal_workspace_runtime_facts.md`

### 4. Persistence, daemon lifecycle, and reload recovery

Persistence is a three-part system:

- `SessionGridStore`
- detached per-workspace terminal daemon
- restored webview with Restty renderers

Persistent state and daemon ownership facts:

- Workspace layout is stored under **`VSmux.sessionGridSnapshot`** in VS Code `workspaceState`
- The daemon is **per-workspace**, not global
- PTYs remain alive across extension reloads using control and session WebSocket sockets
- Sidebar-managed sessions are retained through synchronized renewable leases
- Background timeout is controlled by **`VSmux.backgroundSessionTimeoutMinutes`**, default **5 minutes**, with `<= 0` disabling timeout
- If daemon recovery fails, disconnected snapshots still preserve **title**, **agentName**, and **agentStatus**
- Reattach vs recreation is distinguished by **`didCreateSession`**

Operational timing constants:

- `CONTROL_CONNECT_TIMEOUT_MS = 3000`
- `DAEMON_READY_TIMEOUT_MS = 10000`
- Owner heartbeat interval: **5000 ms**
- Owner heartbeat timeout: **20000 ms**
- Startup grace period: **30000 ms**
- Session attach readiness timeout: **15000 ms**
- Backend polling interval: **500 ms**
- `MAX_HISTORY_BYTES = 8 * 1024 * 1024`
- `REPLAY_CHUNK_BYTES = 128 * 1024`
- PTY env normalizes `LANG` to **`en_US.UTF-8`** if missing or invalid

Webview/runtime retention facts:

- Workspace panel uses **`retainContextWhenHidden: false`**
- Release/destroy runtime semantics are repeated here as persistence-critical invariants

Drill-down:

- `terminal_persistence_reload_facts.md`
- `terminal_workspace_facts.md`

### 5. Runtime monitoring and lag recovery

The workspace includes explicit probe and lag-detection windows intended to detect degraded rendering/runtime behavior and trigger recovery.

Monitoring constants:

- Reconnect probe window: **5000 ms**
- Probe metrics include `frameCount`, `maxFrameGapMs`, `longTaskCount`, `longTaskTotalDurationMs`
- Probe interval: **50 ms**
- Probe window: **5000 ms**
- Monitor window: **10000 ms**
- Lag threshold: **1000 ms**
- Warning threshold: **250 ms**
- **`AUTO_RELOAD_ON_LAG = true`**

Additional UX thresholds:

- Typing auto-scroll burst window: **450 ms**
- Trigger after **4 printable keystrokes**
- Scroll-to-bottom UI shows above **200 px** from bottom and hides below **40 px**

Drill-down:

- `terminal_workspace_runtime_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_sidebar_interaction_facts.md`

### 6. Workspace browser and T3 integration

Workspace/browser integration explicitly excludes internal workspace surfaces from normal browser listing:

- Browser sidebar excludes internal **VSmux workspace**
- Browser sidebar excludes **T3-owned tabs**

Panel restoration and resource identity:

- Webview panel type: **`vsmux.workspace`**
- Panel title: **`VSmux`**
- Local resource roots:
  - `out/workspace`
  - `forks/t3code-embed/dist`

Group rendering relies on authoritative backend payloads via **`sessionIdsByGroup`**.

T3 runtime/activity facts:

- T3 activity is websocket-backed through **`T3ActivityMonitor`**
- Ping is answered with **pong**
- Domain-event refreshes are debounced
- Focus acknowledgement uses completion-marker-aware **`acknowledgeThread`**

Drill-down:

- `workspace_browser_t3_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`

### 7. Managed T3 runtime upgrade and recovery invariants

Managed T3 runtime facts distinguish the embedded runtime from legacy runtime invocations.

Network and protocol facts:

- Updated embedded T3 client must use **`127.0.0.1:3774`**
- Legacy `npx --yes t3 runtime` remains on **`127.0.0.1:3773`**
- WebSocket endpoint is **`/ws`**
- Canonical example: **`ws://127.0.0.1:3774/ws`**
- Effect RPC request IDs are **numeric strings**, not UUIDs

Source-of-truth implementation path:

- `forks/t3code-embed/upstream/apps/server/src/bin.ts`

Recovery pattern:

- Mixed-install recovery requires synchronizing tested **upstream**, **overlay**, and **dist** copies into main, then reinstalling and restarting the managed runtime

Drill-down:

- `t3_managed_runtime_upgrade_facts.md`

### 8. Packaging, activation, and installed-VSIX validation

The extension/package identity is fixed and operationally important for debugging install drift.

Extension/package identifiers:

- Display name: **`VSmux - T3code & Agent CLIs Manager`**
- Publisher: **`maddada`**
- Repository: `https://github.com/maddada/VSmux.git`
- Main entry: `./out/extension/extension.js`
- Icon: `media/VSmux-marketplace-icon.png`

Container/view identity:

- Activity Bar container: **`VSmuxSessions`**
- View id: **`VSmux.sessions`**
- Secondary sidebar container: **`VSmuxSessionsSecondary`**

Activation/configuration facts:

- `onStartupFinished`
- `onView:VSmux.sessions`
- `onWebviewPanel:vsmux.workspace`
- `vite -> npm:@voidzero-dev/vite-plus-core@latest`
- `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
- `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`
- `VSmux.gitTextGenerationProvider` defaults to **`codex`** and supports `codex`, `claude`, `custom`
- `VSmux.sendRenameCommandOnSidebarRename` defaults to **`true`**

Packaging/debugging rule:

- The installed VSIX contents are the source of truth for embed debugging
- Documented drift example: refreshed worktree had `index-DCV3LG5L.js`, installed extension had stale `index-BbtZ0IEL.js`; reinstalling the intended VSIX is required

Drill-down:

- `vsmux_packaging_and_embed_validation_facts.md`

## Cross-entry patterns

### Repeated constants

Several facts recur across entries and function as system-wide invariants:

- **400 ms** focus guard
- **8 px** sidebar reorder threshold
- **1500 ms** startup interaction block
- **`AUTO_RELOAD_ON_LAG = true`**
- release-vs-destroy runtime lifecycle split

These are reinforced across:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `terminal_persistence_reload_facts.md`

### Architectural through-lines

Across the `project` fact set, the dominant design patterns are:

- **Per-workspace ownership**: daemon lifecycle, workspace state, panel restoration
- **Per-session runtime identity**: cache keyed by `sessionId`
- **Authoritative workspace coordination**: `WorkspaceApp` controls focus and order
- **UI stability over churn**: hidden pane persistence, slot stability, delayed PTY attach until stable size
- **Exact identifiers for debugging/recovery**: ports `3774` / `3773`, `/ws`, `vsmux.workspace`, container/view ids, installed asset hashes

## Best drill-down map

- Runtime/rendering/cache lifecycle: `terminal_workspace_facts.md`
- Exact thresholds and interaction constants: `terminal_workspace_runtime_facts.md`
- Focus ownership and debugging APIs: `workspace_focus_debugging_facts.md`
- Drag/reorder and capability matrix: `workspace_focus_and_drag_runtime_facts.md`
- Reload persistence and daemon timings: `terminal_persistence_reload_facts.md`
- Browser/workspace/T3 integration: `workspace_browser_t3_integration_facts.md`
- Managed runtime upgrade/recovery: `t3_managed_runtime_upgrade_facts.md`
- Packaging and VSIX validation: `vsmux_packaging_and_embed_validation_facts.md`
- Consolidated sidebar/session-card interaction rules: `workspace_sidebar_interaction_facts.md`
