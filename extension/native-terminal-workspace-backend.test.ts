import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  createSessionRecord,
  getT3SessionSurfaceTitle,
  getTerminalSessionSurfaceTitle,
} from "../shared/session-grid-contract";
import { NativeTerminalWorkspaceBackend } from "./native-terminal-workspace-backend";

const testState = vi.hoisted(() => ({
  activeTerminal: undefined as MockTerminal | undefined,
  activeTabGroupIndex: 0,
  createTerminal: vi.fn((options: Record<string, unknown>) => {
    const terminal = createTerminal(options);
    testState.terminals.push(terminal);
    testState.tabGroupsAll[0] ??= createTabGroup(1);
    testState.tabGroupsAll[0].tabs.push(createTerminalTab(terminal, testState.tabGroupsAll[0]));
    return terminal;
  }),
  executeCommand: vi.fn(async (command: string, args?: { name: string }) => {
    if (command === "workbench.action.terminal.renameWithArg" && args) {
      if (testState.activeTerminal) {
        testState.activeTerminal.name = args.name;
        syncTerminalTabLabels(testState.activeTerminal);
      }
      return undefined;
    }

    const match = /^workbench\.action\.openEditorAtIndex(\d+)$/.exec(command);
    if (match) {
      const tabIndex = Number.parseInt(match[1] ?? "", 10) - 1;
      activateTabAtIndex(testState.activeTabGroupIndex, tabIndex);
    }

    return undefined;
  }),
  focusEditorGroupByIndex: vi.fn(async (index: number) => {
    setActiveGroup(index);
    return true;
  }),
  moveActiveEditorToNextGroup: vi.fn(async () => {
    moveActiveEditor(1);
  }),
  moveActiveEditorToPreviousGroup: vi.fn(async () => {
    moveActiveEditor(-1);
  }),
  moveActiveTerminalToEditor: vi.fn(async () => {
    const terminal = testState.activeTerminal;
    if (!terminal) {
      return;
    }

    const group =
      testState.tabGroupsAll[testState.activeTabGroupIndex] ??
      createTabGroup(testState.activeTabGroupIndex + 1);
    testState.tabGroupsAll[testState.activeTabGroupIndex] = group;
    removeTerminalTabs(terminal);
    group.tabs.push(createTerminalTab(terminal, group));
    activateTabByLabel(group.viewColumn - 1, terminal.name);
  }),
  onDidChangeActiveTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTerminalState: vi.fn(() => ({ dispose: vi.fn() })),
  onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidOpenTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  readPersistedSessionStateFromFile: vi.fn(async () => ({
    agentName: "codex",
    agentStatus: "idle",
    title: "Codex",
  })),
  tabGroupsAll: [] as MockTabGroup[],
  TabInputTerminalClass: class MockTabInputTerminal {},
  terminals: [] as MockTerminal[],
  updatePersistedSessionStateFile: vi.fn(
    async (
      _filePath: string,
      updater: (state: {
        agentName?: string;
        agentStatus: "attention" | "idle" | "working";
        title?: string;
      }) => {
        agentName?: string;
        agentStatus: "attention" | "idle" | "working";
        title?: string;
      },
    ) =>
      updater({
        agentName: "codex",
        agentStatus: "attention",
        title: "Codex",
      }),
  ),
  workspaceState: {
    get: vi.fn(() => ({})),
    update: vi.fn(async () => undefined),
  },
}));

type MockTab = {
  group: MockTabGroup;
  isActive: boolean;
  input: unknown;
  label: string;
  terminal?: MockTerminal;
};

type MockTabGroup = {
  isActive: boolean;
  tabs: MockTab[];
  viewColumn: number;
};

type MockTerminal = {
  creationOptions: Record<string, unknown>;
  dispose: ReturnType<typeof vi.fn>;
  exitStatus: undefined | { code: number };
  name: string;
  processId: Promise<number>;
  sendText: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
};

