# Terminal Daemon And Session Restore

## 1. Purpose

This document explains how VSmux terminal persistence works today for the daemon-backed terminal path.

The goals are:

- keep terminal sessions running across VS Code window reloads
- reconnect xterm.js panes back to the existing backend PTY
- restore recent scrollback after reconnect
- avoid cross-project session collisions
- avoid output loss during the reconnect window

This is the daemon path used by the `node-pty` backend. It is separate from the older native terminal restore behavior.

## 2. High-Level Model

There are three layers involved:

1. The daemon process owns the real PTY sessions.
2. The extension talks to the daemon over a control socket.
3. The workspace webview terminal pane connects directly to the daemon over a session WebSocket.

The important consequence is:

- the real shell stays alive in the daemon
- the xterm.js buffer is disposable
- after reload, the frontend must be rebuilt from daemon state plus replayed terminal output

## 3. Session Identity And Project Isolation

Session ids like `session-1` are only unique inside one workspace. Because the daemon is shared, VSmux now scopes daemon sessions by:

- `workspaceId`
- `sessionId`

That composite daemon session key is created in:

- `extension/terminal-daemon-session-scope.ts`

This prevents project A `session-1` from attaching to project B `session-1`.

## 4. What The Daemon Stores

Each managed daemon session keeps:

- the live `node-pty` instance
- terminal metadata like `cwd`, `shell`, `rows`, `cols`
- persisted session state file path for title/agent metadata
- recent output history in a bounded ring buffer
- a temporary queue for output produced while a client is reconnecting

Main implementation:

- `extension/terminal-daemon-process.ts`
- `extension/terminal-daemon-ring-buffer.ts`

### History buffer

The daemon now stores recent terminal output in a fixed-size byte ring buffer instead of a large trimmed string.

Current size:

- `8 * 1024 * 1024` bytes

Why this is better:

- bounded memory use
- better fidelity for terminal output
- matches the detached-terminal model used in the collab reference project

## 5. Output Flow While The Session Is Running

When the PTY emits output:

1. VSmux writes the raw output bytes into the ring buffer.
2. VSmux pushes the same bytes into any pending reconnect queues.
3. VSmux streams the bytes to currently attached WebSocket clients.
4. VSmux also parses the text form of the output for title/activity changes.

This means the daemon is the source of truth for:

- current live terminal stream
- recent replayable history

## 6. Reconnect And Restore Flow

After a VS Code reload, the PTY is still alive in the daemon, but the webview/xterm socket is gone.

When the terminal pane reconnects, the daemon now does the attach sequence carefully:

1. Create a temporary per-attach pending queue.
2. Send a terminal state message with full replay history.
3. Flush any output that arrived while the history snapshot was being prepared/sent.
4. Promote the socket to a normal live session socket.
5. Continue normal live streaming.

This prevents a reconnect gap where output could be lost between:

- "history snapshot built"
- "live socket attached"

The attach/replay logic lives in:

- `extension/terminal-daemon-process.ts`

## 7. Frontend Restore Behavior

The workspace terminal pane uses xterm.js. Its buffer is not persisted by itself.

On reconnect:

- state/history arrives from the daemon
- xterm replays that history
- live output resumes after replay

There is an important guard in:

- `workspace/terminal-pane-history.ts`

That helper makes sure the frontend only marks history as applied when a session state message actually contains a `history` field.

This fixes the older failure mode where:

1. a state message without `history` arrived first
2. the frontend assumed restore was done
3. the later real history payload was ignored

## 8. Recent Collab-Derived Improvements Ported Into VSmux

The following recent ideas from the collab reference repo were pulled into VSmux because they fit this architecture.

### A. Replay queue + bounded history

This is the core detached-terminal improvement.

What changed in VSmux:

- replaced trimmed string history with a ring buffer
- added per-attach pending queues
- made reconnect replay history first, then gap output, then live streaming

Why it matters:

- reliable scrollback restore after quick reload
- no dropped output during reconnect

Closest collab inspiration:

- sidecar ring buffer and reconnect queue
- startup race fixes around attach timing

### B. Binary PTY output end-to-end

Recent collab commits switched the live PTY path to raw bytes instead of repeated UTF-8 encode/decode hops. VSmux now does the equivalent for the daemon/webview stream.

What changed in VSmux:

- `node-pty` is spawned with `encoding: null`
- daemon output is handled as raw bytes
- the ring buffer stores bytes directly
- the session WebSocket sends binary frames for live terminal output
- the workspace terminal pane sets `binaryType = "arraybuffer"`
- xterm writes `Uint8Array` chunks directly

Why it matters:

- less encode/decode overhead on every output chunk
- better fidelity for terminal byte streams
- cleaner alignment between stored history and live output

### C. Protocol bump for daemon replacement

Because the wire/runtime behavior changed, the terminal host protocol version was bumped.

Current version:

- `13`

This forces old daemons to be replaced so the frontend and daemon agree on the current transport behavior.

## 9. What Was Not Ported From Collab

Some recent collab commits are about choosing between two terminal backends (`tmux` vs `sidecar`) and persisting which backend owns a session.

Those changes were not copied because VSmux does not use that architecture here.

Not directly applicable:

- per-session backend metadata routing
- tmux fallback/reconnect logic
- tmux-specific preserved-session fixes

The relevant equivalent in VSmux is the single daemon-backed session model, not dual backend routing.

## 10. Current Limits

What survives a quick VS Code reload:

- the running shell
- recent terminal output up to the ring buffer size
- output produced during reconnect

What does not survive a daemon death:

- in-memory ring buffer history
- live PTY processes

What is still bounded:

- replay history is limited to the most recent retained buffer tail, not infinite scrollback

## 11. Main Files

- `extension/terminal-daemon-process.ts`
- `extension/terminal-daemon-ring-buffer.ts`
- `extension/terminal-daemon-session-scope.ts`
- `extension/daemon-terminal-runtime.ts`
- `extension/daemon-terminal-workspace-backend.ts`
- `workspace/terminal-pane.tsx`
- `workspace/terminal-pane-history.ts`
- `shared/terminal-host-protocol.ts`

## 12. Verification

Focused verification run for this daemon/restore work:

- `pnpm exec tsc -p ./tsconfig.extension.json --noEmit`
- `pnpm exec tsc -p ./tsconfig.extension.json`
- `pnpm exec vp build --config vite.workspace.config.ts`
- `pnpm exec vp test run extension/terminal-daemon-ring-buffer.test.ts workspace/terminal-pane-history.test.ts extension/terminal-daemon-session-scope.test.ts`
