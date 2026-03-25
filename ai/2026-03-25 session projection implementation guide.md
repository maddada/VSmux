# Session Projection Implementation Guide

This document explains how the current VSmux session-projection system works so you can edit it directly without rediscovering the architecture from logs.

The current feature set covers three session kinds:

- CLI sessions rendered through native VS Code terminals
- T3 Code sessions rendered through custom webviews
- Browser sessions rendered through the built-in simple browser

The main idea is:

- the store decides what should be visible and focused
- the controller turns that into a projection transaction
- each surface manager projects its own session kind into VS Code editor groups

The most important recent design decision is:

- the store is the source of truth
- observed VS Code focus/activation events are logged, but they should not drive store focus anymore

If you keep only one invariant in mind, keep this one.

## File Map

### Main controller

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

This is the orchestration layer.

It owns:

- the `SessionGridStore`
- the terminal backend
- the T3 webview manager
- the browser session manager
- the debug/layout trace
- the sidebar provider

This file is where session-card clicks, group switches, visible-count changes, fullscreen, code mode, and restore flow all come together.

### Store wrapper

- [extension/session-grid-store.ts](/Users/madda/dev/_active/agent-tiler/extension/session-grid-store.ts)

This is a thin persistence wrapper around the pure shared state functions in `shared/`.

Use this when you want to mutate workspace session state safely and persist it.

### Shared state / normalization

- [shared/grouped-session-workspace-state.ts](/Users/madda/dev/_active/agent-tiler/shared/grouped-session-workspace-state.ts)
- [shared/session-grid-state.ts](/Users/madda/dev/_active/agent-tiler/shared/session-grid-state.ts)
- [shared/session-grid-contract.ts](/Users/madda/dev/_active/agent-tiler/shared/session-grid-contract.ts)

These files define:

- session/group data structures
- normalization rules
- visible-session ordering rules
- display-id/title formatting
- store-level operations like focus/move/remove/create

If left/right or 2x2 ordering is wrong, this layer is one of the first places to inspect.

### Terminal backend

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace-backend.ts)

This is the projection engine for CLI sessions.

It is responsible for:

- attaching to existing managed terminals
- creating missing terminals
- moving terminal editor tabs between groups
- renaming managed terminals to canonical titles
- restoring focus to the correct terminal
- maintaining terminal session snapshots

This has historically been the stormiest part of the feature.

### T3 projection

- [extension/t3-webview-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/t3-webview-manager.ts)
- [extension/t3-runtime-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/t3-runtime-manager.ts)
- [ai/t3-embed-patches.md](/Users/madda/dev/_active/agent-tiler/ai/t3-embed-patches.md)

`t3-webview-manager.ts` owns editor placement of T3 webviews.

`t3-runtime-manager.ts` owns the local T3 backend/runtime process.

The embed patches document explains the local frontend modifications we made to the T3 web app.

### Browser projection

- [extension/browser-session-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/browser-session-manager.ts)

This owns simple-browser tab placement/reveal/reopen logic.

### Logging / debug state

- [extension/session-layout-trace.ts](/Users/madda/dev/_active/agent-tiler/extension/session-layout-trace.ts)
- [extension/runtime-trace.ts](/Users/madda/dev/_active/agent-tiler/extension/runtime-trace.ts)

These produce the debug logs in `logs/`.

The key logs are:

- `logs/session-layout.log`
- `logs/native-terminal-reconcile.log`
- `logs/t3-webview-reconcile.log`
- `logs/browser-session-reconcile.log`

### Helper functions

- [extension/terminal-workspace-helpers.ts](/Users/madda/dev/_active/agent-tiler/extension/terminal-workspace-helpers.ts)

This contains helper commands around:

- editor layout application
- editor group focus
- moving active editor left/right
- moving active terminal to editor/panel
- shell/workspace defaults

## Mental Model

The current system works in three layers.

### 1. Store layer

The store says:

- which group is active
- which sessions belong to each group
- which sessions are visible in the active group
- which visible session is focused
- what layout shape the active group wants

This is persisted state.

### 2. Controller layer

The controller says:

- take the active group snapshot from the store
- project it into the workbench
- restore focus to the store’s focused session
- verify what VS Code actually shows

This is where actions are serialized.

### 3. Surface managers

Each session kind has its own projection engine:

- terminal backend for CLI
- T3 webview manager for T3
- browser manager for browser tabs

Each manager receives the same active snapshot and is responsible only for its own session kind.

## The Core Control Flow

### `NativeTerminalWorkspaceController.focusSession(...)`

File:

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

This is the normal session-card activation path.

High-level flow:

1. `runLoggedAction(...)`
2. mutate store focus with `this.store.focusSession(sessionId)`
3. call `reconcileProjectedSessions(...)`
4. resume agent if needed
5. focus T3 composer if needed
6. acknowledge attention if needed
7. refresh sidebar

### `NativeTerminalWorkspaceController.reconcileProjectedSessions(...)`

This is the main projection transaction.

High-level flow:

1. if code mode is enabled, apply disabled mode and return
2. read the active group snapshot from the store
3. sync all session managers with the full store session list
4. ensure T3 runtime state is ready
5. apply the editor layout if the current workbench layout does not match the snapshot
6. reconcile visible terminals
7. reconcile visible T3 webviews
8. reconcile visible browser tabs
9. restore the focused session
10. verify expected vs observed visible tabs in logs

The important thing here is that this is now intended to be transactional. The controller should decide the target state once and then apply it.

### `NativeTerminalWorkspaceController.runLoggedAction(...)`

This is the current transaction queue.

It serializes user actions through `projectionActionQueue`.

Important behavior:

- top-level actions are queued
- nested actions inside another action reuse the same execution path instead of queueing again

This was added to avoid overlapping focus/reconcile operations.

## Store-Only Truth

The current controller is deliberately biased toward store-only truth.

That means:

- the store decides focused/visible sessions
- terminal activation events are observed but not used to update the store
- T3 panel focus events are observed but not used to update the store
- browser tab focus events are observed but not used to update the store

Relevant constructor hookups in:

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

Look at:

- `this.backend.onDidActivateSession(...)`
- T3 `onDidFocusSession`
- browser `onDidFocusSession`

Right now they log focus, but they do not rewrite store focus.

This is intentional. If you undo this, you are likely to reintroduce storms.

## Terminal Backend: How It Works

### Main methods

- `createOrAttachSession(...)`
- `ensureTerminal(...)`
- `attachManagedTerminal(...)`
- `resolveManagedSessionId(...)`
- `reconcileVisibleTerminals(...)`
- `placeTerminal(...)`
- `activateTerminalEditorTab(...)`
- `focusSession(...)`

All in:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace-backend.ts)

### Terminal identity rules

Current matching order in `resolveManagedSessionId(...)`:

1. managed terminal env identity
2. stored process-id association
3. process env identity read from the process itself
4. canonical title fallback

This is important because terminal titles are not stable on their own.

### Canonical title format

Titles are derived from session records via:

- `getTerminalSessionSurfaceTitle(...)`
- `getT3SessionSurfaceTitle(...)`

Defined in:

- [shared/session-grid-contract.ts](/Users/madda/dev/_active/agent-tiler/shared/session-grid-contract.ts)

Current format is the two-digit display-id format, for example:

- `01_ Scratchpad`
- `00_ T3: Adding prev sessions`

### What `reconcileVisibleTerminals(...)` does

It builds a placement list for all terminal sessions and sorts them before applying moves.

Each placement includes:

- whether the session is visible in the active snapshot
- whether it is focused
- what editor group it should target

Then it calls `placeTerminal(...)` for each terminal session.

### What `placeTerminal(...)` does

This is the heart of terminal placement.

It currently handles:

- materializing a terminal into the editor if it is only in the panel
- moving a terminal editor tab left/right between groups
- foregrounding visible terminals in their target group
- focusing the final active terminal
- restoring the previously active editor group when needed

### Current defensive settle waits

These were added because VS Code can transiently show the same terminal tab in both the source and target groups during a move.

Current wait helpers:

- `waitForActiveTerminal(...)`
- `waitForActiveEditorGroup(...)`
- `waitForTerminalInGroup(...)`
- `waitForTerminalMove(...)`
- `waitForTerminalTabForeground(...)`
- `waitForCondition(...)`

Why these exist:

- without them, the backend could issue the next activation/move command before VS Code had actually finished the previous one
- that caused repeated activations and “dancing” in 4-terminal layouts

