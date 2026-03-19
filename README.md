# Agent Canvas X

This repo is a VS Code extension that manages detached native editor-area terminals in a logical `3x3` workspace. Up to `4` sessions can be visible at once, while the detached PTY daemon keeps session processes alive across VS Code restarts unless the configured background idle timeout shuts them down.

## Tooling baseline

- VS Code `1.110+`
- pnpm `10.14`
- Vite+ (`vp`) for format, lint, staged-file checks, and dependency management
- TypeScript `5.9`

The extension host still compiles through TypeScript so VS Code can load `out/extension/extension.js`, but the day-to-day project workflow follows Vite+ for checks, hooks, and editor defaults.

## Architecture

- `extension/native-terminal-workspace.ts` reconciles daemon-backed sessions into native editor terminals in the main panel.
- `extension/session-sidebar-view.ts` renders the left sidebar HUD and session list.
- `extension/session-grid-store.ts` persists workspace state through VS Code storage.
- `extension/terminal-host-daemon.ts` owns detached PTY lifetimes and background idle shutdown.
- `shared/session-grid-state.ts` contains pure session-grid logic used by both the store and unit tests.
- `shared/session-grid-state.test.ts` covers slot allocation, visible-count normalization, reveal/focus swapping, and directional navigation.

## Background session timeout

Set `agentCanvasX.backgroundSessionTimeoutMinutes` in VS Code settings to control how long detached sessions stay alive after the last Agent Canvas X window disconnects.

- `0` keeps sessions alive until they exit naturally or you explicitly close/reset them.
- Any positive value starts a daemon-owned shutdown timer when the last authenticated client disconnects.
- Reopening VS Code and reconnecting before the timer expires cancels the pending shutdown.

## Running the project

1. Run `vp install`.
2. Run `vp check`.
3. Run `vp run watch` to compile the extension in watch mode.
4. Press `F5` in VS Code to launch an Extension Development Host.
5. Run `Agent Canvas X: Open Workspace` from the Command Palette.

There is no separate canvas app or bundled terminal frontend in this repo anymore. The only webview surface is the lightweight sidebar view used for the HUD and session list.

## Hooks and editor setup

- `.vite-hooks/pre-commit` runs `vp staged`
- `prepare` runs `vp config`
- `.vscode/settings.json` enables OXC format-on-save
- `.vscode/extensions.json` recommends the Vite+ extension pack

## Commands

- `vp install`
- `vp check`
- `vp lint`
- `vp fmt`
- `vp test`
- `vp run compile`
- `vp run watch`
