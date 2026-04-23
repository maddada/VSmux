import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

const debugState = {
  enabled: false,
};
const workspaceState = {
  workspaceRoot: undefined as string | undefined,
};

vi.mock("vscode", () => ({
  workspace: {
    get workspaceFolders() {
      return workspaceState.workspaceRoot
        ? [{ uri: { fsPath: workspaceState.workspaceRoot } }]
        : undefined;
    },
  },
}));

vi.mock("./native-terminal-workspace/settings", () => ({
  getDebuggingMode: () => debugState.enabled,
}));

import {
  getVSmuxDebugLogPath,
  logVSmuxDebug,
  logVSmuxReproTrace,
  resetVSmuxDebugLog,
} from "./vsmux-debug-log";

describe("vsmux debug log", () => {
  let workspaceRoot: string | undefined;

  afterEach(async () => {
    debugState.enabled = false;
    workspaceState.workspaceRoot = undefined;

    if (!workspaceRoot) {
      return;
    }

    await rm(workspaceRoot, { force: true, recursive: true });
    workspaceRoot = undefined;
  });

  test("writes allowlisted debug events to the workspace .vsmux log only when debugging is enabled", async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "vsmux-debug-log-"));
    workspaceState.workspaceRoot = workspaceRoot;
    debugState.enabled = true;
    await mkdir(path.join(workspaceRoot, ".git", "info"), { recursive: true });

    resetVSmuxDebugLog();
    await waitForQueueDrain();

    logVSmuxDebug("controller.waitForTerminalFrontendConnectionAfterReload.timeout", {
      reason: "neverObservedDetach",
      sessionId: "session-04",
    });
    logVSmuxDebug("backend.daemon.sessionState", {
      isAttached: false,
      sessionId: "session-04",
    });
    logVSmuxReproTrace("repro.controller.focusSession.start", {
      sessionId: "session-04",
    });
    await waitForQueueDrain();

    const logPath = getVSmuxDebugLogPath(workspaceRoot);
    const excludePath = path.join(workspaceRoot, ".git", "info", "exclude");
    const contents = await readFile(logPath, "utf8");
    const excludeContents = await readFile(excludePath, "utf8");

    expect(logPath).toBe(path.join(workspaceRoot, ".vsmux", "full-reload-terminal-reconnect.log"));
    expect(contents).toContain("controller.waitForTerminalFrontendConnectionAfterReload.timeout");
    expect(contents).toContain("repro.controller.focusSession.start");
    expect(contents).not.toContain("backend.daemon.sessionState");
    expect(excludeContents).toContain(".vsmux/");
  });

  test("does not create the debug log file when debugging is disabled", async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "vsmux-debug-log-disabled-"));
    workspaceState.workspaceRoot = workspaceRoot;

    logVSmuxDebug("controller.waitForTerminalFrontendConnectionAfterReload.timeout", {
      sessionId: "session-04",
    });
    await waitForQueueDrain();

    await expect(access(getVSmuxDebugLogPath(workspaceRoot))).rejects.toThrow();
  });
});

async function waitForQueueDrain(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
