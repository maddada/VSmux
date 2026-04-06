---
children_hash: 5fb78d2fcc5e833dc82e676294066e2f3ffa6a3a9ff3b2640130c770eec5046c
compression_ratio: 0.7145098985997103
condensation_order: 2
covers:
  [chat_history/_index.md, context.md, git_text_generation/_index.md, terminal_workspace/_index.md]
covers_token_total: 8284
summary_level: d2
token_count: 5919
type: summary
---

# architecture

## Domain scope

This domain captures the VSmux architecture across three connected areas:

- `terminal_workspace` — the primary runtime, state, persistence, focus, sidebar, T3, and integration architecture
- `chat_history` — conversation viewer/search/resume behavior and the VSmux Search rename
- `git_text_generation` — provider-driven commit/PR/session-title text generation used by git flows and session rename summarization

Core domain purpose from `context.md`:

- focus on terminal workspace rendering, pane lifecycle, runtime caching, workspace projection/message handling, pane ordering, backend daemon behavior, leases, and persisted session state
- excludes unrelated editor features and generic terminal usage

## Topic map

- `terminal_workspace/_index.md` is the architectural center of the domain and defines the main controller/webview/daemon/session-state model
- `chat_history/_index.md` describes the separate chat-history webview stack, resume contract, export behavior, and rename to VSmux Search
- `git_text_generation/_index.md` documents shell-command-based text generation for commit messages, PR content, and session titles

## Shared architectural patterns

Across the domain, several patterns repeat:

- **Controller/state authority over UI-local state**
  - `WorkspaceApp` owns focus decisions in `terminal_workspace`
  - normalized workspace/group/session snapshots are the source of truth
  - viewer and sidebar UIs derive from validated metadata rather than owning durable state

- **Webview + extension-host split**
  - `chat_history` splits webview UI (`chat-history/src/webview/...`) from host-side command handling (`chat-history/src/extension/extension.ts`)
  - `terminal_workspace` splits workspace rendering/webview behavior from extension-host controller orchestration and detached daemon-backed PTYs
  - `git_text_generation` splits prompt assembly/execution (`extension/git/text-generation.ts`) from command/parsing helpers (`extension/git/text-generation-utils.ts`)

- **Retain-simple lifecycle over hidden-state persistence**
  - both the chat-history viewer and workspace/chat-history webviews use `retainContextWhenHidden: false`
  - runtime reuse is done explicitly where needed, rather than relying on hidden webview persistence

- **Per-workspace scoping**
  - used for workspace snapshots, daemon ownership, sidebar sort preferences, and bridge integration state

---

# terminal_workspace

## Structural role

`terminal_workspace/_index.md` is the primary architectural summary for the product. It covers:

- terminal runtime/rendering via Restty
- grouped session workspace state
- focus and drag semantics
- session persistence across reloads
- startup/bootstrap strategy
- title/activity/attention behavior
- session rename summarization
- agent command overrides and fork/resume behavior
- browser/T3 integration
- Agent Manager X bridge integration
- packaging and runtime validation

## Core runtime model

Drill down:

- `current_state.md`
- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `workspace_sidebar_interaction_state.md`

Key facts:

- renderer is **Restty**
- runtime cache is keyed by **`sessionId`**
- cached runtimes survive mount/visibility changes and are invalidated by `renderNonce`
- hidden panes remain mounted/painted behind the active pane instead of being torn down
- PTY attach waits for:
  1. appearance application
  2. stable size resolution
  3. transport readiness / PTY attach

Notable thresholds:

- stable sizing: up to **20 attempts**, success after **2 identical measurements**
- typing autoscroll: **450ms** burst, **4** printable keys
- scroll hysteresis: show above **200px**, hide below **40px**
- lag probes: **50ms** sampling, **5000ms** probe window, **10000ms** monitor window
- lag warning/trigger: **250ms** warn, **1000ms** lag

Keyboard mappings are explicit and preserved, including:

- `Shift+Enter -> \x1b[13;2u`
- macOS `Meta+ArrowLeft -> \x01`
- macOS `Meta+ArrowRight -> \x05`
- word navigation `\x1bb` / `\x1bf`

## Focus, ordering, and drag semantics

Drill down:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `workspace_sidebar_interaction_state.md`

Important decisions:

- `WorkspaceApp` is the authoritative focus owner
- `TerminalPane` only emits activation intent
- pane order comes from `activeGroup.snapshot.visibleSessionIds`, not a filtered global list
- `localPaneOrder` is only a temporary override inside current visible sessions
- this preserves stable split positions when active sessions change

