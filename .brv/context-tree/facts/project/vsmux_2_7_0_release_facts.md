---
title: VSmux 2.7.0 Release Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-07T03:06:16.607Z"
updatedAt: "2026-04-07T03:06:16.607Z"
---

## Raw Concept

**Task:**
Capture discrete project and workflow facts from the VSmux 2.7.0 release context.

**Changes:**

- Added durable facts for release version, publish constraints, marketplace behavior, and extension defaults.

**Files:**

- package.json
- scripts/publish-extension.mjs
- README.md
- CHANGELOG.md

**Flow:**
extract release facts -> deduplicate -> group by subject -> store in facts/project

**Timestamp:** 2026-04-07

## Narrative

### Structure

Captured 10 release-related facts across 10 subjects covering versioning, publish constraints, marketplace propagation, engine/package metadata, and git text generation defaults. These facts are intended for direct recall without re-reading the full release snapshot.

### Highlights

The stored facts emphasize the 2.7.0 release date/version, the clean-tree/tag/branch constraints enforced by the publish script, the immediate Open VSX vs lagging Marketplace visibility after publish, and the default/deprecated git text generation settings.

### Examples

Representative subjects: release_version, publish_clean_tree_requirement, marketplace_propagation, package_manager, vscode_engine, git_text_generation_provider_default.

## Facts

- **release_version**: VSmux version 2.7.0 was released on 2026-04-07. [project]
- **publish_clean_tree_requirement**: The publish script requires a clean git worktree before publishing. [convention]
- **publish_branch_requirement**: The publish script refuses to run from detached HEAD. [convention]
- **publish_tag_uniqueness**: The publish script refuses to reuse an existing git tag for the release version. [convention]
- **built_in_search**: VSmux Search is built in as of 2.7.0. [project]
- **marketplace_propagation**: The Open VSX listing went live on 2.7.0 immediately after publish, while the VS Code Marketplace still showed 2.6.0 right after publish. [project]
- **package_manager**: The extension package manager is pnpm@10.14.0. [project]
- **vscode_engine**: The extension targets VS Code engine ^1.100.0. [project]
- **git_text_generation_provider_default**: The default git text generation provider is codex. [project]
- **git_text_generation_setting_deprecation**: The deprecated VSmux.gitTextGenerationAgentId setting should be replaced by VSmux.gitTextGenerationProvider and VSmux.gitTextGenerationCustomCommand. [project]
