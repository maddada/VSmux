import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  createSessionRecord,
  getTerminalSessionSurfaceTitle,
} from "../shared/session-grid-contract";
import { NativeTerminalWorkspaceBackend } from "./native-terminal-workspace-backend";
import { createTsmAttachShellCommand } from "./tsm-shell-command";

const testState = vi.hoisted(() => ({
  activeTerminal: undefined as MockTerminal | undefined,
  createTerminal: vi.fn((options: Record<string, unknown>) => {
    const terminal = createTerminal(options);
    testState.terminals.push(terminal);
    return terminal;
  }),
  ensureBundledTsmBinaryIsExecutable: vi.fn(async () => "/bundled/tsm"),
  ensureSession: vi.fn(async () => undefined),
  executeCommand: vi.fn(async () => undefined),
  killSession: vi.fn(async () => undefined),
  onDidChangeActiveTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTerminalState: vi.fn(() => ({ dispose: vi.fn() })),
  onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  onDidOpenTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  probeSession: vi.fn(async () => ({
    attachedClientCount: 0,
    cwd: "/workspace",
    processId: 1234,
  })),
  readPersistedSessionStateFromFile: vi.fn(async () => ({
    agentName: "codex",
    agentStatus: "idle",
    title: "Codex",
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

vi.mock("./agent-shell-integration", () => ({
  ensureAgentShellIntegration: vi.fn(async () => ({
    binDir: "/bin",
    claudeSettingsPath: "/claude.json",
    notifyPath: "/notify.js",
    opencodeConfigDir: "/opencode",
    zshDotDir: "/zsh",
  })),
}));

vi.mock("./tsm-bundled-binary", () => ({
  ensureBundledTsmBinaryIsExecutable: testState.ensureBundledTsmBinaryIsExecutable,
}));

vi.mock("./tsm-session-runtime", () => ({
  TsmSessionRuntime: class MockTsmSessionRuntime {
    public createAttachEnvironment(environment: Record<string, string>): Record<string, string> {
      return {
        ...environment,
        TSM_DIR: "/tmp/vsmux-tsm-test",
      };
    }

    public ensureSession = testState.ensureSession;
    public getSocketDirectory(): string {
      return "/tmp/vsmux-tsm-test";
    }
    public killSession = testState.killSession;
    public probeSession = testState.probeSession;
    public sendInput = testState.sendInput;
  },
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
  getDefaultShell: () => "/bin/zsh",
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
    testState.createTerminal.mockClear();
    testState.ensureBundledTsmBinaryIsExecutable.mockClear();
    testState.ensureSession.mockClear();
    testState.executeCommand.mockClear();
    testState.killSession.mockClear();
    testState.probeSession.mockClear();
    testState.probeSession.mockImplementation(async () => ({
      attachedClientCount: 0,
      cwd: "/workspace",
      processId: 1234,
    }));
    testState.readPersistedSessionStateFromFile.mockClear();
    testState.sendInput.mockClear();
    testState.terminals = [];
    testState.updatePersistedSessionStateFile.mockClear();
  });

  test("should create bundled tsm attach terminals for focused sessions", async () => {
    const session = createSessionRecord(1, 1);
    const backend = createBackend();

    await backend.initialize([session]);
    await backend.createOrAttachSession(session);
    await backend.focusSession(session.sessionId);

    expect(testState.ensureSession).toHaveBeenCalledWith(session.sessionId, {
      cwd: "/workspace",
      environment: expect.objectContaining({
        PATH: expect.stringContaining("/bin"),
        VSMUX_SESSION_ID: session.sessionId,
        VSMUX_SESSION_STATE_FILE: "/storage/terminal-session-state/session-1.env",
        VSMUX_WORKSPACE_ID: "workspace-1",
        ZDOTDIR: "/zsh",
      }),
      shellPath: "/bin/zsh",
    });
    expect(testState.createTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: getTerminalSessionSurfaceTitle(session),
      }),
    );
    expect(testState.terminals[0]?.sendText).toHaveBeenCalledWith(
      createTsmAttachShellCommand("/bundled/tsm", session.sessionId, "/tmp/vsmux-tsm-test"),
      true,
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

  test("should write input directly to the bundled tsm daemon", async () => {
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
