---
children_hash: d8698861e0dba47a6c06716e629e020963cebb10758b338c6310e6e5d2735028
compression_ratio: 0.5986908750876646
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 12833
summary_level: d3
token_count: 7683
type: summary
---

# Structural Summary

## Knowledge map

This level combines three top-level entries:

- `architecture/_index.md` — long-form architectural map of VSmux
- `facts/_index.md` — dense quick-recall implementation facts
- `terminal-workspace-current-state.md` — current-state snapshot focused on terminal workspace runtime behavior

Together they describe a system centered on `terminal_workspace`, with supporting subsystems for `chat_history` / VSmux Search and `git_text_generation`.

---

## 1) Core system shape: VSmux is a workspace-centered architecture

The dominant architectural center is `architecture/terminal_workspace/_index.md`, reinforced by `terminal-workspace-current-state.md` and many fact entries under `facts/project/_index.md`.

### Primary subsystems

- `terminal_workspace`
  - workspace rendering, pane lifecycle, runtime caching, focus, sidebar, persistence, daemon ownership, browser/T3 integration, Agent Manager X bridge
- `chat_history`
  - conversation viewer, native search, resume actions, VSmux Search branding and packaging
- `git_text_generation`
  - provider-based shell command generation for commit messages, PR text, and session-title summarization

### Repeating architectural throughlines

Across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`, the same choices repeat:

- controller/state authority over UI-local state
- webview + extension-host split
- explicit runtime reuse instead of hidden webview persistence
- per-workspace scoping for persistence, daemons, bridge state, and sidebar preferences
- validated message contracts rather than ad hoc UI mutation
- normalized user-visible state while preserving raw runtime state for behavior logic

A recurring platform choice is `retainContextWhenHidden: false` for both workspace and viewer panels.

---

## 2) Terminal workspace: runtime, pane model, and focus ownership

Primary drill-downs:

- `architecture/terminal_workspace/current_state.md`
- `architecture/terminal_workspace/terminal_pane_runtime_thresholds_and_behaviors.md`
- `architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
- `facts/project/terminal_workspace_facts.md`
- `facts/project/terminal_workspace_runtime_facts.md`
- `terminal-workspace-current-state.md`

### Renderer and runtime cache

- Frontend terminal renderer is `restty`, not xterm.
- Frontend terminal runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- Cache invalidation is generation-based through `renderNonce`.
- When a session is removed, the controller sends `destroyTerminalRuntime` so a recycled `sessionId` cannot inherit stale transcript state.
- Runtime lifecycle distinguishes:
  - `releaseCachedTerminalRuntime()` — detach DOM, preserve runtime
  - `destroyCachedTerminalRuntime()` — full cleanup

### Warm-pane projection model

From `terminal-workspace-current-state.md` and `current_state.md`:

- workspace pane projection includes terminal sessions from all groups, not only the active group
- inactive terminal panes stay mounted behind the active pane in the same `grid-area`
- non-active panes are hidden mainly through z-index/pointer-event behavior, not teardown
- this is intentional to keep terminals warm across same-group and cross-group switching
- hidden-pane reflow is explicitly avoided because size churn caused wrapping changes and visible tail loss

### Focus ownership

- `workspace/terminal-pane.tsx` emits activation intent
- `workspace/workspace-app.tsx` is the authoritative focus owner
- `TerminalPane` should not own focus policy; `WorkspaceApp` decides whether to send `focusSession`

Preserved focus/focus-guard facts:

- activation sources include `pointer` and `focusin`
- `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400ms`
- panel context key is `vsmux.workspacePanelFocus`

### Pane ordering

Across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- visible split order comes from `activeGroup.snapshot.visibleSessionIds`
- not from filtering a global pane-order list
- `localPaneOrder` is only a temporary visible-session override for optimistic reorder feedback
- goal: slot stability, so passive surfaced panes do not jump when active focus changes

---

## 3) Grouped workspace state and session lifecycle

Primary drill-downs:

- `architecture/terminal_workspace/simple_grouped_session_workspace_state.md`
- `facts/project/simple_grouped_session_workspace_state_facts.md`
- `facts/project/workspace_session_sleep_wake_support_facts.md`

