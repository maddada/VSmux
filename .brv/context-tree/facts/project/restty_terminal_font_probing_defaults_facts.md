---
title: Restty Terminal Font Probing Defaults Facts
tags: []
related: [architecture/terminal_workspace/restty_terminal_font_probing_defaults.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T22:51:12.179Z"
updatedAt: "2026-04-06T22:51:12.179Z"
---

## Raw Concept

**Task:**
Record project facts for Restty terminal font probing defaults and matcher constants.

**Changes:**

- Recorded default terminal font stack constant.
- Recorded default local matcher constant.
- Recorded return behavior for default versus custom font configuration.

**Files:**

- workspace/restty-terminal-config.ts
- workspace/restty-terminal-config.test.ts

**Flow:**
font family input -> default/custom classification -> emitted Restty font source facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry captures stable constants and behavior switches used by workspace/restty-terminal-config.ts.

### Dependencies

These facts depend on Restty font source generation and the workspace terminal font-family setting.

### Highlights

The code explicitly treats the bundled default stack and undefined font family as a no-local-probing case while preserving custom probing semantics.

## Facts

- **default_terminal_font_families_constant**: DEFAULT_TERMINAL_FONT_FAMILIES is defined as MesloLGL Nerd Font Mono, Menlo, Monaco, and Courier New. [project]
- **default_local_font_matchers**: DEFAULT_LOCAL_FONT_MATCHERS is defined as MesloLGL Nerd Font Mono and MesloLGL Nerd Font. [project]
- **bundled_default_font_source_result**: Bundled default or unset font-family configuration returns only the Meslo fallback URL source. [project]
- **custom_font_source_required_flag**: Custom font-family configuration retains an optional local font source with required set to false. [project]
