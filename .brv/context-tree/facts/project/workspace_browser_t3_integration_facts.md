---
title: Workspace Browser T3 Integration Facts
tags: []
related: [architecture/terminal_workspace/workspace_browser_t3_integration.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:37:59.250Z"
updatedAt: "2026-04-06T01:37:59.250Z"
---

## Raw Concept

**Task:**
Capture durable project facts for workspace/browser/T3 integration state and constants.

**Changes:**

- Recorded browser sidebar exclusion policy.
- Recorded workspace panel identity and resource roots.
- Recorded T3 websocket monitoring constants and behavior.
- Recorded authoritative workspace rendering source.

**Files:**

- extension/live-browser-tabs.ts
- extension/workspace-panel.ts
- extension/t3-activity-monitor.ts
- sidebar/sidebar-app.tsx

**Flow:**
code-level integration decisions -> curated project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact set stores stable configuration and behavior that other terminal workspace notes can reference without repeating implementation detail. It focuses on identifiers, constants, and integration decisions that define expected UI and controller behavior.

### Dependencies

These facts derive from the browser tab integration, workspace panel manager, T3 activity monitor, and sidebar app. They should be updated when panel identity, websocket methods, exclusion heuristics, or sidebar rendering sources change.

### Highlights

The key durable decisions are that internal VSmux surfaces stay out of the browser tab group, the workspace panel is branded as VSmux under vsmux.workspace, T3 state is live via websocket snapshots and domain events, and sidebar workspace groups trust authoritative session payloads.

## Facts

- **browser_sidebar_exclusion_policy**: Browser sidebar excludes internal VSmux workspace and T3-owned tabs. [project]
- **workspace_panel_restoration_identity**: Workspace panel restoration uses panel type vsmux.workspace and title VSmux. [project]
- **t3_activity_source**: T3 activity state is websocket-backed through T3ActivityMonitor rather than hardcoded idle. [project]
- **t3_focus_acknowledgement**: T3 focus acknowledgement uses completion-marker-aware acknowledgeThread behavior. [project]
- **workspace_group_render_source**: Workspace groups render from authoritative sessionIdsByGroup payload. [project]
- **workspace_panel_local_resource_roots**: Workspace panel local resource roots are out/workspace and forks/t3code-embed/dist. [project]
- **workspace_panel_retain_context_when_hidden**: Workspace panel retainContextWhenHidden is false. [project]
- **t3_monitor_protocol_behavior**: T3 activity monitor responds to Ping with pong and debounces refreshes on domain-event chunks. [project]
