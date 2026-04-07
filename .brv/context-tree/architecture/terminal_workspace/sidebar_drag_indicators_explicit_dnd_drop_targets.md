---
title: Sidebar Drag Indicators Explicit DnD Drop Targets
tags: []
related:
  [
    architecture/terminal_workspace/sidebar_drag_reorder_recovery.md,
    architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md,
    facts/project/sidebar_drag_reorder_recovery_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-07T03:11:40.025Z"
updatedAt: "2026-04-07T03:11:40.025Z"
---

## Raw Concept

**Task:**
Document the sidebar drag-and-drop indicator redesign to use explicit DnD drop targets for sessions and empty groups.

**Changes:**

- Replaced primarily DOM hit-tested sidebar drag indicators with explicit DnD droppable targets.
- Added before and after session drop surfaces on sortable session cards.
- Added explicit empty-group session drop target handling.
- Kept DOM-based point resolution as fallback only.
- Added tests for explicit payload parsing, move behavior, and fallback hit testing.

**Files:**

- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx
- sidebar/session-group-section.tsx
- sidebar/sidebar-dnd.ts
- sidebar/sidebar-dnd.test.ts

**Flow:**
drag start -> parse source and target DnD payloads -> resolve explicit session drop target when present -> fallback to DOM point resolution when needed -> compute next session ordering -> post syncGroupOrder, moveSessionToGroup, or syncSessionOrder

**Timestamp:** 2026-04-07

**Patterns:**

- `^session-drop-target:[^:]+:group:(start|end)$` - Group-level sidebar session drop target ID format
- `^session-drop-target:[^:]+:[^:]+:(before|after)$` - Session-level sidebar session drop target ID format
- `\[data-dragging='true'\]` - Selector used to ignore the actively dragged element during DOM fallback resolution
- `^\[data-sidebar-group-id\]$` - Sidebar group selector
- `^\[data-sidebar-session-id\]$` - Sidebar session selector

## Narrative

### Structure

The sidebar DnD implementation is split across sidebar-app.tsx for drag lifecycle orchestration, sortable-session-card.tsx for per-session drag and droppable surfaces, session-group-section.tsx for group-level drag/drop behavior including empty-group targets, and sidebar-dnd.ts for payload typing, target extraction, DOM fallback resolution, and reorder algorithms. Tests in sidebar-dnd.test.ts cover parsing, resolution, and movement behaviors.

### Dependencies

The implementation depends on PointerSensor, KeyboardSensor, PointerActivationConstraints, useSortable, useDroppable, SortableKeyboardPlugin, DragDropProvider, VS Code webview postMessage messaging, and shared sidebar DnD helpers. DOM fallback still depends on elementFromPoint or elementsFromPoint and dataset-based group/session markers.

### Highlights

Indicators are now driven by DnD-owned drop target state rather than only by global DOM hit testing, which makes before/after session insertion and empty-group insertion explicit. Session cards publish two session-drop-target payloads, empty groups publish a group start target, and sidebar-app prefers those payloads before consulting DOM-derived targets. The reorder algorithm preserves object identity on no-op self-drops, clamps cross-group insert indices, and the tests lock in parsing, empty-group moves, self-drop no-ops, cross-group insertion after a hovered item, and dragging-element skipping in DOM fallback.

### Rules

Session cards publish `{ kind: "session", position: "before", sessionId, groupId }` and `{ kind: "session", position: "after", sessionId, groupId }` as explicit drop targets. Empty groups publish `{ kind: "group", position: "start", groupId }` as an explicit session drop target. `sidebar-app` resolves `session-drop-target` payloads from DnD first and falls back to DOM-based resolution only as backup. DOM fallback ignores the actively dragged element using `[data-dragging='true']`.

### Examples

Example cross-group move path: a dragged session resolves an explicit target after a hovered session in another group, `moveSessionIdsByDropTarget` computes the new session ordering, and sidebar-app posts `{ type: "moveSessionToGroup", groupId, sessionId, targetIndex }`. Example same-group reorder path: a resolved target within the same group produces a new ordered session ID list and posts `{ type: "syncSessionOrder", groupId, sessionIds }`.

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