### Canonical state model

Canonical implementation lives in:

- `shared/simple-grouped-session-workspace-state.ts`

Important invariants:

- at least one group always exists
- normalization starts from `createDefaultGroupedSessionWorkspaceSnapshot()`
- empty groups are retained
- browser sessions are removed from this terminal-focused model
- duplicate display IDs are repaired
- canonical session IDs derive from display IDs as `session-${formatSessionDisplayId(displayId ?? 0)}`
- active-group fallback prefers nearest previous populated group
- `visibleSessionIds` are preserved/restored per group
- single visible pane normalizes to `[focusedSessionId]`
- group focus-by-index is 1-based
- group creation is capped by `MAX_GROUP_COUNT`

### Session creation/movement rules

- new sessions take the first free display ID
- append to the active group
- gain focus immediately
- recompute visibility
- moved sessions activate/focus destination groups
- fullscreen preserves `fullscreenRestoreVisibleCount`
- T3 metadata updates apply only when `kind === t3`

### Sleep/wake model

From `workspace_session_sleep_wake_support.md` and facts:

- session records persist `isSleeping`
- sleeping sessions are excluded from awake focus and visible split calculations
- focusing a sleeping session wakes it
- group sleep/wake can toggle whole groups
- sleeping terminal sessions dispose live runtime/surface but preserve session card and resume metadata

---

## 4) Persistence, daemon ownership, and restore semantics

Primary drill-downs:

