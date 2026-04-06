---
title: Restty Terminal Font Probing Defaults
tags: []
related:
  [architecture/terminal_workspace/context.md, architecture/terminal_workspace/current_state.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T22:51:12.178Z"
updatedAt: "2026-04-06T22:51:12.178Z"
---

## Raw Concept

**Task:**
Document Restty terminal font source selection and suppression of optional local-font probing for the bundled default stack.

**Changes:**

- Added usesBundledDefaultFontStack to detect when VSmux is using the built-in default terminal font stack.
- Updated getResttyFontSources to return only the bundled Meslo fallback URL source for default or unset font-family configuration.
- Preserved optional local font probing for custom configured font families.
- Added focused tests covering bundled default stack, undefined font family, and custom font family behavior.

**Files:**

- workspace/restty-terminal-config.ts
- workspace/restty-terminal-config.test.ts

**Flow:**
read configured font family -> parse and normalize family names -> filter generic and duplicate families -> compare against bundled default stack -> return bundled fallback only for default/unset or local configured source plus fallback for custom fonts

**Timestamp:** 2026-04-06

**Patterns:**

- `"[^"]+"|'[^']+'|[^,]+` - Splits a CSS font-family string into quoted or comma-delimited family tokens for matcher generation.

## Narrative

### Structure

Terminal font source selection lives in workspace/restty-terminal-config.ts. The module defines GENERIC_FONT_FAMILIES, DEFAULT_TERMINAL_FONT_FAMILIES, and DEFAULT_LOCAL_FONT_MATCHERS, then uses getConfiguredFontFamilies, familiesMatch, and usesBundledDefaultFontStack to decide whether Restty should probe local fonts or rely only on the bundled Meslo URL font.

### Dependencies

The implementation depends on Restty font source objects, the bundled MesloLGLNerdFontMono-Regular.ttf asset, and the configured terminal font-family string supplied by the workspace UI. Matching is case-insensitive, generic CSS families are excluded, and duplicate family names are removed before behavior is decided.

### Highlights

This change removes recurring restty warnings about missing optional local fonts during normal use of the built-in terminal font stack. Undefined font-family configuration is treated as the bundled default case, while custom families such as Fira Code still attempt an optional local match before falling back to Meslo.

### Rules

If usesBundledDefaultFontStack(fontFamily) is true, getResttyFontSources must return only the bundled Meslo fallback source. If a custom non-generic font family is configured, getResttyFontSources must prepend an optional local source with matchers derived from the parsed configured families. Family comparison is case-insensitive and requires the parsed family sequence to match the full built-in default stack.

### Examples

Example default input: "MesloLGL Nerd Font Mono", Menlo, Monaco, "Courier New", monospace -> returns only [{ label: "Meslo fallback", type: "url" }]. Example unset input: undefined -> returns only the bundled fallback. Example custom input: "Fira Code", monospace -> returns [{ label: "Configured font", matchers: ["Fira Code"], required: false, type: "local" }, { label: "Meslo fallback", type: "url" }].

## Facts

- **default_terminal_font_stack**: The built-in default terminal font stack is MesloLGL Nerd Font Mono, Menlo, Monaco, and Courier New. [project]
- **restty_default_font_probing_behavior**: When the configured font family is unset or matches the built-in default stack, Restty only uses the bundled Meslo fallback URL font source and skips optional local probing. [project]
- **restty_custom_font_probing_behavior**: Custom configured font families still produce an optional local Restty font source before the bundled Meslo fallback source. [project]
- **generic_font_family_filtering**: Generic font families such as monospace and serif are filtered out when parsing configured terminal font families. [project]