vi.mock("vscode", () => ({
  EventEmitter: class EventEmitter<T> {
    private listeners: Array<(value: T) => void> = [];

    public readonly event = (listener: (value: T) => void) => {
      this.listeners.push(listener);
      return { dispose: vi.fn() };
    };

    public fire(value: T): void {
      for (const listener of this.listeners) {
        listener(value);
      }
    }

    public dispose(): void {
      this.listeners = [];
    }
  },
  TabInputTerminal: testState.TabInputTerminalClass,
  ThemeIcon: class ThemeIcon {},
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
  },
  window: {
    get activeTerminal() {
      return testState.activeTerminal;
    },
    createTerminal: testState.createTerminal,
    onDidChangeActiveTerminal: testState.onDidChangeActiveTerminal,
    onDidChangeTerminalState: testState.onDidChangeTerminalState,
    onDidCloseTerminal: testState.onDidCloseTerminal,
    onDidOpenTerminal: testState.onDidOpenTerminal,
    get tabGroups() {
      return {
        activeTabGroup: testState.tabGroupsAll[testState.activeTabGroupIndex],
        all: testState.tabGroupsAll,
      };
    },
    get terminals() {
      return testState.terminals;
    },
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    })),
    workspaceFolders: [
      {
        uri: {
          fsPath: "/workspace",
          toString: () => "file:///workspace",
        },
      },
    ],
  },
  commands: {
    executeCommand: testState.executeCommand,
  },
}));

vi.mock("./agent-shell-integration", () => ({
  ensureAgentShellIntegration: vi.fn(async () => ({
    binDir: "/bin",
    claudeSettingsPath: "/claude.json",
    notifyPath: "/notify.js",
    opencodeConfigDir: "/opencode",
    zshDotDir: "/zsh",
  })),
}));

vi.mock("./native-terminal-process-identity", () => ({
  readManagedTerminalIdentityFromProcessId: vi.fn(async () => undefined),
}));

vi.mock("./terminal-workspace-helpers", () => ({
  createDisconnectedSessionSnapshot: (
    sessionId: string,
    workspaceId: string,
    status = "disconnected",
  ) => ({
    agentName: undefined,
    agentStatus: "idle",
    cols: 120,
    cwd: "/workspace",
    restoreState: "live",
    rows: 34,
    sessionId,
    shell: "/bin/zsh",
    startedAt: new Date(0).toISOString(),
    status,
    workspaceId,
  }),
  focusEditorGroupByIndex: testState.focusEditorGroupByIndex,
  getDefaultShell: () => "/bin/zsh",
  getDefaultWorkspaceCwd: () => "/workspace",
  getViewColumn: (index: number) => index + 1,
  getWorkspaceStorageKey: (key: string, workspaceId: string) => `${key}:${workspaceId}`,
  moveActiveEditorToNextGroup: testState.moveActiveEditorToNextGroup,
  moveActiveEditorToPreviousGroup: testState.moveActiveEditorToPreviousGroup,
  moveActiveTerminalToEditor: testState.moveActiveTerminalToEditor,
}));

vi.mock("./session-state-file", () => ({
  readPersistedSessionStateFromFile: testState.readPersistedSessionStateFromFile,
  updatePersistedSessionStateFile: testState.updatePersistedSessionStateFile,
}));

