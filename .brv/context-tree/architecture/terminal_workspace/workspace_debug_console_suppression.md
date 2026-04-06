---
title: Workspace Debug Console Suppression
tags: []
related: [architecture/terminal_workspace/workspace_debug_console_suppression.md]
keywords: []
importance: 60
recency: 1
maturity: draft
updateCount: 2
createdAt: "2026-04-06T21:17:24.919Z"
updatedAt: "2026-04-06T22:10:57.564Z"
---

## Raw Concept

**Task:**
Document sidebar debug console suppression while preserving sidebar debug message flow and Storybook harness behavior

**Changes:**

- Made sidebar/sidebar-debug.ts a no-op helper
- Suppressed browser-console sidebar debug echoes such as session.dragIndicatorChanged
- Preserved sidebarDebugLog messaging from sidebar/sidebar-app.tsx
- Added regression coverage in sidebar/sidebar-debug.test.ts

**Files:**

- sidebar/sidebar-debug.ts
- sidebar/sidebar-app.tsx
- sidebar/sidebar-story-harness.tsx
- sidebar/sidebar-debug.test.ts

**Flow:**
sidebar event -> postSidebarDebugLog -> logSidebarDebug no-op -> vscode.postMessage({ type: sidebarDebugLog }) -> Storybook harness records message without browser console echo

**Timestamp:** 2026-04-06

## Narrative

### Structure

Sidebar debug logging now mirrors the workspace pattern by routing debug events through a dedicated helper in sidebar/sidebar-debug.ts that accepts the same signature as before but does not emit console output. sidebar/sidebar-app.tsx keeps its existing postSidebarDebugLog path, including debug-mode gating and vscode.postMessage dispatch for sidebarDebugLog events. sidebar/sidebar-story-harness.tsx still records outbound SidebarToExtensionMessage traffic and continues to invoke logSidebarDebug for sidebarDebugLog messages, preserving its message-path semantics while avoiding browser console noise.

### Dependencies

This behavior depends on the existing sidebar debug message contract remaining intact between SidebarApp, the VS Code webview bridge, and the Storybook harness. The regression test uses vite-plus/test and a console.debug spy to assert that enabled sidebar debug calls no longer write to the browser console.

### Highlights

Browser-console sidebar debug echoes such as session.dragIndicatorChanged are now suppressed without removing sidebarDebugLog messaging. Existing sidebar actions and message types remain unchanged, including createSession, ready, syncGroupOrder, moveSessionToGroup, syncSessionOrder, refreshDaemonSessions, openSettings, adjustTerminalFontSize, toggleCompletionBell, moveSidebarToOtherSide, createGroup, saveScratchPad, cancelSidebarGitCommit, confirmSidebarGitCommit, and setSidebarSectionCollapsed. Storybook retains sidebarStoryMessages collection and STORYBOOK_DRAG_SETTLE_DELAY_MS = 900 while no longer printing mirrored debug echoes to the browser console.

### Examples

Example preserved path: postSidebarDebugLog("session.dragIndicatorChanged", { indicator: sessionDragIndicator }) still calls logSidebarDebug(debuggingMode, event, details) and then posts { details, event, type: "sidebarDebugLog" }. Example regression assertion: logSidebarDebug(true, "session.dragIndicatorChanged", { indicator: { groupId: "group-1", kind: "session", position: "after", sessionId: "session-09" } }) does not call console.debug.

## Facts

- **sidebar_debug_logging**: logSidebarDebug(enabled, \_event, \_payload?) no longer writes to console.debug and performs no action when enabled. [project]
- **sidebar_debug_message_flow**: sidebar/sidebar-app.tsx still calls logSidebarDebug before posting sidebarDebugLog messages to the extension. [project]
- **storybook_sidebar_debug_echo**: sidebar/sidebar-story-harness.tsx still calls logSidebarDebug for sidebarDebugLog messages, but browser console output is suppressed. [project]
- **sidebar_debug_regression_test**: Regression coverage for sidebar debug console suppression was added in sidebar/sidebar-debug.test.ts. [project]
