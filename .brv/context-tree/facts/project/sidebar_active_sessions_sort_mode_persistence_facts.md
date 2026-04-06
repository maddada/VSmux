---
title: Sidebar Active Sessions Sort Mode Persistence Facts
tags: []
related: [architecture/terminal_workspace/sidebar_active_sessions_sort_mode_persistence.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T23:09:45.511Z"
updatedAt: "2026-04-06T23:09:45.511Z"
---

## Raw Concept

**Task:**
Capture factual project details for persisted sidebar active-sessions sort mode

**Changes:**

- Recorded workspace-scoped persistence behavior
- Recorded drag disablement in lastActivity mode
- Recorded local display-only sort semantics and timestamp fallback

**Files:**

- shared/session-grid-contract-sidebar.ts
- extension/sidebar-active-sessions-sort-preferences.ts
- sidebar/active-sessions-sort.ts
- sidebar/sidebar-app.tsx

**Flow:**
extract implementation facts -> group project behaviors -> store as reusable factual recall entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

This entry isolates stable implementation facts that are useful for future recall and change impact analysis around sidebar active session ordering.

### Dependencies

These facts depend on the sidebar HUD contract, workspaceState persistence, and lastInteractionAt timestamp propagation into sidebar session items.

### Highlights

The facts emphasize that manual order is preserved, lastActivity is display-only, drag actions are disabled in activity mode, and timestamp parsing failures degrade safely to 0.

## Facts

- **active_sessions_sort_mode**: Sidebar HUD includes activeSessionsSortMode with values manual or lastActivity. [project]
- **active_sessions_sort_scope**: Active sessions sort mode is persisted per workspace in VS Code workspaceState. [project]
- **active_sort_preserves_manual_order**: Switching to last-activity sorting preserves manual drag order instead of overwriting it. [project]
- **active_sort_drag_disabled_mode**: Group and session dragging are disabled while activeSessionsSortMode is lastActivity. [project]
- **active_sort_order_source**: Display order in last-activity mode is derived locally from lastInteractionAt timestamps. [project]
- **active_sort_invalid_timestamp_fallback**: Missing or invalid lastInteractionAt values are treated as activity time 0. [project]
- **active_sort_toggle_message**: The sidebar sends a toggleActiveSessionsSortMode message when the Active header sort button is pressed. [project]