describe("NativeTerminalWorkspaceBackend", () => {
  beforeEach(() => {
    testState.activeTerminal = undefined;
    testState.activeTabGroupIndex = 0;
    testState.createTerminal.mockClear();
    testState.executeCommand.mockClear();
    testState.focusEditorGroupByIndex.mockClear();
    testState.moveActiveEditorToNextGroup.mockClear();
    testState.moveActiveEditorToPreviousGroup.mockClear();
    testState.moveActiveTerminalToEditor.mockClear();
    testState.readPersistedSessionStateFromFile.mockClear();
    testState.readPersistedSessionStateFromFile.mockImplementation(async () => ({
      agentName: "codex",
      agentStatus: "idle",
      title: "Codex",
    }));
    testState.tabGroupsAll = [];
    testState.terminals = [];
    testState.updatePersistedSessionStateFile.mockClear();
    testState.updatePersistedSessionStateFile.mockImplementation(async (_filePath, updater) =>
      updater({
        agentName: "codex",
        agentStatus: "attention",
        title: "Codex",
      }),
    );
    testState.workspaceState.get.mockClear();
    testState.workspaceState.get.mockReturnValue({});
    testState.workspaceState.update.mockClear();
  });

  test("should attach an existing terminal by its canonical title", async () => {
    const session = createTerminalSession(1, 0, "Adding t3 code");
    const existingTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(session),
    });
    testState.terminals.push(existingTerminal);
    testState.tabGroupsAll = [createTabGroup(1, existingTerminal)];

    const backend = createBackend();
    await backend.initialize([session]);

    expect(backend.hasLiveTerminal(session.sessionId)).toBe(true);
    expect(backend.getSessionSnapshot(session.sessionId)?.status).toBe("running");
  });

  test("should prefer managed terminal identity over a conflicting terminal title", async () => {
    const firstSession = createTerminalSession(1, 0, "Scratchpad");
    const secondSession = createTerminalSession(2, 1, "Publish to Store");
    const terminal = createTerminal({
      env: {
        VSMUX_SESSION_ID: firstSession.sessionId,
        VSMUX_WORKSPACE_ID: "workspace-1",
      },
      name: getTerminalSessionSurfaceTitle(secondSession),
    });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [createTabGroup(1, terminal)];

    const backend = createBackend();
    await backend.initialize([firstSession, secondSession]);

    expect(backend.hasLiveTerminal(firstSession.sessionId)).toBe(true);
    expect(backend.hasLiveTerminal(secondSession.sessionId)).toBe(false);
  });

  test("should create a missing managed terminal in editor group one", async () => {
    const session = createTerminalSession(1, 0, "Adding t3 code");
    const backend = createBackend();
    await backend.initialize([session]);

    await backend.createOrAttachSession(session);

    expect(testState.createTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {
          preserveFocus: true,
          viewColumn: 1,
        },
        name: getTerminalSessionSurfaceTitle(session),
      }),
    );
    expect(backend.hasLiveTerminal(session.sessionId)).toBe(true);
  });

  test("should activate the terminal tab before moving it between mixed editor groups", async () => {
    const terminalSession = createTerminalSession(24, 2, "Fixing layout issues");
    const terminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(terminalSession),
    });
    const firstT3Session = createSessionRecord(112, 0, {
      kind: "t3",
      t3: {
        projectId: "project-1",
        serverOrigin: "http://127.0.0.1:3773",
        threadId: "thread-111",
        workspaceRoot: "/workspace",
      },
      title: "T3 Code",
    });
    const secondT3Session = createSessionRecord(96, 1, {
      kind: "t3",
      t3: {
        projectId: "project-1",
        serverOrigin: "http://127.0.0.1:3773",
        threadId: "thread-095",
        workspaceRoot: "/workspace",
      },
      title: "T3 Code",
    });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [
      createTabGroup(
        1,
        createWebviewTab(
          getT3SessionSurfaceTitle({
            alias: "Indicators for Claude",
            displayId: firstT3Session.displayId,
          }),
        ),
        createWebviewTab(
          getT3SessionSurfaceTitle({
            alias: "Adding prev sessions",
            displayId: secondT3Session.displayId,
          }),
        ),
        terminal,
      ),
      createTabGroup(2),
    ];
    activateTabAtIndex(0, 0);

    const backend = createBackend();
    await backend.initialize([terminalSession]);

    await backend.reconcileVisibleTerminals({
      focusedSessionId: terminalSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [terminalSession],
      viewMode: "horizontal",
      visibleCount: 2,
      visibleSessionIds: ["session-111", terminalSession.sessionId],
    });

    expect(testState.executeCommand).toHaveBeenCalledWith("workbench.action.openEditorAtIndex3");
    expect(testState.moveActiveEditorToNextGroup).toHaveBeenCalledTimes(1);
    expect(testState.tabGroupsAll[0]?.tabs.map((tab) => tab.label)).toEqual([
      getT3SessionSurfaceTitle({
        alias: "Indicators for Claude",
        displayId: firstT3Session.displayId,
      }),
      getT3SessionSurfaceTitle({
        alias: "Adding prev sessions",
        displayId: secondT3Session.displayId,
      }),
    ]);
    expect(testState.tabGroupsAll[1]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(terminalSession),
    ]);
  });

  test("should focus an attached terminal session", async () => {
    const session = createTerminalSession(1, 0, "Adding t3 code");
    const terminal = createTerminal({ env: {}, name: getTerminalSessionSurfaceTitle(session) });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [createTabGroup(1, terminal)];

    const backend = createBackend();
    await backend.initialize([session]);

    const changed = await backend.focusSession(session.sessionId, false);

    expect(changed).toBe(true);
    expect(terminal.show).toHaveBeenCalledWith(false);
  });

  test("should no-op when focusing a terminal that is already the active terminal tab", async () => {
    const session = createTerminalSession(1, 0, "Adding t3 code");
    const terminal = createTerminal({ env: {}, name: getTerminalSessionSurfaceTitle(session) });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [createTabGroup(1, terminal)];
    activateTabAtIndex(0, 0);
    testState.activeTerminal = terminal;

    const backend = createBackend();
    await backend.initialize([session]);
    terminal.show.mockClear();

    const changed = await backend.focusSession(session.sessionId, false);

    expect(changed).toBe(true);
    expect(terminal.show).not.toHaveBeenCalled();
  });

  test("should not rename a terminal in response to terminal-state changes", async () => {
    const session = createTerminalSession(1, 0, "Fixing layout issues");
    const terminal = createTerminal({ env: {}, name: getTerminalSessionSurfaceTitle(session) });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [createTabGroup(1, terminal)];
    activateTabAtIndex(0, 0);
    testState.activeTerminal = terminal;

    const backend = createBackend();
    await backend.initialize([session]);

    const handleTerminalStateChange = testState.onDidChangeTerminalState.mock.calls[0]?.[0] as
      | ((terminal: MockTerminal) => void)
      | undefined;

    expect(handleTerminalStateChange).toBeTypeOf("function");

    testState.executeCommand.mockClear();
    terminal.show.mockClear();
    terminal.name = "Codex changed title";
    syncTerminalTabLabels(terminal);

    handleTerminalStateChange?.(terminal);
    await Promise.resolve();

    expect(terminal.show).not.toHaveBeenCalled();
    expect(testState.executeCommand).not.toHaveBeenCalledWith(
      "workbench.action.terminal.renameWithArg",
      expect.anything(),
    );
  });

  test("should persist attention acknowledgements instead of clearing them only in memory", async () => {
    testState.readPersistedSessionStateFromFile.mockImplementation(async () => ({
      agentName: "codex",
      agentStatus: "attention",
      title: "Codex",
    }));

    const session = createTerminalSession(1, 0, "Adding t3 code");
    const terminal = createTerminal({ env: {}, name: getTerminalSessionSurfaceTitle(session) });
    testState.terminals.push(terminal);
    testState.tabGroupsAll = [createTabGroup(1, terminal)];

    const backend = createBackend();
    await backend.initialize([session]);

    await expect(backend.acknowledgeAttention(session.sessionId)).resolves.toBe(true);
    expect(testState.updatePersistedSessionStateFile).toHaveBeenCalledTimes(1);
    expect(backend.getSessionSnapshot(session.sessionId)?.agentStatus).toBe("idle");
  });

  test("should keep a hidden terminal in its current editor group", async () => {
    const firstSession = createTerminalSession(1, 0, "Adding t3 code");
    const secondSession = createTerminalSession(2, 1, "Publish to Store");
    const firstTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(firstSession),
    });
    const secondTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(secondSession),
    });
    testState.terminals.push(firstTerminal, secondTerminal);
    testState.tabGroupsAll = [createTabGroup(1, firstTerminal), createTabGroup(2, secondTerminal)];
    activateTabAtIndex(0, 0);

    const backend = createBackend();
    await backend.initialize([firstSession, secondSession]);

    await backend.reconcileVisibleTerminals({
      focusedSessionId: firstSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [firstSession, secondSession],
      viewMode: "horizontal",
      visibleCount: 1,
      visibleSessionIds: [firstSession.sessionId],
    });

    expect(testState.moveActiveEditorToNextGroup).not.toHaveBeenCalled();
    expect(testState.moveActiveEditorToPreviousGroup).not.toHaveBeenCalled();
    expect(testState.tabGroupsAll[1]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(secondSession),
    ]);
  });

  test("should keep all tracked terminal sessions after single-session attach operations", async () => {
    const firstSession = createTerminalSession(1, 0, "Fixing layout issues");
    const secondSession = createTerminalSession(2, 1, "Scratchpad");
    const firstTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(firstSession),
    });
    const secondTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(secondSession),
    });
    testState.terminals.push(firstTerminal, secondTerminal);
    testState.tabGroupsAll = [createTabGroup(1, firstTerminal), createTabGroup(2, secondTerminal)];
    activateTabAtIndex(0, 0);

    const backend = createBackend();
    await backend.initialize([firstSession, secondSession]);

    await backend.createOrAttachSession(firstSession);
    await backend.reconcileVisibleTerminals({
      focusedSessionId: secondSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [firstSession, secondSession],
      viewMode: "horizontal",
      visibleCount: 2,
      visibleSessionIds: [firstSession.sessionId, secondSession.sessionId],
    });

    expect(backend.getDebugState().layout.trackedSessionIds).toEqual([
      firstSession.sessionId,
      secondSession.sessionId,
    ]);
    expect(testState.tabGroupsAll[0]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(firstSession),
    ]);
    expect(testState.tabGroupsAll[1]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(secondSession),
    ]);
  });

  test("should not activate a hidden terminal that is already parked in the correct group", async () => {
    const firstSession = createTerminalSession(24, 0, "Fixing layout issues");
    const secondSession = createTerminalSession(25, 1, "Atlas");
    const firstTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(firstSession),
    });
    const secondTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(secondSession),
    });
    testState.terminals.push(firstTerminal, secondTerminal);
    testState.tabGroupsAll = [createTabGroup(1, secondTerminal), createTabGroup(2, firstTerminal)];
    activateTabAtIndex(1, 0);
    testState.activeTerminal = firstTerminal;

    const backend = createBackend();
    await backend.initialize([firstSession, secondSession]);
    firstTerminal.show.mockClear();
    secondTerminal.show.mockClear();

    await backend.reconcileVisibleTerminals(
      {
        focusedSessionId: firstSession.sessionId,
        fullscreenRestoreVisibleCount: undefined,
        sessions: [firstSession, secondSession],
        viewMode: "horizontal",
        visibleCount: 2,
        visibleSessionIds: ["session-111", firstSession.sessionId],
      },
      true,
    );

    expect(firstTerminal.show).not.toHaveBeenCalled();
    expect(secondTerminal.show).not.toHaveBeenCalled();
    expect(testState.activeTerminal).toBe(firstTerminal);
    expect(testState.tabGroupsAll[0]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(secondSession),
    ]);
    expect(testState.tabGroupsAll[1]?.tabs.map((tab) => tab.label)).toEqual([
      getTerminalSessionSurfaceTitle(firstSession),
    ]);
  });

  test("should foreground a visible non-focused terminal in its target group", async () => {
    const visibleSession = createTerminalSession(1, 0, "Scratchpad");
    const focusedSession = createTerminalSession(2, 1, "Fixing layout issues");
    const otherVisibleSession = createTerminalSession(3, 2, "Fix Codex/Claude indicators 24");
    const parkedSession = createTerminalSession(4, 3, "Focus mode impr");

    const visibleTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(visibleSession),
    });
    const focusedTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(focusedSession),
    });
    const otherVisibleTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(otherVisibleSession),
    });
    const parkedTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(parkedSession),
    });

    testState.terminals.push(
      visibleTerminal,
      focusedTerminal,
      otherVisibleTerminal,
      parkedTerminal,
    );
    testState.tabGroupsAll = [
      createTabGroup(1, parkedTerminal, visibleTerminal),
      createTabGroup(2, otherVisibleTerminal),
      createTabGroup(3, focusedTerminal),
      createTabGroup(4),
    ];
    activateTabAtIndex(0, 0);
    testState.activeTerminal = parkedTerminal;

    const backend = createBackend();
    await backend.initialize([visibleSession, focusedSession, otherVisibleSession, parkedSession]);
    testState.executeCommand.mockClear();

    await backend.reconcileVisibleTerminals({
      focusedSessionId: focusedSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [visibleSession, focusedSession, otherVisibleSession, parkedSession],
      viewMode: "grid",
      visibleCount: 4,
      visibleSessionIds: [
        visibleSession.sessionId,
        otherVisibleSession.sessionId,
        focusedSession.sessionId,
        "session-999",
      ],
    });

    expect(testState.executeCommand).toHaveBeenCalledWith("workbench.action.openEditorAtIndex2");
    expect(testState.tabGroupsAll[0]?.tabs.find((tab) => tab.isActive)?.label).toBe(
      getTerminalSessionSurfaceTitle(visibleSession),
    );
    expect(testState.activeTerminal).toBe(focusedTerminal);
  });

  test("should not reopen an already active terminal tab in its target group", async () => {
    const leftSession = createTerminalSession(1, 0, "Scratchpad");
    const rightSession = createTerminalSession(2, 1, "Fixing layout issues");

    const leftTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(leftSession),
    });
    const rightTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(rightSession),
    });

    testState.terminals.push(leftTerminal, rightTerminal);
    testState.tabGroupsAll = [createTabGroup(1, leftTerminal), createTabGroup(2, rightTerminal)];
    activateTabAtIndex(1, 0);
    testState.activeTerminal = rightTerminal;

    const backend = createBackend();
    await backend.initialize([leftSession, rightSession]);
    testState.executeCommand.mockClear();

    await backend.reconcileVisibleTerminals({
      focusedSessionId: rightSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [leftSession, rightSession],
      viewMode: "horizontal",
      visibleCount: 1,
      visibleSessionIds: [rightSession.sessionId],
    });

    expect(testState.executeCommand).not.toHaveBeenCalledWith(
      "workbench.action.openEditorAtIndex1",
    );
    expect(testState.activeTerminal).toBe(rightTerminal);
  });

  test("should restore the focused visible terminal after staging other visible terminals", async () => {
    const leftSession = createTerminalSession(1, 0, "Scratchpad");
    const focusedSession = createTerminalSession(2, 1, "Fixing layout issues");
    const rightSession = createTerminalSession(3, 2, "Fix Codex/Claude indicators 24");
    const parkedSession = createTerminalSession(4, 3, "Focus mode impr");

    const leftTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(leftSession),
    });
    const focusedTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(focusedSession),
    });
    const rightTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(rightSession),
    });
    const parkedTerminal = createTerminal({
      env: {},
      name: getTerminalSessionSurfaceTitle(parkedSession),
    });

    testState.terminals.push(leftTerminal, focusedTerminal, rightTerminal, parkedTerminal);
    testState.tabGroupsAll = [
      createTabGroup(1, parkedTerminal, leftTerminal),
      createTabGroup(2, focusedTerminal),
      createTabGroup(3, rightTerminal),
      createTabGroup(4),
    ];
    activateTabAtIndex(2, 0);
    testState.activeTerminal = rightTerminal;

    const backend = createBackend();
    await backend.initialize([leftSession, focusedSession, rightSession, parkedSession]);

    await backend.reconcileVisibleTerminals({
      focusedSessionId: focusedSession.sessionId,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [leftSession, focusedSession, rightSession, parkedSession],
      viewMode: "grid",
      visibleCount: 4,
      visibleSessionIds: [
        leftSession.sessionId,
        focusedSession.sessionId,
        "session-999",
        rightSession.sessionId,
      ],
    });

    expect(testState.activeTerminal).toBe(focusedTerminal);
  });
});