Focus/drag thresholds:

- `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400ms`
- meaningful sidebar drag movement: **8px**
- startup interaction block: **1500ms**
- non-touch drag distance: **6px**
- touch drag activation: **250ms** with **5px** tolerance
- hold-to-drag: **130ms** with **12px** tolerance

Related message/API surface includes:

- `syncPaneOrder`
- `syncSessionOrder`
- `moveSessionToGroup`
- `focusSession`

## Grouped workspace state

Drill down:

- `simple_grouped_session_workspace_state.md`

Canonical state lives in:

- `shared/simple-grouped-session-workspace-state.ts`

Normalization rules include:

- at least one group always exists
- browser sessions are dropped from this model
- duplicate display IDs are repaired
- session IDs are canonicalized from display IDs as `session-${formatSessionDisplayId(displayId ?? 0)}`

Behavioral decisions:

- active-group fallback prefers nearest previous non-empty group before later groups
- `visibleSessionIds` are remembered/restored per group
- new sessions take the first free display ID, append to active group, gain focus, and recompute visibility
- snapshot equality uses `JSON.stringify(left) === JSON.stringify(right)`

Mutation surface covers focus/remove/reorder/move/create-group/fullscreen restore/T3 metadata updates.

## Sleep/wake support

Drill down:

- `workspace_session_sleep_wake_support.md`

Key facts:

- session records persist `isSleeping`
- sleeping sessions are excluded from awake focus and visible split calculations
- focusing a sleeping session wakes it
- group sleep/wake toggles whole groups
- sleeping terminal sessions dispose live runtime/surface but preserve session card and resume metadata

## Persistence and reload recovery

Drill down:

- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

Persistence architecture has 3 parts:

1. `SessionGridStore`
2. detached per-workspace daemon for PTYs
3. restored webview using cached Restty runtimes

Key persisted key:

- `VSmux.sessionGridSnapshot`

Important daemon/reconnect facts:

- daemon is per-workspace, not tied to extension-host lifetime
- reattach flow: restore snapshot -> reconnect daemon -> wait for `terminalReady` -> replay ring buffer -> flush pending attach queue -> switch live
- control connect timeout: **3000ms**
- daemon ready timeout: **10000ms**
- stale launch lock: **30000ms**
- owner heartbeat: **5000ms**
- owner heartbeat timeout: **20000ms**
- startup grace: **30000ms**
- session attach ready timeout: **15000ms**
- replay cap: **8 MiB**
- replay chunk size: **128 KiB**

Lifecycle helpers:

- `releaseCachedTerminalRuntime()` detaches DOM but preserves runtime
- `destroyCachedTerminalRuntime()` performs full cleanup

## Startup, bootstrap, and panel identity

Drill down:

- `workspace_panel_startup_without_placeholder.md`
- `workspace_panel_startup_without_loading_placeholder.md`
- `workspace_panel_focus_hotkeys.md`

Startup was redesigned around bootstrap-first restore:

- `openWorkspace` reveals sidebar first
- creates or refreshes session state before panel reveal
- embeds latest renderable state in HTML via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`

Replay order:

1. latest renderable state (`hydrate` or `sessionState`)
2. latest transient message if distinct

Other preserved rules:

- one-shot `autoFocusRequest` is stripped before buffering
- duplicate stable state messages are ignored unless autofocus request id changes
- workspace panel uses `retainContextWhenHidden: false`

Standardized panel identity:

- type: `vsmux.workspace`
- title: `VSmux`
- icon: `media/icon.svg`

Hotkey context key:

- `vsmux.workspacePanelFocus`

## Titles, activity, attention, and sounds

Drill down:

- `title_activity_and_sidebar_runtime.md`
- `terminal_titles_activity_and_completion_sounds.md`
- `terminal_title_normalization_and_session_actions.md`
- `sidebar_session_card_last_interaction_timestamps.md`

Terminal titles are first-class state. Central normalization uses:

- `normalizeTerminalTitle()`

Rules include:

- strip leading status/progress glyphs
- hide titles beginning with `~` or `/`
- generated titles like `^Session \d+$` are not visible primary titles

Behavioral split:

- normalized visible titles drive session-facing UI/actions
- raw `liveTitle` stays in controller memory for activity detection

Agent activity markers:

- Claude working: `⠐ ⠂ ·`; idle: `✳ *`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini: `✦` working, `◇` idle
- Copilot: `🤖` working, `🔔` idle/attention

Attention/sound rules:

- a session must have worked for at least **3000ms** before attention shows
- completion sounds delayed **1000ms**
- audio uses unlocked `AudioContext` paths because of VS Code webview constraints

Sidebar last-interaction bands:

- 0–15 min bright green
- 15–30 min faded green
- 30–60 min muted green
- > 1 hr gray

## Session rename summarization

Drill down:

- `session_rename_title_auto_summarization.md`

This feature depends on `git_text_generation`.

Rules:

- summarize only when `title.trim().length > 25`
- generated max title length: **24**
- prefer **2–4 words**
- no quotes, markdown, commentary, or ending punctuation

Output cleanup:

- first non-empty line
- strip fenced output
- remove wrapping quotes
- collapse whitespace
- strip trailing periods
- clamp with whole-word preference

Provider settings here differ from git low-effort defaults:

- timeout: **180000ms**
- Codex: `gpt-5.4-mini` with high reasoning effort
- Claude: `haiku` with high effort

## Agent command resolution and session actions

Drill down:

- `default_agent_commands_overrides.md`
- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `terminal_title_normalization_and_session_actions.md`

Configuration:

- `VSmux.defaultAgentCommands` supports overrides for `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`

Decision rules:

- override values are trimmed; empty becomes `null`
- configured overrides are used only when no stored default-agent preference exists
- legacy stock commands upgrade to configured aliases during resume/fork
- explicit non-default stored commands remain authoritative
- string-only legacy launch values normalize to `{ agentId: "codex", command }`

Supported launch-resolution built-ins:

- `codex`, `claude`, `copilot`, `gemini`, `opencode`
- not `t3`

Capability matrix:

- copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- fork: `codex`, `claude`
- full reload: `codex`, `claude`
- browser sessions cannot rename/fork/copy-resume/full-reload

Fork/resume command signatures:

- Codex fork: `<command> fork '<title>'`
- Claude fork: `<command> --fork-session -r '<title>'`
- Codex resume: `<command> resume '<title>'`
- Claude resume: `<command> -r '<title>'`

Fork creation behavior:

- sibling session inserted after source in same group
- reuses icon and stored launch metadata
- attaches backend and writes fork command
- delayed rename after **4000ms**

## Sidebar rendering and sort behavior

Drill down:

- `sidebar_browsers_empty_state.md`
- `sidebar_active_sessions_sort_mode.md`
- `sidebar_active_sessions_sort_mode_persistence.md`
- `workspace_debug_console_suppression.md`

Key behaviors:

- empty browser groups no longer render `.group-sessions`
- non-browser groups still show `No sessions`

Sort modes:

- `manual`
- `lastActivity`

Persistence key:

- `VSmux.sidebarActiveSessionsSortMode` in workspaceState

`lastActivity` mode rules:

- sessions sorted by descending `lastInteractionAt`
- groups sorted by most recent session activity
- invalid/missing timestamps treated as `0`
- manual order remains tie-breaker and stored source of truth
- dragging disabled while active

Other UI/runtime choice:

- sidebar debug console echo suppressed; helper is effectively no-op while message flow remains available in Storybook harness

## Browser, T3, packaging, and validation

Drill down:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`

Browser integration:

- excludes internal VSmux/T3-owned tabs by `viewType` and localhost URL filtering
- local `/workspace` and `/t3-embed` URLs are filtered
- browser sidebar group id: `browser-tabs`

T3 integration facts:

- activity comes from `T3ActivityMonitor`
- websocket URL: `ws://127.0.0.1:3774/ws`
- snapshot RPC: `orchestration.getSnapshot`
- subscription RPC: `subscribeOrchestrationDomainEvents`
- request timeout: **15000ms**
- reconnect delay: **1500ms**
- refresh debounce: **100ms**

Managed runtime upgrade model:

- managed runtime: `127.0.0.1:3774`
- legacy runtime: `127.0.0.1:3773`
- server entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- protocol requires `/ws`, numeric-string request IDs `^\d+$`, Ping/Pong, and Chunk/Ack/Exit streaming semantics

Packaging/validation:

- build with `pnpm run compile`
- package/install with `scripts/vsix.mjs`
- verify installed T3 asset hash under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js`

## Agent Manager X bridge

Drill down:

- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`

Bridge facts:

- file: `extension/agent-manager-x-bridge.ts`
- endpoint: `ws://127.0.0.1:47652/vsmux`

Controller relationship:

- `NativeTerminalWorkspaceController` owns a single `AgentManagerXBridgeClient`
- publishes initial and changed workspace snapshots
- routes broker `focusSession` requests into workspace focus behavior

