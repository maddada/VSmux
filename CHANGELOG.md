# Changelog

All notable user-facing changes are documented in this file.

## 1.10.0 - 2026-03-25

- Browser sessions now reconnect to existing VS Code browser tabs more reliably, which reduces duplicate tabs and makes restores/reveals less fragile.
- Launching the same browser action now reuses the existing browser session instead of creating another duplicate session.
- Native terminal workspace projection was reworked for more stable focus tracking, session placement, and layout reconciliation across grouped sessions.
- Embedded T3 session placement and restore behavior is more resilient during session reconcile flows.
- Sidebar polish across the actions area, scratch pad, browser session cards, and session visuals.

## 1.9.0 - 2026-03-23

- Added a quick way to copy a session's resume command from the session context menu.
