---
title: Terminal Workspace Runtime Facts
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T01:39:05.168Z"
updatedAt: "2026-04-06T02:20:18.675Z"
---

## Raw Concept

**Task:**
Capture factual runtime rules, thresholds, message types, and file ownership for terminal workspace and sidebar interactions

**Changes:**

- Recorded stable pane ordering source and local override constraints
- Recorded focus activation ownership and 400ms auto-focus guard
- Recorded sidebar drag and reorder thresholds plus startup blocking duration

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
RLM context -> single-pass extraction fallback -> dedup/group -> project facts context update

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry stores concrete implementation facts about thresholds, selectors, message types, and behavior guarantees spanning workspace and sidebar runtime files.

### Dependencies

Facts depend on the current UI runtime implementation and should be updated when focus routing, drag constraints, or pane ordering logic changes.

### Highlights

Includes concrete values such as 400ms auto-focus guard, 1500ms sidebar startup block, 8px reorder threshold, 6px non-touch sensor distance, 250ms touch drag delay, and 130ms session-card drag hold.

## Facts

- **visible_pane_order_source**: Visible split-pane layout order is derived from activeGroup.snapshot.visibleSessionIds. [project]
- **local_pane_order_scope**: localPaneOrder is only a temporary override within the currently visible session ids. [project]
- **workspace_focus_owner**: WorkspaceApp owns authoritative focus state and guard logic for terminal pane activation. [project]
- **terminal_pointer_activation_source**: TerminalPane emits onActivate("pointer") from pointer capture on the terminal root. [project]
- **terminal_focusin_activation_mode**: TerminalPane emits onActivate("focusin") only as a fallback after the pane owns :focus-within. [project]
- **auto_focus_activation_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400. [project]
- **auto_reload_on_lag**: AUTO_RELOAD_ON_LAG is true. [project]
- **sidebar_reorder_threshold_px**: Sidebar session reorder requires pointer movement crossing an 8px threshold for the original session interaction. [project]
- **sidebar_startup_interaction_block_ms**: SIDEBAR_STARTUP_INTERACTION_BLOCK_MS is 1500. [project]
- **sidebar_non_touch_drag_distance_px**: Non-touch sidebar drag activation uses a 6px distance constraint. [project]
- **sidebar_touch_drag_activation**: Touch sidebar drag activation uses a 250ms delay with 5px tolerance. [project]
- **session_card_drag_hold**: Session card drag hold uses 130ms delay and 12px tolerance for both touch and non-touch. [project]
- **hidden_terminal_behavior**: Hidden terminal panes stay painted behind the active pane and should not redraw on visibility flips. [project]
- **scroll_to_bottom_thresholds**: Scroll-to-bottom button shows when distance from bottom exceeds 200px and hides below 40px. [project]
- **typing_auto_scroll_behavior**: Typing auto-scroll uses a 450ms burst window and triggers after 4 printable keystrokes. [project]
- **scheduler_lag_detection_thresholds**: Lag detection in terminal-pane uses 50ms probe interval, 5000ms probe window, 10000ms monitor window, 1000ms lag threshold, and 250ms warn threshold. [project]
- **terminal_startup_background**: Terminal startup background color is #121212. [project]
- **sidebar_reorder_message_types**: Sidebar sends syncGroupOrder, moveSessionToGroup, and syncSessionOrder for reorder operations. [project]
- **workspace_message_types**: WorkspaceApp posts focusSession and syncPaneOrder messages to VS Code for focus and pane ordering changes. [project]
- **session_card_click_behavior**: Session card clicks focus the session, meta-click closes it, and middle click closes it. [project]
