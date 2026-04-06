---
title: Sidebar Active Sessions Sort Mode Persistence
tags: []
related:
  [
    architecture/terminal_workspace/sidebar_session_card_last_interaction_timestamps.md,
    architecture/terminal_workspace/workspace_sidebar_interaction_state.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T23:09:45.510Z"
updatedAt: "2026-04-06T23:09:45.510Z"
---

## Raw Concept

**Task:**
Persist and apply active-sessions sort mode for the sidebar Active section

**Changes:**

- Added SidebarActiveSessionsSortMode with manual and lastActivity modes
- Persisted sidebar active session sort preference in workspaceState using workspace-scoped storage keys
- Added Active header toggle button that posts toggleActiveSessionsSortMode
- Derived display-only group and session ordering locally from lastInteractionAt timestamps
- Disabled group and session dragging while lastActivity mode is active

**Files:**

- shared/session-grid-contract-sidebar.ts
- extension/sidebar-active-sessions-sort-preferences.ts
- extension/native-terminal-workspace/controller.ts
- sidebar/sidebar-app.tsx
- sidebar/active-sessions-sort.ts

**Flow:**
read workspace-scoped sort mode -> include in SidebarHudState -> sidebar computes display layout -> manual mode preserves authoritative drag order -> lastActivity mode sorts locally by lastInteractionAt -> toggle posts message -> extension persists updated mode

**Timestamp:** 2026-04-06

**Patterns:**

- `^lastActivity$` - Recognized persisted value for activity-based sorting
- `^manual$` - Recognized persisted value for manual sorting

## Narrative

### Structure

The feature spans the sidebar contract, a dedicated extension preference helper, native terminal workspace controller wiring, sidebar UI state consumption, and a local layout utility. SidebarHudState now carries activeSessionsSortMode, the controller hydrates and persists it per workspace, and the sidebar renders either authoritative manual order or a computed display order without mutating stored drag layout.

### Dependencies

Persistence depends on VS Code workspaceState and workspace-specific storage keys generated from workspaceId. Display ordering depends on SidebarSessionItem.lastInteractionAt values present in hydrated session data and on the sidebar store fields sessionsById, workspaceGroupIds, and authoritativeSessionIdsByGroup.

### Highlights

Manual ordering remains the source of truth even after users switch to last-activity sorting. Session ties preserve original manual order, group ties preserve original workspaceGroupIds order, and missing or invalid timestamps fall back to 0. The Active section header exposes the mode through an IconArrowsSort toggle placed next to the Previous Sessions action.

### Rules

Sort mode is persisted per workspace, not globally. Manual ordering remains the source of truth. Last-activity order is computed locally for display only. Ties preserve manual order. Switching sort modes must not overwrite or destroy drag-defined manual ordering. Dragging is disabled while activeSessionsSortMode === "lastActivity".

### Examples

The sidebar posts { type: "toggleActiveSessionsSortMode" } when the Active header toggle is clicked. In manual mode, createDisplaySessionLayout returns the original workspaceGroupIds and session order. In lastActivity mode, sessions are sorted by descending Date.parse(lastInteractionAt) with original manual index as the tie-breaker, and groups are sorted by their latest session activity with original group order as the tie-breaker.

## Facts

- **active_sessions_sort_mode**: Sidebar HUD includes activeSessionsSortMode with values manual or lastActivity. [project]
- **active_sessions_sort_scope**: Active sessions sort mode is persisted per workspace in VS Code workspaceState. [project]
- **active_sort_preserves_manual_order**: Switching to last-activity sorting preserves manual drag order instead of overwriting it. [project]
- **active_sort_drag_disabled_mode**: Group and session dragging are disabled while activeSessionsSortMode is lastActivity. [project]
- **active_sort_order_source**: Display order in last-activity mode is derived locally from lastInteractionAt timestamps. [project]
- **active_sort_invalid_timestamp_fallback**: Missing or invalid lastInteractionAt values are treated as activity time 0. [project]
- **active_sort_toggle_message**: The sidebar sends a toggleActiveSessionsSortMode message when the Active header sort button is pressed. [project]
