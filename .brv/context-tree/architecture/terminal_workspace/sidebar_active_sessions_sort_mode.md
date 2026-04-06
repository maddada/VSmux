---
title: Sidebar Active Sessions Sort Mode
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T23:09:55.234Z"
updatedAt: "2026-04-06T23:09:55.234Z"
---

## Raw Concept

**Task:**
Document persisted active-sessions sort mode for the sidebar Active header

**Changes:**

- Added SidebarActiveSessionsSortMode with manual and lastActivity values to sidebar HUD state
- Persisted active sessions sort mode per workspace via workspaceState
- Added Active header toggle button for switching sort modes
- Derived sidebar display order locally from manual order and lastInteractionAt
- Disabled group and session dragging while last-activity sorting is active

**Files:**

- shared/session-grid-contract-sidebar.ts
- extension/sidebar-active-sessions-sort-preferences.ts
- extension/native-terminal-workspace/controller.ts
- sidebar/sidebar-app.tsx
- sidebar/active-sessions-sort.ts

**Flow:**
hydrate hud state -> read persisted sort mode from workspaceState -> derive display layout locally -> toggle sort mode from sidebar header -> preserve manual order while optionally rendering by last activity

**Timestamp:** 2026-04-06

## Narrative

### Structure

The feature spans the shared sidebar contract, extension-side sort mode persistence, controller integration, sidebar UI state, and a dedicated local sorting helper. SidebarHudState now carries activeSessionsSortMode, the extension stores that mode under a workspace-scoped key, and sidebar/sidebar-app.tsx derives effectiveGroupIds and effectiveSessionIdsByGroup through createDisplaySessionLayout rather than overwriting authoritative manual order.

### Dependencies

Persistence depends on vscode.ExtensionContext.workspaceState and getWorkspaceStorageKey(workspaceId). UI behavior depends on the existing sidebar message contract using toggleActiveSessionsSortMode, and sorting depends on SidebarSessionItem.lastInteractionAt plus Date.parse for timestamp comparison.

### Highlights

Manual mode keeps the authoritative workspace group and session ordering intact and leaves drag-and-drop reordering enabled. Last-activity mode reorders sessions and groups only for display, sorts by descending activity recency, uses manual order as the tie-breaker, treats invalid or missing timestamps as 0, and preserves the previously arranged manual order when the user switches back.

### Rules

Sort mode values: "manual" and "lastActivity"
Persistence key: VSmux.sidebarActiveSessionsSortMode
Normalization rule: only "lastActivity" is preserved explicitly; all other values normalize to "manual"
Manual mode: preserves authoritative workspaceGroupIds and per-group session order; drag-and-drop reordering remains enabled
Last-activity mode: sorts sessions within each group by descending lastInteractionAt; sorts groups by most recent session activity; falls back to original manual order for tie-breaking; uses Date.parse(lastInteractionAt); invalid or missing timestamps become 0; does not overwrite stored manual order; drag-and-drop reordering is disabled

### Examples

The Active section header now shows a sort toggle button next to Previous Sessions. The button aria label announces the current mode, its selected state indicates non-manual mode, and its tooltip switches between "Manual Sort" and "Last Activity". When activeSessionsSortMode is not manual, the drag start, drag move, drag over, and drag end handlers return early and clear drag indicators instead of applying reorder operations.

## Facts

- **sidebar_active_sessions_sort_mode**: Sidebar HUD now includes activeSessionsSortMode with values manual or lastActivity. [project]
- **active_sessions_sort_persistence_scope**: The extension persists the active sessions sort mode per workspace in workspaceState. [project]
- **active_sessions_sort_persistence_key**: The persistence key for sidebar active sessions sort mode is VSmux.sidebarActiveSessionsSortMode. [project]
- **active_sessions_sort_normalization**: Normalization preserves only lastActivity explicitly and normalizes every other stored value to manual. [convention]
- **manual_sort_behavior**: Manual mode preserves authoritative workspaceGroupIds and per-group session order and keeps drag-and-drop enabled. [project]
- **last_activity_sort_behavior**: Last-activity mode sorts sessions within each group by descending lastInteractionAt and sorts groups by most recent session activity. [project]
- **last_activity_tiebreak_and_preservation**: Last-activity sorting falls back to the original manual order for tie-breaking and does not overwrite stored manual order. [project]
- **last_activity_timestamp_fallback**: Invalid or missing lastInteractionAt timestamps are converted to 0 using Date.parse fallback logic. [project]
- **sort_mode_drag_constraint**: Group and session dragging are disabled when active sessions sort mode is not manual. [project]
- **active_sessions_sort_toggle_ui**: The Active section header includes a toggle button next to Previous Sessions that posts toggleActiveSessionsSortMode. [project]
- **active_sessions_sort_tooltips**: The toggle button tooltip reflects the current mode using Manual Sort or Last Activity. [project]
