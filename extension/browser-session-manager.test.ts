import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { BrowserSessionRecord } from "../shared/session-grid-contract";
import { BrowserSessionManager } from "./browser-session-manager";

const testState = vi.hoisted(() => ({
  changeTabGroupListeners: [] as Array<() => void>,
  changeTabsListeners: [] as Array<() => void>,
  closeTab: vi.fn(async () => undefined),
  executeCommand: vi.fn(async () => undefined),
  focusEditorGroupByIndex: vi.fn(async () => true),
  getActiveEditorGroupViewColumn: vi.fn(() => 2),
  tabGroupsAll: [] as Array<{
    isActive: boolean;
    tabs: Array<{
      group: unknown;
      input: unknown;
      isActive: boolean;
      label: string;
    }>;
    viewColumn: number;
  }>,
  TabInputCustomClass: class MockTabInputCustom {
    public constructor(public readonly uri: { toString: (skipEncoding?: boolean) => string }) {}
  },
  TabInputTextClass: class MockTabInputText {
    public constructor(public readonly uri: { toString: (skipEncoding?: boolean) => string }) {}
  },
}));

vi.mock("vscode", () => ({
  TabInputCustom: testState.TabInputCustomClass,
  TabInputText: testState.TabInputTextClass,
  Uri: {
    parse: (value: string) => ({
      toString: () => value,
    }),
  },
  ViewColumn: {
    Nine: 9,
    One: 1,
    Two: 2,
    Three: 3,
  },
  commands: {
    executeCommand: testState.executeCommand,
  },
  window: {
    activeTerminal: undefined,
    tabGroups: {
      activeTabGroup: {
        viewColumn: 1,
      },
      close: testState.closeTab,
      get all() {
        return testState.tabGroupsAll;
      },
      onDidChangeTabGroups: vi.fn((listener: () => void) => {
        testState.changeTabGroupListeners.push(listener);
        return { dispose: vi.fn() };
      }),
      onDidChangeTabs: vi.fn((listener: () => void) => {
        testState.changeTabsListeners.push(listener);
        return { dispose: vi.fn() };
      }),
    },
    terminals: [],
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    })),
  },
}));

vi.mock("./terminal-workspace-helpers", () => ({
  focusEditorGroupByIndex: testState.focusEditorGroupByIndex,
  getDefaultWorkspaceCwd: () => "/workspace",
  getActiveEditorGroupViewColumn: testState.getActiveEditorGroupViewColumn,
  getViewColumn: (index: number) => index + 1,
}));