function createBackend(): NativeTerminalWorkspaceBackend {
  return new NativeTerminalWorkspaceBackend({
    context: {
      globalStorageUri: { fsPath: "/tmp/vsmux" },
      workspaceState: testState.workspaceState,
    } as never,
    ensureShellSpawnAllowed: async () => true,
    workspaceId: "workspace-1",
  });
}

function createTerminal(options: Record<string, unknown>): MockTerminal {
  const terminal: MockTerminal = {
    creationOptions: options,
    dispose: vi.fn(),
    exitStatus: undefined,
    name: String(options.name ?? ""),
    processId: Promise.resolve(Math.floor(Math.random() * 10_000) + 1),
    sendText: vi.fn(),
    show: vi.fn(() => {
      testState.activeTerminal = terminal;
    }),
  };
  return terminal;
}

function createTabGroup(
  viewColumn: number,
  ...tabsOrTerminals: Array<MockTerminal | MockTab>
): MockTabGroup {
  const group: MockTabGroup = {
    isActive: false,
    tabs: [],
    viewColumn,
  };
  for (const candidate of tabsOrTerminals) {
    if ("creationOptions" in candidate) {
      group.tabs.push(createTerminalTab(candidate, group));
      continue;
    }

    const tab = {
      ...candidate,
      group,
    };
    group.tabs.push(tab);
  }
  return group;
}

