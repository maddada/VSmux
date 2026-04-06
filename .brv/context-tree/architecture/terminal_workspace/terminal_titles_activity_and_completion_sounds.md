---
title: Terminal Titles Activity And Completion Sounds
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:37:10.725Z"
updatedAt: "2026-04-06T01:37:10.725Z"
---

## Raw Concept

**Task:**
Document terminal title handling, agent activity derivation, attention gating, session title helpers, sidebar validation details, and completion sound playback behavior

**Changes:**

- Terminal titles are persisted as first-class presentation state from daemon snapshots
- CLI agent activity is derived from title markers and title transitions
- Attention requires a prior sustained working phase of at least 3 seconds
- High-frequency title and activity changes use targeted patch messages rather than full rehydrates
- Completion sounds are embedded and played through unlocked AudioContext paths

**Files:**

- extension/session-title-activity.ts
- shared/session-grid-contract-session.ts
- extension/native-terminal-workspace/activity.ts
- extension/session-sidebar-view.ts
- extension/native-terminal-workspace/controller.ts

**Flow:**
terminal emits title -> daemon/backend snapshot carries title -> controller stores terminalTitleBySessionId and posts targeted presentation patch -> title helpers derive agent state from markers and transitions -> effective activity gate promotes attention only after sustained working -> sidebar queues delayed completion sound and plays embedded audio after unlock

**Timestamp:** 2026-04-06

## Narrative

### Structure

The behavior spans five main files. session-title-activity.ts classifies Claude, Codex, Gemini, and Copilot from terminal title text, spinner markers, and transition timing. session-grid-contract-session.ts defines visible title helpers, session alias/display rules, and default session workspace snapshots. native-terminal-workspace/activity.ts converts raw snapshot state into effective activity with a sustained-working requirement before attention is surfaced. session-sidebar-view.ts owns webview setup, CSP, embedded sound URLs, and strict sidebar message validation. controller.ts stores live terminal titles, reacts to backend presentation changes, and triggers targeted presentation updates plus completion sound synchronization.

### Dependencies

This behavior depends on daemon-provided presentation updates, terminal session snapshots, webview messaging, and browser audio restrictions inside VS Code webviews. Activity derivation also depends on prior title transition history for Claude and Codex so stale spinner glyphs do not falsely report active work.

### Highlights

Real terminal titles are preserved across UI surfaces so generated Session N labels do not hide meaningful runtime titles. Claude and Codex use a stricter activity model with observed transitions and a 3 second stale-spinner timeout, while Gemini and Copilot use simpler marker-based detection. Attention is only surfaced after at least 3 seconds of real working, and completion feedback is delayed by 1 second before audio is played. Sidebar sounds are shipped as embedded data URLs and decoded through AudioContext because fetch-based decoding and delayed HTMLAudio playback were unreliable in the webview environment.

### Rules

Visible session title precedence: manual user title first, otherwise terminal title, otherwise alias.
Claude and Codex require observed title transitions before a spinner counts as working, because stale spinner glyphs can linger in titles.
Claude and Codex stop counting as working if the glyph stops changing for 3 seconds.
Gemini and Copilot do not use the stale-spinner guard.
A session must stay working for at least 3 seconds before a later attention state is allowed to surface as green.
Completion sounds are confirmation-delayed by 1 second after attention appears.
Title and activity updates use targeted presentation patch messages instead of full sidebar/workspace rehydrates to avoid typing lag from high-frequency title changes such as spinners.
Full reload is only available for Codex and Claude sessions.

### Examples

Claude uses ⠐, ⠂, and · as working markers and ✳ or \* as idle markers. Codex uses the spinner set ⠸, ⠴, ⠼, ⠧, ⠦, ⠏, ⠋, ⠇, ⠙, and ⠹. Gemini uses ✦ for working and ◇ for idle, while GitHub Copilot uses 🤖 for working and 🔔 for idle or attention. Sidebar HTML embeds sounds in window.**VSMUX_SOUND_URLS** and enforces a CSP with default-src none, script nonces, and data: media sources.

## Facts

- **terminal_titles_first_class**: Terminal sessions use live terminal titles from the daemon as first-class presentation state. [project]
- **osc_title_snapshot_flow**: OSC title updates are parsed from terminal output and carried through session snapshots. [project]
- **visible_session_title_precedence**: Visible session title precedence is manual user title first, otherwise terminal title, otherwise alias. [convention]
- **cli_agent_activity_source**: Runtime source for CLI agent activity is title-driven detection. [project]
- **claude_working_markers**: Claude working markers are ⠐, ⠂, and ·. [project]
- **claude_idle_markers**: Claude idle markers are ✳ and \*. [project]
- **codex_working_markers**: Codex working markers are ⠸, ⠴, ⠼, ⠧, ⠦, ⠏, ⠋, ⠇, ⠙, and ⠹. [project]
- **gemini_title_markers**: Gemini uses ✦ for working and ◇ for idle. [project]
- **copilot_title_markers**: GitHub Copilot uses 🤖 for working and 🔔 for idle/attention. [project]
- **observed_title_transition_requirement**: Claude and Codex require observed title transitions before a spinner counts as working. [convention]
- **stale_spinner_timeout**: Claude and Codex stop counting as working if the glyph stops changing for 3 seconds. [convention]
- **stale_spinner_guard_exclusions**: Gemini and Copilot do not use the stale-spinner guard. [project]
- **presentation_update_strategy**: Title and activity updates use targeted presentation patch messages instead of full sidebar or workspace rehydrates. [project]
- **minimum_working_duration_before_attention**: A session must stay working for at least 3 seconds before a later attention state is allowed to surface as green. [convention]
- **completion_sound_delay**: Completion sounds are delayed by 1 second after attention appears. [project]
- **completion_sound_delivery**: Sidebar completion sounds are embedded into the webview HTML as data URLs and decoded through AudioContext without fetch. [project]
- **htmlaudio_webview_limitation**: Delayed HTMLAudio playback is blocked by VS Code webview gesture rules. [environment]
- **fetch_web_audio_limitation**: Fetch-based Web Audio decoding of webview sound URLs was unreliable. [environment]
- **sidebar_audio_unlock_behavior**: Sidebar audio is unlocked on first user interaction and then used for delayed sound playback. [project]
- **title_activity_window_ms**: TITLE_ACTIVITY_WINDOW_MS is 1000 for Gemini and Copilot. [project]
- **slow_spinner_activity_window_ms**: SLOW_SPINNER_ACTIVITY_WINDOW_MS is 3000 for Claude and Codex. [project]
- **min_working_duration_before_attention_ms**: MIN_WORKING_DURATION_BEFORE_ATTENTION_MS is 3000. [project]
- **completion_sound_confirmation_delay_ms**: COMPLETION_SOUND_CONFIRMATION_DELAY_MS is 1000. [project]
- **preferred_session_title_behavior**: getPreferredSessionTitle currently returns visible terminal title first and otherwise returns visible primary session title. [project]
- **visible_terminal_title_sanitization**: getVisibleTerminalTitle strips leading spinner, braille, and bullet characters and hides titles starting with ~ or /. [project]
- **rename_prompt_title_preference**: Rename session prompt prepopulation prefers visible terminal title over saved session title. [project]
- **full_reload_supported_agents**: Full reload is only available for Codex and Claude sessions. [project]
- **default_t3_activity_websocket_url**: The default T3 activity websocket URL is ws://127.0.0.1:3774/ws. [environment]
