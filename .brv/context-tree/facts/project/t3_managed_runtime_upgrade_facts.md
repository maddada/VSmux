---
title: T3 Managed Runtime Upgrade Facts
tags: []
related: [architecture/terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:24:39.289Z"
updatedAt: "2026-04-06T02:24:39.289Z"
---

## Raw Concept

**Task:**
Capture high-signal facts for embedded T3 runtime upgrade and recovery

**Changes:**

- Added recall-friendly facts for runtime endpoint, websocket route, request ID format, entrypoint path, and recovery procedure

**Files:**

- extension/t3-runtime-manager.ts
- docs/2026-04-03-how-to-update-t3-code.md
- scripts/build-t3-embed.mjs

**Flow:**
record endpoint and protocol facts -> retain recovery procedure -> support later troubleshooting and upgrade work

**Timestamp:** 2026-04-03

## Narrative

### Structure

This fact entry condenses the embedded T3 upgrade into endpoint, protocol, and recovery invariants that are likely to be reused during debugging or future vendor refreshes.

### Highlights

The most important invariants are the 3774 managed runtime, mandatory /ws websocket path, numeric string RPC IDs, and the need to keep the installed VSIX payload aligned with vendored upstream and dist contents.

### Examples

Example websocket URL: ws://127.0.0.1:3774/ws. Example recovery summary: sync the tested worktree copies of upstream, overlay, and dist into main, reinstall, and restart the managed runtime.

## Facts

- **updated_t3_runtime_endpoint**: Updated embedded T3 client must talk to a matching updated runtime on 127.0.0.1:3774. [project]
- **legacy_t3_runtime_endpoint**: Legacy npx --yes t3 runtime remains associated with 127.0.0.1:3773 in the migration notes. [project]
- **t3_real_websocket_endpoint**: Real websocket endpoint is /ws rather than the bare origin. [project]
- **t3_rpc_request_id_format**: Effect RPC requests use numeric string IDs rather than UUID strings. [project]
- **t3_runtime_bin_path**: The managed runtime source entrypoint is forks/t3code-embed/upstream/apps/server/src/bin.ts. [project]
- **t3_mixed_install_recovery**: The mixed-install recovery requires syncing upstream, overlay, and dist from the tested refresh worktree into main. [project]
