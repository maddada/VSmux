import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  createSessionRecord,
  getTerminalSessionSurfaceTitle,
} from "../shared/session-grid-contract";
import { NativeTerminalWorkspaceBackend } from "./native-terminal-workspace-backend";
import { createZellijAttachArgs } from "./zellij-shell-command";

const testState = vi.hoisted(() => ({
  activeTerminal: undefined as MockTerminal | undefined,
  buildZellijUiProfile: vi.fn(() => ({
    configContent: "show_startup_tips false\n",
    layoutContent: "layout {\n    pane\n}\n",
  })),
  createTerminal: vi.fn((options: Record<string, unknown>) => {
    const terminal = createTerminal(options);
    testState.terminals.push(terminal);
    return terminal;
  }),
  ensureBundledZellijBinaryIsExecutable: vi.fn(async () => "/bundled/zellij"),
  executeCommand: vi.fn(async () => undefined),
  killSession: vi.fn(async () => undefined),
  onDidChangeActiveTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTerminalShellIntegration: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTerminalState: vi.fn(() => ({ dispose: vi.fn() })),
  onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidOpenTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  probeSession: vi.fn(async () => ({
    sessionId: "session-1",
  })),
  readPersistedSessionStateFromFile: vi.fn(async () => ({
    agentName: "codex",
    agentStatus: "idle",
    title: "Codex",
  })),
  readZellijUiSettings: vi.fn(() => ({
    customConfigKdl: "",
    customLayoutKdl: "",
    mode: "native",
  })),
  sendInput: vi.fn(async () => undefined),
  terminals: [] as MockTerminal[],
  updatePersistedSessionStateFile: vi.fn(async (_filePath, updater) =>
    updater({
      agentName: "codex",
      agentStatus: "attention",
      title: "Codex",
    }),
  ),
  writeZellijUiProfile: vi.fn(async () => ({
    configPath: "/storage/zellij-ui-profiles/workspace-1.config.kdl",
    layoutPath: "/storage/zellij-ui-profiles/workspace-1.layout.kdl",
  })),
}));