describe("BrowserSessionManager", () => {
  beforeEach(() => {
    testState.changeTabGroupListeners.length = 0;
    testState.changeTabsListeners.length = 0;
    testState.closeTab.mockClear();
    testState.executeCommand.mockClear();
    testState.focusEditorGroupByIndex.mockClear();
    testState.getActiveEditorGroupViewColumn.mockReset();
    testState.getActiveEditorGroupViewColumn.mockReturnValue(2);
    testState.tabGroupsAll = [];
  });

  test("should dispose browser tabs for removed tracked sessions", async () => {
    const manager = new BrowserSessionManager({
      onDidChangeSessions: vi.fn(async () => {}),
      onDidFocusSession: vi.fn(async () => {}),
    });
    const staleTab = createBrowserTab("https://old.example.com", 1, false);
    (manager as any).managedTabsBySessionId.set("session-old", {
      renderKey: "old",
      sessionId: "session-old",
      tab: staleTab.tab,
      url: "https://old.example.com",
    });

    manager.syncSessions([createBrowserSession("session-1", "001", "Docs", "https://example.com")]);

    expect(testState.closeTab).toHaveBeenCalledTimes(1);
    expect((manager as any).sessionRecordBySessionId.has("session-1")).toBe(true);
  });

  test("should open a missing visible browser session in the requested group", async () => {
    const manager = new BrowserSessionManager({
      onDidChangeSessions: vi.fn(async () => {}),
      onDidFocusSession: vi.fn(async () => {}),
    });
    const session = createBrowserSession("session-1", "001", "Docs", "https://example.com");
    manager.syncSessions([session]);

    await manager.reconcileVisibleSessions(
      {
        focusedSessionId: session.sessionId,
        fullscreenRestoreVisibleCount: undefined,
        sessions: [session],
        viewMode: "grid",
        visibleCount: 1,
        visibleSessionIds: [session.sessionId],
      },
      false,
    );

    expect(testState.executeCommand).toHaveBeenCalledWith(
      "simpleBrowser.api.open",
      expect.objectContaining({
        toString: expect.any(Function),
      }),
      {
        preserveFocus: false,
        viewColumn: 1,
      },
    );
  });

  test("should detect a live tab by URL", () => {
    const manager = new BrowserSessionManager({
      onDidChangeSessions: vi.fn(async () => {}),
      onDidFocusSession: vi.fn(async () => {}),
    });
    const session = createBrowserSession("session-1", "001", "Docs", "https://example.com");
    const liveTab = createBrowserTab("https://example.com", 1, true);
    testState.tabGroupsAll = [liveTab.group as (typeof testState.tabGroupsAll)[number]];
    manager.syncSessions([session]);
    (manager as any).managedTabsBySessionId.set(session.sessionId, {
      renderKey: "Docs|https://example.com",
      sessionId: session.sessionId,
      tab: undefined,
      url: "https://example.com",
    });

    expect(manager.hasLiveTab(session.sessionId)).toBe(true);
  });

  test("should notify focus changes for active managed browser tabs", async () => {
    const onDidFocusSession = vi.fn(async () => {});
    const manager = new BrowserSessionManager({
      onDidChangeSessions: vi.fn(async () => {}),
      onDidFocusSession,
    });
    const session = createBrowserSession("session-1", "001", "Docs", "https://example.com");
    const liveTab = createBrowserTab("https://example.com", 1, true);
    testState.tabGroupsAll = [liveTab.group as (typeof testState.tabGroupsAll)[number]];
    manager.syncSessions([session]);
    (manager as any).managedTabsBySessionId.set(session.sessionId, {
      renderKey: "Docs|https://example.com",
      sessionId: session.sessionId,
      tab: liveTab.tab,
      url: "https://example.com",
    });

    await fireTabChange();

    expect(onDidFocusSession).toHaveBeenCalledWith(session.sessionId);
  });

  test("should keep a hidden browser tab in its current group", async () => {
    const manager = new BrowserSessionManager({
      onDidChangeSessions: vi.fn(async () => {}),
      onDidFocusSession: vi.fn(async () => {}),
    });
    const visibleSession = createBrowserSession(
      "session-1",
      "001",
      "Visible",
      "https://visible.example.com",
    );
    const hiddenSession = createBrowserSession(
      "session-2",
      "002",
      "Hidden",
      "https://hidden.example.com",
    );
    const hiddenTab = createBrowserTab("https://hidden.example.com", 2, false);
    testState.tabGroupsAll = [
      createBrowserTab("https://visible.example.com", 1, true).group,
      hiddenTab.group,
    ];
    manager.syncSessions([visibleSession, hiddenSession]);
    (manager as any).managedTabsBySessionId.set(hiddenSession.sessionId, {
      renderKey: "Hidden|https://hidden.example.com",
      sessionId: hiddenSession.sessionId,
      tab: hiddenTab.tab,
      url: "https://hidden.example.com",
    });

    await manager.reconcileVisibleSessions(
      {
        focusedSessionId: visibleSession.sessionId,
        fullscreenRestoreVisibleCount: undefined,
        sessions: [visibleSession, hiddenSession],
        viewMode: "horizontal",
        visibleCount: 1,
        visibleSessionIds: [visibleSession.sessionId],
      },
      false,
    );

    const hiddenOpenCall = testState.executeCommand.mock.calls.find(([command, uri]) => {
      return (
        command === "simpleBrowser.api.open" &&
        typeof (uri as { toString?: () => string })?.toString === "function" &&
        (uri as { toString: () => string }).toString() === "https://hidden.example.com"
      );
    });
    expect(hiddenOpenCall).toBeUndefined();
    expect((manager as any).managedTabsBySessionId.get(hiddenSession.sessionId)?.tab).toBe(
      hiddenTab.tab,
    );
  });
});

async function fireTabChange(): Promise<void> {
  for (const listener of testState.changeTabsListeners) {
    listener();
  }
  for (const listener of testState.changeTabGroupListeners) {
    listener();
  }
  await Promise.resolve();
}

function createBrowserSession(
  sessionId: string,
  displayId: string,
  alias: string,
  url: string,
): BrowserSessionRecord {
  return {
    alias,
    browser: { url },
    column: 0,
    createdAt: new Date().toISOString(),
    displayId,
    kind: "browser",
    row: 0,
    sessionId,
    slotIndex: 0,
    title: alias,
  };
}

function createBrowserTab(url: string, viewColumn: number, isActive: boolean) {
  const group = {
    isActive,
    tabs: [] as Array<{
      group: unknown;
      input: unknown;
      isActive: boolean;
      label: string;
    }>,
    viewColumn,
  };
  const tab = {
    group,
    input: new testState.TabInputTextClass({
      toString: () => url,
    }),
    isActive,
    label: "Docs",
  };
  group.tabs.push(tab);
  return { group, tab };
}
