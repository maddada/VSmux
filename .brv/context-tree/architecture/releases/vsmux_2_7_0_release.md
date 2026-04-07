---
title: VSmux 2.7.0 Release
tags: []
related:
  [
    architecture/chat_history/viewer_search_and_resume_actions.md,
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/default_agent_commands_overrides.md,
    architecture/terminal_workspace/sidebar_active_sessions_sort_mode.md,
    architecture/terminal_workspace/sidebar_session_card_last_interaction_timestamps.md,
    architecture/terminal_workspace/vsmux_ai_devtools_integration.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-07T03:06:16.605Z"
updatedAt: "2026-04-07T03:06:16.605Z"
---

## Raw Concept

**Task:**
Document the VSmux 2.7.0 release, release notes, publish procedure, package metadata, commands, views, activation events, settings, keybindings, and README product highlights.

**Changes:**

- Released VSmux 2.7.0 using the repository publish flow
- Updated package.json, CHANGELOG.md, and README.md for the 2.7.0 release
- Built-in VSmux Search shipped with integrated conversation viewer and workspace bridges
- Sidebar session sorting, timestamps, reload behavior, titles, and browser grouping were polished
- Workspace focus recovery, T3 clipboard writes, lag diagnostics, and backend activity tracking were improved
- Built-in agent command definitions can now be overridden through configuration

**Files:**

- package.json
- CHANGELOG.md
- README.md
- scripts/publish-extension.mjs
- docs/2026-04-03-how-to-update-t3-code.md
- patches/restty@0.1.35.patch

**Flow:**
derive release notes since v2.6.0 -> update package.json/CHANGELOG.md/README.md -> ensure clean worktree and unique tag on a branch -> package with pnpm run vsix:package -> publish with scripts/publish-extension.mjs -> tag release -> push branch with follow-tags -> monitor Marketplace/Open VSX propagation

**Timestamp:** 2026-04-07

**Patterns:**

- `Refusing to publish with uncommitted changes\. Commit or stash your work first\.` - Publish script failure message when git status is not clean
- `Git tag v2\.7\.0 already exists\.` - Publish script failure message when the release tag already exists
- `Refusing to publish from a detached HEAD\. Check out a branch first\.` - Publish script failure message when not on a named branch

## Narrative

### Structure

The 2.7.0 release bundle captures release notes plus a snapshot of package.json identity, packaged files, scripts, dependencies, contributed commands, views, activation events, configuration keys, keybindings, README product guidance, and a publish script that tags and pushes the release after marketplace publication. The release notes emphasize search, sidebar polish, workspace focus/clipboard reliability, backend activity tracking, and built-in command overrides as the main user-facing changes since v2.6.0.

### Dependencies

Publishing depends on a clean git worktree, a non-existent release tag, a checked-out branch, VSCE credentials via VSCE_PAT, the repo-level publish script, and the packaging pipeline driven by pnpm/vite-plus plus TypeScript compilation. Packaging includes media assets, chat-history build output, vendored T3 embed output, workspace output, the compiled extension out directory, and a patched restty dependency at patches/restty@0.1.35.patch.

### Highlights

As of 2026-04-07, VSmux Search is built in and contributed through the VSmuxSearch command set and conversations webview. Session management polish in 2.7.0 includes active-session sorting, live timestamps, stronger ordering and reload actions, cleaner titles, and better browser grouping. Workspace behavior is documented as steadier via focus recovery, T3 clipboard reliability, lag diagnostics, and backend activity tracking. Open VSX reflected version 2.7.0 immediately after publish, while the VS Code Marketplace still showed 2.6.0, indicating propagation lag rather than a failed release.

### Rules

Publishing from a clean tree required:

1. stash local `.brv` index changes
2. stash generated `out` file modifications
3. publish from the release commit
4. restore the `.brv` changes
5. leave fresh `out/` build diffs in the working tree

`scripts/publish-extension.mjs` enforces:

- clean git worktree
- tag must not already exist
- publish must not run from detached HEAD

### Examples

Packaging command: `pnpm run vsix:package`
Marketplace publish: `scripts/publish-extension.mjs`
Open VSX publish: `npx ovsx publish installer/VSmux-2.7.0.vsix`
Example product URLs: `https://marketplace.visualstudio.com/items?itemName=maddada.VSmux` and `https://open-vsx.org/extension/maddada/VSmux`
Example configuration defaults: `VSmux.backgroundSessionTimeoutMinutes=5`, `VSmux.gitTextGenerationProvider=codex`, `VSmux.sendRenameCommandOnSidebarRename=true`, `VSmux.createSessionOnSidebarDoubleClick=false`

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
