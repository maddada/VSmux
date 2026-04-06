---
title: Current State
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:35:49.418Z"
updatedAt: "2026-04-06T01:35:49.418Z"
---

## Raw Concept

**Task:**
Document the implemented current state of the terminal workspace frontend runtime cache, pane lifecycle, workspace projection, and daemon backend behavior

**Changes:**

- Restty is the user-facing workspace terminal renderer
- Terminal runtimes are cached by sessionId and invalidated by renderNonce changes
- Hidden terminal panes stay mounted and painted behind the active pane
- Workspace projects sessions from all groups instead of only active panes
- Backend daemon is scoped per workspace and renews managed session leases
- Persisted session state preserves sidebar presentation when daemon state is unavailable

**Files:**

- workspace/terminal-runtime-cache.ts
- workspace/terminal-pane.tsx
- workspace/workspace-app.tsx
- extension/native-terminal-workspace/workspace-pane-session-projection.ts
- extension/daemon-terminal-workspace-backend.ts

**Flow:**
workspace snapshot -> project session records from all groups -> derive visible pane layout -> acquire cached Restty runtime by sessionId -> apply appearance -> wait for stable size -> connect or reattach PTY -> keep hidden panes mounted -> sync daemon snapshots and leases -> fall back to persisted disconnected state when daemon is unavailable

**Timestamp:** 2026-04-06

**Patterns:**

- `VSmux\.backgroundSessionTimeoutMinutes` - VS Code configuration key controlling backend background session timeout
- `terminal\.(rendererReady|rendererPreference|stableSizeResolved|stableSizeFallback|connectWhenReady|performanceWindow|schedulerWindow|schedulerLagDetected|schedulerState|canvasRevealed|postReplayViewport|termSizeChanged|resizeObserved|focusActivate|pointerActivate|autoFocusRequestApplied)` - Debug event names emitted by terminal runtime and pane lifecycle

## Narrative

### Structure

The frontend terminal workspace is split across a runtime cache module, a terminal pane component, and a workspace app that manages pane projection and message handling. Runtime identity is session-based, with cached Restty hosts reused across mount and visibility changes. The backend complements this with a per-workspace daemon runtime, periodic snapshot refresh, and persisted session-state fallback for disconnected terminals.

### Dependencies

The runtime cache depends on Restty, workspace PTY transport creation, terminal appearance settings, and workspace panel connection state. The workspace app depends on projected group snapshots, pane ordering helpers, and VS Code webview messaging. The backend depends on DaemonTerminalRuntime, workspace storage paths for persisted session state, and VS Code configuration for idle shutdown timing.

### Highlights

Simple pane switches avoid runtime destruction by keeping inactive panes mounted in the same layout slot. Startup black-surface visuals are bootstrap-only and stop rerunning after the first successful reveal. PTY connection waits for stable terminal size to reduce reconnect churn. The workspace app can explicitly destroy a cached runtime when a session closes, and lag detection can request a workarea reload. As of 2026-04-06, managed sidebar sessions remain alive through lease renewal while VS Code is active, and disconnected snapshots preserve title and agent metadata from persisted session state.

### Rules

Runtime cache keys are the sessionId. Simple release must not destroy the Restty runtime. Hidden connected panes should remain painted and skip maintenance work. Reattach should be used when a live daemon PTY exists, while resume/recreation should only occur when the backend terminal was actually recreated. Background timeout is controlled by VSmux.backgroundSessionTimeoutMinutes, defaults to 5 minutes, and <= 0 means no timeout.

### Examples

Examples include getTerminalRuntimeCacheKey(sessionId) returning the sessionId directly, AUTO_FOCUS_ACTIVATION_GUARD_MS being 400, backend polling running every 500 ms, and createOrAttach returning didCreateSession to distinguish attach from recreation. Input mappings include Shift+Enter sending "\x1b[13;2u" and macOS Meta/Alt arrow combinations mapping to shell control sequences.

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
- **auto_focus_guard_ms**: Workspace auto-focus activation guard lasts 400 ms. [project]
- **auto_reload_on_lag**: Terminal lag handling can auto-reload the workspace panel when AUTO_RELOAD_ON_LAG is true. [project]
- **session_projection_strategy**: Workspace session projection flattens all group session arrays so all groups are projected into the workspace. [project]
- **daemon_scope**: The terminal backend uses a per-workspace DaemonTerminalRuntime rather than a global daemon. [project]
- **managed_session_leases**: Managed sidebar-listed terminal sessions are kept alive through synchronized and renewed leases while VS Code is running. [project]
- **background_session_timeout**: Background session timeout is configured by VSmux.backgroundSessionTimeoutMinutes with a default of 5 minutes and values less than or equal to 0 disable timeout. [project]
- **persisted_disconnected_snapshot_behavior**: When the daemon is not live, disconnected snapshots are populated from persisted session state so sidebar title, agentName, and agentStatus remain visible. [project]
- **reattach_vs_recreate_behavior**: Reattach is used when a live daemon PTY still exists, while backend recreation is distinguished by didCreateSession. [project]
- **backend_poll_interval_ms**: Backend session polling refreshes every 500 ms. [project]
