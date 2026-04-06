---
title: Terminal Workspace Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:35:49.420Z"
updatedAt: "2026-04-06T01:35:49.420Z"
---

## Raw Concept

**Task:**
Capture high-value factual statements about the terminal workspace current state

**Changes:**

- Recorded renderer, daemon scope, lease, timeout, and visibility facts for quick recall

**Files:**

- workspace/terminal-runtime-cache.ts
- workspace/terminal-pane.tsx
- workspace/workspace-app.tsx
- extension/native-terminal-workspace/workspace-pane-session-projection.ts
- extension/daemon-terminal-workspace-backend.ts

**Flow:**
current-state summary -> extract traceable implementation facts -> store as reusable project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This topic stores concise factual statements rather than a full architectural walkthrough. The facts focus on stable implementation decisions such as renderer selection, runtime identity, timeout defaults, lag thresholds, and daemon scope.

### Dependencies

Facts were extracted from the current-state summary that references frontend workspace files and backend daemon workspace files.

### Highlights

Key facts include Restty as the renderer, per-workspace daemon scope, 5-minute default background timeout, 500 ms backend polling, 400 ms auto-focus guard, and persisted disconnected snapshots retaining title and agent metadata.

## Facts

- **terminal_renderer**: The workspace terminal renderer is Restty. [project]
- **runtime_cache_key**: Terminal runtime cache keys are stable per sessionId. [project]
- **runtime_reuse_strategy**: Frontend terminal runtimes are reused per sessionId and invalidated by renderNonce changes. [project]
- **runtime_release_behavior**: releaseCachedTerminalRuntime decrements refCount and removes the host only when refCount reaches 0 without destroying the runtime for simple release. [project]
- **runtime_destroy_behavior**: destroyCachedTerminalRuntime fully destroys transport, Restty, and host and removes the cache entry. [project]
- **hidden_pane_behavior**: Hidden connected panes stay mounted and painted behind the active pane instead of being redrawn on visibility flips. [project]
- **startup_visuals_behavior**: Terminal startup visuals run only until the first successful canvas reveal for a runtime bootstrap. [project]
- **stable_terminal_size_attempts**: Terminal size stabilization waits up to 20 attempts and returns after 2 identical measurements. [project]
- **pty_connect_sequence**: PTY connection waits for appearance completion and stable terminal size before connecting. [project]
- **reconnect_probe_window**: Reconnect performance probes run for 5000 ms and track frameCount, maxFrameGapMs, longTaskCount, and longTaskTotalDurationMs. [project]
- **scheduler_lag_threshold**: Scheduler lag detection samples every 50 ms, flushes every 5000 ms, and treats average timer overshoot of at least 1000 ms during the first 10000 ms as lag under visible and focused conditions. [project]
- **typing_autoscroll_threshold**: Rapid typing autoscroll uses a 450 ms burst window and triggers after 4 printable keypresses when scrollToBottomWhenTyping is enabled. [project]
- **workspace_hidden_panes_dom**: Workspace app keeps hidden panes rendered in the DOM using the workspace-pane-hidden class. [project]
- **workspace_visible_pane_order_source**: Visible workspace pane layout order comes from the active group's snapshot.visibleSessionIds, with localPaneOrder used only as a temporary override within the visible sessions. [project]
- **auto_focus_guard_ms**: Workspace auto-focus activation guard lasts 400 ms. [project]
- **auto_reload_on_lag**: Terminal lag handling can auto-reload the workspace panel when AUTO_RELOAD_ON_LAG is true. [project]
- **workspace_terminal_activation_owner**: WorkspaceApp owns terminal focus decisions while TerminalPane only emits pointer or focusin activation intent. [project]
- **session_projection_strategy**: Workspace session projection flattens all group session arrays so all groups are projected into the workspace. [project]
- **daemon_scope**: The terminal backend uses a per-workspace DaemonTerminalRuntime rather than a global daemon. [project]
- **managed_session_leases**: Managed sidebar-listed terminal sessions are kept alive through synchronized and renewed leases while VS Code is running. [project]
- **background_session_timeout**: Background session timeout is configured by VSmux.backgroundSessionTimeoutMinutes with a default of 5 minutes and values less than or equal to 0 disable timeout. [project]
- **persisted_disconnected_snapshot_behavior**: When the daemon is not live, disconnected snapshots are populated from persisted session state so sidebar title, agentName, and agentStatus remain visible. [project]
- **reattach_vs_recreate_behavior**: Reattach is used when a live daemon PTY still exists, while backend recreation is distinguished by didCreateSession. [project]
- **backend_poll_interval_ms**: Backend session polling refreshes every 500 ms. [project]
- **sidebar_session_reorder_threshold_px**: Sidebar session reorder from pointer input requires at least 8px of movement from the original session pointerdown target before drag end can mutate order. [project]
