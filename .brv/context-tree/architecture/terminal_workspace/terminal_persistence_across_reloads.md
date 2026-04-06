---
title: Terminal Persistence Across Reloads
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
    architecture/terminal_workspace/terminal_pane_runtime_thresholds_and_behaviors.md,
    facts/project/terminal_workspace_runtime_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:38:00.950Z"
updatedAt: "2026-04-06T02:38:00.950Z"
---

## Raw Concept

**Task:**
Document terminal persistence across VS Code reloads, including extension-host state restoration, detached daemon lifecycle, session replay, and browser runtime caching.

**Changes:**

- Documented SessionGridStore persistence key and grouped workspace snapshot restoration.
- Documented detached daemon startup, reuse, launch lock, owner heartbeat, and lease lifecycle behavior.
- Documented webview restoration through WebviewPanelSerializer with retainContextWhenHidden disabled.
- Documented terminal replay buffering, pending attach queues, and Restty runtime cache release versus destroy semantics.

**Files:**

- extension/session-grid-store.ts
- extension/daemon-terminal-runtime.ts
- extension/terminal-daemon-process.ts
- extension/workspace-panel.ts
- workspace/terminal-runtime-cache.ts

**Flow:**
workspaceState snapshot restore -> webview panel restore -> daemon ensureReady/reuse or spawn -> session socket reattach with replay -> snapshot rebuild from live or persisted state -> leases and heartbeats govern background lifetime

**Timestamp:** 2026-04-06

**Patterns:**

- `VSmux\.sessionGridSnapshot` - Workspace state key for grouped terminal layout
- `ws://127\.0\.0\.1:${String\(this\.daemonInfo\.port\)}/control\?token=\$\{encodeURIComponent\(this\.daemonInfo\.token\)\}` - Control socket URL template used for daemon communication

## Narrative

### Structure

Reload persistence is split across extension-host state, a detached Node.js terminal daemon, and a restored VS Code webview. SessionGridStore restores grouped layout and session metadata from workspaceState, the daemon keeps PTYs alive independently of extension reload, and the browser side rebuilds terminal panes with cached Restty runtimes and daemon-backed transport connections.

### Dependencies

The design depends on VS Code workspaceState and WebviewPanelSerializer, ws-based control/session sockets, @lydell/node-pty for PTY hosting, persisted per-session state files for title and agent fallback metadata, and Restty transport/runtime caching in the workspace webview. Daemon reuse depends on protocol version matching, a reachable control socket, and launch-lock coordination in the workspace-specific daemon state directory.

### Highlights

The daemon is per-workspace rather than per-extension-host lifecycle, which allows terminal sessions to survive reloads. Reattachment correctness depends on the ring buffer, replay chunk generation, pending attach queues, and a replay-before-live switch. Webview state is intentionally not retained when hidden, so reconstruction must come from persisted layout plus daemon session state. Browser runtime caching keeps detached terminal renderers reusable, and releaseCachedTerminalRuntime intentionally detaches DOM without fully destroying the runtime.

### Rules

retainContextWhenHidden: false
Terminal processes are not owned by the extension host process; they live in a detached daemon.
Daemon readiness/reuse is guarded by protocol version match, reachability check, and launch lock.
Session presentation state survives daemon/session gaps via persisted state files.
Session leases extend session lifetime when clients disconnect.
Full cleanup requires destroyCachedTerminalRuntime(); releaseCachedTerminalRuntime() alone is not sufficient.

### Examples

SessionGridStore persists the snapshot under the exact key "VSmux.sessionGridSnapshot". The daemon writes daemon-info.json atomically and uses daemon-launch.lock to serialize startup. Reattachment creates a pending attach queue at the current history cursor, sends replay chunks up to 128 KiB each, flushes output produced during attach, then promotes the socket to the live session socket. PTY creation uses pty.spawn(request.shell, [], { cols, rows, cwd, encoding: null, env: createPtyEnvironment(...), name: "xterm-256color" }).

## Facts

- **terminal_persistence_architecture**: Terminal persistence across VS Code reloads is implemented as a three-part system: SessionGridStore, a detached per-workspace terminal daemon, and a restored webview with Restty renderers. [project]
- **workspace_snapshot_key**: SessionGridStore persists grouped workspace layout in VS Code workspaceState under the key VSmux.sessionGridSnapshot. [project]
- **daemon_scope**: The detached terminal daemon is per-workspace and keeps PTYs alive across extension reloads using control and session WebSocket sockets. [project]
- **daemon_connect_timeouts**: DaemonTerminalRuntime uses CONTROL_CONNECT_TIMEOUT_MS = 3000 and DAEMON_READY_TIMEOUT_MS = 10000. [environment]
- **owner_heartbeat_timing**: The daemon owner heartbeat interval is 5000ms and owner heartbeat timeout is 20000ms. [environment]
- **owner_startup_grace**: The daemon startup grace period is 30000ms. [environment]
- **terminal_replay_limits**: Terminal replay history uses MAX*HISTORY_BYTES = 8 * 1024 \_ 1024 and REPLAY_CHUNK_BYTES = 128 \* 1024. [project]
- **session_attach_ready_timeout**: Session attach readiness times out after 15000ms. [environment]
- **webview_retention_mode**: WorkspacePanelManager creates the workspace webview with retainContextWhenHidden set to false. [project]
- **runtime_cache_release_behavior**: releaseCachedTerminalRuntime removes the host from the DOM when refCount reaches zero but does not destroy the runtime or remove it from cache. [project]
- **runtime_cache_destroy_behavior**: destroyCachedTerminalRuntime fully deletes the cached runtime entry and destroys the transport and Restty instance. [project]
- **pty_lang_normalization**: PTY environments are normalized to LANG = en_US.UTF-8 when LANG is missing or not UTF-8. [environment]