- `architecture/terminal_workspace/terminal_persistence_across_reloads.md`
- `architecture/terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `facts/project/terminal_persistence_reload_facts.md`
- `facts/project/terminal_persistence_across_vs_code_reloads_facts.md`
- `terminal-workspace-current-state.md`

### Three-part persistence architecture

Repeated across architecture and facts:

1. `SessionGridStore`
2. detached per-workspace daemon for PTYs
3. restored webview state with cached Restty runtimes

Persisted snapshot key:

- `VSmux.sessionGridSnapshot`

Related daemon state artifacts called out in facts:

- `daemon-info.json`
- `daemon-launch.lock`
- `terminal-daemon-debug.log`

### Per-workspace daemon decision

A major architectural decision is:

- VSmux uses a per-workspace daemon, not a single global daemon

Reason preserved in `terminal-workspace-current-state.md`:

- shared daemon ownership across unrelated projects caused conflicts and stale-daemon replacement problems

### Restore / reconnect flow

Restore ordering is preserved in multiple entries:

- restore snapshot
- reconnect daemon
- wait for `terminalReady`
- replay ring buffer
- flush pending attach queue / pending output
- switch live / attach active runtime

Important timeouts and limits:

- control connect timeout `3000ms`
- daemon ready timeout `10000ms`
- stale launch lock `30000ms`
- owner heartbeat `5000ms`
- owner heartbeat timeout `20000ms`
- startup grace `30000ms`
- terminal/session attach ready timeout `15000ms`
- replay cap `8 MiB`
- replay chunk size `128 KiB`
- idle shutdown `5 * 60_000ms`

### Reattach vs resume

A key semantic distinction from `terminal-workspace-current-state.md`:

- `createOrAttach` responses include `didCreateSession`
- if backend PTY is still live, VSmux must reattach
- resume commands should run only when a backend terminal was actually recreated

### Persisted presentation state

Persisted session state stores:

- `agentName`
- `agentStatus`
- `title`

Key files and behavior:

- `extension/session-state-file.ts`
- `extension/terminal-daemon-session-state.ts`

Purpose:

- preserve last known agent/title for cold-start correctness when daemon is not currently live

---

## 5) Startup/bootstrap and lag recovery

Primary drill-downs:

- `architecture/terminal_workspace/workspace_panel_startup_without_placeholder.md`
- `architecture/terminal_workspace/workspace_panel_startup_without_loading_placeholder.md`
- `facts/project/workspace_panel_startup_bootstrap_facts.md`
- `terminal-workspace-current-state.md`

### Bootstrap-first restore

Startup is organized around embedding state into HTML before panel reveal.

Preserved identity/bootstrap details:

- `openWorkspace` reveals sidebar first
- latest renderable state is embedded via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- facts also refer to `window.VSMUX_WORKSPACE_BOOTSTRAP`
- replay prioritizes renderable state (`hydrate` / `sessionState`) before transient state
- duplicate stable-state messages are ignored by JSON-signature comparison
- one-shot `autoFocusRequest` is allowed through / stripped from buffering depending on replay stage

Panel identity:

- type: `vsmux.workspace`
- title: `VSmux`
- icon: `media/icon.svg`

### Lag detection and recovery

Drill down:

- `architecture/terminal_workspace/workspace_focus_debugging.md`
- `facts/project/workspace_focus_debugging_facts.md`
- `docs/workarea-lag-recovery.md` is referenced indirectly by the curated entries

Preserved behavior:

- lag recovery is enabled by default with `AUTO_RELOAD_ON_LAG = true`
- current-state note: detector currently runs only when `debuggingMode` is enabled because the effect is gated that way
- detection windows/constants include:
  - probe interval `50ms`
  - probe window `5000ms`
  - monitor window `10000ms`
  - warn threshold `250ms`
  - reload threshold `>= 1000ms` average overshoot
- auto reload is limited to once per workarea boot
- reload preserves focus by carrying the last active `sessionId` through `reloadWorkspacePanel`
- dormant reload-notice UI remains as fallback if auto reload is disabled

---

## 6) Sidebar interaction, sorting, timestamps, and debug suppression

Primary drill-downs:

- `architecture/terminal_workspace/sidebar_active_sessions_sort_mode.md`
- `architecture/terminal_workspace/sidebar_active_sessions_sort_mode_persistence.md`
- `architecture/terminal_workspace/sidebar_browsers_empty_state.md`
- `architecture/terminal_workspace/sidebar_session_card_last_interaction_timestamps.md`
- `architecture/terminal_workspace/workspace_debug_console_suppression.md`
- corresponding fact files under `facts/project/*`

### Drag/reorder safety

Repeated thresholds:

- startup interaction block `1500ms`
- meaningful reorder / drag movement `8px`
- non-touch drag activation `6px`
- touch activation delay `250ms` with `5px` tolerance
- hold-to-drag `130ms` with `12px` tolerance

Important decision:

- sidebar clicks should focus sessions only
- reordering requires proof of actual pointer movement, not just drag-library drop inference

### Sort modes

- modes: `manual | lastActivity`
- persisted under `VSmux.sidebarActiveSessionsSortMode` in workspace state
- `lastActivity` sorts sessions by descending `lastInteractionAt`
- groups sort by most recent session activity
- missing/invalid timestamps fall back to `0`
- manual order remains tie-breaker / stored source of truth
- dragging is disabled while `lastActivity` mode is active
- toggle contract: `toggleActiveSessionsSortMode`

### Timestamp display

- relative timestamps rerender every second
- activity color buckets:
  - `0–15 min` bright green
  - `15–30 min` faded green
  - `30–60 min` muted green
  - `>1 hr` gray
- persisted file mtimes may seed `lastInteractionAt`

### Empty browser-group behavior and debug suppression

- empty browser groups hide `.group-sessions`
- non-browser empty groups still show `No sessions`
- `sidebar/sidebar-debug.ts` suppresses console logging by making `logSidebarDebug(...)` effectively a no-op
- message flow remains available, especially in Storybook harnesses

---

## 7) Titles, activity, sounds, and session actions

Primary drill-downs:

- `architecture/terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `architecture/terminal_workspace/terminal_titles_activity_and_completion_sounds.md`
- `architecture/terminal_workspace/title_activity_and_sidebar_runtime.md`
- corresponding fact files:
  - `terminal_title_normalization_facts.md`
  - `session_rename_title_auto_summarization_facts.md`
  - `sidebar_session_fork_support_facts.md`
  - `sidebar_fork_session_behavior_facts.md`
  - `default_agent_commands_override_facts.md`

### Title normalization vs raw title tracking

Core rule:

- normalized visible titles drive user-facing UI
- raw live/daemon terminal titles remain in controller memory for activity detection

Key APIs/rules:

- central normalization via `normalizeTerminalTitle()`
- glyph/status stripping regex begins with `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- titles starting with `~` or `/` are hidden from primary visible-title usage
- generated titles like `^Session \d+$` are not preferred visible titles
- preferred precedence is:
  - visible terminal title
  - visible primary session title
  - `undefined`

### Activity markers and sounds

Agent markers preserved:

- Claude working: `⠐ ⠂ ·`; idle: `✳ *`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini working: `✦`; idle: `◇`
- Copilot working: `🤖`; idle/attention: `🔔`

Attention/sound rules:

- a session must have been working for at least `3000ms` before attention appears
- completion sound confirmation delay is `1000ms`
- audio uses unlocked `AudioContext` paths due to VS Code webview constraints

### Rename summarization

This sits at the boundary of `terminal_workspace` and `git_text_generation`.

Rules from architecture + facts:

- summarize only when `title.trim().length > 25`
- `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
- `GENERATED_SESSION_TITLE_MAX_LENGTH = 24`
- preferred output length is `2–4` words
- no quotes, markdown, commentary, or ending punctuation
- cleanup keeps the first non-empty line, strips fences/quotes, collapses whitespace, strips trailing periods, and clamps with whole-word preference

Provider choices here are intentionally different from low-effort git defaults:

- Codex: `gpt-5.4-mini` with high reasoning effort
- Claude: `haiku` with high effort
- timeout remains `180000ms`

### Agent command resolution and session action support

Config surface:

- `VSmux.defaultAgentCommands`
- built-in keys: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`

Rules:

- empty/whitespace overrides normalize to `null`
- configured overrides are used only when no stored per-session preference exists
- stored per-session commands remain authoritative
- legacy built-ins may upgrade to configured aliases during resume/fork only when exact legacy default matches
- legacy string-only launches normalize to `{ agentId: "codex", command }`

Built-in launch resolution supports:

- `codex`, `claude`, `copilot`, `gemini`, `opencode`
- not `t3`

Support matrix:

- copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- fork: `codex`, `claude`
- full reload: `codex`, `claude`
- browser sessions cannot rename, fork, copy-resume, or full-reload

### Fork and resume command signatures

Preserved signatures and behaviors:

- Codex fork: `<command> fork '<title>'`
- Claude fork: `<command> --fork-session -r '<title>'`
- Codex resume: `<command> resume '<title>'`
- Claude resume: `<command> -r '<title>'`

Additional fork behavior:

- fork message contract includes `{ type: "forkSession", sessionId: string }`
- routed via `extension/native-terminal-workspace/sidebar-message-dispatch.ts`
- new fork is inserted as a sibling immediately after the source in the same group
- reuses icon and stored launch metadata
- delayed rename after `FORK_RENAME_DELAY_MS = 4000`

---

## 8) Browser tabs, T3 integration, and managed runtime upgrade

Primary drill-downs:

- `architecture/terminal_workspace/workspace_browser_t3_integration.md`
- `architecture/terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md`
- `facts/project/workspace_browser_t3_integration_facts.md`
- `facts/project/t3_managed_runtime_upgrade_facts.md`

### Browser integration

- browser sidebar group id is `browser-tabs`
- internal VSmux / T3-owned tabs are excluded
- filters cover `viewType` and localhost URL checks
- local `/workspace` and `/t3-embed` URLs are filtered
- browser sessions are intentionally excluded from terminal-only actions and grouped terminal normalization

### T3 activity/runtime integration

Key components and endpoints:

- activity source: `T3ActivityMonitor`
- managed runtime endpoint: `127.0.0.1:3774`
- legacy runtime endpoint: `127.0.0.1:3773`
- websocket URL: `ws://127.0.0.1:3774/ws`
- snapshot RPC: `orchestration.getSnapshot`
- subscription RPC: `subscribeOrchestrationDomainEvents`

Behavioral details:

- request timeout `15000ms`
- reconnect delay `1500ms`
- refresh debounce `100ms`
- Ping/Pong supported
- request IDs are numeric strings matching `^\d+$`
- streaming protocol includes Chunk/Ack/Exit semantics
- T3 focus acknowledgement is completion-marker-aware

Source entrypoint:

- `forks/t3code-embed/upstream/apps/server/src/bin.ts`

Recovery after mixed installs requires synchronization of upstream, overlay, and dist from a tested refresh worktree.

---

## 9) Agent Manager X bridge

Primary drill-downs:

- `architecture/terminal_workspace/agent_manager_x_bridge_integration.md`
- `architecture/terminal_workspace/agent_manager_x_focus_path_without_sidebar_rehydration.md`
- corresponding facts entries

### Bridge model

Key file and endpoint:

- `extension/agent-manager-x-bridge.ts`
- `ws://127.0.0.1:47652/vsmux`

Ownership:

- `NativeTerminalWorkspaceController` owns a single `AgentManagerXBridgeClient`

Snapshot behavior:

- publishes initial and changed workspace snapshots
- snapshots are memory-only
- sends only when:
  - a latest snapshot exists
  - socket is `WebSocket.OPEN`
  - serialized payload changed

Reconnect/handshake:

- handshake timeout `3000ms`
- reconnect backoff starts at `1000ms` and caps at `5000ms`
- `perMessageDeflate` disabled
- `ping` messages are ignored

Payload includes workspace metadata plus per-session fields such as:

- `agent`
- `alias`
- `displayName`
- `isFocused`
- `isRunning`
- `isVisible`
- `kind`
- `status`
- optional `terminalTitle`
- optional `threadId`

Focus path rule:

- `focusSession` is honored only when incoming `workspaceId` matches `latestSnapshot.workspaceId`
- refined focus path now targets session focus directly without forcing sidebar rehydration/reopen

---

## 10) Chat history and VSmux Search

Primary drill-downs:

- `architecture/chat_history/_index.md`
- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `architecture/chat_history/vsmux_search_rename.md`
- fact entries:
  - `viewer_search_and_resume_actions_facts.md`
  - `vsmux_search_rename_facts.md`
  - `vsmux_ai_devtools_integration_facts.md`

### Viewer architecture

Implementation split:

- `chat-history/src/webview/App.tsx`
- `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- `chat-history/src/extension/extension.ts`

Flow:

1. load conversation JSONL
2. parse entries and derive `source`, `sessionId`, optional `cwd`
3. enable search/resume only when metadata is valid
4. webview posts messages like `ready`, `refreshConversation`, `resumeSession`
5. extension validates payload and opens terminal
6. provider-specific resume command executes

### Search model

Architectural choice:

- viewer uses native `window.find` rather than custom indexed search state

Preserved UI behavior:

- `Cmd/Ctrl+F` opens custom find bar
- `Enter` next, `Shift+Enter` previous, `Escape` close
- wraps around
- resets selection/scroll on query change
- explicit states for empty input and failed matches

### Resume contract

Message payload:

- `resumeSession` carries `source`, `sessionId`, optional `cwd`

Source inference from file path:

- `/.codex/`, `/.codex-profiles/` -> `Codex`
- `/.claude/`, `/.claude-profiles/` -> `Claude`

Resume commands:

- `claude --resume <sessionId>`
- `codex resume <sessionId>`

Other preserved details:

- shell quoting uses `quoteShellLiteral`
- terminal opens in conversation `cwd` when available
- terminal label is `AI DevTools Resume (<source>)`
- invalid JSONL/schema parse results normalize to `x-error` records

### VSmux Search rename / packaging

Renamed identifiers:

- command namespace: `VSmuxSearch.*`
- view id: `VSmuxSearch.conversations`
- view label: `VSmux Search`
- viewer panel type: `vsmuxSearchViewer`

Pattern references preserved:

- `^VSmuxSearch\..+$`
- `^onView:VSmuxSearch\.conversations$`
- `^vsmux-search-export-.+\.md$`

Package/runtime identity:

- package: `vsmux-search-vscode`
- publisher: `vsmux-search`
- version: `1.1.0`
- activity bar container: `vsmux-search`

Filtering/export behavior:

- recent-only cutoff is 7 days
- cutoff applies only when `!this._showAllTime && !this._filterText`
- filter debounce `150ms`
- live browser tab filtering ignores VSmux Search labels
- export filename format: `vsmux-search-export-${sessionId}.md`
- unknown tools export by default when no option-key mapping exists

### Relationship to workspace

`chat_history` depends on terminal launch/resume infrastructure from `terminal_workspace` rather than building its own runtime stack.

---

## 11) Git text generation subsystem

Primary drill-downs:

- `architecture/git_text_generation/_index.md`
- `architecture/git_text_generation/low_effort_provider_settings.md`
- `facts/project/git_text_generation_low_effort_provider_facts.md`

### Purpose and execution flow

Used for:

- commit messages
- PR content
- session titles

Key files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

Execution flow:

1. build prompt
2. append output instructions
3. build provider shell command
4. run shell command
5. read output from temp file or stdout
6. parse and sanitize
7. return text

Dependencies/helpers:

- `runShellCommand` from `./process`
- `mkdtemp`, `readFile`, `rm`
- shell quoting from `../agent-shell-integration-utils`
- `GENERATED_SESSION_TITLE_MAX_LENGTH` from native terminal workspace title generation

### Config and provider defaults

Config keys:

- `VSmux.gitTextGenerationProvider`
- `VSmux.gitTextGenerationCustomCommand`

Supported providers:

- `codex | claude | custom`

Default provider:

- `codex`

Built-in low-effort providers:

- Codex:
  - `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
- Claude:
  - `exec claude --model haiku --effort low -p ...`

Timeout:

- `180000ms`

Placeholder rules:

- custom commands support `{outputFile}` and `{prompt}`
- if `{prompt}` is absent, quoted prompt is appended automatically

### Parsing and prompt constraints

Recognition/sanitization patterns include:

- conventional commit subject:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch path extraction:
  - `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  - `^[a-z0-9._-]+$`

Behavior:

- empty outputs are fatal
- non-zero exits get provider-specific wrapped errors
- session titles clamp to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tests keep title output under 25 chars

### Relationship to terminal workspace

`git_text_generation` is the general subsystem; `terminal_workspace/session_rename_title_auto_summarization.md` applies it with stricter title-specific rules and higher-effort provider settings.

---

## 12) Packaging, extension identity, and build composition

Primary drill-downs:

- `architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md`
- `architecture/terminal_workspace/vsmux_ai_devtools_integration.md`
- `facts/project/vsmux_packaging_and_embed_validation_facts.md`
- `facts/project/vsmux_ai_devtools_integration_facts.md`

### Main extension identity

Preserved facts:

- display name: `VSmux - T3code & Agent CLIs Manager`
- publisher: `maddada`
- main: `./out/extension/extension.js`
- repo: `https://github.com/maddada/VSmux.git`
- icon: `media/VSmux-marketplace-icon.png`
- version: `2.6.0`
- VS Code engine: `^1.100.0`
- package manager: `pnpm@10.14.0`

View containers / activation surface:

- `VSmuxSessions`
- `VSmux.sessions`
- `VSmuxSessionsSecondary`
- activation events include:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`

### Build composition

Root build includes:

- sidebar
- debug-panel
- workspace
- `chat-history:webview:build`
- TypeScript compile
- vendoring/runtime packaging

Additional build/package facts:

- `chat-history/dist` is dedicated output
- extension TypeScript compile includes `extension`, `shared`, and `chat-history/src/extension`
- TypeScript target is `ES2024`
- chat-history webview targets `es2020` with `iife`
- `restty@0.1.35` is patched via `patches/restty@0.1.35.patch`
- pnpm overrides `vite` and `vitest` to `@voidzero-dev` packages

### AI DevTools integration

- VSmux remains the only shipped extension host
- copied chat-history extension code is activated inside VSmux
- `aiDevtools.conversations` is registered under `VSmuxSessions`, below `VSmux.sessions`
- `ai-devtools.suspend` disposes panel, clears cache, and records suspended state to free memory

### VSIX / T3 embed validation

Packaging flow references:

- `pnpm run compile`
- `scripts/vsix.mjs`

Validation includes checking installed T3 asset hash under:

- `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js`

---

## 13) Current-state emphasis from `terminal-workspace-current-state.md`

This entry mostly confirms and sharpens the architecture/facts summaries.

### Strongly emphasized current truths

- `restty` is the active renderer
- warm terminal switching is required both within and across groups
- terminals from all groups are projected so group switching does not cold-create panes
- inactive panes stay mounted behind the active pane
- hidden-pane size churn must be avoided
- focus should route through `WorkspaceApp`
- closing then reusing a `sessionId` must never resurrect stale frontend transcript state
- sidebar-listed sessions should stay alive while VS Code is running, even if sidebar/workarea closes
- if daemon PTY is live, reopen should reattach, not resume
- if daemon is not live, sidebar should still show persisted agent/title state
- sidebar clicking should not mutate order without real drag movement

### Additional implementation nuance

- visible maintenance is shared for startup and observer-driven upkeep
- runtime cache stores `bootstrapVisualsComplete`
- startup-black seeding/reveal checks run only until that flag becomes `false`->complete
- after bootstrap, maintenance continues with scroll-host binding, scroll visibility updates, and optional size updates
- hidden panes skip redraw work after PTY connect

---

## 14) Cross-entry relationships

### `chat_history` ↔ `terminal_workspace`

- conversation resume uses workspace terminal launch/resume infrastructure
- both use webview/extension-host message contracts
- both use `retainContextWhenHidden: false`
- chat-history code is also packaged into the main VSmux extension (`vsmux_ai_devtools_integration.md`)

### `git_text_generation` ↔ `terminal_workspace`

- session rename auto-summarization depends on git text-generation execution/parsing
- git uses low-effort provider defaults
- rename summarization uses stricter title constraints and higher-effort settings

### `architecture` ↔ `facts`

- `architecture/_index.md` explains subsystem structure, rationale, and relationships
- `facts/_index.md` distills constants, support matrices, persisted keys, regexes, command signatures, and endpoint values
- `terminal-workspace-current-state.md` acts as a direct operational snapshot of what is currently implemented and why

---

## Best drill-down paths

### For terminal runtime / restore / daemon behavior

- `architecture/terminal_workspace/current_state.md`
- `architecture/terminal_workspace/terminal_persistence_across_reloads.md`
- `architecture/terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `facts/project/terminal_workspace_runtime_facts.md`
- `facts/project/terminal_persistence_across_vs_code_reloads_facts.md`

### For focus / pane order / drag safety

- `architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
- `architecture/terminal_workspace/workspace_focus_debugging.md`
- `facts/project/workspace_focus_and_drag_runtime_facts.md`
- `terminal-workspace-current-state.md`

### For titles / rename / session actions

- `architecture/terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `architecture/terminal_workspace/session_rename_title_auto_summarization.md`
- `facts/project/terminal_title_normalization_facts.md`
- `facts/project/sidebar_fork_session_behavior_facts.md`
- `facts/project/default_agent_commands_override_facts.md`

### For chat viewer / search / resume / VSmux Search

- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `architecture/chat_history/vsmux_search_rename.md`
- `facts/project/viewer_search_and_resume_actions_facts.md`
- `facts/project/vsmux_search_rename_facts.md`

### For T3 / browser / bridge integrations

- `architecture/terminal_workspace/workspace_browser_t3_integration.md`
- `architecture/terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md`
- `architecture/terminal_workspace/agent_manager_x_bridge_integration.md`
- `facts/project/workspace_browser_t3_integration_facts.md`
- `facts/project/agent_manager_x_bridge_integration_facts.md`

## Overall compressed takeaway

This knowledge set describes VSmux as a per-workspace, state-authoritative terminal orchestration system built around `restty`, detached daemon-backed PTYs, bootstrap-first webview restore, and warm runtime reuse keyed by `sessionId`. `terminal_workspace` is the central subsystem; `chat_history` reuses its resume/launch infrastructure for conversation viewing and VSmux Search; `git_text_generation` supplies shell-command-driven text generation, especially for session rename summarization. The most stable implementation themes are explicit state normalization, strong controller ownership, per-workspace daemon/runtime boundaries, hidden-pane preservation over teardown, and exact message/command contracts.