### Current backend workarounds / defensive behavior

These are not elegant, but they were added for real bugs:

1. Terminal settle waits after moves and activations
   Reason:
   VS Code move commands do not settle synchronously.

2. `focusSession(...)` no-op if the terminal is already active
   Reason:
   calling `terminal.show(false)` repeatedly can replay terminal activation churn.

3. Rename is not driven from generic terminal-state changes anymore
   Reason:
   syncing titles from noisy terminal-state events caused activation loops.

4. Terminal identity prefers env/process identity over title
   Reason:
   title drift caused orphan-like misattachment.

If you see storms again, start in this file first.

## T3 Webviews: How They Work

### Main methods

- `syncSessions(...)`
- `reconcileVisibleSessions(...)`
- `ensurePlacement(...)`
- `createPanel(...)`
- `focusComposer(...)`
- `waitForSessionReady(...)`

File:

- [extension/t3-webview-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/t3-webview-manager.ts)

### Main behavior

The manager keeps one `ManagedPanel` per T3 session.

That record stores:

- the panel
- whether the embedded app is ready
- whether composer focus is pending
- a render key

### Important T3 behaviors

1. T3 focus events are observed only
   Reason:
   they should not mutate store focus.

2. The manager can recreate a panel if the current panel no longer matches the session render key or placement.

3. Composer focus is deferred until the embedded app sends `vsmuxReady`.

4. The T3 panel uses local built assets from:

- `forks/t3code-embed/dist`

See:

- [ai/t3-embed-patches.md](/Users/madda/dev/_active/agent-tiler/ai/t3-embed-patches.md)

for the local frontend patch ledger.

### Important T3 fragility

The webview manager is much simpler than the terminal backend, but it is still sensitive to:

- panel recreation timing
- reveal/focus order
- which editor group is active before creation

If you are debugging T3-only issues, use:

- `logs/t3-webview-reconcile.log`

## Browser Sessions: How They Work

### Main methods

- `syncSessions(...)`
- `reconcileVisibleSessions(...)`
- `ensurePlacement(...)`
- `openBrowserTab(...)`
- `revealTab(...)`
- `handleTabChange(...)`

File:

- [extension/browser-session-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/browser-session-manager.ts)

### Main behavior

The browser manager tracks a `ManagedBrowserTab` per browser session.

The main goals are:

- reopen the tab if the URL/session changed
- reveal an existing tab in the target editor group if it already exists
- observe focus/tab changes without mutating store focus

### Important browser fragility

The browser integration depends on the built-in simple browser and VS Code’s tab API, which is not as identity-rich as we would like.

Browser tabs are currently more heuristic-driven than terminals.

## Logging / Tracing

### Main trace orchestrator

- [extension/session-layout-trace.ts](/Users/madda/dev/_active/agent-tiler/extension/session-layout-trace.ts)

This is the generic trace helper.

The main API is:

- `SessionLayoutTrace.runOperation(...)`

Each operation logs:

- begin state
- expected state
- intermediate steps
- final state
- failures

### Where logging happens

Controller:

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

Terminal backend:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace-backend.ts)

T3:

- [extension/t3-webview-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/t3-webview-manager.ts)

Browser:

- [extension/browser-session-manager.ts](/Users/madda/dev/_active/agent-tiler/extension/browser-session-manager.ts)

### What to read first during debugging

If the sidebar and editor disagree:

- `logs/session-layout.log`

If terminals are dancing:

- `logs/native-terminal-reconcile.log`

If T3 tabs are blank/recreating/wrong group:

- `logs/t3-webview-reconcile.log`

If browser tabs duplicate or do not reattach:

- `logs/browser-session-reconcile.log`

## Code Mode

Main function:

- `toggleVsMuxDisabled(...)`
- `applyDisabledVsMuxMode(...)`

File:

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

Current behavior:

- move managed terminals to the panel
- dispose T3 webviews
- join editor groups
- reopen browser sessions in one group

When re-enabled:

- run normal projection restore from the store snapshot

Sidebar sessions are intentionally dimmed/inert while code mode is enabled.

## Important Invariants

If you change this system, try hard to preserve these:

1. The store is the source of truth for visible/focused sessions.

2. `visibleSessionIds` are ordered slots, not just a set.

3. Reconcile should be transactional:
   store snapshot -> project -> restore focus -> verify

