import * as path from "node:path";
import * as vscode from "vscode";
import type {
  NativeTerminalBackendDebugState,
  NativeTerminalLayoutDebugState,
  NativeTerminalDebugProjection,
} from "../shared/native-terminal-debug-contract";
import {
  getTerminalSessionSurfaceTitle,
  isTerminalSession,
  type SessionGridSnapshot,
  type SessionRecord,
  type TerminalSessionRecord,
} from "../shared/session-grid-contract";
import type {
  TerminalAgentStatus,
  TerminalSessionSnapshot,
} from "../shared/terminal-host-protocol";
import {
  createManagedTerminalEnvironment,
  getManagedTerminalIdentity,
} from "./native-managed-terminal";
import type {
  TerminalWorkspaceBackend,
  TerminalWorkspaceBackendTitleChange,
} from "./terminal-workspace-backend";
import {
  createDisconnectedSessionSnapshot,
  focusEditorGroupByIndex,
  getDefaultWorkspaceCwd,
  getViewColumn,
  moveActiveEditorToNextGroup,
  moveActiveEditorToPreviousGroup,
  moveActiveTerminalToEditor,
  moveActiveTerminalToPanel,
} from "./terminal-workspace-helpers";
import { createWorkspaceTrace } from "./runtime-trace";
import {
  readPersistedSessionStateFromFile,
  updatePersistedSessionStateFile,
  type PersistedSessionState,
} from "./session-state-file";
import { ensureBundledZellijBinaryIsExecutable } from "./zellij-bundled-binary";
import { ZellijSessionRuntime } from "./zellij-session-runtime";
import { createZellijAttachArgs } from "./zellij-shell-command";
import {
  buildZellijUiProfile,
  readZellijUiSettings,
  writeZellijUiProfile,
} from "./zellij-ui-profile";

const AGENT_STATE_DIR_NAME = "terminal-session-state";
const POLL_INTERVAL_MS = 500;
const OPEN_EDITOR_AT_INDEX_COMMAND_PREFIX = "workbench.action.openEditorAtIndex";
const SESSION_ATTACH_RETRY_COUNT = 100;
const SESSION_ATTACH_RETRY_DELAY_MS = 100;
const TERMINAL_RENAME_COMMAND = "workbench.action.terminal.renameWithArg";
const TRACE_FILE_NAME = "native-terminal-reconcile.log";

type NativeTerminalWorkspaceBackendOptions = {
  context: vscode.ExtensionContext;
  ensureShellSpawnAllowed: () => Promise<boolean>;
  workspaceId: string;
};

type SessionProjection = {
  sessionId: string;
  terminal: vscode.Terminal;
};

export class NativeTerminalWorkspaceBackend implements TerminalWorkspaceBackend {
  private readonly activateSessionEmitter = new vscode.EventEmitter<string>();
  private readonly changeDebugStateEmitter = new vscode.EventEmitter<void>();
  private readonly changeSessionsEmitter = new vscode.EventEmitter<void>();
  private readonly changeSessionTitleEmitter =
    new vscode.EventEmitter<TerminalWorkspaceBackendTitleChange>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly lastKnownPersistedStateBySessionId = new Map<string, PersistedSessionState>();
  private readonly lastTerminalActivityAtBySessionId = new Map<string, number>();
  private pollTimer: NodeJS.Timeout | undefined;
  private readonly projections = new Map<string, SessionProjection>();
  private reconcileDepth = 0;
  private readonly sessionRecordBySessionId = new Map<string, TerminalSessionRecord>();
  private readonly sessionTitleBySessionId = new Map<string, string>();
  private readonly sessions = new Map<string, TerminalSessionSnapshot>();
  private readonly staleTerminals = new WeakSet<vscode.Terminal>();
  private readonly terminalToSessionId = new Map<vscode.Terminal, string>();
  private readonly trace = createWorkspaceTrace(TRACE_FILE_NAME);
  private bundledZellijBinaryPath: string | undefined;
  private zellijRuntime: ZellijSessionRuntime | undefined;

  public readonly onDidActivateSession = this.activateSessionEmitter.event;
  public readonly onDidChangeDebugState = this.changeDebugStateEmitter.event;
  public readonly onDidChangeSessions = this.changeSessionsEmitter.event;
  public readonly onDidChangeSessionTitle = this.changeSessionTitleEmitter.event;

  public constructor(private readonly options: NativeTerminalWorkspaceBackendOptions) {}