Snapshot payload includes workspace metadata plus per-session:

- agent
- alias
- displayName
- `isFocused`
- `isRunning`
- `isVisible`
- `kind`
- `status`
- optional `terminalTitle`
- optional `threadId`

Rules:

- send only when a latest snapshot exists, socket is `WebSocket.OPEN`, and serialized payload changed
- reconnect backoff starts at **1000ms** and caps at **5000ms**
- snapshots are memory-only
- `focusSession` accepted only when payload is valid and `workspaceId` matches `latestSnapshot.workspaceId`
- focus path was refined so Agent Manager X no longer forces sidebar container rehydration

## Font source defaults

Drill down:

- `restty_terminal_font_probing_defaults.md`

Key decision in `workspace/restty-terminal-config.ts`:

- bundled default stack is `MesloLGL Nerd Font Mono`, `Menlo`, `Monaco`, `Courier New`
- when unset or matching bundled defaults, Restty uses only bundled Meslo URL fallback and skips optional local probing
- custom non-generic families still prepend optional local source
- generic families like `monospace` and `serif` are filtered out

## AI DevTools / chat-history integration

Drill down:

- `vsmux_ai_devtools_integration.md`

Relationship to `chat_history`:

- VSmux remains the only shipped extension host
- copied chat-history extension code is activated inside VSmux
- `aiDevtools.conversations` is registered under `VSmuxSessions`, below `VSmux.sessions`

Build/package facts:

- dedicated output: `chat-history/dist`
- package includes chat-history dist and media assets
- build pipeline includes sidebar, debug-panel, workspace, `chat-history:webview:build`, TypeScript compile, and vendoring
- `ai-devtools.suspend` disposes panel, clears cache, and enters suspended state

---

# chat_history

## Structural role

`chat_history/_index.md` covers the conversation viewer architecture plus branding/packaging under VSmux Search.

Children:

- `viewer_search_and_resume_actions.md`
- `vsmux_search_rename.md`

## Viewer/search/resume architecture

Implementation split:

- `chat-history/src/webview/App.tsx`
- `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- `chat-history/src/extension/extension.ts`

Flow:

1. load conversation JSONL
2. parse entries and derive `source`, `sessionId`, optional `cwd`
3. enable search and resume when metadata is valid
4. webview posts messages such as `ready`, `refreshConversation`, `resumeSession`
5. extension validates payload and opens terminal
6. provider-specific resume command runs

Search model from `viewer_search_and_resume_actions.md`:

- uses browser-native `window.find`
- Cmd/Ctrl+F opens custom find bar
- Enter = next, Shift+Enter = previous, Escape = close
- wraps around
- resets selection/scroll on query change
- has explicit status for empty input and failed matches

Architectural choice:

- lightweight DOM-driven search instead of custom indexed search state

Resume contract:

- `resumeSession` carries `source`, `sessionId`, optional `cwd`
- resume only available when `sessionId` is parsed and source inferred from file path

Source inference:

- `/.codex/`, `/.codex-profiles/` -> `Codex`
- `/.claude/`, `/.claude-profiles/` -> `Claude`

Terminal execution behavior:

- Claude: `claude --resume <sessionId>`
- Codex: `codex resume <sessionId>`
- IDs are shell-quoted with `quoteShellLiteral`
- terminal opens in conversation `cwd` when available
- terminal label: `AI DevTools Resume (<source>)`

Other preserved choices:

- panel uses `retainContextWhenHidden: false`
- JSONL parse failures normalize to `x-error` records

## VSmux Search rename

Drill down:

- `vsmux_search_rename.md`

Renamed identifiers:

- command namespace: `VSmuxSearch.*`
- view id: `VSmuxSearch.conversations`
- view label: `VSmux Search`
- viewer panel type: `vsmuxSearchViewer`

Pattern references preserved:

- `^VSmuxSearch\..+$`
- `^onView:VSmuxSearch\.conversations$`
- `^vsmux-search-export-.+\.md$`

Packaging facts:

- package name: `vsmux-search-vscode`
- display name: `VSmux Search`
- publisher: `vsmux-search`
- version: `1.1.0`
- activity bar container id: `vsmux-search`
- activation event: `onView:VSmuxSearch.conversations`

Sidebar/runtime behavior:

- scans and loads conversation folders
- supports refresh/reload
- supports current-vs-all scope
- supports recent-only vs all-time filtering
- opens viewer and optional resume
- supports markdown export

Important filter behavior:

- recent-only cutoff is 7 days via `Date.now() - 7 * 24 * 60 * 60 * 1000`
- cutoff only applies when `!this._showAllTime && !this._filterText`
- live browser tab filtering ignores VSmux Search labels

Export behavior:

- filename format: `vsmux-search-export-${sessionId}.md`
- branded with VSMUX-SEARCH tags
- metadata and message categories preserved
- Chrome MCP tools mapped into grouped option keys
- unknown tools included by default if no option key matches

## Relationship to terminal workspace

`chat_history` depends on workspace/runtime capabilities documented in:

- `architecture/terminal_workspace/current_state`
- `architecture/terminal_workspace/workspace_browser_t3_integration`

Most importantly, chat resume reuses terminal launch infrastructure rather than implementing a separate runtime stack.

---

# git_text_generation

## Structural role

`git_text_generation/_index.md` documents provider-specific shell command construction and parsing for generated text used in:

- commit messages
- PR content
- session titles

Primary drill-down:

- `low_effort_provider_settings.md`

Key files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

## Execution flow

From `low_effort_provider_settings.md`:

1. build prompt
2. append output instructions
3. build provider shell command
4. run shell command
5. read output from temp file or stdout
6. parse and sanitize
7. return commit/PR/title text

Custom command behavior:

- supports `{outputFile}` and `{prompt}` placeholders
- if `{prompt}` is absent, the quoted prompt is appended automatically

Dependencies:

- `runShellCommand` from `./process`
- temp FS helpers: `mkdtemp`, `readFile`, `rm`
- shell quoting from `../agent-shell-integration-utils`
- `GENERATED_SESSION_TITLE_MAX_LENGTH` from native terminal workspace title generation

Config keys:

- `VSmux.gitTextGenerationProvider`
- `VSmux.gitTextGenerationCustomCommand`

## Built-in provider decisions

Built-in providers are pinned to low-effort defaults as of `2026-04-06`.

Default provider:

- `VSmux.gitTextGenerationProvider = codex`

Built-ins:

- Codex:
  - `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
  - model `gpt-5.4-mini`
  - stdin prompt transport via trailing `exec -`
