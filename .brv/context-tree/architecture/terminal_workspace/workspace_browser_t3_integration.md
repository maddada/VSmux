---
title: Workspace Browser T3 Integration
tags: []
related:
  [architecture/terminal_workspace/current_state.md, facts/project/terminal_workspace_facts.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:37:59.249Z"
updatedAt: "2026-04-06T01:37:59.249Z"
---

## Raw Concept

**Task:**
Document current integration state across live browser tab discovery, workspace panel restoration, native terminal workspace control, T3 activity monitoring, and sidebar rendering.

**Changes:**

- Excluded internal VSmux workspace and T3-owned tabs from the Browsers sidebar group.
- Standardized restored workspace panel identity to vsmux.workspace with visible title VSmux and branded icon.
- Wired T3 activity through T3ActivityMonitor instead of treating T3 sessions as always idle.
- Enabled T3 focus acknowledgement via completion-marker-aware thread acknowledgement.
- Made workspace sidebar groups render from authoritative sessionIdsByGroup payload to avoid transient empty placeholders after session creation.

**Files:**

- extension/live-browser-tabs.ts
- extension/workspace-panel.ts
- extension/native-terminal-workspace/controller.ts
- extension/t3-activity-monitor.ts
- sidebar/sidebar-app.tsx

**Flow:**
tab groups -> browser tab metadata filtering -> sidebar browser sessions; backend/workspace events -> session activity sync -> sidebar refresh -> workspace panel refresh; T3 websocket connect -> snapshot request -> domain-event subscription -> debounced refresh -> acknowledged attention updates

**Timestamp:** 2026-04-06

**Patterns:**

- `^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:workspace|t3-embed)(?:\/|$)` (flags: i) - Matches local VSmux workspace and T3 embed asset URLs that must be excluded from browser sidebar tabs.

## Narrative

### Structure

Live browser tab discovery is implemented in extension/live-browser-tabs.ts, workspace webview panel lifecycle in extension/workspace-panel.ts, terminal workspace orchestration in extension/native-terminal-workspace/controller.ts, T3 websocket-backed activity tracking in extension/t3-activity-monitor.ts, and sidebar rendering logic in sidebar/sidebar-app.tsx. Together these components define how browser tabs are surfaced, how the workspace panel is restored and messaged, how T3 thread activity propagates into UI indicators, and how workspace groups avoid transient empty states.

### Dependencies

The browser tab layer depends on VS Code tab metadata, browser-session-manager helper utilities, T3 panel helpers, and workspace-panel constants. The workspace panel depends on the shared workspace panel contract, extension resources in out/workspace and forks/t3code-embed/dist, and a permissive localhost CSP for local assets and websocket connectivity. The T3 monitor depends on t3-activity-state reducers and the t3-rpc-protocol message helpers. The controller depends on T3ActivityMonitor and WorkspacePanelManager to keep sidebar and panel state synchronized with backend session changes.

### Highlights

As of 2026-04-06, the Browsers group excludes internal VSmux-owned tabs by checking explicit panel view types, the vsmux. viewType prefix, and localhost workspace/t3-embed URLs. Restored workspace panels use panel type vsmux.workspace, title VSmux, and media/icon.svg so the visible panel matches the branded workspace surface. T3 activity is now live and websocket-backed, with snapshot fetches, domain event subscription, ping/pong handling, reconnect scheduling, and completion-marker-based attention acknowledgement. Sidebar workspace rendering now uses authoritative sessionIdsByGroup data for workspace groups so newly created sessions do not temporarily show No sessions when local ordering state lags behind.

### Rules

Exclude tabs whose labels include Extension:, Settings, Keyboard Shortcuts, (Working Tree), (Index), or welcome. Exclude diff tabs. Treat tabs as VSmux-owned when viewType equals T3_PANEL_TYPE, viewType equals WORKSPACE_PANEL_TYPE, viewType starts with vsmux., or the tab label is VSmux with no URL or a localhost workspace/t3-embed asset URL. Accept only normalized http/https URLs in sidebar metadata. Workspace panel accepted messages are ready, workspaceDebugLog, reloadWorkspacePanel, focusSession, closeSession, fullReloadSession, syncPaneOrder, and syncSessionOrder. Empty sidebar state is shown only when there are no visible browser groups and every workspace group has zero sessions.

### Examples

Browser webview detection includes simpleBrowser.view and any viewType containing browser or preview. openWorkspace() reveals the sidebar and workspace panel, creates a session if none exist, and otherwise refreshes both surfaces. On T3 activity monitor change, the controller syncs T3 session titles from the monitor, syncs known session activities, logs title changes, and refreshes the sidebar and workspace panel. Empty-sidebar double click creates a session unless the target is button, input, select, textarea, a, [role=button], [role=menu], [role=menuitem], or [data-empty-space-blocking=true].

## Facts

- **browser_sidebar_group_id**: Browser sidebar group ID is browser-tabs. [project]
- **workspace_panel_type**: Workspace panel type is vsmux.workspace. [project]
- **workspace_panel_title**: Workspace panel title is VSmux. [project]
- **workspace_panel_icon**: Workspace panel icon path is media/icon.svg. [project]
- **t3_activity_websocket_url**: Default T3 activity websocket URL is ws://127.0.0.1:3774/ws. [environment]
- **t3_snapshot_rpc_method**: T3 snapshot RPC method is orchestration.getSnapshot. [project]
- **t3_domain_events_rpc_method**: T3 domain event subscription RPC method is subscribeOrchestrationDomainEvents. [project]
- **sidebar_startup_interaction_block_ms**: Sidebar startup interaction block is 1500 ms. [project]
- **sidebar_pointer_drag_reorder_threshold_px**: Sidebar pointer drag reorder threshold is 8 px. [project]
- **t3_request_timeout_ms**: T3 activity request timeout is 15000 ms. [project]
- **t3_reconnect_delay_ms**: T3 reconnect delay is 1500 ms. [project]
- **t3_refresh_debounce_ms**: T3 refresh debounce is 100 ms. [project]
