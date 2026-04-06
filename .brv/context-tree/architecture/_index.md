---
children_hash: a8021e19bf06b400213715fb2a3b182eaad06ee319c09a4f95b233247fe048c2
compression_ratio: 0.6903313049357674
condensation_order: 2
covers: [context.md, terminal_workspace/_index.md]
covers_token_total: 4437
summary_level: d2
token_count: 3063
type: summary
---

# architecture → terminal_workspace

## Domain purpose

Architectural knowledge for the VSmux terminal workspace stack: frontend terminal rendering, pane/runtime lifecycle, workspace projection and ordering, sidebar interaction semantics, daemon-backed session behavior, and embedded T3 integration. Canonical topic baseline lives in `terminal_workspace/current_state.md`; `context.md` defines the domain scope.

## Topic structure

Use these entries for drill-down:

- Foundational: `context.md`, `current_state.md`
- Runtime behavior: `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`
- Focus / ordering / drag: `workspace_focus_debugging.md`, `workspace_focus_and_sidebar_drag_semantics.md`, `terminal_titles_activity_and_sidebar_runtime.md`
- Title/activity/audio: `terminal_titles_activity_and_completion_sounds.md`, `title_activity_and_sidebar_runtime.md`
- T3 / browser / packaging: `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`, `vsix_packaging_and_t3_embed_validation.md`

## Core architecture

### Frontend runtime model

From `current_state.md`:

- Terminal renderer is **Restty**.
- Runtime cache identity is stable per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- Runtimes survive mount/visibility changes and are recreated only when `renderNonce` changes.
- `releaseCachedTerminalRuntime` does not fully destroy the runtime; teardown is reserved for `destroyCachedTerminalRuntime`.
- PTY startup sequence is: appearance applied → stable size confirmed → connect or reattach.

### Hidden pane strategy

Across `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_focus_and_sidebar_drag_semantics.md`, and `workspace_sidebar_interaction_state.md`:

- Hidden connected panes remain mounted and painted behind the active pane.
- Visibility flips should not trigger repaint/reconnect after startup.
- This is a deliberate stability/performance contract to avoid churn during pane switching.

### Stable sizing / readiness

From `current_state.md` and `terminal_pane_runtime_thresholds_and_behaviors.md`:

- Size stabilization waits up to **20 attempts** and resolves after **2 identical measurements**.
- `transportController.markTerminalReady(cols, rows)` is sent before PTY connection.
- Reattach is preferred when a live daemon PTY exists; `didCreateSession` distinguishes recreation.

## Workspace projection, ordering, and focus

### Session projection

From `current_state.md`:

- Projection now flattens all group session arrays, not just active panes.
- Visible layout is derived from projected session records across groups.

### Pane order contract

Primary detail: `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_sidebar_interaction_state.md`

- Split-pane order comes from `activeGroup.snapshot.visibleSessionIds`.
- `localPaneOrder` is only a temporary override within the currently visible set.
- Message coordination includes `syncPaneOrder` and `focusSession`.
- Goal: preserve slot stability when active session changes.

### Focus ownership

From `workspace_focus_debugging.md` and `workspace_focus_and_sidebar_drag_semantics.md`:

- `TerminalPane` emits activation intent only via `onActivate("pointer")` and fallback `onActivate("focusin")`.
- `WorkspaceApp` is authoritative for real focus changes and `vscode.postMessage({ sessionId, type: "focusSession" })`.
- Pointer activation is primary; `focusin` is fallback after `:focus-within`.
- Auto-focus guard window: **400 ms** (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
- T3 iframe-originated focus uses `vsmuxT3Focus`.
- Stale pending local focus is cleared if server-reported focus moves elsewhere.

## Runtime thresholds and input behavior

From `terminal_pane_runtime_thresholds_and_behaviors.md`:

- Auto-scroll trigger: **4 printable keystrokes within 450 ms**
- Scroll-to-bottom button:
  - show if > **200 px** from bottom
  - hide below **40 px**
- Scheduler probe:
  - every **50 ms**
  - over **5000 ms**
  - warning at **250 ms**
- Lag monitor:
  - over **10000 ms**
  - lag when avg overshoot ≥ **1000 ms**
  - only while pane is visible, document visible, and focused
- Search close clears results to `SEARCH_RESULTS_EMPTY = { resultCount: 0, resultIndex: -1 }` and refocuses terminal on next animation frame.

### Keyboard mappings

Across `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`:

- `Shift+Enter` → `\x1b[13;2u`
- macOS:
  - `Meta+ArrowLeft` → `\x01`
  - `Meta+ArrowRight` → `\x05`
  - `Alt+ArrowLeft` → `\x1bb`
  - `Alt+ArrowRight` → `\x1bf`
- non-Mac:
  - `Ctrl+ArrowLeft` → `\x1bb`
  - `Ctrl+ArrowRight` → `\x1bf`
- Platform detection regex: `/Mac|iPhone|iPad|iPod/`

## Sidebar interaction and drag semantics

From `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_sidebar_interaction_state.md`:

- Sidebar cards must not reorder from click-shaped interactions.
- Reorder requires real pointer movement in the same interaction.
- Ignore reorder if drag end occurs without meaningful motion, even if drop target resolves.
- Movement threshold: **8 px**

### Drag timing / sensors

From `terminal_titles_activity_and_sidebar_runtime.md`:

- Startup interaction block: **1500 ms**
- Non-touch activation distance: **6 px**
- Touch activation: **250 ms** delay, **5 px** tolerance
- Hold-to-drag on session cards: **130 ms** delay, **12 px** tolerance

### Session-card capabilities

From `workspace_sidebar_interaction_state.md`:

- Actions: `promptRenameSession`, `closeSession`, `copyResumeCommand`, `fullReloadSession`
- Resume command copy supported for: **codex, claude, copilot, gemini, opencode**
- Full reload supported only for: **codex, claude**

## Titles, agent activity, and completion sounds

### Title precedence / sanitization

From `terminal_titles_activity_and_completion_sounds.md` and `title_activity_and_sidebar_runtime.md`:

- Visible title precedence:
  1. manual user title
  2. terminal title
  3. alias
- Generated `Session N` titles are not meaningful primary titles.
- Path-like titles beginning with `~` or `/` are hidden.
- Leading spinner/braille/bullet chars are stripped.

Important patterns:

- `^Session \d+$`
- `^(~|/)`
- `^[\s\u2800-\u28ff·•⋅◦]+`
- `^session-(\d+)$`
- `^\d{2}$`

### Activity derivation

Across both title/activity entries:

- CLI agent activity is title-derived.
- Supported title models: **Claude, Codex, Gemini, GitHub Copilot**
- Markers:
  - Claude working: `⠐`, `⠂`, `·`; idle: `✳`, `*`
  - Codex working: `⠸`, `⠴`, `⠼`, `⠧`, `⠦`, `⠏`, `⠋`, `⠇`, `⠙`, `⠹`
  - Gemini: `✦` working, `◇` idle
  - Copilot: `🤖` working, `🔔` idle/attention

### Stale spinner / attention / audio

- Claude and Codex require observed title transitions before spinner markers count as working.
- Their spinner state expires if glyphs stall for **3000 ms**.
- Gemini and Copilot do not use stale-spinner gating.
- Attention can surface only after a prior working phase of at least **3000 ms**.
- Completion sound plays **1000 ms** after attention appears.
- Presentation updates use targeted patch messages rather than full sidebar/workspace rehydrate.
- Audio is embedded as data URLs and decoded with **`AudioContext`**, unlocked on first user interaction; avoids unreliable fetch/`HTMLAudio` behavior in VS Code webviews.

## Backend / daemon behavior

From `current_state.md`:

- Backend uses a per-workspace `DaemonTerminalRuntime`, not a global daemon.
- Managed sidebar sessions stay alive through lease renewal while VS Code is active.
- `VSmux.backgroundSessionTimeoutMinutes` controls background timeout:
  - default **5 minutes**
  - `<= 0` disables timeout
- If daemon state is unavailable, disconnected snapshots come from persisted session state while preserving title, `agentName`, and `agentStatus`.
- Backend session polling refreshes every **500 ms**.

## Workspace browser and T3 integration

### Browser tab filtering / panel identity

From `workspace_browser_t3_integration.md`:

- Browser sidebar group ID: `browser-tabs`
- Exclude VSmux-owned tabs from browser group when:
  - `viewType === T3_PANEL_TYPE`
  - `viewType === WORKSPACE_PANEL_TYPE`
  - `viewType.startsWith("vsmux.")`
  - URL matches localhost workspace/t3 embed
- URL exclusion regex:
  `^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:workspace|t3-embed)(?:\/|$)` with `i`
- Workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon: `media/icon.svg`
- Accepted panel messages:
  - `ready`
  - `workspaceDebugLog`
  - `reloadWorkspacePanel`
  - `focusSession`
  - `closeSession`
  - `fullReloadSession`
  - `syncPaneOrder`
  - `syncSessionOrder`

### T3 activity monitor

From `workspace_browser_t3_integration.md`:

- Activity is websocket-backed via `extension/t3-activity-monitor.ts`.
- RPC methods:
  - `orchestration.getSnapshot`
  - `subscribeOrchestrationDomainEvents`
- Timing:
  - request timeout **15000 ms**
  - reconnect delay **1500 ms**
  - refresh debounce **100 ms**

### Managed T3 runtime / upgrade model

From `t3_managed_runtime_upgrade_and_recovery.md`:

- Managed runtime: **`127.0.0.1:3774`**
- Legacy runtime: **`127.0.0.1:3773`**
- Required websocket endpoint: **`ws://127.0.0.1:3774/ws`**
- RPC request IDs must be numeric strings matching `^\d+$`.
- Protocol expectations include `/ws`, `Ping` → `Pong`, and subscription stream handling via `Chunk`, `Ack`, `Exit`.
- Runtime-related files:
  - `extension/t3-runtime-manager.ts`
  - `scripts/build-t3-embed.mjs`
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Runtime supervision:
  - startup/request timeout **30000 ms**
  - lease heartbeat **30000 ms**
  - grace period **180000 ms**
  - supervisor files: `supervisor.json`, `supervisor-launch.lock`
- Upgrade rule: validate T3 changes in an isolated worktree, keep embedded HTML + local asset server hosting, and do not point new embed at legacy `3773` runtime.
- Mixed-install recovery requires syncing `forks/t3code-embed/upstream`, `overlay`, and `dist` from tested worktree back to main.

## VSIX packaging and embed validation

From `vsix_packaging_and_t3_embed_validation.md`:

- Packaging baseline:
  - extension version **2.5.0**
  - VS Code engine **^1.100.0**
  - package manager **pnpm@10.14.0**
  - entrypoint `out/extension/extension.js`
- Packaged outputs include:
  - `forks/t3code-embed/dist/**`
  - `out/workspace/**`
  - `out/**`
  - `media/**`
- Workflow handled by `scripts/vsix.mjs` with modes `package` and `install`
- Usage: `node ./scripts/vsix.mjs <package|install> [--profile-build]`
- Key commands/settings:
  - build: `pnpm run compile`
  - package: `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
  - install: `<vscodeCli> --install-extension <vsixPath> --force`
  - env flags: `VSMUX_PROFILE_BUILD=1`, `VSMUX_SKIP_PREPUBLISH=1`
- CLI resolution prefers `VSMUX_CODE_CLI` or auto-detects `code`, `code-insiders`, `cursor`, `cursor-insiders`, `codium`, `windsurf`.

### Critical validation rule

Before debugging T3 UI behavior:

1. Reinstall the intended VSIX
2. Verify installed asset hash under `~/.vscode/extensions/maddada.vsmux-*/forks/t3code-embed/dist/assets/index-*.js`
3. Only then compare behavior

Observed mismatch in `vsix_packaging_and_t3_embed_validation.md`:

- refreshed worktree hash: `index-DCV3LG5L.js`
- stale installed hash: `index-BbtZ0IEL.js`

## Stable cross-entry architectural decisions

Consistent across the topic:

- **Restty** is the renderer.
- Runtime identity/reuse is per `sessionId`.
- Hidden panes stay mounted and painted.
- Visible pane order is driven by `activeGroup.snapshot.visibleSessionIds`.
- `TerminalPane` signals intent; `WorkspaceApp` owns focus.
- Sidebar reorder requires true drag motion, not clicks.
- Agent activity is title-derived, with stale-spinner logic for Claude/Codex.
- Completion sounds use embedded `AudioContext` delivery.
- Managed T3 integration standardizes on `ws://127.0.0.1:3774/ws`.
- Installed VSIX asset hash, not localhost output, is the source of truth for embed-debug validation.
