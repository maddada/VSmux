---
title: Vsix Packaging And T3 Embed Validation
tags: []
related:
  [
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
    architecture/terminal_workspace/current_state.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T02:06:38.394Z"
updatedAt: "2026-04-06T02:06:38.394Z"
---

## Raw Concept

**Task:**
Document VSmux package metadata, VSIX packaging and installation workflow, and T3 embed refresh validation procedure

**Changes:**

- Added T3 embed refresh validation guidance tied to installed asset hashes
- Documented scripts/vsix.mjs package and install workflow
- Captured current package metadata, packaged files, commands, settings, and install behavior

**Files:**

- package.json
- scripts/vsix.mjs
- scripts/vscode-prepublish.mjs
- scripts/vendor-runtime-deps.mjs
- scripts/storybook-live.mjs
- scripts/storybook-test.mjs
- scripts/workspace-reconnect-harness.mjs
- scripts/build-t3-embed.mjs
- scripts/publish-extension.mjs
- tsconfig.extension.json
- vite.sidebar.config.ts
- vite.debug-panel.config.ts
- vite.workspace.config.ts
- patches/restty@0.1.35.patch

**Flow:**
edit source and build assets -> pnpm run compile -> vp exec vsce package -> write VSIX under installer/ -> optionally auto-detect editor CLI -> install VSIX with --force -> verify installed T3 embed asset hash -> only then debug webview UI behavior

**Timestamp:** 2026-04-06

**Author:** maddada

**Patterns:**

- `^~\/.vscode\/extensions\/maddada\.vsmux-.*\/forks\/t3code-embed\/dist\/assets\/index-.*\.js$` - Installed T3 embed asset path to inspect when validating that the active VSIX contains the expected webview bundle.

## Narrative

### Structure

VSmux is packaged as a VS Code extension with out/extension/extension.js as the main entrypoint and includes bundled webview assets from forks/t3code-embed/dist plus workspace and media outputs. The package.json also defines the command surface, activity bar and secondary sidebar containers, key runtime settings for sessions, sidebar UI, terminal appearance, workspace layout, audio, agents, Git text generation, and rename behavior.

### Dependencies

Packaging depends on pnpm, vp, vsce, tsconfig.extension.json, the Vite config files, and the scripts that build sidebar, debug panel, workspace, and T3 embed assets. Install mode additionally depends on either VSMUX_CODE_CLI or successful detection of a supported editor CLI such as code, code-insiders, cursor, cursor-insiders, codium, or windsurf, with extra absolute-path candidates on macOS.

### Highlights

As of 2026-04-06, a refreshed worktree embed produced index-DCV3LG5L.js while a stale installed extension still served index-BbtZ0IEL.js, which explains why localhost browser checks can diverge from the VS Code webview. scripts/vsix.mjs handles both package and install modes, supports --profile-build for unminified source-mapped bundles, creates installer/ when missing, and falls back to a timestamped output if the default package target is locked with EPERM.

### Rules

Procedure:

1. Reinstall the intended VSIX.
2. Verify the installed asset hash.
3. Only then debug UI behavior.

Usage: node ./scripts/vsix.mjs <package|install> [--profile-build]

If no editor CLI is found: Could not find an editor CLI. Install the 'code' or 'cursor' command, or set VSMUX_CODE_CLI to the editor binary path.

### Examples

Example installed-asset check path: ~/.vscode/extensions/maddada.vsmux-_/forks/t3code-embed/dist/assets/index-_.js. Example package command: vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>. Example install command: <vscodeCli> --install-extension <vsixPath> --force.

## Facts

- **extension_version**: VSmux package version is 2.5.0. [project]
- **vscode_engine**: The VS Code engine requirement is ^1.100.0. [project]
- **package_manager**: The package manager is pnpm@10.14.0. [project]
- **vsix_packaged_files**: The packaged extension includes forks/t3code-embed/dist/**, out/workspace/**, out/**, and media/**. [project]
- **t3_embed_worktree_hash**: Worktree refresh on 2026-04-06 produced index-DCV3LG5L.js for the T3 embed asset. [environment]
- **t3_embed_stale_hash**: A stale main install still served index-BbtZ0IEL.js. [environment]
- **vsix_script**: VSIX packaging and install are handled by scripts/vsix.mjs. [project]
- **vsix_modes**: Valid scripts/vsix.mjs modes are package and install. [convention]
- **vsix_profile_flag**: The optional profiling flag for scripts/vsix.mjs is --profile-build. [convention]
- **vsix_package_output**: Package mode writes installer/<name>-<version>.vsix unless the default path is locked. [project]
- **vsix_install_output**: Install mode writes a timestamped VSIX filename using Date.now(). [project]
- **vsix_locked_fallback**: If removing the default VSIX path fails with EPERM, scripts/vsix.mjs falls back to a timestamped path and warns that the existing VSIX is locked. [project]
- **vsix_build_command**: The build step for VSIX packaging runs pnpm run compile. [project]
- **profile_build_env**: Profile builds set VSMUX_PROFILE_BUILD=1. [project]
- **vsix_package_command**: The package step runs vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>. [project]
- **skip_prepublish_env**: VSIX packaging sets VSMUX_SKIP_PREPUBLISH=1 for the package step. [project]
- **profile_build_notice**: When profile build is enabled, scripts/vsix.mjs prints that webview bundles are unminified with source maps. [project]
- **editor_cli_resolution**: Install mode auto-detects an editor CLI unless VSMUX_CODE_CLI is set. [convention]
- **editor_cli_failure_message**: If no editor CLI is found, scripts/vsix.mjs fails with guidance to install code or cursor or set VSMUX_CODE_CLI. [convention]
- **vsix_install_command**: Install mode runs <vscodeCli> --install-extension <vsixPath> --force. [project]
- **t3_embed_validation_path**: T3 embed refresh validation should verify the installed asset hash under ~/.vscode/extensions/maddada.vsmux-_/forks/t3code-embed/dist/assets/index-_.js before UI debugging. [convention]
- **browser_vs_webview_mismatch**: A browser localhost check can disagree with the VS Code webview when the installed VSIX still contains an older embed dist. [environment]