function createTerminalTab(terminal: MockTerminal, group: MockTabGroup): MockTab {
  return {
    group,
    isActive: false,
    input: new testState.TabInputTerminalClass(),
    label: terminal.name,
    terminal,
  };
}

function createWebviewTab(label: string): MockTab {
  return {
    group: undefined as never,
    isActive: false,
    input: { viewType: "mainThreadWebview-VSmux.t3Session" },
    label,
  };
}

function createTerminalSession(sessionNumber: number, slotIndex: number, alias: string) {
  const session = createSessionRecord(sessionNumber, slotIndex);
  return {
    ...session,
    alias,
  };
}

function setActiveGroup(index: number): void {
  testState.activeTabGroupIndex = index;
  for (const [groupIndex, group] of testState.tabGroupsAll.entries()) {
    group.isActive = groupIndex === index;
  }
}

function activateTabAtIndex(groupIndex: number, tabIndex: number): void {
  const group = testState.tabGroupsAll[groupIndex];
  if (!group) {
    return;
  }

  setActiveGroup(groupIndex);
  for (const tab of group.tabs) {
    tab.isActive = false;
  }

  const tab = group.tabs[tabIndex];
  if (!tab) {
    return;
  }

  tab.isActive = true;
}

function activateTabByLabel(groupIndex: number, label: string): void {
  const group = testState.tabGroupsAll[groupIndex];
  if (!group) {
    return;
  }

  const tabIndex = group.tabs.findIndex((tab) => tab.label === label);
  if (tabIndex >= 0) {
    activateTabAtIndex(groupIndex, tabIndex);
  }
}

