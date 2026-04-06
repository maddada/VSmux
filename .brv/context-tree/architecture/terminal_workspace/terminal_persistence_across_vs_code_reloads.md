---
title: Terminal Persistence Across VS Code Reloads
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    facts/project/terminal_persistence_across_vs_code_reloads_facts.md,
  ]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T02:38:22.043Z"
updatedAt: "2026-04-06T02:40:16.277Z"
---

## Raw Concept

**Task:**
Document how terminal workspace state and live PTY sessions persist across VS Code reloads.

**Changes:**

- Workspace layout is persisted and restored from workspaceState.
- Live PTYs are hosted by a detached per-workspace daemon instead of the webview lifecycle.
- Restored panes reattach through replay of buffered terminal history.
- Per-session state files preserve title and agent metadata when daemon state is unavailable.

**Files:**

- extension/session-grid-store.ts
- extension/daemon-terminal-runtime.ts
- extension/terminal-daemon-process.ts

**Flow:**
session-grid snapshot persisted -> VS Code reload restores webview state -> runtime reconnects to daemon-info.json-backed daemon -> session socket waits for terminalReady -> daemon replays ring buffer -> pending live output flushes -> control channel broadcasts refreshed snapshots

**Timestamp:** 2026-04-06

**Author:** ByteRover RLM curation

## Narrative

### Structure

SessionGridStore persists a grouped terminal workspace snapshot under the key VSmux.sessionGridSnapshot in VS Code workspaceState and restores focus, group ordering, visible sessions, aliases, titles, and metadata. DaemonTerminalRuntime runs in the extension host, manages a per-workspace daemon state directory, connects to a token-authenticated control socket, acquires a launch lock when needed, replaces stale daemons whose protocol version or reachability is invalid, and keeps ownership alive with heartbeats. The detached terminal-daemon-process hosts PTYs, exposes /control and /session WebSocket endpoints, stores terminal output in a bounded ring buffer, rebuilds snapshots from live and persisted presentation state, and supports replay-based reattachment after reload.

### Dependencies

The implementation depends on VS Code workspaceState and WebviewPanelSerializer for UI restoration, ws for WebSocket control and session channels, @lydell/node-pty for PTY hosting, daemon-info.json and daemon-launch.lock in a per-workspace global-storage directory, session state files for persisted title and agent metadata, and React with Restty in the restored pane UI.

### Highlights

Key thresholds are a 3_000ms control connect timeout, 10_000ms daemon ready timeout, 30_000ms lock stale threshold, 5_000ms runtime owner heartbeat interval, 20_000ms daemon owner heartbeat timeout, 30_000ms startup grace window, 15_000ms session attach ready timeout, 8 MiB replay buffer cap, and 128 KiB replay chunk size. Replay is resilient because output arriving during reattachment is stored in a pending attach queue and flushed immediately after history replay completes. When the daemon is unavailable, per-session state files still preserve title and agent metadata so restored UI can reconstruct presentation state.

### Rules

Requests requiring a response must include a requestId. Existing daemons are only retained when protocolVersion matches TERMINAL_HOST_PROTOCOL_VERSION and the daemon is reachable. The daemon requires a valid token for /control and /session upgrades. If no sessions and no connected clients attach during startup grace, the daemon shuts down with owner-startup-timeout. If leases expire and no sessions remain, the daemon shuts down with lease-expired. If idle shutdown is enabled and no clients or leases remain, it shuts down with idle-timeout.

### Examples

Examples include workspaceState key VSmux.sessionGridSnapshot, daemon state directory prefix terminal-daemon-${workspaceId}, control socket URL ws://127.0.0.1:${String(this.daemonInfo.port)}/control?token=..., PTY terminal name xterm-256color, and UTF-8 fallback LANG=en_US.UTF-8.

## Facts

- **workspace_state_key**: Workspace layout is persisted in VS Code workspaceState under VSmux.sessionGridSnapshot. [project]
- **per_workspace_daemon**: Terminal PTYs are kept alive by a detached per-workspace Node.js daemon. [project]
- **daemon_dependencies**: The daemon runtime uses ws for control connections and @lydell/node-pty for PTY hosting. [project]
- **daemon_state_dir**: The daemon state directory is stored under global storage with the prefix terminal-daemon-${workspaceId}. [project]
- **daemon_info_file**: Persisted daemon metadata is stored in daemon-info.json. [project]
- **launch_lock_file**: Daemon launch locking uses daemon-launch.lock. [project]
- **debug_log_file**: Daemon debug logging is appended to terminal-daemon-debug.log. [project]
- **control_socket_timeout**: The runtime control connection timeout is 3_000ms. [project]
- **daemon_startup_timeout**: Daemon readiness timeout is 10_000ms. [project]
- **launch_lock_stale_threshold**: Launch locks are treated as stale after 30_000ms. [project]
- **owner_heartbeat_interval**: The runtime sends owner heartbeats every 5_000ms. [project]
- **owner_heartbeat_timeout**: The daemon expires stale owner heartbeats after 20_000ms. [project]
- **owner_startup_grace**: The daemon allows a 30_000ms startup grace period for owner adoption. [project]
- **idle_shutdown_timeout**: Default idle shutdown timeout is 5 \* 60_000ms. [project]
- **ring_buffer_limit**: The terminal history ring buffer is capped at 8 _ 1024 _ 1024 bytes. [project]
- **session_attach_ready_timeout**: Session attach waits up to 15_000ms for terminalReady before closing the socket. [project]
- **replay_chunk_size**: Replay history is sent in chunks of 128 \* 1024 bytes. [project]
- **terminal_ready_handshake**: Restored webviews are reattached using a terminalReady handshake before replay activation. [project]
- **pending_attach_queue**: Output produced during replay is buffered in a pending attach queue and flushed after replay completes. [project]
- **session_state_fallback**: Per-session state files preserve title and agent metadata when live daemon data is unavailable. [project]
- **snapshot_merge_behavior**: buildSnapshot merges live title and activity with persisted session state. [project]
- **websocket_auth**: The daemon requires token-authenticated WebSocket upgrades on /control and /session. [project]
- **pty_terminal_name**: PTYs are spawned with terminal name xterm-256color. [project]
- **pty_lang_fallback**: The PTY environment forces LANG to en_US.UTF-8 when UTF-8 is missing. [project]
- **browser_session_metadata_behavior**: setBrowserSessionMetadata currently always returns false. [project]
- **daemon_request_rule**: Requests expecting daemon responses must include a requestId. [convention]
- **daemon_reuse_rule**: Existing daemons are only reused when protocolVersion matches TERMINAL_HOST_PROTOCOL_VERSION and the daemon is reachable. [project]
- **shutdown_reasons**: The daemon shuts down for owner-startup-timeout, lease-expired, idle-timeout, SIGTERM, SIGINT, and unknown reasons. [project]
- **restore_flow**: Terminal restoration flow is reload -> workspaceState restore -> daemon reconnect -> session reconnect -> terminalReady -> replay -> pending output flush -> active attachment. [project]
