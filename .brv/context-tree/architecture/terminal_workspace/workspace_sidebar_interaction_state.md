---
title: Workspace Sidebar Interaction State
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    facts/project/terminal_workspace_runtime_facts.md,
    facts/project/workspace_focus_debugging_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:21:38.335Z"
updatedAt: "2026-04-06T02:21:38.335Z"
---

## Raw Concept

**Task:**
Document current terminal workspace and sidebar interaction state and implementation rules

**Changes:**

- Pane ordering now derives visible layout from active group snapshot visibleSessionIds for slot stability
- Terminal activation intent is emitted by TerminalPane while WorkspaceApp centralizes focus decisions and auto-focus guard handling
- Sidebar session reorder requires real pointer movement before drag-end can mutate order
- Terminal pane runtime preserves hidden panes, stable sizing before PTY connect, and lag detection thresholds
- Session-card interactions include context-menu actions, drag-hold sensors, and capability gating for resume copy and full reload

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
pointer/focus intent -> WorkspaceApp activation guards -> local focus visual -> focusSession postMessage; sidebar pointerdown -> drag state tracking -> movement guard -> reorder/moveSessionToGroup/syncSessionOrder postMessage

**Timestamp:** 2026-04-06

**Patterns:**

- `:focus-within` - Terminal focus fallback only activates after pane owns focus within
- `button, [role='button'], input, select, textarea, a, .workspace-pane-header-actions` - Workspace pane header interactive target selector blocks drag initiation from interactive controls

## Narrative

### Structure

WorkspaceApp owns pane ordering, focus state, auto-focus guarding, pane drag state, and reorder synchronization for visible panes. TerminalPane owns terminal-root activation signals, PTY boot sequencing, hidden-pane rendering behavior, appearance application, stable-size waiting, scroll affordances, scheduler lag detection, and keyboard input translation. SidebarApp owns pointerdown provenance, drag lifecycle guards, group and session reorder decisions, and empty-space interaction behavior, while SortableSessionCard owns per-session drag-hold sensors, focus clicks, keyboard activation, context-menu actions, and agent capability gating.

### Dependencies

Workspace behavior depends on workspaceState snapshots, visible pane filtering, postMessage commands such as focusSession, syncPaneOrder, syncGroupOrder, syncSessionOrder, moveSessionToGroup, promptRenameSession, closeSession, copyResumeCommand, and fullReloadSession. Terminal behavior depends on restty runtime setup, transport readiness, animation-frame sequencing, document visibility/focus state, and platform-specific keyboard modifier detection. Sidebar behavior depends on pointer sensor activation constraints, session/group drop metadata, and drag-native event inspection.

### Highlights

User-facing requirements are explicit: clicking a terminal pane must activate it through WorkspaceApp, split-session switching must preserve the passive pane slot, and normal clicking in the sidebar must never reorder sessions. Visible pane order is computed from the active group snapshot with localPaneOrder constrained to visible sessions, preventing pane jumps caused by unrelated global ordering. Terminal focus includes a 400 ms auto-focus guard, hidden terminals freeze after PTY connect, stable terminal size is resolved before PTY connect with up to 20 attempts, scroll-to-bottom appears past 200 px and hides below 40 px, typing auto-scroll triggers after 4 printable keys in 450 ms, and scheduler lag is detected from average overshoot of at least 1000 ms within 10000 ms while visible and focused.

### Rules

1. Visible split-pane layout order is derived from the active group’s snapshot.visibleSessionIds, not by filtering the saved global pane order.
2. localPaneOrder is only a temporary override inside the currently visible session ids.
3. Clicking a terminal pane in the workspace should activate that pane through the centralized WorkspaceApp focus path.
4. TerminalPane should emit activation intent only; WorkspaceApp owns authoritative focus state and guard logic.
5. Sidebar session cards must never reorder from ordinary clicking.
6. Sidebar reorder is allowed only when pointer movement crossed an 8px threshold for that same session interaction.
7. If there was no real pointer movement, dragEnd is ignored for reordering even if the drag library resolved a drop target.
8. Hidden terminal panes stay painted behind the active pane and should not redraw on visibility flips once connected unless visibility semantics are intentionally redesigned.

### Examples

Examples include onActivate("pointer") from terminal root pointer capture, onActivate("focusin") after :focus-within, focusSession postMessage requests from WorkspaceApp and sidebar session cards, syncPaneOrder for visible pane reorder, syncSessionOrder for same-group sidebar reorder, moveSessionToGroup for cross-group session moves, promptRenameSession / closeSession / copyResumeCommand / fullReloadSession from session context menu actions, Shift+Enter -> \x1b[13;2u, macOS Meta+ArrowLeft -> \x01, macOS Meta+ArrowRight -> \x05, macOS Alt+ArrowLeft -> \x1bb, macOS Alt+ArrowRight -> \x1bf, Ctrl+ArrowLeft -> \x1bb, and Ctrl+ArrowRight -> \x1bf.

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