function moveActiveEditor(direction: 1 | -1): void {
  const sourceGroup = testState.tabGroupsAll[testState.activeTabGroupIndex];
  if (!sourceGroup) {
    return;
  }

  const activeTabIndex = sourceGroup.tabs.findIndex((tab) => tab.isActive);
  if (activeTabIndex < 0) {
    return;
  }

  const targetGroupIndex = testState.activeTabGroupIndex + direction;
  if (targetGroupIndex < 0) {
    return;
  }

  const targetGroup =
    testState.tabGroupsAll[targetGroupIndex] ?? createTabGroup(targetGroupIndex + 1);
  testState.tabGroupsAll[targetGroupIndex] = targetGroup;

  const [activeTab] = sourceGroup.tabs.splice(activeTabIndex, 1);
  if (!activeTab) {
    return;
  }

  activeTab.group = targetGroup;
  activeTab.isActive = false;
  targetGroup.tabs.push(activeTab);
  activateTabAtIndex(targetGroupIndex, targetGroup.tabs.length - 1);
}

function removeTerminalTabs(terminal: MockTerminal): void {
  for (const group of testState.tabGroupsAll) {
    group.tabs = group.tabs.filter((tab) => {
      return tab.terminal !== terminal;
    });
  }
}

function syncTerminalTabLabels(terminal: MockTerminal): void {
  for (const group of testState.tabGroupsAll) {
    for (const tab of group.tabs) {
      if (tab.terminal === terminal) {
        tab.label = terminal.name;
      }
    }
  }
}
