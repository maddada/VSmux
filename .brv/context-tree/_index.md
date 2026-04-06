---
children_hash: 9bb2c8bc0884b0bd44f56f9b938a1d84e0d64eee722bf865b5a5a5ccab332ce1
compression_ratio: 0.5723496590204588
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 8065
summary_level: d3
token_count: 4616
type: summary
---

# Structural Summary: Terminal Workspace Architecture and Facts

## Scope

These entries describe the VSmux terminal workspace’s stable architecture and quick-recall facts. The material clusters around:

- terminal runtime lifecycle and pane projection
- focus ownership, drag/reorder safeguards, and input behavior
- title/activity derivation and completion signaling
- daemon/session persistence behavior
- browser sidebar + workspace panel + T3 integration
- managed T3 runtime upgrade and VSIX validation rules

Primary drill-down:

- `architecture/_index.md`
- `facts/_index.md`
- `terminal-workspace-current-state.md`

---

## 1. Core Terminal Workspace Model

### Renderer, cache, and runtime identity

Across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- Frontend terminal renderer is `Restty`/`restty`, not xterm.
- Frontend runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- Runtime reuse is intentional so session switches do not recreate the frontend terminal or replay transcripts.
- Invalidation is generation-based via `renderNonce`.
- `releaseCachedTerminalRuntime` is non-destructive host release logic; full teardown happens via `destroyCachedTerminalRuntime`.
- Closed sessions explicitly send `destroyTerminalRuntime` so recycled `sessionId` values cannot inherit old content.

### Hidden pane and warm-switching strategy

From `architecture/_index.md` and `terminal-workspace-current-state.md`:

- Workspace projection includes terminal sessions from all groups, not just the active group.
- Hidden/inactive panes remain mounted in the same layout slot behind the active pane.
- Panes stack in the same `grid-area`; active pane is surfaced with higher `z-index`; hidden panes mainly disable pointer events.
- This is a deliberate architectural decision to prevent reconnect churn, reflow, wrapping changes, transcript loss, and visible-tail cutback during pane switching.

### Visible pane order contract

