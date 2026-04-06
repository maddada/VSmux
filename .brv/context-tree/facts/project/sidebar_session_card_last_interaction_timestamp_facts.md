---
title: Sidebar Session Card Last Interaction Timestamp Facts
tags: []
keywords: []
importance: 75
recency: 1
maturity: validated
updateCount: 5
createdAt: "2026-04-06T03:48:19.302Z"
updatedAt: "2026-04-06T22:52:16.075Z"
---

## Raw Concept

**Task:**
Capture factual updates for sidebar last-interaction timestamps and terminal activity sourcing

**Changes:**

- Discrete timestamp color bands were introduced
- A 1-second UI tick now keeps relative labels live
- Storybook preserves lastInteractionAt
- Terminal activity uses persisted session state mtimes as a better signal

**Flow:**
activity signal changes -> timestamp source selection -> sidebar relative label rerender -> visual age band update

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry tracks the concrete behavioral rules behind sidebar last-activity rendering and terminal-card timestamp sourcing.

### Highlights

It preserves the exact age-band thresholds, the 1-second label refresh behavior, the Playwriter verification outcome, and the fallback rule for missing activity signals.

## Facts

- **sidebar_timestamp_color_model**: Sidebar timestamp colors now use discrete age buckets instead of continuous blending [project]
- **sidebar_timestamp_color_bands**: Timestamp color bands are bright green for 0-15 minutes, slightly faded green for 15-30 minutes, more muted green for 30-60 minutes, and gray after 1 hour [project]
- **sidebar_relative_time_tick**: The sidebar UI now has a 1-second tick hook so rendered relative time labels advance in place [project]
- **storybook_last_interaction_passthrough**: Storybook sidebar-story-workspace now preserves lastInteractionAt [project]
- **playwriter_sidebar_activity_verification**: Playwriter verification showed SelectorStates had distinct colors and Default advanced from 31s ago to 33s ago after about 2.2 seconds [project]
- **terminal_activity_timestamp_source**: Native terminal activity sourcing now seeds and refreshes from persisted session state file mtimes when agent status or title changes [project]
- **terminal_activity_fallback_rule**: Terminal cards fall back to session creation time only when no better activity signal exists [project]
