import { describe, expect, test } from "vite-plus/test";
import {
  hasTerminalFrontendConnectionAfterReload,
  shouldAwaitWorkspaceTerminalFrontendConnection,
} from "./terminal-frontend-attachment";

describe("shouldAwaitWorkspaceTerminalFrontendConnection", () => {
  test("should wait when the workspace panel is visible and the session is visible", () => {
    expect(
      shouldAwaitWorkspaceTerminalFrontendConnection({
        isSessionVisibleInWorkspace: true,
        isWorkspacePanelVisible: true,
      }),
    ).toBe(true);
  });

  test("should skip waiting when the workspace panel is hidden", () => {
    expect(
      shouldAwaitWorkspaceTerminalFrontendConnection({
        isSessionVisibleInWorkspace: true,
        isWorkspacePanelVisible: false,
      }),
    ).toBe(false);
  });

  test("should skip waiting when the session is not visible in the workspace", () => {
    expect(
      shouldAwaitWorkspaceTerminalFrontendConnection({
        isSessionVisibleInWorkspace: false,
        isWorkspacePanelVisible: true,
      }),
    ).toBe(false);
  });
});

describe("hasTerminalFrontendConnectionAfterReload", () => {
  test("should accept the first attachment when the session was detached before reload", () => {
    expect(
      hasTerminalFrontendConnectionAfterReload({
        isAttached: true,
        sawDetachedSinceReload: false,
        wasAttachedBeforeReload: false,
      }),
    ).toBe(true);
  });

  test("should wait for a fresh attachment when the session was attached before reload", () => {
    expect(
      hasTerminalFrontendConnectionAfterReload({
        isAttached: true,
        sawDetachedSinceReload: false,
        wasAttachedBeforeReload: true,
      }),
    ).toBe(false);
  });

  test("should accept the reconnect after a detach is observed", () => {
    expect(
      hasTerminalFrontendConnectionAfterReload({
        isAttached: true,
        sawDetachedSinceReload: true,
        wasAttachedBeforeReload: true,
      }),
    ).toBe(true);
  });

  test("should stay false while the frontend is still detached", () => {
    expect(
      hasTerminalFrontendConnectionAfterReload({
        isAttached: false,
        sawDetachedSinceReload: true,
        wasAttachedBeforeReload: true,
      }),
    ).toBe(false);
  });
});
