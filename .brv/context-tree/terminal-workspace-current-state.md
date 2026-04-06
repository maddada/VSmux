# Terminal Workspace Current State

## Frontend terminal model

- The workspace terminal renderer is `restty`, not xterm.
- Frontend terminal runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- The reason for the cache is to keep one stable `Restty` runtime and transport per terminal session so switching sessions does not recreate the frontend terminal and replay it again.
- Cache invalidation is generation-based through `renderNonce`. If a terminal session is intentionally recreated, the generation changes and the old runtime is destroyed.
- When a terminal session is removed, the controller explicitly sends `destroyTerminalRuntime` to the workspace so a recycled `sessionId` cannot inherit an old transcript.

## Workspace pane projection and switching

- The workspace pane projection includes terminal sessions from all groups, not just the active group.
- This is intentional so cross-group switching can keep terminals warm instead of creating a fresh pane set when the user switches groups.
- Inactive terminal panes stay mounted in the same layout slot behind the active pane.
- The current implementation stacks panes in the same `grid-area`, keeps the active pane above the others with a higher `z-index`, and uses `workspace-pane-hidden` mainly to disable pointer events on non-active panes.
- Visible split-pane layout order is derived from the active group's `snapshot.visibleSessionIds`, not by filtering the saved full pane order.
- `localPaneOrder` is only used as a temporary override within the currently visible session ids, mainly for optimistic pane drag/reorder feedback.
- The design goal is instant switching without reconnecting and without hidden-pane reflow.
- The design goal for visible pane order is slot stability: when focus changes inside a split, the surfaced-but-not-active pane should keep the same slot instead of jumping because of unrelated global pane order.
- Hidden or inactive terminal behavior should avoid any size change caused only by being hidden, because hidden-pane size churn was a major cause of transcript loss and visible tail changes.

## Workspace activation ownership

- `workspace/terminal-pane.tsx` emits activation intent from terminal-root `pointer` capture and `focusin` fallback only after the pane owns `:focus-within`.
- `workspace/workspace-app.tsx` is the authoritative owner of terminal focus decisions. It applies local focus visuals, evaluates the auto-focus guard, and decides whether to send `focusSession`.
- The reason for this split is to keep child panes event-oriented while the app-level workspace state owns the actual focus policy.

## Sidebar drag and reorder safety

- Sidebar session cards should not change order from ordinary clicking.
- The sidebar records the original pointerdown session target and only allows session reorder on drag end if pointer movement crossed an `8px` threshold for that same session interaction.
- If a click-shaped interaction reaches drag end without real pointer movement, reorder is ignored even if the drag library resolved a drop target.

## Workarea lag recovery

- The workarea has a scheduler-lag recovery path for terminal panes.
- The current implementation only runs the scheduler lag detector when `debuggingMode` is enabled, because the detector lives inside a `debuggingMode`-gated effect in `workspace/terminal-pane.tsx`.
- Lag detection is based on `terminal.schedulerWindow` during the first 10 seconds after workarea boot, not on a separate probe window.
- The current threshold is average timer overshoot of at least `1000ms` while the pane is visible and the document has focus.
- Auto reload is controlled by `AUTO_RELOAD_ON_LAG` in `workspace/workspace-app.tsx` and is currently enabled.
- Auto reload is limited to once per workarea boot.
- When lag-triggered reload happens, the controller preserves focus on the last active terminal session by carrying its `sessionId` through `reloadWorkspacePanel` and enqueueing an auto-focus request with source `reload`.
- The older in-workarea reload notice UI still exists as a dormant fallback and becomes active again if `AUTO_RELOAD_ON_LAG` is set to `false`.
- `retainContextWhenHidden` is currently `false` for the workspace panel, because full webview recreation on hide/reveal is preferred over retaining a potentially bad scheduler state.
- The workspace app also deduplicates repeated stable `hydrate` and `sessionState` messages while still allowing newer `autoFocusRequest` payloads through.

## Terminal bootstrap and maintenance

