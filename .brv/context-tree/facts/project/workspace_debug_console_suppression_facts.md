---
title: Workspace Debug Console Suppression Facts
tags: []
related: [architecture/terminal_workspace/workspace_debug_console_suppression.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T21:17:24.920Z"
updatedAt: "2026-04-06T22:10:09.701Z"
---

## Raw Concept

**Task:**
Capture factual details for sidebar debug console suppression

**Changes:**

- Recorded no-op sidebar debug helper behavior
- Recorded preserved sidebarDebugLog messaging flow
- Recorded regression test and preserved drag constants

**Files:**

- sidebar/sidebar-debug.ts
- sidebar/sidebar-app.tsx
- sidebar/sidebar-story-harness.tsx
- sidebar/sidebar-debug.test.ts

**Flow:**
source files reviewed -> facts extracted -> deduplicated by subject -> stored in facts/project

**Timestamp:** 2026-04-06

## Narrative

### Structure

This entry stores the stable project facts associated with sidebar debug console suppression so they can be recalled independently from the architectural narrative. It focuses on helper behavior, preserved message flow, drag constants, activation thresholds, and regression coverage.

### Highlights

The key factual outcome is that console debug echo is suppressed while sidebarDebugLog messaging remains unchanged. Additional facts preserve numeric behavior for startup interaction blocking, drag reorder thresholds, Storybook settle timing, and pointer activation settings.

## Facts

- **sidebar_debug_helper_behavior**: sidebar/sidebar-debug.ts now implements logSidebarDebug as a no-op helper that returns early when debugging is disabled and does not emit console output. [project]
- **sidebar_debug_message_flow**: sidebar/sidebar-app.tsx still posts sidebarDebugLog messages, including session.dragIndicatorChanged, through vscode.postMessage while browser-console debug echo is suppressed. [project]
- **storybook_sidebar_debug_behavior**: sidebar/sidebar-story-harness.tsx still captures sidebarDebugLog messages and Storybook debug echo is suppressed because logSidebarDebug is now a no-op. [project]
- **sidebar_debug_regression_test**: Regression coverage was added in sidebar/sidebar-debug.test.ts to verify logSidebarDebug(true, ...) does not call console.debug. [project]
- **sidebar_drag_constants**: sidebar/sidebar-app.tsx preserves SIDEBAR_STARTUP_INTERACTION_BLOCK_MS = 1500 and SIDEBAR_POINTER_DRAG_REORDER_THRESHOLD_PX = 8. [project]
- **sidebar_pointer_activation_constraints**: Touch drag activation uses new PointerActivationConstraints.Delay({ tolerance: 5, value: 250 }) and non-touch drag activation uses new PointerActivationConstraints.Distance({ value: 6 }). [project]
- **storybook_drag_settle_delay**: sidebar/sidebar-story-harness.tsx defines STORYBOOK_DRAG_SETTLE_DELAY_MS = 900 for scheduled workspace updates after drag interactions. [project]
