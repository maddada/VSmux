---
children_hash: 0526e0d760c2b4eb9f0db6b594b8ecd3cca2007242de595a69ac599e782747cf
compression_ratio: 0.7811912225705329
condensation_order: 1
covers: [context.md, vsmux_2_7_0_release.md]
covers_token_total: 1595
summary_level: d1
token_count: 1246
type: summary
---

# releases

Tracks shipped VSmux releases, combining release notes with the release-time snapshot of packaging, publishing, extension metadata, commands, views, activation events, settings, and README positioning.

## Scope and relationships

- This topic is the release-history layer for shipped extension behavior.
- It connects productized changes to deeper architecture topics:
  - `architecture/chat_history/viewer_search_and_resume_actions.md`
  - `architecture/terminal_workspace/current_state.md`
  - `architecture/terminal_workspace/default_agent_commands_overrides.md`
  - `architecture/terminal_workspace/sidebar_active_sessions_sort_mode.md`
  - `architecture/terminal_workspace/sidebar_session_card_last_interaction_timestamps.md`
  - `architecture/terminal_workspace/vsmux_ai_devtools_integration.md`

## Core structure

- `context.md`
  - Defines the topic as release tracking for VSmux.
  - Emphasizes:
    - release notes
    - publish workflow
    - extension metadata
    - configuration surface
    - commands and activation

- `vsmux_2_7_0_release.md`
  - Canonical entry for the `2026-04-07` VSmux `2.7.0` release.
  - Documents:
    - release notes since `v2.6.0`
    - release process and guardrails
    - package metadata and contributed surface
    - shipped user-facing features and defaults

## VSmux 2.7.0 release summary

### Release identity

- Version: `2.7.0`
- Release date: `2026-04-07`
- Main files referenced:
  - `package.json`
  - `CHANGELOG.md`
  - `README.md`
  - `scripts/publish-extension.mjs`
  - `docs/2026-04-03-how-to-update-t3-code.md`
  - `patches/restty@0.1.35.patch`

### Main shipped themes

From `vsmux_2_7_0_release.md`, the release centers on:

- Built-in `VSmux Search` with integrated conversation viewer and workspace bridges.
- Terminal workspace and sidebar polish:
  - active-session sorting
  - last-interaction timestamps
  - reload/order stability
  - title cleanup
  - browser grouping improvements
- Workspace/runtime reliability:
  - focus recovery
  - T3 clipboard write reliability
  - lag diagnostics
  - backend activity tracking
- Configuration extensibility:
  - built-in agent command definitions can be overridden through settings

## Publish and packaging workflow

The release flow is explicitly:

1. derive release notes since `v2.6.0`
2. update `package.json`, `CHANGELOG.md`, and `README.md`
3. ensure clean worktree and unique tag on a branch
4. package with `pnpm run vsix:package`
5. publish with `scripts/publish-extension.mjs`
6. tag release
7. push branch with follow-tags
8. monitor Marketplace and Open VSX propagation

### Publish constraints and enforced checks

`vsmux_2_7_0_release.md` preserves hard release guardrails:

- clean git worktree required
- release tag must not already exist
- publish must run from a checked-out branch, not detached `HEAD`

Associated failure patterns:

- `Refusing to publish with uncommitted changes. Commit or stash your work first.`
- `Git tag v2.7.0 already exists.`
- `Refusing to publish from a detached HEAD. Check out a branch first.`

### Release-commit operating rules

The entry also records a practical release procedure:

1. stash local `.brv` index changes
2. stash generated `out` changes
3. publish from the release commit
4. restore `.brv` changes
5. leave fresh `out/` build diffs in the working tree

## Packaging/runtime dependencies

Key release dependencies captured in `vsmux_2_7_0_release.md`:

- credentials via `VSCE_PAT`
- packaging/build flow based on `pnpm`, `vite-plus`, and TypeScript compilation
- packaged assets include:
  - media assets
  - `chat-history` build output
  - vendored T3 embed output
  - workspace output
  - compiled extension `out/`
- patched dependency:
  - `patches/restty@0.1.35.patch`

## Extension/product metadata captured at release time

Important release-time facts:

- package manager: `pnpm@10.14.0`
- VS Code engine target: `^1.100.0`
- built-in search is part of the product as of `2.7.0`
- default git text generation provider: `codex`

### Configuration evolution

The release records a settings migration:

- deprecated:
  - `VSmux.gitTextGenerationAgentId`
- replacement settings:
  - `VSmux.gitTextGenerationProvider`
  - `VSmux.gitTextGenerationCustomCommand`

Example defaults preserved in the release entry:

- `VSmux.backgroundSessionTimeoutMinutes=5`
- `VSmux.gitTextGenerationProvider=codex`
- `VSmux.sendRenameCommandOnSidebarRename=true`
- `VSmux.createSessionOnSidebarDoubleClick=false`

## Distribution outcome

`vsmux_2_7_0_release.md` distinguishes successful publishing from storefront lag:

- Open VSX showed `2.7.0` immediately after publish.
- VS Code Marketplace still showed `2.6.0` right after publishing.
- Interpretation: propagation delay, not publish failure.

## Drill-down map

Use these entries for details:

- `context.md` — topic purpose and related architecture areas
- `vsmux_2_7_0_release.md` — full 2.7.0 release notes, publish workflow, metadata, defaults, and release constraints
