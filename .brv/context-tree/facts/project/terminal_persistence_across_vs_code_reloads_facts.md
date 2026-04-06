---
title: Terminal Persistence Across VS Code Reloads Facts
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T02:38:22.044Z"
updatedAt: "2026-04-06T02:40:16.279Z"
---

## Raw Concept

**Task:**
Capture project facts for terminal persistence across VS Code reloads.

**Changes:**

- Recorded storage keys, file names, and lifecycle thresholds.
- Recorded daemon reuse, replay, handshake, and shutdown rules.
- Recorded fallback metadata behavior and PTY environment details.

**Files:**

- extension/session-grid-store.ts
- extension/daemon-terminal-runtime.ts
- extension/terminal-daemon-process.ts

**Flow:**
RLM context -> fact extraction -> deduplication -> subject grouping -> fact upsert

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry stores concrete constants, storage artifacts, protocol behaviors, and restoration semantics separately from the broader architecture narrative. Subjects are normalized so individual values such as timeouts, file names, and replay behavior can be recalled quickly.

### Dependencies

The facts come from the terminal workspace persistence stack implemented across the session grid store, daemon runtime, and detached daemon process.

### Highlights

Captured 29 deduplicated facts across 29 grouped subjects.

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
