---
title: Title Activity And Sidebar Runtime
tags: []
related:
  [
    architecture/terminal_workspace/context.md,
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/terminal_titles_activity_and_completion_sounds.md,
    facts/project/terminal_workspace_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:39:05.166Z"
updatedAt: "2026-04-06T01:39:05.166Z"
---

## Raw Concept

**Task:**
Curate current terminal workspace behavior for terminal titles, title-derived activity, completion sounds, and sidebar messaging.

**Changes:**

- Terminal titles are treated as first-class presentation state from daemon session updates.
- Visible title selection prioritizes manual title over terminal title over alias.
- CLI agent activity is derived from terminal titles with stale-spinner protection for Claude and Codex.
- Attention state is gated by a 3 second prior working phase before surfacing.
- Completion sounds are delayed by 1 second and delivered through embedded webview audio data URLs.
- Sidebar messaging serializes most messages but bypasses queueing for selected git and settings actions.

**Files:**

- extension/session-title-activity.ts
- shared/session-grid-contract-session.ts
- extension/native-terminal-workspace/activity.ts
- extension/native-terminal-workspace/controller.ts
- extension/session-sidebar-view.ts
- media/sounds
- out/sidebar/sidebar.js
- out/sidebar/sidebar.css

**Flow:**
daemon title update -> session snapshot/presentation update -> title-derived activity resolution -> effective attention gating -> sidebar patch update -> delayed completion sound playback

**Timestamp:** 2026-04-06

**Patterns:**

- `^Session \d+$` - Generated session titles are not treated as visible primary titles
- `^(~|/)` - Path-like terminal titles are hidden from visible terminal title selection
- `^[\s\u2800-\u28ff·•⋅◦]+` - Leading spinner, braille, and punctuation are stripped from terminal titles
- `^session-(\d+)$` - Session identifiers encode a positive numeric suffix
- `^\d{2}$` - Two-digit display IDs are preserved when already normalized

## Narrative

### Structure

Terminal title parsing lives in extension/session-title-activity.ts and identifies Claude, Codex, Gemini, and GitHub Copilot states from title keywords and marker glyphs. Session display title helpers live in shared/session-grid-contract-session.ts, where visible terminal titles are sanitized and preferred over generated session names. Effective activity gating and completion-sound state tracking live in extension/native-terminal-workspace/activity.ts and the controller keeps terminalTitleBySessionId, lastKnownActivityBySessionId, workingStartedAtBySessionId, pendingCompletionSoundTimeoutBySessionId, and sidebar presentation caches.

### Dependencies

Title presentation depends on daemon-driven session presentation updates and the controller listens to backend onDidChangeSessionPresentation events. Completion sound delivery depends on media/sounds assets, webview HTML bootstrapping in session-sidebar-view.ts, and an unlocked AudioContext path because delayed HTMLAudio playback is blocked by VS Code webview gesture rules. T3 activity depends on a websocket endpoint with default URL ws://127.0.0.1:3774/ws.

### Highlights

Claude and Codex only count as working after observed title transitions and stop counting as working if spinner glyphs stop changing for 3 seconds, while Gemini and Copilot do not use that stale-spinner guard. Attention cannot surface unless the session previously remained in working for at least 3 seconds, which prevents false-positive green completion states. Sidebar hydrate and sessionState messages are cached by revision, most inbound messages are serialized through a message queue, and completion sounds are embedded as base64 data URLs to avoid unreliable fetch-based decoding.

### Rules

Visible session title resolution

1. Use manual user title if present and visible.
2. Otherwise use terminal title if visible.
3. Otherwise use alias.

Title-derived activity resolution

1. Parse title into agent/state via getTitleState.
2. If no title state:
   - if no prior working seen, return undefined
   - otherwise fallback to attention or idle if acknowledged
3. If title state is idle:
   - return attention only if prior working was seen and not acknowledged
   - otherwise idle
4. If title state is working:
   - Claude/Codex require observed transitions / lastTitleChangeAt
   - Gemini/Copilot can use current time immediately
5. If working window expires:
   - return attention unless already acknowledged, then idle

Effective attention gating

1. On working, store workingStartedAt
2. On attention:
   - if no prior working start or working lasted under 3 seconds, downgrade to idle
   - otherwise allow attention
3. On non-working/non-attention, clear working start

Completion sound triggering

1. Sync effective activities for all sessions.
2. If a session newly enters attention, queue completion sound.
3. If it is not in attention, cancel pending completion sound.
4. Additional confirmation delay: 1_000ms.

### Examples

Examples of preserved markers and accepted values: Claude idle markers ✳ and \*; Claude working markers ⠐, ⠂, ·; Codex working markers ⠸, ⠴, ⠼, ⠧, ⠦, ⠏, ⠋, ⠇, ⠙, ⠹; Gemini markers ✦ and ◇; Copilot markers 🤖 and 🔔. Sidebar message validation includes adjustTerminalFontSize delta -1 or 1, git actions commit/push/pr, setVisibleCount values 1/2/3/4/6/9, setViewMode values horizontal/vertical/grid, and moveSessionToGroup targetIndex undefined or an integer >= 0.

## Facts

- **terminal_title_source**: Terminal sessions use live terminal titles from the daemon as first-class presentation state. [project]
- **visible_session_title_precedence**: Visible session title precedence is manual user title, then terminal title, then alias. [convention]
- **cli_activity_source**: Title-driven activity detection is the runtime source for CLI agents. [project]
- **presentation_update_strategy**: Title and activity updates use targeted presentation patch messages instead of full sidebar or workspace rehydrates. [project]
- **attention_gating_threshold**: A session must stay working for at least 3 seconds before a later attention state is allowed to surface. [convention]
- **completion_sound_delay**: Completion sounds are confirmation-delayed by 1 second after attention appears. [project]
- **sidebar_audio_delivery**: Sidebar completion sounds are embedded into webview HTML as data URLs and decoded through AudioContext without fetch. [project]
- **claude_working_markers**: Claude working title markers are ⠐, ⠂, and ·. [project]
- **claude_idle_markers**: Claude idle markers are ✳ and \*. [project]
- **codex_working_markers**: Codex working title markers are ⠸, ⠴, ⠼, ⠧, ⠦, ⠏, ⠋, ⠇, ⠙, and ⠹. [project]
- **gemini_title_markers**: Gemini uses ✦ as a working marker and ◇ as an idle marker. [project]
- **copilot_title_markers**: GitHub Copilot uses 🤖 as a working marker and 🔔 as an attention marker. [project]
- **stale_spinner_guard**: Claude and Codex require observed title transitions before spinner glyphs count as working. [convention]
- **stale_spinner_guard_exceptions**: Gemini and Copilot do not use the stale-spinner guard. [convention]
- **extension_id**: The extension ID is maddada.VSmux. [project]
- **full_reload_scope**: Full reload is only available for Codex and Claude sessions. [convention]
- **default_t3_activity_websocket_url**: The default T3 activity websocket URL is ws://127.0.0.1:3774/ws. [environment]
- **sidebar_visible_counts**: Sidebar setVisibleCount accepts only 1, 2, 3, 4, 6, or 9. [convention]
- **sidebar_view_modes**: Sidebar setViewMode accepts only horizontal, vertical, or grid. [convention]
- **sidebar_git_actions**: Sidebar git actions accept only commit, push, or pr. [convention]
