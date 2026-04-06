---
title: Workspace Focus And Sidebar Drag Semantics
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/title_activity_and_sidebar_runtime.md,
    architecture/terminal_workspace/workspace_focus_debugging.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:20:33.361Z"
updatedAt: "2026-04-06T02:20:33.361Z"
---

## Raw Concept

**Task:**
Document terminal workspace interaction decisions for focus ownership, visible pane ordering, pane drag handling, and sidebar session reorder semantics

**Changes:**

- Defined visible split-pane order from active group snapshot.visibleSessionIds for slot stability
- Centralized terminal pane focus decisions in WorkspaceApp while keeping TerminalPane intent-driven
- Added sidebar guard to prevent click-shaped interactions from reordering session cards
- Documented workspace pane drag lifecycle, auto-focus guard, and sync message behavior

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
pointer/focus intent in pane -> WorkspaceApp applies local focus visual -> guard checks run -> focusSession postMessage sent when needed; pointerdown on sidebar session -> drag state tracks movement -> dragEnd reorders only after real movement threshold

**Timestamp:** 2026-04-06

**Patterns:**

- `button, [role='button'], input, select, textarea, a, .workspace-pane-header-actions` - Workspace pane header interactive target selector used to block drag initiation from controls
- `focusSession` - VS Code postMessage type for focusing a session
- `syncPaneOrder` - VS Code postMessage type for syncing full pane order after workspace reorder
- `syncSessionOrder` - VS Code postMessage type for syncing sidebar session order within a group
- `moveSessionToGroup` - VS Code postMessage type for moving a session to another sidebar group

## Narrative

### Structure

The workspace implementation splits responsibility between TerminalPane and WorkspaceApp. TerminalPane detects pointer and focusin activation from the terminal root, while WorkspaceApp owns authoritative focus state, auto-focus guard checks, local focus visuals, and focusSession messaging. Visible workspace pane ordering is computed from the active group snapshot.visibleSessionIds, then optionally constrained by localPaneOrder only within the currently visible session set so passive panes keep their surface slots stable during split-session changes. Sidebar drag behavior is coordinated in sidebar-app.tsx and sortable-session-card.tsx, with pointerdown target capture, movement tracking, drag sensors, and drag-end guards deciding whether a reorder is legitimate.

### Dependencies

Workspace focus behavior depends on workspaceState, presentedFocusedSessionId, autoFocusGuardRef, and VS Code postMessage messaging. Pane reordering depends on helper builders that convert visible pane order into a full session order. Sidebar drag semantics depend on pointerDownSessionTargetRef, sessionPointerDragStateRef, drag sensors, and resolved drop targets. Sortable session cards depend on group-aware drag data and optional focus callbacks.

### Highlights

As of 2026-04-06, workspace slot stability is explicitly protected by deriving visible pane order from the active group snapshot rather than a global saved order. Focus behavior is intentionally centralized so terminal panes emit intent only, preventing stale pane-local focus logic in split layouts. Sidebar session cards are protected against accidental reorder by requiring real pointer movement before dragEnd can mutate order. The implementation also documents exact message types including focusSession, syncPaneOrder, syncSessionOrder, and moveSessionToGroup.

### Rules

Visible split-pane layout order must come from the active group's snapshot.visibleSessionIds, not by filtering the saved global pane order.
Terminal pane activation is intent-driven from TerminalPane, but stateful focus decisions are centralized in WorkspaceApp.
Sidebar session cards must never reorder from ordinary clicking.
Reorder is allowed on drag end only if pointer movement crossed an 8px threshold for that same session interaction.
If there was no real pointer movement, dragEnd is ignored for reordering even if the drag library resolved a drop target.
These rules are current implementation decisions, not historical notes. They should be preserved unless workspace ordering or drag semantics are intentionally redesigned.

### Examples

Examples include TerminalPane emitting onActivate("pointer") from terminal root pointer capture and onActivate("focusin") after :focus-within is confirmed; WorkspaceApp sending vscode.postMessage({ sessionId, type: "focusSession" }) when pane activation requests focus; sidebar drag end returning early when sessionPointerDragState.startPoint exists and didMove is false; and workspace reorder sending vscode.postMessage({ groupId, sessionIds: nextPaneOrder, type: "syncPaneOrder" }).

## Facts

- **visible_pane_order_source**: Visible workspace split-pane order is derived from the active group snapshot.visibleSessionIds rather than filtering a saved global pane order. [project]
- **local_pane_order_scope**: localPaneOrder is only a temporary override within the currently visible session ids. [project]
- **focus_ownership**: WorkspaceApp centralizes stateful terminal focus decisions while TerminalPane emits activation intent. [project]
- **terminal_pointer_activation**: TerminalPane emits onActivate("pointer") from pointer capture on the terminal root. [project]
- **terminal_focusin_activation**: TerminalPane emits onActivate("focusin") only after the root owns :focus-within. [project]
- **auto_focus_activation_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400. [project]
- **sidebar_reorder_threshold_px**: Sidebar reorder is allowed only when pointer movement crosses an 8px threshold for the same session interaction. [convention]
- **sidebar_drag_end_guard**: Sidebar drag end is ignored for session reordering when a pointer start point exists but didMove is false. [convention]
- **workspace_header_interactive_targets**: Workspace header drag activation ignores interactive header targets matching button, role=button, input, select, textarea, a, or .workspace-pane-header-actions. [project]
- **workspace_reorder_message**: Workspace pane reorder posts a syncPaneOrder message with the full session order built from visible pane order. [project]
- **workspace_terminal_click_requirement**: A terminal pane click should activate the pane through the centralized WorkspaceApp focus path. [convention]
- **split_slot_stability_requirement**: Switching active sessions in a split should preserve the passive surfaced pane slot. [convention]
- **sidebar_click_focus_only_requirement**: Clicking session cards in the sidebar should focus sessions only and not mutate order unless the user actually drags. [convention]
