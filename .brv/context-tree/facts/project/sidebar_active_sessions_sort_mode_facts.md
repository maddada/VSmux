---
title: Sidebar Active Sessions Sort Mode Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T23:09:55.235Z"
updatedAt: "2026-04-06T23:09:55.235Z"
---

## Raw Concept

**Task:**
Capture project facts for sidebar active-sessions sort mode

**Changes:**

- Recorded persistence key and workspace scope
- Recorded manual versus last-activity behavior
- Recorded UI toggle and drag constraints

**Files:**

- shared/session-grid-contract-sidebar.ts
- extension/sidebar-active-sessions-sort-preferences.ts
- sidebar/sidebar-app.tsx
- sidebar/active-sessions-sort.ts

**Flow:**
feature change -> extract factual statements -> store as project recall facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry stores stable recall details for the active-sessions sort mode feature rather than the full implementation narrative. It captures the enum values, persistence key, workspace scoping, local sort logic, tie-breaking behavior, and drag restrictions that matter for future lookup.

### Highlights

The most important facts are that the preference is workspace-scoped, the key is VSmux.sidebarActiveSessionsSortMode, manual order is preserved even when last-activity rendering is enabled, and drag interactions are disabled outside manual mode.

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
