---
title: Workspace Sidebar Interaction Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:21:38.337Z"
updatedAt: "2026-04-06T02:21:38.337Z"
---

## Raw Concept

**Task:**
Capture recall-oriented facts for terminal workspace and sidebar interaction behavior

**Changes:**

- Added implementation thresholds and capability rules for workspace/sidebar behavior

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
implementation decisions -> extracted thresholds and rules -> fact storage for recall

**Timestamp:** 2026-04-06

## Narrative

### Structure

This entry stores concise facts about ordering rules, focus ownership, drag thresholds, lag thresholds, keyboard mappings, and capability gates.

### Highlights

Includes 400 ms auto-focus guard, 8 px sidebar reorder threshold, 1500 ms startup interaction block, 130 ms card drag hold, 200/40 px scroll thresholds, 4 keys in 450 ms typing auto-scroll, 1000/10000 ms lag detection thresholds, and agent support rules for resume copy and full reload.

## Facts

- **visible_pane_order_source**: Visible workspace pane order is derived from the active group snapshot visibleSessionIds instead of filtering a saved global pane order. [project]
- **local_pane_order_scope**: localPaneOrder acts only as a temporary override within the currently visible session ids. [project]
- **split_slot_stability**: The workspace preserves passive pane slot stability when switching active sessions inside a split view. [project]
- **terminal_focus_ownership**: Terminal pane activation intent originates in TerminalPane and authoritative focus decisions are centralized in WorkspaceApp. [project]
- **terminal_activation_sources**: TerminalPane emits onActivate("pointer") from terminal root pointer capture and onActivate("focusin") only after the pane matches :focus-within. [project]
- **auto_focus_activation_guard_ms**: WorkspaceApp uses an auto-focus activation guard window of 400 ms. [project]
- **auto_reload_on_lag**: Workspace auto reload on lag is enabled. [project]
- **sidebar_reorder_threshold_px**: Sidebar session cards only reorder after real pointer movement crosses an 8 px threshold for the same session interaction. [project]
- **session_card_drag_hold_delay_ms**: Session-card drag hold delay is 130 ms for both pointer and touch drag initiation. [project]
- **sidebar_startup_interaction_block_ms**: Sidebar startup interaction blocking lasts 1500 ms. [project]
- **hidden_terminal_rendering_rule**: Hidden terminal panes remain painted behind the active pane and should not redraw on visibility flips once PTY is connected. [project]
- **scroll_to_bottom_thresholds**: Terminal scroll-to-bottom UI shows beyond 200 px from bottom and hides below 40 px. [project]
- **typing_auto_scroll_trigger**: Typing auto-scroll triggers after 4 printable keystrokes inside a 450 ms burst window. [project]
- **terminal_lag_detection_threshold**: Terminal lag detection treats average scheduler overshoot of at least 1000 ms within a 10000 ms monitor window as lag when visible and focused. [project]
- **scheduler_probe_settings**: Scheduler probe interval is 50 ms, probe window is 5000 ms, and overshoot warnings start at 250 ms. [project]
- **shift_enter_mapping**: Shift+Enter sends raw terminal input \x1b[13;2u. [convention]
- **mac_meta_arrow_mappings**: On macOS, Meta+ArrowLeft maps to \x01 and Meta+ArrowRight maps to \x05. [convention]
- **mac_alt_arrow_mappings**: On macOS, Alt+ArrowLeft maps to \x1bb and Alt+ArrowRight maps to \x1bf. [convention]
- **ctrl_arrow_mappings**: On non-mac control navigation, Ctrl+ArrowLeft maps to \x1bb and Ctrl+ArrowRight maps to \x1bf. [convention]
- **resume_command_copy_support**: Sidebar session cards support resume command copy for codex, claude, copilot, gemini, and opencode sessions. [project]
- **full_reload_support**: Full reload is supported only for codex and claude sessions. [project]
