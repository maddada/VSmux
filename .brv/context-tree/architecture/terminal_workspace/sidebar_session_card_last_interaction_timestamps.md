---
title: Sidebar Session Card Last Interaction Timestamps
tags: []
keywords: []
importance: 75
recency: 1
maturity: validated
updateCount: 5
createdAt: "2026-04-06T03:48:19.300Z"
updatedAt: "2026-04-06T22:52:16.073Z"
---

## Raw Concept

**Task:**
Document latest sidebar last-activity UX behavior and terminal activity timestamp sourcing

**Changes:**

- Changed timestamp color bands to discrete age buckets
- Added 1-second UI tick hook so relative time labels advance in place
- Fixed Storybook sidebar-story-workspace to preserve lastInteractionAt
- Verified live that color states are distinct and relative labels update over time
- Native terminal activity sourcing now seeds and refreshes from persisted session state file mtimes when agent status or title changes

**Files:**

- extension/native-terminal-workspace/sidebar-message-dispatch.ts
- extension/native-terminal-workspace/activity.ts

**Flow:**
session activity changes -> lastInteractionAt updates -> 1s UI tick rerenders relative labels -> sidebar cards show discrete age colors -> persisted session state mtimes seed and refresh terminal activity timestamps

**Timestamp:** 2026-04-06

## Narrative

### Structure

Sidebar session cards now render last-activity timestamps with discrete visual age bands instead of a continuously blended appearance. The UI includes a 1-second tick hook so relative labels such as seconds-ago values advance in place while the sidebar remains mounted. Storybook propagation through sidebar-story-workspace now preserves lastInteractionAt, which keeps component demos aligned with real runtime behavior.

### Dependencies

The sidebar display depends on lastInteractionAt being preserved through Storybook workspace wiring and on native terminal activity updates receiving refreshed timestamps from persisted session state file mtimes. Terminal cards still fall back to session creation time only when no better activity signal is available.

### Highlights

The timestamp bands are bright green for 0-15 minutes, slightly faded green for 15-30 minutes, more muted green for 30-60 minutes, and gray after 1 hour. Live verification with Playwriter confirmed distinct selector colors and that a default relative label advanced from 31s ago to 33s ago after roughly 2.2 seconds. Native terminal activity sourcing now uses real activity and completion updates rather than stale creation-time timestamps whenever persisted state mtimes provide a stronger signal.

## Facts

- **sidebar_timestamp_color_model**: Sidebar timestamp colors now use discrete age buckets instead of continuous blending [project]
- **sidebar_timestamp_color_bands**: Timestamp color bands are bright green for 0-15 minutes, slightly faded green for 15-30 minutes, more muted green for 30-60 minutes, and gray after 1 hour [project]
- **sidebar_relative_time_tick**: The sidebar UI now has a 1-second tick hook so rendered relative time labels advance in place [project]
- **storybook_last_interaction_passthrough**: Storybook sidebar-story-workspace now preserves lastInteractionAt [project]
- **playwriter_sidebar_activity_verification**: Playwriter verification showed SelectorStates had distinct colors and Default advanced from 31s ago to 33s ago after about 2.2 seconds [project]
- **terminal_activity_timestamp_source**: Native terminal activity sourcing now seeds and refreshes from persisted session state file mtimes when agent status or title changes [project]
- **terminal_activity_fallback_rule**: Terminal cards fall back to session creation time only when no better activity signal exists [project]
