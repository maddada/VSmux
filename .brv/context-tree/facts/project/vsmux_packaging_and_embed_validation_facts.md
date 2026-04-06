---
title: VSmux Packaging And Embed Validation Facts
tags: []
related: [architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:06:38.395Z"
updatedAt: "2026-04-06T02:06:38.395Z"
---

## Raw Concept

**Task:**
Record key VSmux packaging, activation, container, and configuration facts from package metadata and VSIX workflow notes

**Changes:**

- Added packaging metadata facts for VSmux extension identity and containers
- Recorded activation events and dependency override facts
- Captured T3 embed validation and VSIX workflow facts for quick recall

**Files:**

- package.json
- scripts/vsix.mjs

**Flow:**
package metadata defines extension identity and configuration -> scripts/vsix.mjs builds and packages VSIX -> install step deploys extension -> installed asset hash confirms actual embed bundle in use

**Timestamp:** 2026-04-06

**Author:** maddada

## Narrative

### Structure

This fact entry condenses stable extension metadata, container ids, activation hooks, dependency overrides, and operational packaging checkpoints that are easy to query later without reopening package.json and scripts/vsix.mjs. It complements the architecture topic by emphasizing exact values and identifiers rather than broader workflow description.

### Dependencies

These facts depend on package.json remaining aligned with scripts/vsix.mjs packaging behavior and on the installed VSIX actually containing the current forks/t3code-embed/dist output. When debugging webview drift, the installed extension directory is the authoritative source rather than localhost browser output.

### Highlights

The current documented embed drift case is 2026-04-06 with index-DCV3LG5L.js in the refreshed worktree and index-BbtZ0IEL.js in a stale installed extension. That mismatch is the key operational signal that reinstalling the intended VSIX is required before further UI diagnosis.

## Facts

- **extension_display_name**: VSmux display name is VSmux - T3code & Agent CLIs Manager. [project]
- **extension_publisher**: The extension publisher is maddada. [project]
- **repository_url**: The extension repository URL is https://github.com/maddada/VSmux.git. [project]
- **extension_main**: The extension main entry is ./out/extension/extension.js. [project]
- **extension_icon**: The package icon is media/VSmux-marketplace-icon.png. [project]
- **primary_container_and_view**: The Activity Bar container id is VSmuxSessions and the view id is VSmux.sessions. [project]
- **secondary_container**: The secondary sidebar container id is VSmuxSessionsSecondary. [project]
- **activation_events**: Activation events are onStartupFinished, onView:VSmux.sessions, and onWebviewPanel:vsmux.workspace. [project]
- **pnpm_overrides**: pnpm overrides vite to npm:@voidzero-dev/vite-plus-core@latest and vitest to npm:@voidzero-dev/vite-plus-test@latest. [project]
- **patched_dependency**: restty@0.1.35 is patched via patches/restty@0.1.35.patch. [project]
- **git_text_generation_provider**: VSmux.gitTextGenerationProvider defaults to codex and supports codex, claude, and custom. [project]
- **sidebar_rename_behavior**: VSmux.sendRenameCommandOnSidebarRename defaults to true. [project]
