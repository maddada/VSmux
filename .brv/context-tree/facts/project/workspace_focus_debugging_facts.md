---
title: Workspace Focus Debugging Facts
tags: []
related: [architecture/terminal_workspace/workspace_focus_debugging.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:48:58.868Z"
updatedAt: "2026-04-06T01:48:58.868Z"
---

## Raw Concept

**Task:**
Record factual configuration and API details for workspace focus debugging behavior

**Changes:**

- Recorded focus guard timing constant
- Recorded lag auto-reload configuration
- Recorded T3 iframe focus message type
- Recorded activation source enum values

**Files:**

- workspace/workspace-app.tsx

**Flow:**
constants and message shapes extracted -> facts normalized -> stored for later recall

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry captures stable configuration values and message/API identifiers from the workspace focus debugging changes so they can be recalled independently of the longer architectural narrative.

### Dependencies

These facts depend on the workspace panel runtime in workspace/workspace-app.tsx and the VS Code webview message channel used for focusSession, ready, and reloadWorkspacePanel messages.

### Highlights

The stored facts preserve the 400 ms auto-focus activation guard, enabled auto reload on lag, the vsmuxT3Focus iframe event type, and the focusin/pointer terminal activation source values.

## Facts

- **workspace_focus_debugging_file**: Workspace focus debugging changes were made in workspace/workspace-app.tsx [project]
- **auto_focus_activation_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400 [project]
- **auto_reload_on_lag**: AUTO_RELOAD_ON_LAG is true [project]
- **t3_iframe_focus_message_type**: T3 iframe focus messages use type vsmuxT3Focus [project]
- **workspace_terminal_activation_source**: Workspace terminal activation source is focusin or pointer [project]