From `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- Visible split-pane order is driven by `activeGroup.snapshot.visibleSessionIds`.
- `localPaneOrder` is only a temporary optimistic override within the currently visible sessions.
- Slot stability is a core invariant: switching active session inside a split should not make passive surfaced panes jump slots.

Drill down:

- `terminal-workspace-current-state.md`
- `architecture/_index.md`
- `facts/_index.md`

---

## 2. Bootstrap, sizing, and maintenance behavior

### Stable readiness and PTY startup

From `architecture/_index.md` and `facts/_index.md`:

- Stable sizing waits up to `20` attempts and resolves after `2` identical measurements.
- PTY connection waits for appearance completion plus stable terminal size.
- `transportController.markTerminalReady(cols, rows)` is sent before PTY connect.
- Reattach is preferred when a live daemon PTY exists; `didCreateSession` distinguishes reattach from recreation.

### Visible maintenance lifecycle

From `terminal-workspace-current-state.md`:

- `workspace/terminal-pane.tsx` uses one shared visible-maintenance path for startup and later upkeep.
- Cached runtime stores `bootstrapVisualsComplete`.
- Startup-only black-surface seeding and canvas reveal checks stop once bootstrap visuals complete.
- Later visible maintenance continues with scroll-host binding, scroll visibility updates, and optional size updates.
- Resize and mutation observers both trigger visible maintenance.
- Hidden panes skip redraw work after PTY connect.

### Lag detection and recovery

From all three entries:

- Scheduler lag recovery exists for terminal panes.
- Current implementation runs lag detection only when `debuggingMode` is enabled.
- Lag threshold is average timer overshoot `>= 1000 ms`.
- Key windows/constants repeated across summaries:
  - probe interval: `50 ms`
  - probe/flush window: `5000 ms`
  - monitor window: `10000 ms`
  - warning threshold: `250 ms`
- Recovery only matters when pane is visible and focused / document visible.
- `AUTO_RELOAD_ON_LAG = true`.
- Auto reload is limited to once per workarea boot.
- Reload preserves the last active `sessionId` via `reloadWorkspacePanel` and a follow-up auto-focus request.
- Dormant reload-notice UI remains fallback if auto reload is disabled.
- `retainContextWhenHidden = false` for the workspace panel to prefer fresh webview recreation over retaining a bad scheduler state.

Drill down:

- `terminal-workspace-current-state.md`
- `terminal_pane_runtime_thresholds_and_behaviors.md` (via `architecture/_index.md`)
- `terminal_workspace_runtime_facts.md` (via `facts/_index.md`)

---

## 3. Focus ownership, activation, and pane interaction

### Focus authority split

Across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- `TerminalPane` emits activation intent only.
- `WorkspaceApp` is authoritative for actual focus decisions and focus policy.
- Primary activation path is `onActivate("pointer")`.
- Fallback path is `onActivate("focusin")`, only after pane ownership of `:focus-within`.
- Workspace-to-extension focus messaging uses `vscode.postMessage({ sessionId, type: "focusSession" })`.
- `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`.
- Pending local focus is cleared if server-reported focus moves elsewhere.
- T3 iframe-originated focus uses message type `vsmuxT3Focus`.

### Input mappings and terminal behavior

From `architecture/_index.md` and `facts/_index.md`:

- `Shift+Enter` → `\x1b[13;2u`
- macOS:
  - `Meta+ArrowLeft` → `\x01`
  - `Meta+ArrowRight` → `\x05`
  - `Alt+ArrowLeft` → `\x1bb`
  - `Alt+ArrowRight` → `\x1bf`
- non-macOS:
  - `Ctrl+ArrowLeft` → `\x1bb`
  - `Ctrl+ArrowRight` → `\x1bf`
- platform detection regex: `/Mac|iPhone|iPad|iPod/`

### Scroll and search thresholds

From `architecture/_index.md` and `facts/_index.md`:

- Typing auto-scroll triggers after `4` printable keystrokes within `450 ms`.
- Scroll-to-bottom button shows when more than `200 px` from bottom and hides below `40 px`.
- Search close resets results to `SEARCH_RESULTS_EMPTY = { resultCount: 0, resultIndex: -1 }` and refocuses terminal next animation frame.

Drill down:

- `workspace_focus_debugging.md`
- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging_facts.md`
- `workspace_sidebar_interaction_facts.md`

---

## 4. Sidebar drag, reorder, and session-card behavior

### Reorder safety model

Across all summaries:

- Sidebar session cards must not reorder from ordinary clicks.
- Reorder requires real movement in the same interaction.
- Drag-end reorder is ignored if interaction stayed click-shaped even when the drag library resolved a drop target.
- Sidebar reorder mutation threshold: `8 px`.

### Drag timing / sensors

From `architecture/_index.md` and `facts/_index.md`:

- startup interaction block: `1500 ms`
- non-touch activation distance: `6 px`
- touch activation: `250 ms` delay with `5 px` tolerance
- session-card hold-to-drag: `130 ms` delay with `12 px` tolerance

### Session-card actions and messaging

From `facts/_index.md` and `architecture/_index.md`:

- Card actions include:
  - `promptRenameSession`
  - `closeSession`
  - `copyResumeCommand`
  - `fullReloadSession`
- Session card click focuses session.
- Meta-click and middle-click close session.
- Resume command copy supports:
  - `codex`
  - `claude`
  - `copilot`
  - `gemini`
  - `opencode`
- Full reload supports only:
  - `codex`
  - `claude`

### Ordering / workspace message types

Message coordination mentioned across entries:

- `syncPaneOrder`
- `focusSession`
- `syncGroupOrder`
- `moveSessionToGroup`
- `syncSessionOrder`

Drill down:

- `workspace_sidebar_interaction_state.md`
- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`

---

## 5. Titles, agent activity, and completion signaling

### Title precedence and sanitization

From `architecture/_index.md`:

- Visible title precedence:
  1. manual user title
  2. terminal title
  3. alias
- Generated `Session N` titles are not meaningful primary titles.
- Path-like titles beginning with `~` or `/` are hidden.
- Leading spinner/braille/bullet glyphs are stripped.

Key patterns preserved:

- `^Session \d+$`
- `^(~|/)`
- `^[\s\u2800-\u28ff·•⋅◦]+`
- `^session-(\d+)$`
- `^\d{2}$`

### Title-derived agent activity

From `architecture/_index.md`:

- Agent activity is derived from terminal title text.
- Supported title models:
  - Claude
  - Codex
  - Gemini
  - GitHub Copilot
- Marker sets:
  - Claude working: `⠐`, `⠂`, `·`; idle: `✳`, `*`
  - Codex working: `⠸`, `⠴`, `⠼`, `⠧`, `⠦`, `⠏`, `⠋`, `⠇`, `⠙`, `⠹`
  - Gemini: `✦` working, `◇` idle
  - Copilot: `🤖` working, `🔔` idle/attention

### Spinner staleness, attention, and sound delivery

From `architecture/_index.md`:

- Claude and Codex require observed title transitions before spinner markers count as working.
- Spinner state expires if glyphs stall for `3000 ms`.
- Gemini and Copilot do not use stale-spinner gating.
- Attention only surfaces after a prior working phase of at least `3000 ms`.
- Completion sound plays `1000 ms` after attention appears.
- Presentation updates use targeted patch messages instead of full rehydrate.
- Audio delivery uses embedded data URLs plus `AudioContext`, unlocked on first user interaction, instead of fetch/`HTMLAudio` in VS Code webviews.

Drill down:

- `terminal_titles_activity_and_completion_sounds.md`
- `title_activity_and_sidebar_runtime.md`

---

## 6. Daemon lifetime, persistence, and session semantics

### Daemon ownership model

From `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- Backend uses a per-workspace `DaemonTerminalRuntime`, not a single global daemon.
- This avoids ownership conflicts and stale-daemon replacement problems across unrelated projects.
- Sidebar-listed managed sessions remain alive through synchronized lease renewal while VS Code is active.

### Timeout, polling, and persistence

Repeated facts:

- `VSmux.backgroundSessionTimeoutMinutes` default is `5`.
- `<= 0` disables timeout.
- Backend polling interval is `500 ms`.
- Persisted disconnected snapshots preserve `title`, `agentName`, and `agentStatus`.

### Reattach vs resume semantics

From `terminal-workspace-current-state.md` and summaries:

- `createOrAttach` includes `didCreateSession`.
- If a live daemon PTY exists, behavior must be reattach, not resume.
- Resume commands should run only when backend terminal was truly recreated.

Drill down:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `terminal-workspace-current-state.md`

---

## 7. Browser sidebar, workspace panel, and T3 integration

### Browser/workspace boundary rules

From `architecture/_index.md` and `facts/_index.md`:

- Browser sidebar group ID is `browser-tabs`.
- VSmux-owned tabs are excluded from browser grouping when:
  - `viewType === T3_PANEL_TYPE`
  - `viewType === WORKSPACE_PANEL_TYPE`
  - `viewType.startsWith("vsmux.")`
  - URL matches localhost workspace/T3 embed patterns
- Exclusion regex:
  `^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:workspace|t3-embed)(?:\/|$)` with `i`

### Workspace panel identity and roots

- Workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon: `media/icon.svg`
- Local resource roots:
  - `out/workspace`
  - `forks/t3code-embed/dist`
- `retainContextWhenHidden = false`
- Workspace groups render from authoritative `sessionIdsByGroup` payloads.

### Panel/workspace message types

Accepted workspace/panel messages mentioned across entries:

- `ready`
- `workspaceDebugLog`
- `reloadWorkspacePanel`
- `focusSession`
- `closeSession`
- `fullReloadSession`
- `syncPaneOrder`
- `syncSessionOrder`

### T3 activity and focus

From `architecture/_index.md` and `facts/_index.md`:

- T3 activity is websocket-backed via `extension/t3-activity-monitor.ts` / `T3ActivityMonitor`.
- RPC methods:
  - `orchestration.getSnapshot`
  - `subscribeOrchestrationDomainEvents`
- Timing:
  - request timeout `15000 ms`
  - reconnect delay `1500 ms`
  - refresh debounce `100 ms`
- Activity monitor responds to `Ping` with `pong`/`Pong`.
- Domain-event chunk refreshes are debounced.
- Focus acknowledgement uses completion-marker-aware `acknowledgeThread`.

Drill down:

- `workspace_browser_t3_integration.md`
- `workspace_browser_t3_integration_facts.md`
- `workspace_focus_debugging_facts.md`

---

## 8. Managed T3 runtime upgrade and recovery model

### Runtime endpoints and protocol invariants

From `architecture/_index.md` and `facts/_index.md`:

- Managed runtime: `127.0.0.1:3774`
- Legacy runtime: `127.0.0.1:3773`
- Required websocket endpoint: `ws://127.0.0.1:3774/ws`
- `/ws` is required; bare origin is not sufficient.
- Effect/RPC request IDs must be numeric strings matching `^\d+$`, not UUIDs.
- Protocol expectations include:
  - `Ping` → `Pong`
  - subscription stream handling via `Chunk`, `Ack`, `Exit`

### Supervision and recovery

Key runtime-related files:

- `extension/t3-runtime-manager.ts`
- `scripts/build-t3-embed.mjs`
- `forks/t3code-embed/upstream/apps/server/src/bin.ts`

Runtime supervision constants:

- startup/request timeout `30000 ms`
- lease heartbeat `30000 ms`
- grace period `180000 ms`
- supervisor files:
  - `supervisor.json`
  - `supervisor-launch.lock`

Upgrade/recovery rules:

- Validate T3 changes in an isolated worktree.
- Keep embedded HTML plus local asset server hosting.
- Do not retarget new embed behavior to legacy `3773`.
- Mixed-install recovery requires syncing tested `upstream`, `overlay`, and `dist` back to the main worktree, then reinstalling and restarting the managed runtime.

Drill down:

- `t3_managed_runtime_upgrade_and_recovery.md`
- `t3_managed_runtime_upgrade_facts.md`

---

## 9. VSIX packaging, extension identity, and embed validation

### Packaging baseline

From `architecture/_index.md` and `facts/_index.md`:

- Extension version: `2.5.0`
- VS Code engine: `^1.100.0`
- package manager: `pnpm@10.14.0`
- main entrypoint: `out/extension/extension.js` / `./out/extension/extension.js`

Packaged outputs include:

- `forks/t3code-embed/dist/**`
- `out/workspace/**`
- `out/**`
- `media/**`

Workflow:

- `scripts/vsix.mjs` with modes `package` and `install`
- command form: `node ./scripts/vsix.mjs <package|install> [--profile-build]`
- build: `pnpm run compile`
- package: `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
- install: `<vscodeCli> --install-extension <vsixPath> --force`

Flags and CLI resolution:

- `VSMUX_PROFILE_BUILD=1`
- `VSMUX_SKIP_PREPUBLISH=1`
- `VSMUX_CODE_CLI` preferred; otherwise detect `code`, `code-insiders`, `cursor`, `cursor-insiders`, `codium`, `windsurf`

### Extension identity and activation

From `facts/_index.md`:

- Display name: `VSmux - T3code & Agent CLIs Manager`
- Publisher: `maddada`
- Repository: `https://github.com/maddada/VSmux.git`
- Icon: `media/VSmux-marketplace-icon.png`
- Primary Activity Bar container: `VSmuxSessions`
- Primary view ID: `VSmux.sessions`
- Secondary container: `VSmuxSessionsSecondary`
- Activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`

### Dependency/config invariants

From `facts/_index.md`:

- `pnpm` overrides:
  - `vite` → `npm:@voidzero-dev/vite-plus-core@latest`
  - `vitest` → `npm:@voidzero-dev/vite-plus-test@latest`
- `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`
- `VSmux.gitTextGenerationProvider` default: `codex`; supported: `codex`, `claude`, `custom`
- `VSmux.sendRenameCommandOnSidebarRename` default: `true`

### Critical validation rule

Strongly repeated across packaging entries:

- Installed VSIX contents are the source of truth when diagnosing T3/embed drift, not localhost/worktree output alone.
- Before debugging T3 UI behavior:
  1. reinstall the intended VSIX
  2. verify installed asset hash under `~/.vscode/extensions/maddada.vsmux-*/forks/t3code-embed/dist/assets/index-*.js`
  3. only then compare behavior

Observed mismatch recorded:

- worktree/refreshed bundle: `index-DCV3LG5L.js`
- installed/stale bundle: `index-BbtZ0IEL.js`

Drill down:

- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_packaging_and_embed_validation_facts.md`

---

## 10. Cross-entry implementation anchors

Stable decisions repeated across the architecture and facts layers:

- `Restty` is the terminal renderer.
- Runtime identity and reuse are keyed by `sessionId`.
- `renderNonce` controls generation-based invalidation.
- Hidden panes stay mounted and painted behind the active pane.
- Pane order comes from `activeGroup.snapshot.visibleSessionIds`.
- `TerminalPane` emits activation intent; `WorkspaceApp` owns focus policy.
- Sidebar reorder requires real drag motion, not click-shaped interactions.
- T3 iframe focus uses `vsmuxT3Focus`.
- Agent activity is title-derived; stale-spinner gating applies to Claude/Codex.
- Completion sound uses embedded `AudioContext` delivery.
- Backend uses a per-workspace daemon with `500 ms` polling and `5` minute default background timeout.
- Managed T3 runtime standardizes on `ws://127.0.0.1:3774/ws`.
- Installed VSIX asset hash is the authoritative embed-debug validation signal.

---

## Drill-down map by need

- Baseline current behavior: `terminal-workspace-current-state.md`
- Full architectural overview: `architecture/_index.md`
- Quick stable constants and rules: `facts/_index.md`
- Focus and drag internals: `workspace_focus_debugging.md`, `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging_facts.md`, `workspace_focus_and_drag_runtime_facts.md`
- Sidebar/session interaction rules: `workspace_sidebar_interaction_state.md`, `workspace_sidebar_interaction_facts.md`
- Runtime thresholds and lifecycle details: `terminal_pane_runtime_thresholds_and_behaviors.md`, `terminal_workspace_runtime_facts.md`
- Title/activity/audio behavior: `terminal_titles_activity_and_completion_sounds.md`, `title_activity_and_sidebar_runtime.md`
- Browser/workspace/T3 integration: `workspace_browser_t3_integration.md`, `workspace_browser_t3_integration_facts.md`
- Managed T3 runtime and recovery: `t3_managed_runtime_upgrade_and_recovery.md`, `t3_managed_runtime_upgrade_facts.md`
- Packaging and embed validation: `vsix_packaging_and_t3_embed_validation.md`, `vsmux_packaging_and_embed_validation_facts.md`