type MockTerminal = {
  creationOptions: Record<string, unknown>;
  dispose: ReturnType<typeof vi.fn>;
  exitStatus: undefined | { code: number };
  name: string;
  sendText: ReturnType<typeof vi.fn>;
  shellIntegration: object | undefined;
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
  TabInputTerminal: class MockTabInputTerminal {},
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
    onDidChangeTerminalShellIntegration: testState.onDidChangeTerminalShellIntegration,
    onDidChangeTerminalState: testState.onDidChangeTerminalState,
    onDidCloseTerminal: testState.onDidCloseTerminal,
    onDidOpenTerminal: testState.onDidOpenTerminal,
    tabGroups: {
      activeTabGroup: undefined,
      all: [],
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

vi.mock("./zellij-bundled-binary", () => ({
  ensureBundledZellijBinaryIsExecutable: testState.ensureBundledZellijBinaryIsExecutable,
}));

vi.mock("./zellij-session-runtime", () => ({
  ZellijSessionRuntime: class MockZellijSessionRuntime {
    public killSession = testState.killSession;
    public probeSession = testState.probeSession;
    public sendInput = testState.sendInput;
  },
}));

vi.mock("./zellij-ui-profile", () => ({
  buildZellijUiProfile: testState.buildZellijUiProfile,
  readZellijUiSettings: testState.readZellijUiSettings,
  writeZellijUiProfile: testState.writeZellijUiProfile,
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
  focusEditorGroupByIndex: vi.fn(async () => true),
  getDefaultWorkspaceCwd: () => "/workspace",
  getViewColumn: (index: number) => index + 1,
  moveActiveEditorToNextGroup: vi.fn(async () => undefined),
  moveActiveEditorToPreviousGroup: vi.fn(async () => undefined),
  moveActiveTerminalToEditor: vi.fn(async () => undefined),
  moveActiveTerminalToPanel: vi.fn(async () => undefined),
}));

vi.mock("./session-state-file", () => ({
  readPersistedSessionStateFromFile: testState.readPersistedSessionStateFromFile,
  updatePersistedSessionStateFile: testState.updatePersistedSessionStateFile,
}));

describe("NativeTerminalWorkspaceBackend", () => {
  beforeEach(() => {
    testState.activeTerminal = undefined;
    testState.buildZellijUiProfile.mockClear();
    testState.createTerminal.mockClear();
    testState.ensureBundledZellijBinaryIsExecutable.mockClear();
    testState.executeCommand.mockClear();
    testState.killSession.mockClear();
    testState.probeSession.mockClear();
    testState.probeSession.mockImplementation(async () => ({
      sessionId: "session-1",
    }));
    testState.readPersistedSessionStateFromFile.mockClear();
    testState.readZellijUiSettings.mockClear();
    testState.sendInput.mockClear();
    testState.terminals = [];
    testState.updatePersistedSessionStateFile.mockClear();
    testState.writeZellijUiProfile.mockClear();
  });

  test("should create bundled zellij attach terminals for focused sessions", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.focusSession(session.sessionId);

    expect(testState.createTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          VSMUX_SESSION_ID: session.sessionId,
          VSMUX_SESSION_STATE_FILE: "/storage/terminal-session-state/session-1.env",
          VSMUX_WORKSPACE_ID: "workspace-1",
        }),
        cwd: "/workspace",
        name: getTerminalSessionSurfaceTitle(session),
      }),
    );
    expect(testState.terminals[0]?.creationOptions).toEqual(
      expect.objectContaining({
        shellArgs: createZellijAttachArgs(
          "/storage/zellij-ui-profiles/workspace-1.config.kdl",
          session.sessionId,
          true,
          "/storage/zellij-ui-profiles/workspace-1.layout.kdl",
        ),
        shellPath: "/bundled/zellij",
      }),
    );
    expect(backend.hasAttachedTerminal(session.sessionId)).toBe(true);
    expect(backend.hasLiveTerminal(session.sessionId)).toBe(true);
  });

  test("should dispose hidden attach terminals without killing the session daemon", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.focusSession(session.sessionId);
    const attachedTerminal = testState.terminals[0];

    await backend.reconcileVisibleTerminals(
      {
        focusedSessionId: undefined,
        fullscreenRestoreVisibleCount: undefined,
        sessions: [session],
        viewMode: "grid",
        visibleCount: 1,
        visibleSessionIds: [],
      },
      false,
    );

    expect(attachedTerminal?.dispose).toHaveBeenCalledTimes(1);
    expect(testState.killSession).not.toHaveBeenCalled();
    expect(backend.hasAttachedTerminal(session.sessionId)).toBe(false);
  });

  test("should recreate disposed attach terminals when refocusing a session", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.focusSession(session.sessionId);

    const firstTerminal = testState.terminals[0];
    expect(firstTerminal).toBeDefined();
    firstTerminal!.exitStatus = { code: 0 };
    testState.activeTerminal = undefined;

    await expect(backend.focusSession(session.sessionId)).resolves.toBe(true);

    expect(testState.createTerminal).toHaveBeenCalledTimes(2);
    expect(testState.terminals[1]).toBeDefined();
    expect(testState.terminals[1]).not.toBe(firstTerminal);
    expect(testState.terminals[1]?.creationOptions).toEqual(
      expect.objectContaining({
        cwd: "/workspace",
        shellArgs: createZellijAttachArgs(
          "/storage/zellij-ui-profiles/workspace-1.config.kdl",
          session.sessionId,
          false,
          "/storage/zellij-ui-profiles/workspace-1.layout.kdl",
        ),
        shellPath: "/bundled/zellij",
      }),
    );
  });

  test("should ignore stale terminals that still appear in the VS Code terminal list", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.focusSession(session.sessionId);

    const firstTerminal = testState.terminals[0];
    expect(firstTerminal).toBeDefined();
    firstTerminal!.show.mockImplementation(() => {
      throw new Error("Terminal has already been disposed");
    });
    testState.activeTerminal = undefined;

    await expect(backend.focusSession(session.sessionId)).resolves.toBe(true);

    expect(testState.createTerminal).toHaveBeenCalledTimes(2);
    expect(testState.terminals[1]).toBeDefined();
    expect(testState.terminals[1]).not.toBe(firstTerminal);
  });

  test("should write input directly to the bundled zellij session", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.writeText(session.sessionId, "codex resume 'Harbor Vale'", true);

    expect(testState.sendInput).toHaveBeenCalledWith(
      session.sessionId,
      "codex resume 'Harbor Vale'",
      true,
    );
  });
});

function createBackend(): NativeTerminalWorkspaceBackend {
  return new NativeTerminalWorkspaceBackend({
    context: {
      globalStorageUri: {
        fsPath: "/storage",
      },
      extensionUri: {
        fsPath: "/extension-root",
      },
    } as never,
    ensureShellSpawnAllowed: async () => true,
    workspaceId: "workspace-1",
  });
}

function createTerminal(options: Record<string, unknown>): MockTerminal {
  const terminal = {
    creationOptions: options,
    dispose: vi.fn(() => {
      terminal.exitStatus = { code: 0 };
      testState.terminals = testState.terminals.filter((candidate) => candidate !== terminal);
      if (testState.activeTerminal === terminal) {
        testState.activeTerminal = undefined;
      }
    }),
    exitStatus: undefined,
    name: String(options.name ?? "terminal"),
    sendText: vi.fn(),
    shellIntegration: {},
    show: vi.fn(() => {
      if (terminal.exitStatus) {
        throw new Error("Terminal has already been disposed");
      }
      testState.activeTerminal = terminal;
    }),
  } satisfies MockTerminal;

  return terminal;
}
