---
title: Terminal Titles Activity And Sidebar Runtime
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_focus_debugging.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:20:18.674Z"
updatedAt: "2026-04-06T02:20:18.674Z"
---

## Raw Concept

**Task:**
Document current terminal workspace and sidebar interaction state, focus activation flow, visible pane ordering, drag thresholds, and preserved implementation rules

**Changes:**

- Visible workspace pane order is derived from activeGroup.snapshot.visibleSessionIds instead of filtering the global pane order
- TerminalPane emits pointer and focusin activation intents while WorkspaceApp owns authoritative focus decisions and guard logic
- Sidebar session reorder now requires meaningful pointer movement and ignores click-shaped drag-end interactions
- Auto-focus requests arm a 400ms guard against conflicting pane activations
- Hidden terminal panes remain painted behind the active pane and should not redraw on visibility flips

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
pointerdown/focusin intent in TerminalPane -> WorkspaceApp applies local focus visuals -> auto-focus guard check -> focusSession postMessage when authoritative focus must change; sidebar pointerdown records source session -> drag lifecycle tracks movement -> reorder only if threshold-crossing movement occurred

**Timestamp:** 2026-04-06

**Patterns:**

- `button, [role='button'], input, select, textarea, a, .workspace-pane-header-actions` - Workspace pane header targets excluded from drag initiation
- `button, input, select, textarea, a, [role='button'], [role='menu'], [role='menuitem'], [data-empty-space-blocking='true']` - Sidebar empty-space double-click blockers

## Narrative

### Structure

WorkspaceApp tracks workspace focus, local focused session, local visible pane order override, drag state, lag notice state, pending focus request state, and auto-focus guard state. Visible panes are ordered from the active group snapshot visibleSessionIds, with localPaneOrder allowed only as a temporary override within the currently visible session set. TerminalPane handles Restty rendering, appearance application, connection readiness, lag monitoring, and activation intent emission. SidebarApp records pointerdown origin data globally, tracks session pointer movement through drag lifecycle state, and posts syncSessionOrder, moveSessionToGroup, or syncGroupOrder messages only after valid drag interactions.

### Dependencies

Workspace focus behavior depends on WorkspaceApp coordinating TerminalPane activation events and VS Code postMessage focusSession requests. Pane reordering depends on buildVisiblePaneOrderForDrop and buildFullSessionOrderFromVisiblePaneOrder projecting visible drag results back into full session order. Sidebar drag behavior depends on PointerSensor and KeyboardSensor activation constraints plus a separate 8px meaningful-movement guard tied to the original pointerdown session interaction. Hidden pane behavior depends on connectPtyStartedRef and visibility-aware maintenance logic.

### Highlights

As of 2026-04-06, pointer activation is the primary terminal activation path and focusin is only a fallback after :focus-within confirmation. Auto-focus requests preserve the requested session for 400ms against competing activations. Sidebar startup blocks interactions for 1500ms, non-touch drag activation uses distance 6px, touch drag activation uses 250ms delay with 5px tolerance, and session card hold-to-drag uses 130ms with 12px tolerance. User-visible guarantees are that split-pane passive slots remain stable, pane clicks follow centralized focus routing, and sidebar clicks do not reorder sessions unless actual dragging occurred.

### Rules

1. Visible pane layout order must come from activeGroup.snapshot.visibleSessionIds.
2. localPaneOrder may only temporarily reorder within currently visible sessions.
3. TerminalPane emits activation intent only.
4. WorkspaceApp decides whether activation is ignored, visual-only, or forwarded as focusSession.
5. Auto-focus requests arm a 400ms guard against competing pane activations.
6. Session reordering must not occur from click-like interactions.
7. Drag end is ignored if the session interaction never showed real pointer movement.
8. Reorder threshold for sidebar session interactions is 8px.
9. Hidden terminal panes stay painted behind the active pane and should not redraw on visibility flips.

### Examples

WorkspaceApp sends ready, focusSession, syncPaneOrder, and reloadWorkspacePanel messages. SidebarApp sends createSession, ready, refreshDaemonSessions, openSettings, adjustTerminalFontSize, toggleCompletionBell, moveSidebarToOtherSide, createGroup, setSidebarSectionCollapsed, saveScratchPad, cancelSidebarGitCommit, confirmSidebarGitCommit, syncGroupOrder, moveSessionToGroup, and syncSessionOrder. Terminal keyboard behaviors preserve shortcuts such as Cmd/Ctrl+F for search, Shift+Enter sending \x1b[13;2u, and macOS/meta or ctrl/alt arrow combinations sending shell word/home/end control sequences.

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
