---
title: Workspace Focus Debugging
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
    facts/project/terminal_workspace_runtime_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T01:48:58.867Z"
updatedAt: "2026-04-06T02:17:25.247Z"
---

## Raw Concept

**Task:**
Document workspace focus debugging updates for stale pending focus suppression, auto-focus guard behavior, T3 iframe focus routing, and terminal-pane activation ownership

**Changes:**

- Fixed stale pending focus suppression so server-focused session changes can override an old pending local focus request
- Added T3 iframe focus routing through workspace visibility and auto-focus guard checks
- Centralized terminal pane activation decisions in `WorkspaceApp` while `TerminalPane` emits only activation intent
- Added explicit debug events for T3 iframe focus receipt, ignores, and pane activation outcomes
- Preserved duplicate-state suppression and auto-focus request handling in workspace message processing

**Files:**

- workspace/workspace-app.tsx
- workspace/terminal-pane.tsx

**Flow:**
window/document focus sync -> workspace state message handling -> auto-focus guard arming -> terminal pane or iframe activation intent -> local focus visual -> optional server focus request -> stale pending focus supersession cleanup

**Timestamp:** 2026-04-06

## Narrative

### Structure

The focus logic lives primarily in `workspace/workspace-app.tsx` and coordinates document focus state, workspace state messages, local pending focus requests, terminal pane activation handlers, and T3 iframe-originated focus messages. `workspace/terminal-pane.tsx` only reports activation intent from pointer and fallback focus signals. Duplicate message suppression is based on a stable message signature plus a separate check for new auto-focus request ids, while destroyTerminalRuntime and ready signaling remain part of the surrounding message API behavior.

### Dependencies

Focus routing depends on browser document visibility APIs, `performance.now` timing for auto-focus guard expiry and pending request durations, workspace pane visibility state, `postWorkspaceDebugLog` for instrumentation, and `vscode.postMessage` for ready and `focusSession` messages.

### Highlights

A stale pending local focus request is now cleared when the server reports focus on a different session, which prevents old local focus intent from blocking sidebar-driven focus changes. T3 iframe focus only activates visible T3 panes, respects the active auto-focus guard, applies local focus visuals immediately, and requests server focus only when the session is not already focused. Terminal panes emit activation intent only, while `WorkspaceApp` owns the authoritative decision to ignore, visually focus, or request server focus. This keeps pointer activation reliable in multi-split layouts and prevents pane-local state from fighting with sidebar or auto-focus handoffs.

### Rules

If duplicate stable state and no new auto-focus request: log `message.ignoredDuplicate` and return without applying.
If server focus matches pending local focus request: clear pending request normally.
If server focus differs: treat pending local request as stale or superseded, log it, then clear it.
No guard: allow activation.
Expired guard: clear guard and allow activation.
Same guarded session: allow activation.
Different session during active guard: ignore activation and log `focus.activationIgnoredDuringAutoFocus`.
Accept only `type === "vsmuxT3Focus"` with string `sessionId`.
Ignore hidden panes and log `focus.t3IframeFocusIgnored` with `reason: "hiddenPane"`.
Ignore activations blocked by auto-focus guard and log `focus.t3IframeFocusIgnored` with `reason: "autoFocusGuard"`.
If T3 pane is already focused, log `focus.t3IframeFocusIgnored` with `reason: "alreadyFocused"`.
Terminal panes should emit activation intent through `pointer` or `focusin`, but `WorkspaceApp` should remain the single owner of stateful focus decisions.
If `pointerDragStateRef.current` is set during terminal activation, log `focus.paneActivationIgnoredDuringHeaderDrag` and return.

### Examples

Pending focus supersession payload includes `pendingFocusRequest.durationMs`, `pendingFocusRequest.requestId`, `pendingFocusRequest.sessionId`, and `serverFocusedSessionId`.
T3 iframe focus received event logs `eventOrigin`, `ignoredForAutoFocus`, `isFocused`, `isVisible`, `paneExists`, and `sessionId`.
Local focus request posts `vscode.postMessage({ sessionId, type: "focusSession" })`.
Terminal pane activation flows through `handleTerminalActivate(sessionId, source)` in `workspace/workspace-app.tsx`.

## Facts

- **workspace_focus_debugging_file**: Workspace focus debugging changes were made in `workspace/workspace-app.tsx`. [project]
- **workspace_terminal_activation_file**: Terminal panes emit activation intent from `workspace/terminal-pane.tsx`. [project]
- **auto_focus_activation_guard_ms**: `AUTO_FOCUS_ACTIVATION_GUARD_MS` is `400`. [project]
- **auto_reload_on_lag**: `AUTO_RELOAD_ON_LAG` is `true`. [project]
- **t3_iframe_focus_message_type**: T3 iframe focus messages use type `vsmuxT3Focus`. [project]
- **workspace_terminal_activation_source**: Workspace terminal activation source is `focusin` or `pointer`. [project]
- **workspace_terminal_activation_owner**: `WorkspaceApp` owns the stateful decision to ignore, visually focus, or request server focus for terminal pane activation. [project]
