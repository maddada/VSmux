---
title: Terminal Persistence Reload Facts
tags: []
related: [architecture/terminal_workspace/terminal_persistence_across_reloads.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:38:00.952Z"
updatedAt: "2026-04-06T02:38:00.952Z"
---

## Raw Concept

**Task:**
Capture factual recall items for terminal persistence, daemon timings, replay limits, and runtime cache behavior.

**Changes:**

- Captured persistence architecture facts.
- Captured daemon timing and lifecycle facts.
- Captured webview retention and runtime cache lifecycle facts.

**Files:**

- extension/session-grid-store.ts
- extension/daemon-terminal-runtime.ts
- extension/terminal-daemon-process.ts
- extension/workspace-panel.ts
- workspace/terminal-runtime-cache.ts

**Flow:**
extract implementation facts -> store project recall facts for future queries

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry isolates constants, state keys, lifecycle thresholds, and cache semantics that are useful for quick recall without reopening the broader architecture note.

### Dependencies

Facts rely on the terminal daemon runtime, daemon process, workspace panel restoration, and browser runtime cache implementation.

### Highlights

Includes the workspace snapshot key, heartbeat and replay limits, session attach timeout, daemon scope, and the distinction between runtime release and runtime destruction.

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
