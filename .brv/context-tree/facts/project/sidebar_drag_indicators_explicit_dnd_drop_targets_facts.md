---
title: Sidebar Drag Indicators Explicit DnD Drop Targets Facts
tags: []
related: [architecture/terminal_workspace/sidebar_drag_indicators_explicit_dnd_drop_targets.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-07T03:11:40.026Z"
updatedAt: "2026-04-07T03:11:40.026Z"
---

## Raw Concept

**Task:**
Capture factual recall data for the sidebar explicit DnD drop target implementation.

**Changes:**

- Captured constants, file paths, helper APIs, drop target types, message types, and tested behaviors for the sidebar DnD redesign.

**Files:**

- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx
- sidebar/session-group-section.tsx
- sidebar/sidebar-dnd.ts
- sidebar/sidebar-dnd.test.ts

**Flow:**
implementation notes -> factual extraction -> project facts entry

**Timestamp:** 2026-04-07

## Narrative

### Structure

This facts entry summarizes the explicit session-drop-target model, the helper APIs in sidebar-dnd.ts, the constants and sensor constraints used by sidebar-app.tsx and sortable-session-card.tsx, and the test cases that preserve expected reorder and fallback behavior.

### Highlights

The most important recall points are that DnD payloads now own drop-target state, DOM hit testing is fallback-only, empty groups expose an explicit start target, and moveSessionIdsByDropTarget encodes the definitive reorder semantics for both same-group and cross-group session moves.

## Facts

- **sidebar_drag_indicator_model**: Sidebar drag indicators use explicit DnD droppable targets instead of relying primarily on a global DOM hit-testing resolver. [project]
- **session_drop_surfaces**: Session cards expose explicit before and after droppable surfaces for session drag reordering. [project]
- **empty_group_drop_target**: Empty groups expose a session droppable target with kind group and position start. [project]
- **drop_target_resolution_order**: sidebar-app resolves explicit session-drop-target payloads from DnD first and falls back to DOM-based resolution only as backup. [project]
- **sidebar_startup_interaction_block_ms**: SIDEBAR_STARTUP_INTERACTION_BLOCK_MS is 1500 in sidebar/sidebar-app.tsx. [project]
- **sidebar_pointer_drag_reorder_threshold_px**: SIDEBAR_POINTER_DRAG_REORDER_THRESHOLD_PX is 8 in sidebar/sidebar-app.tsx. [project]
- **sidebar_drag_sensor_constraints**: The top-level sidebar pointer sensor uses a 250 ms touch delay with tolerance 5 and a pointer distance threshold of 6 for non-touch drags. [project]
- **session_card_drag_hold_constraints**: Session card drag hold delay is 130 ms with tolerance 12 px for both pointer and touch activation constraints. [project]
- **session_drop_target_surface_rendering**: sortable-session-card.tsx renders aria-hidden session-drop-target-surface-before and session-drop-target-surface-after divs backed by useDroppable refs. [project]
- **empty_group_indicator_rendering**: sidebar/session-group-section.tsx uses an emptyGroupDropTarget and marks the empty group state with data-drop-position start when active. [project]
- **sidebar_session_drop_target_type**: sidebar/sidebar-dnd.ts defines SidebarSessionDropTarget as either a group target with positions start or end or a session target with positions before or after. [project]
- **session_drop_target_id_format**: createSessionDropTargetId formats group targets as session-drop-target:<groupId>:group:<position> and session targets as session-drop-target:<groupId>:<sessionId>:<position>. [project]
- **sidebar_drop_data_parsing**: getSidebarDropData parses session, group, create-group, and session-drop-target payloads and validates session-drop-target payloads with isSidebarSessionDropTarget. [project]
- **explicit_drop_target_extraction**: getSidebarSessionDropTarget returns candidate.dropTarget only when the parsed payload kind is session-drop-target. [project]
- **client_point_extraction**: getClientPoint returns x and y only when the event exposes numeric clientX and clientY values. [project]
- **dom_fallback_resolution_behavior**: getSidebarSessionDropTargetAtPoint uses elementsFromPoint when available, otherwise elementFromPoint, and skips elements inside data-dragging=true ancestors. [project]
- **session_midpoint_drop_rule**: DOM-derived session drop targets use the session midpoint to choose before in the upper half and after in the lower half. [project]
- **group_midpoint_drop_rule**: DOM-derived group drop targets use the group midpoint to choose start in the upper half and end in the lower half. [project]
- **move_session_ids_noop_conditions**: moveSessionIdsByDropTarget is a no-op when the source group or session is missing, the target group is missing, or the target insert index is undefined. [project]
- **same_group_move_behavior**: In same-group moves, moveSessionIdsByDropTarget adjusts the target index when the source is removed before insertion and returns the original object when dropping onto the same effective position. [project]
- **cross_group_move_behavior**: In cross-group moves, moveSessionIdsByDropTarget removes the session from the source group and inserts it into the target group at a clamped target index. [project]
- **sidebar_drag_post_messages**: handleDragEnd posts moveSessionToGroup for cross-group moves and syncSessionOrder for same-group reorder operations. [project]
- **group_drag_message_type**: Group drags sync group order with the syncGroupOrder message type. [project]
- **sidebar_dnd_test_coverage**: sidebar/sidebar-dnd.test.ts verifies parsing explicit session-drop-target payloads, moving a session into an empty group, preserving identity when dropping onto self, inserting after a hovered session in another group, and skipping the dragging element during DOM fallback resolution. [project]
