---
title: Terminal Pane Runtime Thresholds And Behaviors
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_focus_debugging.md,
    facts/project/terminal_workspace_runtime_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:20:33.362Z"
updatedAt: "2026-04-06T02:20:33.362Z"
---

## Raw Concept

**Task:**
Document terminal pane runtime thresholds, visibility behavior, appearance application, connection readiness, lag detection, search lifecycle, and key mappings

**Changes:**

- Captured terminal auto-scroll and scroll-to-bottom thresholds
- Captured lag detection monitor windows and overshoot thresholds
- Documented hidden pane freeze behavior and connection readiness sequence
- Documented search lifecycle and keyboard input mappings

**Files:**

- workspace/terminal-pane.tsx

**Flow:**
terminal root receives pointer/focusin -> WorkspaceApp activation path runs; appearance applies font/theme in phases -> stable terminal size is measured -> transport marks terminal ready -> PTY connects; scheduler probe samples overshoot -> lag callback fires when thresholds are met; search opens -> query updates activePane -> close clears search and refocuses terminal

**Timestamp:** 2026-04-06

**Patterns:**

- `/Mac|iPhone|iPad|iPod/` - Platform detection regex for Mac-style key handling
- `\x1b[13;2u` - Raw input sequence sent for Shift+Enter
- `\x01` - Raw input sequence for Mac Meta+ArrowLeft
- `\x05` - Raw input sequence for Mac Meta+ArrowRight
- `\x1bb` - Raw input sequence for backward word navigation
- `\x1bf` - Raw input sequence for forward word navigation

## Narrative

### Structure

terminal-pane.tsx manages runtime concerns for an individual terminal pane, including activation listeners, auto-focus application, hidden-pane rendering behavior, appearance updates, terminal size stabilization, PTY connection sequencing, lag detection, search state, and keyboard mappings. Appearance application is request-id based so stale font or theme work does not overwrite newer requests. Connection starts only after appearance work resolves and terminal size measurements stabilize across repeated animation frames.

### Dependencies

Runtime behavior depends on restty, activePane, transportController, visibility state, document focus, terminalAppearance options, and requestAnimationFrame scheduling. Lag detection depends on timer overshoot sampling and visibility/focus predicates. Search behavior depends on activePane clearSearch and setSearchQuery methods. Keyboard mapping depends on platform detection and modifier-key combinations.

### Highlights

The pane uses explicit numeric thresholds throughout: 450ms and 4 keystrokes for typing-triggered scroll-to-bottom, 200px/40px for scroll button visibility hysteresis, 1000ms average overshoot inside a 10000ms lag monitor window, and 50ms scheduler probes over 5000ms with a 250ms warning threshold. Hidden panes intentionally remain painted and skip redraws on visibility flips once PTY startup has occurred. Search close explicitly clears search results and refocuses the terminal on the next animation frame.

### Rules

onActivate("focusin") is emitted only after the pane actually owns :focus-within.
onActivate("pointer") is emitted from pointer capture on the terminal root.
If autoFocusRequest is absent, already handled, or the pane is not visible, auto-focus application must return early.
Hidden panes stay painted behind the active pane and should not redraw on visibility flips.
Lag detection requires the pane to be visible, the document visibilityState to be "visible", and the document to have focus before scheduler overshoot is treated as laggy.
If search is closed or query length is zero, clearSearch must run and SEARCH_RESULTS_EMPTY must be restored.

### Examples

Examples include focus search on primaryModifier+F, sending "\x1b[13;2u" on Shift+Enter, sending "\x01" and "\x05" for Mac line navigation, using "\x1bb" and "\x1bf" for word navigation, and calling transportController.markTerminalReady(cols, rows) before activePane.connectPty(buildSessionSocketUrl(connection, pane.sessionId)).

## Facts

- **restty_startup_background**: RESTTY_STARTUP_BACKGROUND is #121212. [project]
- **typing_auto_scroll_threshold**: Typing auto-scroll uses a 450ms burst window and triggers after 4 typed characters. [project]
- **scroll_to_bottom_thresholds**: Scroll-to-bottom appears when distance from bottom exceeds 200px and hides after it drops to 40px. [project]
- **lag_detection_threshold**: Lag detection treats a visible focused document as laggy when average timer overshoot is at least 1000ms within a 10000ms monitor window. [project]
- **scheduler_probe_thresholds**: Scheduler probes run every 50ms over a 5000ms window and warn at 250ms overshoot. [project]
- **search_results_empty**: SEARCH_RESULTS_EMPTY is { resultCount: 0, resultIndex: -1 }. [project]
- **shift_enter_terminal_sequence**: Shift+Enter sends raw terminal input \x1b[13;2u. [convention]
- **mac_line_navigation_sequences**: On Mac, Meta+ArrowLeft sends \x01 and Meta+ArrowRight sends \x05. [convention]
- **word_navigation_sequences**: Word navigation sends \x1bb for left and \x1bf for right on Mac Alt+Arrow and non-Mac Ctrl+Arrow. [convention]
- **hidden_pane_freeze_behavior**: Hidden panes stay painted behind the active pane and are not redrawn on visibility flips after PTY connection starts. [project]
