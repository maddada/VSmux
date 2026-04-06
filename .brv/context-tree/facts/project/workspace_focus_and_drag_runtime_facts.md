---
title: Workspace Focus And Drag Runtime Facts
tags: []
related:
  [
    architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md,
    architecture/terminal_workspace/terminal_pane_runtime_thresholds_and_behaviors.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:20:33.362Z"
updatedAt: "2026-04-06T02:20:33.362Z"
---

## Raw Concept

**Task:**
Capture atomic project facts for terminal workspace focus, drag semantics, sidebar constraints, and runtime constants

**Changes:**

- Added current constants for focus guard, sidebar reorder threshold, drag hold constraints, and context menu sizing
- Recorded supported agent icon sets for resume-command copy and full reload

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx
- sidebar/sidebar-app.tsx
- sidebar/sortable-session-card.tsx

**Flow:**
constants and supported command rules define runtime UI behavior for focus, drag, and context menu handling

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry collects standalone constants and support matrices that are useful for recall without reading the architectural topics. It includes workspace focus-guard constants, sidebar drag thresholds, session card hold delays, context menu sizing, and agent-icon capability checks.

### Dependencies

These facts depend on the workspace and sidebar implementation files where the constants and helper predicates are defined.

### Highlights

The sidebar intentionally combines several independent safeguards: startup interaction blocking, drag distance or delay constraints, click-vs-drag detection, and supported capability matrices for session commands.

## Facts

- **terminal_workspace_interaction_state_date**: The current implementation date for the terminal workspace and sidebar interaction state is 2026-04-06. [project]
- **auto_reload_on_lag**: AUTO_RELOAD_ON_LAG is true. [project]
- **auto_focus_activation_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400. [project]
- **sidebar_startup_interaction_block_ms**: SIDEBAR_STARTUP_INTERACTION_BLOCK_MS is 1500. [project]
- **sidebar_pointer_drag_reorder_threshold_px**: SIDEBAR_POINTER_DRAG_REORDER_THRESHOLD_PX is 8. [project]
- **sidebar_sensor_activation_constraints**: Sidebar pointer sensor distance activation is 6 for non-touch and touch delay activation is 250ms with tolerance 5. [project]
- **session_card_drag_hold_constraints**: Session card drag hold delay is 130ms with tolerance 12 for both pointer and touch sensors. [project]
- **session_context_menu_dimensions**: Context menu width is 156px, item height is 34px, margin is 12px, and vertical padding is 12px. [project]
- **resume_command_copy_supported_agents**: supportsResumeCommandCopy returns true for codex, claude, copilot, gemini, and opencode agent icons. [project]
- **full_reload_supported_agents**: supportsFullReload returns true only for codex and claude agent icons. [project]