- `workspace/terminal-pane.tsx` uses one shared visible-maintenance path for startup and for later observer-driven upkeep.
- The runtime cache stores `bootstrapVisualsComplete`, and `runVisibleMaintenance` only seeds startup-black surfaces and runs canvas reveal checks while that flag is still `false`.
- Once bootstrap visuals complete, visible maintenance continues with scroll-host binding, scroll visibility updates, and optional size updates without rerunning startup-black surface seeding.
- Resize and mutation observers both run visible maintenance for the active pane.
- Hidden panes skip redraw work after PTY connect; they stay mounted behind the active pane instead of being repainted on visibility flips.

## Daemon ownership and lifetime

- VSmux uses a per-workspace daemon, not a single global daemon.
- The reason is stability: sharing one daemon across unrelated projects caused daemon ownership conflicts and stale-daemon replacement problems.
- The extension synchronizes session leases to the daemon for sidebar-listed terminal sessions.
- The intended behavior is that any terminal session still shown in the VSmux sidebar stays alive while VS Code is running, even if the VSmux sidebar or workarea is closed.
- The configured background timeout only matters after VS Code is gone long enough for the lease to expire.

## Reattach vs resume semantics

- `createOrAttach` responses include `didCreateSession`.
- The controller uses that to distinguish:
  - reattaching to an already-live daemon PTY
  - creating a replacement backend terminal
- Resume commands must only run when a backend terminal was truly recreated.
- If a live daemon terminal still exists, the correct behavior is reattach, not resume.

## Persisted terminal presentation state

- Persisted terminal session state stores `agentName`, `agentStatus`, and `title` in `extension/session-state-file.ts`.
- `extension/terminal-daemon-session-state.ts` preserves the last known agent and title unless a better live or title-derived value is available.
- The reason is cold-start correctness: if the daemon is not live, the sidebar should still be able to show the last known agent and title after reload.

## Final implemented user-facing requirements

- The workspace terminal renderer is `restty`.
- Switching between terminal sessions in the same group should reuse already-loaded terminal runtimes instead of recreating them.
- Switching between terminal sessions across groups should also keep terminals warm by projecting sessions from all groups into the workspace instead of creating a fresh pane set on group switch.
- Terminal sessions should stay visually stable across session switches: inactive panes stay mounted behind the active pane, and hidden-pane behavior should avoid reflow that changes wrapping or cuts back the visible tail.
- Switching the active session inside a visible split should preserve the passive surfaced pane's slot.
- Clicking a terminal pane in the workspace should activate that pane through the centralized `WorkspaceApp` focus path.
- Closing a terminal session and then creating a new terminal must not resurrect old content from the closed session, even if the same `sessionId` is later reused.
- If `debuggingMode` is enabled and startup lag is detected in the workarea, VSmux should automatically reload the workarea and return focus to the last active terminal session.
- If auto reload is later disabled, the dormant reload notice UI should remain available as the fallback recovery surface.
- VSmux should keep sidebar-listed terminal sessions alive while VS Code is running, even if the VSmux sidebar or workarea is closed.
- If a live daemon PTY still exists after reload or reopen, VSmux should reattach to it instead of running a resume command.
- If the daemon is not live, the sidebar should still show the last known agent and terminal title from persisted session state.
- Clicking around session cards in the sidebar should focus sessions only; it should not mutate session order unless the user actually drags.

## Important lessons

- Avoid hidden-pane reflow. Hidden-pane size changes can alter wrapping and make the visible tail look cut back even without reconnect.
- Avoid deriving visible split layout from the saved full pane order. That makes passive surfaced panes jump slots when active focus changes.
- Avoid reusing a cached frontend runtime for a recycled `sessionId` after session close.
- Keep lag recovery tied to the actual scheduler signal that correlates with terminal degradation, not to weaker secondary probes.
- Preserve focused terminal identity through any automatic workarea recovery so reload does not feel like session loss.
- Keep bootstrap visuals explicitly gated and persisted in the cached runtime so startup-only surface treatment does not rerun once a terminal is already visually established.
- Keep sidebar reorder behind proof of actual pointer movement, not just the drag library's end-state inference.