  public async initialize(sessionRecords: readonly SessionRecord[]): Promise<void> {
    this.bundledZellijBinaryPath = await ensureBundledZellijBinaryIsExecutable(this.options.context);
    this.zellijRuntime = new ZellijSessionRuntime(this.bundledZellijBinaryPath);
    this.syncSessions(sessionRecords);
    await this.trace.reset();

    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        void this.attachManagedTerminal(terminal);
      }),
      vscode.window.onDidCloseTerminal((terminal) => {
        const sessionId = this.terminalToSessionId.get(terminal);
        this.markTerminalStale(terminal);
        if (!sessionId) {
          return;
        }

        this.terminalToSessionId.delete(terminal);
        this.projections.delete(sessionId);
        void this.refreshSessionSnapshot(sessionId).then(({ didChangeSnapshot, titleChange }) => {
          if (titleChange) {
            this.changeSessionTitleEmitter.fire(titleChange);
          }
          if (didChangeSnapshot) {
            this.changeSessionsEmitter.fire();
          }
          this.changeDebugStateEmitter.fire();
        });
      }),
      vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (!terminal) {
          return;
        }

        const sessionId = this.terminalToSessionId.get(terminal);
        if (!sessionId || this.reconcileDepth > 0) {
          return;
        }

        this.activateSessionEmitter.fire(sessionId);
      }),
      vscode.window.onDidChangeTerminalState((terminal) => {
        void this.attachManagedTerminal(terminal).then(async () => {
          const sessionId = this.terminalToSessionId.get(terminal);
          if (!sessionId) {
            return;
          }

          this.lastTerminalActivityAtBySessionId.set(sessionId, Date.now());
          await this.syncTerminalName(terminal, sessionId);
          const { didChangeSnapshot, titleChange } = await this.refreshSessionSnapshot(sessionId);
          if (titleChange) {
            this.changeSessionTitleEmitter.fire(titleChange);
          }
          if (didChangeSnapshot) {
            this.changeSessionsEmitter.fire();
          }
          this.changeDebugStateEmitter.fire();
        });
      }),
    );

    for (const terminal of vscode.window.terminals) {
      await this.attachManagedTerminal(terminal);
    }

    await this.refreshSessionSnapshots();
    this.pollTimer = setInterval(() => {
      void this.refreshSessionSnapshots();
    }, POLL_INTERVAL_MS);
  }

  public async syncConfiguration(): Promise<void> {}

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }

    this.activateSessionEmitter.dispose();
    this.changeDebugStateEmitter.dispose();
    this.changeSessionsEmitter.dispose();
    this.changeSessionTitleEmitter.dispose();
  }

  public async clearDebugArtifacts(): Promise<void> {
    await this.trace.reset();
  }

  public getTraceState(): {
    layout: NativeTerminalLayoutDebugState;
    sessions: Array<{
      agentStatus: TerminalAgentStatus;
      sessionId: string;
      status: TerminalSessionSnapshot["status"];
      terminalName?: string;
    }>;
  } {
    return {
      layout: this.captureLayoutState(),
      sessions: [...this.sessions.entries()].map(([sessionId, snapshot]) => ({
        agentStatus: snapshot.agentStatus,
        sessionId,
        status: snapshot.status,
        terminalName:
          this.projections.get(sessionId)?.terminal.name ??
          this.projections.get(sessionId)?.terminal.creationOptions.name,
      })),
    };
  }

  public getDebugState(): NativeTerminalBackendDebugState {
    return {
      currentMoveAction: undefined,
      lastVisibleSnapshot: undefined,
      layout: this.captureLayoutState(),
      matchVisibleTerminalOrder: false,
      moveHistory: [],
      nativeTerminalActionDelayMs: 0,
      observedAt: new Date().toISOString(),
      workspaceId: this.options.workspaceId,
    };
  }

  public hasAttachedTerminal(sessionId: string): boolean {
    const projection = this.projections.get(sessionId);
    return Boolean(projection && this.isReusableTerminal(projection.terminal));
  }

  public getLastTerminalActivityAt(sessionId: string): number | undefined {
    return this.lastTerminalActivityAtBySessionId.get(sessionId);
  }

  public hasLiveTerminal(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.status === "running";
  }

  public async acknowledgeAttention(sessionId: string): Promise<boolean> {
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot || snapshot.agentStatus !== "attention") {
      return false;
    }

    const persistedState = await updatePersistedSessionStateFile(
      this.getSessionAgentStateFilePath(sessionId),
      (currentState) => {
        if (currentState.agentStatus !== "attention") {
          return currentState;
        }

        return {
          ...currentState,
          agentName: snapshot.agentName ?? currentState.agentName,
          agentStatus: "idle",
        };
      },
    ).catch(() => undefined);

    const nextSnapshot = {
      ...snapshot,
      agentName: persistedState?.agentName ?? snapshot.agentName,
      agentStatus: persistedState?.agentStatus ?? "idle",
    } satisfies TerminalSessionSnapshot;
    this.sessions.set(sessionId, nextSnapshot);

    if (!haveSameTerminalSessionSnapshot(snapshot, nextSnapshot)) {
      this.changeSessionsEmitter.fire();
    }

    return nextSnapshot.agentStatus === "idle";
  }

  public async createOrAttachSession(
    sessionRecord: SessionRecord,
  ): Promise<TerminalSessionSnapshot> {
    if (!isTerminalSession(sessionRecord)) {
      return (
        this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId)
      );
    }

    this.upsertSession(sessionRecord);
    await this.ensureAttachedTerminal(sessionRecord, {
      bootstrapSession: true,
    });
    await this.refreshSessionSnapshot(sessionRecord.sessionId);
    return this.sessions.get(sessionRecord.sessionId)!;
  }

  public canReuseVisibleLayout(_snapshot: SessionGridSnapshot): boolean {
    return false;
  }

  public async focusSession(sessionId: string, preserveFocus = false): Promise<boolean> {
    const sessionRecord = this.sessionRecordBySessionId.get(sessionId);
    if (!sessionRecord) {
      return false;
    }

    let projection = await this.ensureAttachedTerminal(sessionRecord);
    if (this.isTerminalTabActive(sessionId, projection.terminal)) {
      return true;
    }

    try {
      projection.terminal.show(preserveFocus);
    } catch (error) {
      if (!isDisposedTerminalError(error)) {
        throw error;
      }

      this.markTerminalStale(projection.terminal);
      projection = await this.ensureAttachedTerminal(sessionRecord);
      projection.terminal.show(preserveFocus);
    }

    return true;
  }

  public getSessionSnapshot(sessionId: string): TerminalSessionSnapshot | undefined {
    return this.sessions.get(sessionId);
  }

  public async killSession(sessionId: string): Promise<void> {
    this.projections.get(sessionId)?.terminal.dispose();
    this.projections.delete(sessionId);
    await this.runtime.killSession(sessionId);
    await this.refreshSessionSnapshot(sessionId);
  }

  public async reconcileVisibleTerminals(
    snapshot: SessionGridSnapshot,
    preserveFocus = false,
  ): Promise<void> {
    const visibleTerminalSessionIds = new Set(
      snapshot.visibleSessionIds.filter((sessionId) => this.sessionRecordBySessionId.has(sessionId)),
    );

    for (const [sessionId, projection] of [...this.projections.entries()]) {
      if (visibleTerminalSessionIds.has(sessionId)) {
        continue;
      }

      projection.terminal.dispose();
      this.projections.delete(sessionId);
    }

    const focusedSessionId = snapshot.focusedSessionId ?? snapshot.visibleSessionIds[0];
    const placements = [...this.sessionRecordBySessionId.values()]
      .filter((sessionRecord) => visibleTerminalSessionIds.has(sessionRecord.sessionId))
      .map((sessionRecord) => {
        const visibleIndex = snapshot.visibleSessionIds.indexOf(sessionRecord.sessionId);
        return {
          isFocused: focusedSessionId === sessionRecord.sessionId,
          sessionRecord,
          targetGroupIndex: Math.max(0, visibleIndex),
        };
      });

    placements.sort(compareTerminalPlacements);

    this.reconcileDepth += 1;
    try {
      for (const placement of placements) {
        await this.placeTerminal(
          placement.sessionRecord,
          placement.targetGroupIndex,
          placement.isFocused && !preserveFocus,
        );
      }
    } finally {
      this.reconcileDepth = Math.max(0, this.reconcileDepth - 1);
    }

    await this.refreshSessionSnapshots();
  }

  public async renameSession(sessionRecord: SessionRecord): Promise<void> {
    if (!isTerminalSession(sessionRecord)) {
      return;
    }

    this.upsertSession(sessionRecord);
    const projection = this.projections.get(sessionRecord.sessionId);
    if (!projection) {
      return;
    }

    await this.syncTerminalName(projection.terminal, sessionRecord.sessionId);
  }

  public async restartSession(sessionRecord: SessionRecord): Promise<TerminalSessionSnapshot> {
    if (!isTerminalSession(sessionRecord)) {
      return (
        this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId)
      );
    }

    await this.killSession(sessionRecord.sessionId);
    return this.createOrAttachSession(sessionRecord);
  }

  public async writeText(sessionId: string, data: string, shouldExecute = true): Promise<void> {
    const sessionRecord = this.sessionRecordBySessionId.get(sessionId);
    if (!sessionRecord) {
      return;
    }

    if (!(await this.runtime.probeSession(sessionId))) {
      await this.ensureAttachedTerminal(sessionRecord, {
        bootstrapSession: true,
        forceNewTerminal: true,
      });
    }
    await this.runtime.sendInput(sessionId, data, shouldExecute);
    this.lastTerminalActivityAtBySessionId.set(sessionId, Date.now());
  }

  public async moveManagedTerminalsToPanel(): Promise<void> {
    const projections = [...this.projections.values()].sort((left, right) => {
      const leftGroupIndex = this.findTerminalGroupIndex(left.sessionId) ?? Number.MAX_SAFE_INTEGER;
      const rightGroupIndex =
        this.findTerminalGroupIndex(right.sessionId) ?? Number.MAX_SAFE_INTEGER;
      if (leftGroupIndex !== rightGroupIndex) {
        return leftGroupIndex - rightGroupIndex;
      }

      return left.sessionId.localeCompare(right.sessionId);
    });

    for (const projection of projections) {
      const groupIndex = this.findTerminalGroupIndex(projection.sessionId);
      if (groupIndex === undefined) {
        continue;
      }

      await this.activateTerminalEditorTab(projection.sessionId, groupIndex);
      await moveActiveTerminalToPanel();
    }

    await this.refreshSessionSnapshots();
  }

  public syncSessions(sessionRecords: readonly SessionRecord[]): void {
    const nextSessionRecords = sessionRecords.filter(isTerminalSession);
    const nextSessionIdSet = new Set(
      nextSessionRecords.map((sessionRecord) => sessionRecord.sessionId),
    );

    for (const sessionRecord of nextSessionRecords) {
      this.upsertSession(sessionRecord);
    }

    for (const sessionId of [...this.sessionRecordBySessionId.keys()]) {
      if (nextSessionIdSet.has(sessionId)) {
        continue;
      }

      this.sessionRecordBySessionId.delete(sessionId);
      this.sessionTitleBySessionId.delete(sessionId);
      this.lastKnownPersistedStateBySessionId.delete(sessionId);
      this.lastTerminalActivityAtBySessionId.delete(sessionId);
      this.sessions.delete(sessionId);
      this.projections.get(sessionId)?.terminal.dispose();
      this.projections.delete(sessionId);
    }
  }

  private get runtime(): ZellijSessionRuntime {
    if (!this.zellijRuntime) {
      throw new Error("Bundled zellij runtime is not initialized.");
    }

    return this.zellijRuntime;
  }

  private upsertSession(sessionRecord: TerminalSessionRecord): void {
    this.sessionRecordBySessionId.set(sessionRecord.sessionId, sessionRecord);
    this.sessions.set(
      sessionRecord.sessionId,
      this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId),
    );
  }

  private async ensureShellSpawnAllowedOrThrow(
    sessionRecord: TerminalSessionRecord,
  ): Promise<void> {
    if (!(await this.options.ensureShellSpawnAllowed())) {
      const disconnectedSnapshot = createDisconnectedSessionSnapshot(
        sessionRecord.sessionId,
        this.options.workspaceId,
        "error",
      );
      disconnectedSnapshot.errorMessage = "Shell creation blocked in an untrusted workspace.";
      this.sessions.set(sessionRecord.sessionId, disconnectedSnapshot);
      this.changeSessionsEmitter.fire();
      throw new Error("Shell creation blocked in an untrusted workspace.");
    }
  }

  private async placeTerminal(
    sessionRecord: TerminalSessionRecord,
    targetGroupIndex: number,
    shouldFocus: boolean,
  ): Promise<void> {
    const projection = await this.ensureAttachedTerminal(sessionRecord);
    await this.syncTerminalName(projection.terminal, sessionRecord.sessionId);

    let currentGroupIndex = this.findTerminalGroupIndex(sessionRecord.sessionId);
    const restoreViewColumn = !shouldFocus
      ? vscode.window.tabGroups.activeTabGroup?.viewColumn
      : undefined;

    if (currentGroupIndex === undefined) {
      projection.terminal.show(false);
      await this.waitForActiveTerminal(projection.terminal);
      await focusEditorGroupByIndex(targetGroupIndex);
      await moveActiveTerminalToEditor();
      currentGroupIndex = this.findTerminalGroupIndex(sessionRecord.sessionId);
    }

    while (currentGroupIndex !== undefined && currentGroupIndex < targetGroupIndex) {
      await this.activateTerminalEditorTab(sessionRecord.sessionId, currentGroupIndex);
      await moveActiveEditorToNextGroup();
      currentGroupIndex =
        this.findTerminalGroupIndex(sessionRecord.sessionId) ?? currentGroupIndex + 1;
    }

    while (currentGroupIndex !== undefined && currentGroupIndex > targetGroupIndex) {
      await this.activateTerminalEditorTab(sessionRecord.sessionId, currentGroupIndex);
      await moveActiveEditorToPreviousGroup();
      currentGroupIndex =
        this.findTerminalGroupIndex(sessionRecord.sessionId) ?? currentGroupIndex - 1;
    }

    if (
      currentGroupIndex === targetGroupIndex &&
      !shouldFocus &&
      !this.isTerminalTabForeground(sessionRecord.sessionId, targetGroupIndex)
    ) {
      await this.activateTerminalEditorTab(sessionRecord.sessionId, targetGroupIndex);
    }

    if (shouldFocus) {
      projection.terminal.show(false);
      await this.waitForActiveTerminal(projection.terminal);
    }

    if (
      !shouldFocus &&
      restoreViewColumn &&
      restoreViewColumn !== getViewColumn(targetGroupIndex)
    ) {
      await focusEditorGroupByIndex(restoreViewColumn - 1);
    }
  }

  private async ensureAttachedTerminal(
    sessionRecord: TerminalSessionRecord,
    options: {
      bootstrapSession?: boolean;
      forceNewTerminal?: boolean;
    } = {},
  ): Promise<SessionProjection> {
    await this.ensureShellSpawnAllowedOrThrow(sessionRecord);

    const existingProjection = !options.forceNewTerminal
      ? this.projections.get(sessionRecord.sessionId)
      : undefined;
    if (existingProjection && this.isReusableTerminal(existingProjection.terminal)) {
      return existingProjection;
    }

    if (existingProjection) {
      this.unbindTerminal(existingProjection.terminal);
    }

    const existingTerminal = options.forceNewTerminal
      ? undefined
      : await this.findExistingTerminal(sessionRecord);
    if (existingTerminal) {
      try {
        const projection = {
          sessionId: sessionRecord.sessionId,
          terminal: existingTerminal,
        } satisfies SessionProjection;
        this.bindTerminalToSession(sessionRecord.sessionId, existingTerminal);
        await this.syncTerminalName(existingTerminal, sessionRecord.sessionId);
        return projection;
      } catch (error) {
        if (!isDisposedTerminalError(error)) {
          throw error;
        }

        this.markTerminalStale(existingTerminal);
      }
    }

    const zellijUiProfile = await this.resolveZellijUiProfilePaths();
    const terminalOptions: vscode.TerminalOptions = {
      cwd: getDefaultWorkspaceCwd(),
      env: this.createSessionLaunchEnvironment(sessionRecord.sessionId),
      location: {
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.One,
      },
      name: this.getSessionSurfaceTitle(sessionRecord.sessionId),
      shellArgs: createZellijAttachArgs(
        zellijUiProfile.configPath,
        sessionRecord.sessionId,
        options.bootstrapSession === true,
        zellijUiProfile.layoutPath,
      ),
      shellPath: this.bundledZellijBinaryPath ?? "zellij",
    };

    const terminal = vscode.window.createTerminal(terminalOptions);
    const projection = {
      sessionId: sessionRecord.sessionId,
      terminal,
    } satisfies SessionProjection;
    this.bindTerminalToSession(sessionRecord.sessionId, terminal);
    if (options.bootstrapSession) {
      await this.waitForSessionStartup(sessionRecord.sessionId);
    }
    return projection;
  }

  private async waitForSessionStartup(sessionId: string): Promise<void> {
    for (let attempt = 0; attempt < SESSION_ATTACH_RETRY_COUNT; attempt += 1) {
      if (await this.runtime.probeSession(sessionId)) {
        return;
      }

      await delay(SESSION_ATTACH_RETRY_DELAY_MS);
    }

    throw new Error(`Timed out while starting bundled zellij session ${sessionId}.`);
  }

  private isReusableTerminal(terminal: vscode.Terminal): boolean {
    return (
      !this.staleTerminals.has(terminal) &&
      !terminal.exitStatus &&
      vscode.window.terminals.includes(terminal)
    );
  }

  private async attachManagedTerminal(terminal: vscode.Terminal): Promise<void> {
    const sessionId = await this.resolveManagedSessionId(terminal);
    if (!sessionId || this.terminalToSessionId.get(terminal) === sessionId) {
      return;
    }

    this.bindTerminalToSession(sessionId, terminal);
    await this.syncTerminalName(terminal, sessionId);
    const { didChangeSnapshot, titleChange } = await this.refreshSessionSnapshot(sessionId);
    if (titleChange) {
      this.changeSessionTitleEmitter.fire(titleChange);
    }
    if (didChangeSnapshot) {
      this.changeSessionsEmitter.fire();
    }
    this.changeDebugStateEmitter.fire();
  }

  private async findExistingTerminal(
    sessionRecord: TerminalSessionRecord,
  ): Promise<vscode.Terminal | undefined> {
    for (const terminal of vscode.window.terminals) {
      if (!this.isReusableTerminal(terminal)) {
        continue;
      }

      const resolvedSessionId = await this.resolveManagedSessionId(terminal);
      if (resolvedSessionId === sessionRecord.sessionId) {
        return terminal;
      }
    }

    return undefined;
  }

  private async resolveManagedSessionId(terminal: vscode.Terminal): Promise<string | undefined> {
    const managedIdentity = getManagedTerminalIdentity(terminal);
    if (
      managedIdentity?.workspaceId === this.options.workspaceId &&
      this.sessionRecordBySessionId.has(managedIdentity.sessionId)
    ) {
      return managedIdentity.sessionId;
    }

    const sessionRecord = this.findSessionRecordByTitle(
      terminal.name ?? terminal.creationOptions.name,
    );
    return sessionRecord?.sessionId;
  }

  private bindTerminalToSession(sessionId: string, terminal: vscode.Terminal): void {
    const previousSessionId = this.terminalToSessionId.get(terminal);
    if (previousSessionId && previousSessionId !== sessionId) {
      const previousProjection = this.projections.get(previousSessionId);
      if (previousProjection?.terminal === terminal) {
        this.projections.delete(previousSessionId);
      }
    }

    const previousProjection = this.projections.get(sessionId);
    if (previousProjection && previousProjection.terminal !== terminal) {
      const previousTerminalSessionId = this.terminalToSessionId.get(previousProjection.terminal);
      if (previousTerminalSessionId === sessionId) {
        this.terminalToSessionId.delete(previousProjection.terminal);
      }
    }

    this.projections.set(sessionId, {
      sessionId,
      terminal,
    });
    this.terminalToSessionId.set(terminal, sessionId);
  }

  private unbindTerminal(terminal: vscode.Terminal): void {
    const sessionId = this.terminalToSessionId.get(terminal);
    if (sessionId) {
      const projection = this.projections.get(sessionId);
      if (projection?.terminal === terminal) {
        this.projections.delete(sessionId);
      }
      this.terminalToSessionId.delete(terminal);
    }
  }

  private markTerminalStale(terminal: vscode.Terminal): void {
    this.staleTerminals.add(terminal);
    this.unbindTerminal(terminal);
  }

  private findSessionRecordByTitle(title: string | undefined): TerminalSessionRecord | undefined {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      return undefined;
    }

    return [...this.sessionRecordBySessionId.values()].find(
      (sessionRecord) => this.getSessionSurfaceTitle(sessionRecord.sessionId) === normalizedTitle,
    );
  }

  private async syncTerminalName(terminal: vscode.Terminal, sessionId: string): Promise<void> {
    const desiredName = this.getSessionSurfaceTitle(sessionId);
    if (!desiredName) {
      return;
    }

    if ((terminal.name ?? terminal.creationOptions.name) === desiredName) {
      return;
    }

    try {
      terminal.show(false);
    } catch (error) {
      if (isDisposedTerminalError(error)) {
        this.markTerminalStale(terminal);
      }
      throw error;
    }
    await this.waitForActiveTerminal(terminal);
    await vscode.commands.executeCommand(TERMINAL_RENAME_COMMAND, { name: desiredName });
    this.changeSessionTitleEmitter.fire({
      sessionId,
      title: desiredName,
    });
  }

  private async waitForActiveTerminal(terminal: vscode.Terminal): Promise<void> {
    const deadline = Date.now() + 500;
    while (Date.now() < deadline) {
      if (vscode.window.activeTerminal === terminal) {
        return;
      }
      await delay(25);
    }
  }

  private findTerminalGroupIndex(sessionId: string): number | undefined {
    const group = this.findTerminalTabGroup(sessionId);
    return group?.viewColumn ? group.viewColumn - 1 : undefined;
  }

  private findTerminalTabIndex(sessionId: string, groupIndex: number): number | undefined {
    const expectedTitle = this.getSessionSurfaceTitle(sessionId);
    if (!expectedTitle) {
      return undefined;
    }

    const viewColumn = getViewColumn(groupIndex);
    const group = vscode.window.tabGroups.all.find((candidateGroup) => {
      return candidateGroup.viewColumn === viewColumn;
    });
    if (!group) {
      return undefined;
    }

    const tabIndex = group.tabs.findIndex(
      (tab) => tab.input instanceof vscode.TabInputTerminal && tab.label === expectedTitle,
    );
    return tabIndex >= 0 ? tabIndex : undefined;
  }

  private findTerminalTabGroup(sessionId: string): vscode.TabGroup | undefined {
    const expectedTitle = this.getSessionSurfaceTitle(sessionId);
    if (!expectedTitle) {
      return undefined;
    }

    return vscode.window.tabGroups.all.find((group) => {
      return group.tabs.some((tab) => {
        return tab.input instanceof vscode.TabInputTerminal && tab.label === expectedTitle;
      });
    });
  }

  private isTerminalTabActive(sessionId: string, terminal: vscode.Terminal): boolean {
    if (vscode.window.activeTerminal !== terminal) {
      return false;
    }

    const expectedTitle = this.getSessionSurfaceTitle(sessionId);
    if (!expectedTitle) {
      return false;
    }

    const activeGroup = vscode.window.tabGroups.activeTabGroup;
    if (!activeGroup) {
      return false;
    }

    return activeGroup.tabs.some((tab) => {
      return (
        tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === expectedTitle
      );
    });
  }

  private async activateTerminalEditorTab(sessionId: string, groupIndex: number): Promise<boolean> {
    const tabIndex = this.findTerminalTabIndex(sessionId, groupIndex);
    if (tabIndex === undefined || tabIndex > 8) {
      return false;
    }

    const viewColumn = getViewColumn(groupIndex);
    const activeGroupViewColumn = vscode.window.tabGroups.activeTabGroup?.viewColumn;
    if (this.isTerminalTabForeground(sessionId, groupIndex)) {
      if (activeGroupViewColumn !== viewColumn) {
        await focusEditorGroupByIndex(groupIndex);
      }
      return true;
    }

    await focusEditorGroupByIndex(groupIndex);
    await vscode.commands.executeCommand(`${OPEN_EDITOR_AT_INDEX_COMMAND_PREFIX}${tabIndex + 1}`);
    return true;
  }

  private async refreshSessionSnapshots(): Promise<void> {
    let didChangeSessions = false;
    const titleChanges: TerminalWorkspaceBackendTitleChange[] = [];

    for (const sessionId of this.sessionRecordBySessionId.keys()) {
      const result = await this.refreshSessionSnapshot(sessionId);
      didChangeSessions ||= result.didChangeSnapshot;
      if (result.titleChange) {
        titleChanges.push(result.titleChange);
      }
    }

    for (const titleChange of titleChanges) {
      this.changeSessionTitleEmitter.fire(titleChange);
    }

    if (didChangeSessions) {
      this.changeSessionsEmitter.fire();
    }

    if (didChangeSessions || titleChanges.length > 0) {
      this.changeDebugStateEmitter.fire();
    }
  }

  private async refreshSessionSnapshot(sessionId: string): Promise<{
    didChangeSnapshot: boolean;
    titleChange?: TerminalWorkspaceBackendTitleChange;
  }> {
    const previousSnapshot = this.sessions.get(sessionId);
    const previousTitle = this.sessionTitleBySessionId.get(sessionId);
    const persistedState = await this.readPersistedSessionState(sessionId);
    const sessionInfo = await this.runtime.probeSession(sessionId).catch(() => undefined);
    const nextSnapshot = createNextSnapshot({
      previousSnapshot,
      sessionId,
      persistedState,
      sessionInfoExists: Boolean(sessionInfo),
      workspaceId: this.options.workspaceId,
    });

    if (didPersistedStateChange(this.lastKnownPersistedStateBySessionId.get(sessionId), persistedState)) {
      this.lastKnownPersistedStateBySessionId.set(sessionId, persistedState);
      this.lastTerminalActivityAtBySessionId.set(sessionId, Date.now());
    }

    this.sessions.set(sessionId, nextSnapshot);

    const nextTitle = persistedState.title;
    if (nextTitle) {
      this.sessionTitleBySessionId.set(sessionId, nextTitle);
    } else {
      this.sessionTitleBySessionId.delete(sessionId);
    }

    return {
      didChangeSnapshot: !haveSameTerminalSessionSnapshot(previousSnapshot, nextSnapshot),
      titleChange:
        nextTitle && nextTitle !== previousTitle
          ? {
              sessionId,
              title: nextTitle,
            }
          : undefined,
    };
  }

  private async readPersistedSessionState(sessionId: string): Promise<PersistedSessionState> {
    return readPersistedSessionStateFromFile(this.getSessionAgentStateFilePath(sessionId));
  }

  private createSessionLaunchEnvironment(sessionId: string): Record<string, string> {
    return createManagedTerminalEnvironment(
      this.options.workspaceId,
      sessionId,
      this.getSessionAgentStateFilePath(sessionId),
    );
  }

  private async resolveZellijUiProfilePaths(): Promise<{
    configPath: string;
    layoutPath: string | undefined;
  }> {
    return writeZellijUiProfile(
      this.options.context.globalStorageUri.fsPath,
      this.options.workspaceId,
      buildZellijUiProfile(readZellijUiSettings()),
    );
  }

  private getSessionSurfaceTitle(sessionId: string): string | undefined {
    const sessionRecord = this.sessionRecordBySessionId.get(sessionId);
    return sessionRecord ? getTerminalSessionSurfaceTitle(sessionRecord) : undefined;
  }

  private getAgentStateDirectory(): string {
    return path.join(this.options.context.globalStorageUri.fsPath, AGENT_STATE_DIR_NAME);
  }

  private getSessionAgentStateFilePath(sessionId: string): string {
    return path.join(this.getAgentStateDirectory(), `${sessionId}.env`);
  }

  private captureLayoutState(): NativeTerminalLayoutDebugState {
    const projections: NativeTerminalDebugProjection[] = [
      ...this.sessionRecordBySessionId.keys(),
    ].map((sessionId) => {
      const projection = this.projections.get(sessionId);
      const groupIndex = this.findTerminalGroupIndex(sessionId);
      return {
        alias: this.sessionRecordBySessionId.get(sessionId)?.alias,
        exitCode: projection?.terminal.exitStatus?.code,
        isParked: groupIndex !== undefined && !this.isTerminalTabForeground(sessionId, groupIndex),
        isTracked: true,
        location: formatLocation(groupIndex),
        sessionId,
        terminalName: projection?.terminal.name ?? projection?.terminal.creationOptions.name,
      };
    });

    return {
      activeTerminalName: vscode.window.activeTerminal?.name,
      editorSurfaceGroups: vscode.window.tabGroups.all.map((group) => ({
        labels: group.tabs.map((tab) => tab.label),
        sessionIds: group.tabs
          .filter((tab) => tab.input instanceof vscode.TabInputTerminal)
          .map((tab) => this.findSessionIdByTitle(tab.label))
          .filter((sessionId): sessionId is string => Boolean(sessionId)),
        visibleIndex: (group.viewColumn ?? 1) - 1,
        viewColumn: group.viewColumn,
      })),
      parkedTerminals: projections.filter((projection) => projection.isParked),
      processAssociations: [],
      projections,
      rawTabGroups: vscode.window.tabGroups.all.map((group) => ({
        labels: group.tabs.map((tab) => tab.label),
        terminalLabels: group.tabs
          .filter((tab) => tab.input instanceof vscode.TabInputTerminal)
          .map((tab) => tab.label),
        viewColumn: group.viewColumn,
      })),
      terminalCount: vscode.window.terminals.length,
      terminalNames: vscode.window.terminals.map((terminal) => terminal.name),
      trackedSessionIds: [...this.sessionRecordBySessionId.keys()],
    };
  }

  private findSessionIdByTitle(title: string): string | undefined {
    return [...this.sessionRecordBySessionId.values()].find(
      (sessionRecord) => getTerminalSessionSurfaceTitle(sessionRecord) === title,
    )?.sessionId;
  }

  private isTerminalTabForeground(sessionId: string, groupIndex: number): boolean {
    const expectedTitle = this.getSessionSurfaceTitle(sessionId);
    if (!expectedTitle) {
      return false;
    }

    const group = vscode.window.tabGroups.all.find((candidateGroup) => {
      return candidateGroup.viewColumn === getViewColumn(groupIndex);
    });
    if (!group) {
      return false;
    }

    return group.tabs.some((tab) => {
      return (
        tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === expectedTitle
      );
    });
  }
}