- Claude:
  - `exec claude --model haiku --effort low -p ...`
  - model `haiku`
  - CLI prompt transport via `-p`

Timeout:

- **180000 ms**

Package metadata was updated to describe these as low-effort built-ins.
User-customized numeric session rename generation limits are preserved.

## Parsing, rules, and patterns

Error behavior:

- empty outputs are fatal for commit messages, PR content, and session titles
- non-zero exits are wrapped with provider-specific error text from `describeGitTextGenerationSettings`
- session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tests keep title output under 25 characters

Recognition/sanitization patterns:

- conventional commit subject:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch path extraction:
  - `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  - `^[a-z0-9._-]+$`

Prompt constraints:

- commit messages: conventional type required, lowercase/specific scope, imperative summary `<= 40` chars, `3 to 8` bullet points when meaningful, no fences/commentary
- PR content: concise title, markdown body, short `Summary` and `Testing`, no fences/commentary
- session titles: `2 to 4` words, specific/scannable, no quotes/markdown/commentary/trailing punctuation, must remain below tested 25-char behavior and under `GENERATED_SESSION_TITLE_MAX_LENGTH + 1`

## Relationship to terminal workspace

`git_text_generation` directly feeds:

- `terminal_workspace/session_rename_title_auto_summarization`

The topic-level relationship is:

- `git_text_generation` defines the general command/execution/parsing subsystem
- `session_rename_title_auto_summarization.md` applies that subsystem with stricter title-specific rules and different effort settings

---

# Cross-topic relationships

## chat_history ↔ terminal_workspace

- chat resume relies on terminal launch/resume capabilities from the workspace system
- both use webview/extension-host message contracts
- both prefer `retainContextWhenHidden: false`
- chat-history code is also packaged/integrated into the main VSmux extension, as detailed in `vsmux_ai_devtools_integration.md`

## git_text_generation ↔ terminal_workspace

- session rename auto-summarization in `terminal_workspace` is built on the git text generation subsystem
- low-effort provider defaults for git generation coexist with high-effort title summarization settings for rename flows

## domain-level architectural throughline

The domain consistently favors:

- normalized state snapshots over ad hoc UI state
- explicit command/message contracts
- per-workspace ownership for runtime/persistence concerns
- narrow, validated integrations between subsystems
- targeted runtime reuse and bootstrap restoration instead of hidden-context persistence