4. External workbench focus events should not mutate the store.

5. Terminal/session ownership must stay one-to-one.

6. Hidden sessions do not need to be parked in group 1 only.
   Hidden just means "not in the visible set".

7. Reconcile order matters.
   Visible sessions are usually staged before hidden ones.

## Places Where Workarounds Exist

These are the current workaround-heavy areas.

### 1. Terminal move settle logic

File:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace-backend.ts)

Why it exists:

- VS Code moves are not synchronous
- the same tab can appear in source and target groups briefly

### 2. Layout normalization before reconcile

File:

- [extension/native-terminal-workspace.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace.ts)

Why it exists:

- malformed editor-group shapes were causing impossible placement states

Current behavior:

- if the current editor layout does not match the active snapshot layout, `applyEditorLayout(...)` runs with `joinAllGroups: true`

This is defensive. It is not elegant, but it keeps projection from starting from garbage.

### 3. T3 embed frontend patches

File:

- [ai/t3-embed-patches.md](/Users/madda/dev/_active/agent-tiler/ai/t3-embed-patches.md)

Why it exists:

- we need a VSmux-specific T3 embed mode
- we need forced mobile/sidebar behavior
- we need a ready/focus bridge

### 4. Title-based fallback attachment

Files:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace-backend.ts)
- [shared/session-grid-contract.ts](/Users/madda/dev/_active/agent-tiler/shared/session-grid-contract.ts)

Why it exists:

- restored terminals can lose stable metadata

But title matching is fallback only. Do not promote it above managed env/process identity.

## Good Starting Points If You Want To Rewrite Pieces

If you want to simplify this system yourself, these are the best seams.

### If you want to simplify the architecture

Start with:

- `reconcileProjectedSessions(...)`
- `restoreFocusedSessionProjection(...)`
- `SessionGridStore`

Goal:

- make the controller even more strictly transactional

### If you want to simplify terminal behavior

Start with:

- `reconcileVisibleTerminals(...)`
- `placeTerminal(...)`
- `activateTerminalEditorTab(...)`

Goal:

- reduce how many intermediate tab activations happen during a reconcile

### If you want to debug wrong left/right or 2x2 ordering

Start with:

- `shared/grouped-session-workspace-state.ts`
- `shared/session-grid-state.ts`

Goal:

- verify that the visible-session order is what you think it is before projection even begins

## Practical Debugging Workflow

When a bug happens:

1. capture the screenshot
2. open `logs/session-layout.log`
3. find the action begin/complete block
4. compare:
   - store active snapshot
   - expected projection
   - observed workbench state
5. if terminals are involved, inspect `logs/native-terminal-reconcile.log`
6. if T3 is involved, inspect `logs/t3-webview-reconcile.log`
7. if browser is involved, inspect `logs/browser-session-reconcile.log`

The question to answer first is always:

- did the store ask for the right thing?
- or did projection apply the right thing incorrectly?

Do not start with random UI guesses. Start with that split.

## Current Biggest Risk Areas

These are the places most likely to still produce bugs.

1. Four-terminal layouts
   Reason:
   the terminal backend still has the most command sequencing complexity.

2. Cross-group transitions between layouts of different sizes
   Reason:
   the workbench can retain stale group shape unless we normalize first.

3. Terminal restore after reload
   Reason:
   restored terminal identity from VS Code is still imperfect.

4. Any path that relies on live observed tab state
   Reason:
   we have intentionally moved away from using observed state as truth, so anything that drifts back toward that model is risky.

## If You Are Editing Line By Line

My recommendation:

1. Start from the store snapshot you want.
2. Check whether the bug is already present in `visibleSessionIds` / `focusedSessionId`.
3. If the store is correct, debug only the relevant surface manager.
4. Avoid adding more controller-side reactions to workbench events.
5. Prefer removing extra commands over adding more after-the-fact repairs.

The biggest historical failure mode in this feature has been:

- “the UI looked wrong, so add one more reactive fix”

That usually made storms worse.

## Short Summary

The current implementation is store-driven and transaction-oriented at the controller level, but the terminal backend is still the hardest part because VS Code terminal editor-tab moves do not settle synchronously. If you are debugging storms, start in the terminal backend and the logs, not in the sidebar or T3 code.
