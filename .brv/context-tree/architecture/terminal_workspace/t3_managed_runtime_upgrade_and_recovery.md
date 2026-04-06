---
title: T3 Managed Runtime Upgrade And Recovery
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:24:39.288Z"
updatedAt: "2026-04-06T02:24:39.288Z"
---

## Raw Concept

**Task:**
Document the embedded T3 runtime upgrade model, protocol requirements, and recovery steps after VS Code restart launch failures

**Changes:**

- Introduced managed T3 runtime launch from vendored upstream server entrypoint instead of depending on legacy npx t3 compatibility
- Standardized updated runtime isolation on port 3774 while keeping legacy runtime on 3773
- Recorded recovery for mixed-install failures by syncing upstream, overlay, and dist from tested worktree into main and reinstalling
- Documented websocket protocol requirements including /ws route, numeric string request IDs, and Ping/Pong handling
- Captured build script behavior for copying overlay into upstream, rebuilding web assets, and pruning sourcemaps

**Files:**

- extension/t3-runtime-manager.ts
- scripts/build-t3-embed.mjs
- docs/2026-04-03-how-to-update-t3-code.md

**Flow:**
create isolated worktree -> refresh upstream -> port overlay -> rebuild dist -> launch matching managed runtime on 3774 -> install/test worktree VSIX -> port validated changes back to main -> reinstall -> restart managed runtime

**Timestamp:** 2026-04-03

**Patterns:**

- `ws://127\.0\.0\.1:3774/ws` - Required websocket endpoint for the updated managed T3 runtime
- `^\d+$` - Effect RPC request IDs must be numeric strings such as 1, 2, 3

## Narrative

### Structure

T3RuntimeManager now resolves a managed startup command that launches the vendored server entrypoint from forks/t3code-embed/upstream/apps/server/src/bin.ts with Bun, stores runtime state under the extension global storage t3-runtime directory, maintains lease heartbeats, and connects websocket clients to ws://127.0.0.1:3774/ws. The embed build script copies overlay files into the vendored upstream checkout, runs bun install and bun run build in the web app, recreates forks/t3code-embed/dist, and prunes sourcemap and mock service worker artifacts before packaging.

### Dependencies

The upgraded embedded client depends on matching upstream server code, Bun being available in the VS Code environment, T3CODE_HOME being passed via process environment, and the installed VSIX payload matching the vendored upstream, overlay, and dist sources in the main checkout. Runtime/session restore logic depends on orchestration snapshot queries and thread/project recreation when persisted metadata is stale.

### Highlights

The documented failure mode is a mixed install where the installed VSIX embed bundle is newer than the main checkout vendored T3 source, which can surface after VS Code restart. The reliable recovery is to sync forks/t3code-embed/upstream, forks/t3code-embed/overlay, and forks/t3code-embed/dist from a tested refresh worktree into main, reinstall with vp run install, and restart the managed 3774 runtime so client and server versions match again. The working upgrade model keeps the existing VSmux embedded HTML plus local asset server host model and avoids switching to a localhost iframe page during debugging.

### Rules

1. Do not update T3 directly on the main branch.
2. Do not overwrite the current working forks/t3code-embed/dist first.
3. Do not install the test VSIX over the main branch and assume rollback will be painless.
4. Do not point the updated embedded web app at the old npx --yes t3 runtime on 127.0.0.1:3773.
5. Do not change the host model to a localhost iframe page. Keep the existing embedded HTML + local asset server approach.
6. websocket URL must be ws://127.0.0.1:3774/ws.
7. request IDs must be numeric strings like "1", "2", "3".
8. do not use UUIDs or labels like vsmux-t3-activity-snapshot.
9. handle Ping by replying with Pong.
10. handle streaming subscriptions via Chunk, Ack, and Exit.
11. Build and install only from the worktree while testing.
12. After validation, make the same update self-contained in the main branch install path.

### Examples

Recovery example: sync forks/t3code-embed/upstream, forks/t3code-embed/overlay, and forks/t3code-embed/dist from the tested refresh worktree into main, run vp run install, then restart the managed 3774 runtime. Worktree setup example: git worktree add /tmp/agent-tiler-t3-refresh -b t3-upstream-refresh. Verification examples include checking ~/Library/Application Support/Code/User/globalStorage/maddada.vsmux/t3-runtime/supervisor.json and ~/Library/Application Support/Code/User/globalStorage/maddada.vsmux/t3-runtime/managed-home/userdata/logs/server.log for a server listening on http://127.0.0.1:3774.

## Facts

- **managed_t3_runtime_port**: The managed updated T3 runtime uses host 127.0.0.1 and port 3774. [project]
- **legacy_t3_runtime_port**: The legacy runtime referenced in the docs runs on 127.0.0.1:3773. [project]
- **t3_websocket_route**: The managed T3 websocket route must be /ws. [project]
- **managed_t3_entrypoint**: The managed T3 entrypoint is forks/t3code-embed/upstream/apps/server/src/bin.ts. [project]
- **managed_t3_repo_root**: The default managed repo root falls back to /Users/madda/dev/\_active/agent-tiler. [environment]
- **t3_timeout_ms**: The startup timeout and request timeout are both 30000 ms in T3RuntimeManager. [project]
- **t3_lease_timing**: Lease heartbeat runs every 30000 ms and grace period is 180000 ms. [project]
- **t3_supervisor_state_files**: The managed runtime stores supervisor state in supervisor.json and launch locking in supervisor-launch.lock. [project]
- **managed_t3_home_dir**: The managed T3 home directory name is managed-home under the t3-runtime global storage directory. [environment]
- **t3_embed_sourcemaps**: The embed build disables sourcemaps by setting T3CODE_WEB_SOURCEMAP=false. [project]
- **t3_embed_pruned_artifacts**: Embed artifact pruning removes .map files and mockServiceWorker.js from dist. [project]
- **t3_update_guide_date**: The source-of-truth update guide is dated 2026-04-03. [project]
