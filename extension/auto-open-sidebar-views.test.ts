import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { configurationValues, executeCommandMock } = vi.hoisted(() => ({
  configurationValues: new Map<string, unknown>(),
  executeCommandMock: vi.fn(async () => undefined),
}));

vi.mock("vscode", () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) =>
        configurationValues.has(key) ? configurationValues.get(key) : defaultValue,
      ),
    })),
  },
}));

import { maybeAutoOpenSidebarViewsOnStartup } from "./auto-open-sidebar-views";

describe("maybeAutoOpenSidebarViewsOnStartup", () => {
  beforeEach(() => {
    configurationValues.clear();
    executeCommandMock.mockReset();
    executeCommandMock.mockResolvedValue(undefined);
  });

  test("should stay idle when startup auto-open is disabled", async () => {
    const revealSidebar = vi.fn(async () => undefined);

    await maybeAutoOpenSidebarViewsOnStartup({ revealSidebar });

    expect(revealSidebar).not.toHaveBeenCalled();
    expect(executeCommandMock).not.toHaveBeenCalled();
  });

  test("should reveal the VSmux sidebar and focus the sessions view when enabled", async () => {
    configurationValues.set("autoOpenSidebarViewsOnStartup", true);
    const revealSidebar = vi.fn(async () => undefined);

    await maybeAutoOpenSidebarViewsOnStartup({ revealSidebar });

    expect(revealSidebar).toHaveBeenCalledTimes(1);
    expect(executeCommandMock.mock.calls).toEqual([["VSmux.sessions.focus"]]);
  });

  test("should ignore a sessions view focus failure", async () => {
    configurationValues.set("autoOpenSidebarViewsOnStartup", true);
    executeCommandMock.mockRejectedValueOnce(new Error("missing view command"));
    const revealSidebar = vi.fn(async () => undefined);

    await maybeAutoOpenSidebarViewsOnStartup({ revealSidebar });

    expect(executeCommandMock.mock.calls).toEqual([["VSmux.sessions.focus"]]);
  });
});