function isDisposedTerminalError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Terminal has already been disposed");
}

function compareTerminalPlacements(
  left: {
    isFocused: boolean;
    sessionRecord: TerminalSessionRecord;
    targetGroupIndex: number;
  },
  right: {
    isFocused: boolean;
    sessionRecord: TerminalSessionRecord;
    targetGroupIndex: number;
  },
): number {
  if (left.isFocused !== right.isFocused) {
    return left.isFocused ? 1 : -1;
  }

  if (left.targetGroupIndex !== right.targetGroupIndex) {
    return right.targetGroupIndex - left.targetGroupIndex;
  }

  return left.sessionRecord.alias.localeCompare(right.sessionRecord.alias);
}

function createNextSnapshot(options: {
  persistedState: PersistedSessionState;
  previousSnapshot: TerminalSessionSnapshot | undefined;
  sessionId: string;
  sessionInfoExists: boolean;
  workspaceId: string;
}): TerminalSessionSnapshot {
  const baseSnapshot =
    options.previousSnapshot ??
    createDisconnectedSessionSnapshot(options.sessionId, options.workspaceId);

  if (options.sessionInfoExists) {
    return {
      ...baseSnapshot,
      agentName: options.persistedState.agentName,
      agentStatus: options.persistedState.agentStatus,
      restoreState: "live",
      startedAt:
        options.previousSnapshot?.status === "running"
          ? options.previousSnapshot.startedAt
          : new Date().toISOString(),
      status: "running",
      workspaceId: options.workspaceId,
    };
  }

  return {
    ...baseSnapshot,
    agentName: options.persistedState.agentName,
    agentStatus: options.persistedState.agentStatus,
    endedAt:
      baseSnapshot.status === "running" && !baseSnapshot.endedAt
        ? new Date().toISOString()
        : baseSnapshot.endedAt,
    restoreState: "live",
    status: baseSnapshot.status === "running" ? "exited" : "disconnected",
    workspaceId: options.workspaceId,
  };
}

function didPersistedStateChange(
  previousState: PersistedSessionState | undefined,
  nextState: PersistedSessionState,
): boolean {
  return (
    previousState?.agentName !== nextState.agentName ||
    previousState?.agentStatus !== nextState.agentStatus ||
    previousState?.title !== nextState.title
  );
}

function formatLocation(groupIndex: number | undefined): string {
  if (groupIndex === undefined) {
    return "unknown";
  }

  return `editor:${groupIndex}`;
}

function haveSameTerminalSessionSnapshot(
  left: TerminalSessionSnapshot | undefined,
  right: TerminalSessionSnapshot,
): boolean {
  return (
    left?.agentName === right.agentName &&
    left?.agentStatus === right.agentStatus &&
    left?.cols === right.cols &&
    left?.cwd === right.cwd &&
    left?.endedAt === right.endedAt &&
    left?.errorMessage === right.errorMessage &&
    left?.exitCode === right.exitCode &&
    left?.restoreState === right.restoreState &&
    left?.rows === right.rows &&
    left?.sessionId === right.sessionId &&
    left?.shell === right.shell &&
    left?.startedAt === right.startedAt &&
    left?.status === right.status &&
    left?.workspaceId === right.workspaceId
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
