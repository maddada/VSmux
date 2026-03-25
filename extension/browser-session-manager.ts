import * as vscode from "vscode";
import {
  isBrowserSession,
  type BrowserSessionRecord,
  type SessionGridSnapshot,
  type SessionRecord,
} from "../shared/session-grid-contract";
import {
  focusEditorGroupByIndex,
  getActiveEditorGroupViewColumn,
  getViewColumn,
} from "./terminal-workspace-helpers";
import { captureWorkbenchState } from "./session-layout-trace";
import { createWorkspaceTrace } from "./runtime-trace";
import {
  getBrowserTabInputKind,
  getBrowserTabUrl,
  getPlacementRank,
  getRenderKey,
  isBrowserLikeTab,
  normalizeUrl,
} from "./browser-session-manager/helpers";

type BrowserSessionManagerOptions = {
  onDidChangeSessions?: () => Promise<void> | void;
  onDidFocusSession: (sessionId: string) => Promise<void>;
};

type ManagedBrowserTab = {
  lastKnownLabel?: string;
  renderKey: string;
  sessionId: string;
  tab: vscode.Tab | undefined;
  url: string;
};

const SIMPLE_BROWSER_OPEN_COMMAND = "simpleBrowser.api.open";
const TRACE_FILE_NAME = "browser-session-reconcile.log";

export class BrowserSessionManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly managedTabsBySessionId = new Map<string, ManagedBrowserTab>();
  private readonly sessionRecordBySessionId = new Map<string, BrowserSessionRecord>();
  private readonly trace = createWorkspaceTrace(TRACE_FILE_NAME);
  private suppressFocusEvents = 0;

  public constructor(private readonly options: BrowserSessionManagerOptions) {
    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        void this.handleTabChange();
      }),
      vscode.window.tabGroups.onDidChangeTabGroups(() => {
        void this.handleTabChange();
      }),
    );
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.managedTabsBySessionId.clear();
    this.sessionRecordBySessionId.clear();
  }

  public async resetDebugTrace(): Promise<void> {
    await this.trace.reset();
  }

  public syncSessions(sessionRecords: readonly SessionRecord[]): void {
    const nextRecords = new Map(
      sessionRecords
        .filter(isBrowserSession)
        .map((sessionRecord) => [sessionRecord.sessionId, sessionRecord]),
    );
    this.sessionRecordBySessionId.clear();
    for (const [sessionId, sessionRecord] of nextRecords) {
      this.sessionRecordBySessionId.set(sessionId, sessionRecord);
    }

    for (const sessionId of this.managedTabsBySessionId.keys()) {
      if (nextRecords.has(sessionId)) {
        continue;
      }

      void this.disposeSession(sessionId);
    }

    void this.logState("SYNC", "sessions", {
      trackedSessionIds: [...this.sessionRecordBySessionId.keys()],
    });
  }

  public async reconcileVisibleSessions(
    snapshot: SessionGridSnapshot,
    preserveFocus = false,
  ): Promise<void> {
    const placements = this.getPlacements(snapshot);
    await this.logState("RECONCILE", "start", {
      placements: placements.map((placement) => ({
        isFocused: placement.isFocused,
        isVisible: placement.isVisible,
        sessionId: placement.sessionRecord.sessionId,
        targetViewColumn: placement.targetViewColumn,
      })),
      preserveFocus,
      snapshot,
    });
    this.suppressFocusEvents += 1;
    try {
      for (const placement of placements) {
        await this.logState("PLACE", "before", {
          isFocused: placement.isFocused,
          isVisible: placement.isVisible,
          sessionId: placement.sessionRecord.sessionId,
          targetViewColumn: placement.targetViewColumn,
        });
        await this.ensurePlacement(
          placement.sessionRecord,
          placement.targetViewColumn,
          placement.isFocused && !preserveFocus,
          placement.isVisible,
        );
        await this.logState("PLACE", "after", {
          isFocused: placement.isFocused,
          isVisible: placement.isVisible,
          sessionId: placement.sessionRecord.sessionId,
          targetViewColumn: placement.targetViewColumn,
        });
      }
    } finally {
      this.suppressFocusEvents = Math.max(0, this.suppressFocusEvents - 1);
    }
    await this.logState("RECONCILE", "complete", {
      preserveFocus,
      snapshot,
    });
  }

  public async revealStoredSession(
    sessionRecord: BrowserSessionRecord,
    snapshot: SessionGridSnapshot,
    preserveFocus: boolean,
  ): Promise<void> {
    this.syncSessions([
      ...Array.from(this.sessionRecordBySessionId.values()).filter(
        (existingSessionRecord) => existingSessionRecord.sessionId !== sessionRecord.sessionId,
      ),
      sessionRecord,
    ]);
    await this.reconcileVisibleSessions(snapshot, preserveFocus);
  }

  public hasLiveTab(sessionId: string): boolean {
    return Boolean(this.resolveLiveTab(sessionId));
  }

  public getObservedActiveSessionId(viewColumn: number | undefined): string | undefined {
    if (!viewColumn) {
      return undefined;
    }

    for (const [sessionId] of this.managedTabsBySessionId) {
      const liveTab = this.resolveLiveTab(sessionId);
      if (liveTab?.group.viewColumn === viewColumn && liveTab.isActive) {
        return sessionId;
      }
    }

    return undefined;
  }

  public async revealAllSessionsInOneGroup(
    sessionRecords: readonly BrowserSessionRecord[],
    preserveFocus = true,
  ): Promise<void> {
    this.syncSessions(sessionRecords);
    const snapshot: SessionGridSnapshot = {
      focusedSessionId: undefined,
      fullscreenRestoreVisibleCount: undefined,
      sessions: [...sessionRecords],
      viewMode: "grid",
      visibleCount: 1,
      visibleSessionIds: [],
    };
    await this.reconcileVisibleSessions(snapshot, preserveFocus);
  }

  public async disposeSession(sessionId: string): Promise<void> {
    const managedTab = this.managedTabsBySessionId.get(sessionId);
    this.managedTabsBySessionId.delete(sessionId);
    if (!managedTab?.tab) {
      return;
    }

    try {
      await vscode.window.tabGroups.close(managedTab.tab, true);
      await this.logState("DISPOSE", "session", { sessionId });
    } catch {
      // Ignore races with user-controlled browser tabs.
    }
  }

  private getPlacements(snapshot: SessionGridSnapshot): Array<{
    isFocused: boolean;
    isVisible: boolean;
    sessionRecord: BrowserSessionRecord;
    targetViewColumn: vscode.ViewColumn;
  }> {
    const focusedSessionId = snapshot.focusedSessionId ?? snapshot.visibleSessionIds[0];
    const placements = [...this.sessionRecordBySessionId.values()].map((sessionRecord) => {
      const visibleIndex = snapshot.visibleSessionIds.indexOf(sessionRecord.sessionId);
      const isVisible = visibleIndex >= 0;
      const currentViewColumn =
        this.resolveLiveTab(sessionRecord.sessionId)?.group.viewColumn ??
        this.managedTabsBySessionId.get(sessionRecord.sessionId)?.tab?.group.viewColumn;

      return {
        isFocused: focusedSessionId === sessionRecord.sessionId,
        isVisible,
        sessionRecord,
        targetViewColumn: isVisible ? getViewColumn(visibleIndex) : (currentViewColumn ?? 1),
      };
    });

    placements.sort((left, right) => {
      const leftRank = getPlacementRank(left.isVisible, left.isFocused);
      const rightRank = getPlacementRank(right.isVisible, right.isFocused);
      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }

      if (left.targetViewColumn !== right.targetViewColumn) {
        return left.targetViewColumn - right.targetViewColumn;
      }

      return left.sessionRecord.alias.localeCompare(right.sessionRecord.alias);
    });

    return placements;
  }

  private async ensurePlacement(
    sessionRecord: BrowserSessionRecord,
    targetViewColumn: vscode.ViewColumn,
    shouldFocus: boolean,
    isVisible: boolean,
  ): Promise<void> {
    const renderKey = getRenderKey(sessionRecord);
    const managedTab =
      this.managedTabsBySessionId.get(sessionRecord.sessionId) ??
      this.createManagedTab(sessionRecord.sessionId, renderKey, sessionRecord.browser.url);
    managedTab.renderKey = renderKey;
    managedTab.url = sessionRecord.browser.url;

    let liveTab = this.resolveLiveTab(sessionRecord.sessionId);
    if (!liveTab || liveTab.group.viewColumn !== targetViewColumn) {
      await this.logState("PLACE", "reopen", {
        hasLiveTab: Boolean(liveTab),
        sessionId: sessionRecord.sessionId,
        shouldFocus,
        targetViewColumn,
      });
      await this.closeManagedTab(sessionRecord.sessionId, true);
      liveTab = await this.openBrowserTab(sessionRecord, targetViewColumn, !shouldFocus);
    }

    managedTab.tab = liveTab;
    if (!liveTab) {
      return;
    }

    if (isVisible || shouldFocus) {
      await this.revealTab(liveTab, targetViewColumn, shouldFocus);
    }
  }

  private createManagedTab(sessionId: string, renderKey: string, url: string): ManagedBrowserTab {
    const managedTab: ManagedBrowserTab = {
      lastKnownLabel: undefined,
      renderKey,
      sessionId,
      tab: undefined,
      url,
    };
    this.managedTabsBySessionId.set(sessionId, managedTab);
    return managedTab;
  }

  private async openBrowserTab(
    sessionRecord: BrowserSessionRecord,
    targetViewColumn: vscode.ViewColumn,
    preserveFocus: boolean,
  ): Promise<vscode.Tab | undefined> {
    const restoreViewColumn = preserveFocus ? getActiveEditorGroupViewColumn() : undefined;
    const browserTabsBeforeOpen = new Set(this.getBrowserLikeTabs(targetViewColumn));
    await vscode.commands.executeCommand(
      SIMPLE_BROWSER_OPEN_COMMAND,
      vscode.Uri.parse(sessionRecord.browser.url),
      {
        preserveFocus,
        viewColumn: targetViewColumn,
      },
    );
    const openedTab =
      this.findOpenedBrowserLikeTab(targetViewColumn, browserTabsBeforeOpen) ??
      this.findTabByUrl(sessionRecord.browser.url, targetViewColumn) ??
      this.findBestBrowserCandidate(sessionRecord.sessionId, targetViewColumn);
    const managedTab = this.managedTabsBySessionId.get(sessionRecord.sessionId);
    if (managedTab && openedTab) {
      managedTab.lastKnownLabel = openedTab.label;
    }
    if (preserveFocus && restoreViewColumn && restoreViewColumn !== targetViewColumn) {
      await focusEditorGroupByIndex(restoreViewColumn - 1);
    }
    await this.logState("OPEN", "browser-tab", {
      browserLikeTabLabelsAfterOpen: this.getBrowserLikeTabs(targetViewColumn).map(
        (tab) => tab.label,
      ),
      browserLikeTabLabelsBeforeOpen: [...browserTabsBeforeOpen].map((tab) => tab.label),
      openedTabInputKind: openedTab ? getBrowserTabInputKind(openedTab) : undefined,
      openedTabLabel: openedTab?.label,
      preserveFocus,
      sessionId: sessionRecord.sessionId,
      targetViewColumn,
      url: sessionRecord.browser.url,
    });
    return openedTab;
  }

  private async revealTab(
    tab: vscode.Tab,
    targetViewColumn: vscode.ViewColumn,
    shouldFocus: boolean,
  ): Promise<void> {
    const restoreViewColumn = !shouldFocus ? getActiveEditorGroupViewColumn() : undefined;
    await focusEditorGroupByIndex(targetViewColumn - 1);
    const liveTab =
      this.resolveSpecificLiveTab(tab) ??
      this.findTabByUrl(getBrowserTabUrl(tab), targetViewColumn) ??
      this.findBestBrowserCandidate(undefined, targetViewColumn);
    if (!liveTab) {
      await this.logState("REVEAL", "browser-tab-missing", {
        shouldFocus,
        tabLabel: tab.label,
        tabUrl: getBrowserTabUrl(tab),
        targetViewColumn,
      });
      return;
    }

    const tabIndex = liveTab.group.tabs.indexOf(liveTab);
    if (tabIndex >= 0 && tabIndex < 9) {
      await vscode.commands.executeCommand(`workbench.action.openEditorAtIndex${tabIndex + 1}`);
    }

    if (!shouldFocus && restoreViewColumn && restoreViewColumn !== targetViewColumn) {
      await focusEditorGroupByIndex(restoreViewColumn - 1);
    }
    await this.logState("REVEAL", "browser-tab", {
      shouldFocus,
      targetViewColumn,
      tabLabel: tab.label,
      url: getBrowserTabUrl(tab),
    });
  }

  private resolveLiveTab(sessionId: string): vscode.Tab | undefined {
    const managedTab = this.managedTabsBySessionId.get(sessionId);
    if (!managedTab) {
      return undefined;
    }

    const exactTab = this.resolveSpecificLiveTab(managedTab.tab);
    if (exactTab) {
      managedTab.lastKnownLabel = exactTab.label;
      return exactTab;
    }

    const urlMatch = this.findTabByUrl(managedTab.url);
    if (urlMatch) {
      managedTab.lastKnownLabel = urlMatch.label;
      return urlMatch;
    }

    const candidate = this.findBestBrowserCandidate(sessionId);
    if (candidate) {
      managedTab.lastKnownLabel = candidate.label;
    }
    return candidate;
  }

  private resolveSpecificLiveTab(tab: vscode.Tab | undefined): vscode.Tab | undefined {
    if (!tab) {
      return undefined;
    }

    return vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .find((candidate) => candidate === tab);
  }

  private findTabByUrl(
    url: string | undefined,
    viewColumn?: vscode.ViewColumn,
  ): vscode.Tab | undefined {
    const expectedUrl = normalizeUrl(url);
    return vscode.window.tabGroups.all
      .filter((group) => viewColumn === undefined || group.viewColumn === viewColumn)
      .flatMap((group) => group.tabs)
      .find((tab) => normalizeUrl(getBrowserTabUrl(tab)) === expectedUrl);
  }

  private findOpenedBrowserLikeTab(
    viewColumn: vscode.ViewColumn,
    tabsBeforeOpen: ReadonlySet<vscode.Tab>,
  ): vscode.Tab | undefined {
    return this.getBrowserLikeTabs(viewColumn).find((tab) => !tabsBeforeOpen.has(tab));
  }

  private findBestBrowserCandidate(
    sessionId: string | undefined,
    viewColumn?: vscode.ViewColumn,
  ): vscode.Tab | undefined {
    const managedTab = sessionId ? this.managedTabsBySessionId.get(sessionId) : undefined;
    const browserLikeTabs = this.getBrowserLikeTabs(viewColumn);
    if (browserLikeTabs.length === 0) {
      return undefined;
    }

    if (managedTab?.lastKnownLabel) {
      const labelMatch = browserLikeTabs.find((tab) => tab.label === managedTab.lastKnownLabel);
      if (labelMatch) {
        return labelMatch;
      }
    }

    const activeTab = browserLikeTabs.find((tab) => tab.group.isActive && tab.isActive);
    if (activeTab) {
      return activeTab;
    }

    if (this.sessionRecordBySessionId.size === 1) {
      return browserLikeTabs.at(-1);
    }

    return undefined;
  }

  private getBrowserLikeTabs(viewColumn?: vscode.ViewColumn): vscode.Tab[] {
    return vscode.window.tabGroups.all
      .filter((group) => viewColumn === undefined || group.viewColumn === viewColumn)
      .flatMap((group) => group.tabs)
      .filter(isBrowserLikeTab);
  }

  private async closeManagedTab(sessionId: string, preserveFocus: boolean): Promise<void> {
    const liveTab = this.resolveLiveTab(sessionId);
    const managedTab = this.managedTabsBySessionId.get(sessionId);
    if (managedTab) {
      managedTab.tab = undefined;
    }
    if (!liveTab) {
      return;
    }

    try {
      await vscode.window.tabGroups.close(liveTab, preserveFocus);
    } catch {
      // Ignore races with user-controlled browser tabs.
    }
  }

  private async handleTabChange(): Promise<void> {
    await this.logState("EVENT", "tab-change", undefined);
    if (this.suppressFocusEvents > 0) {
      await this.options.onDidChangeSessions?.();
      return;
    }

    const activeSessionId = [...this.managedTabsBySessionId.keys()].find((sessionId) => {
      const liveTab = this.resolveLiveTab(sessionId);
      return Boolean(liveTab?.group.isActive && liveTab.isActive);
    });
    await this.options.onDidChangeSessions?.();
    if (!activeSessionId) {
      return;
    }

    await this.options.onDidFocusSession(activeSessionId);
  }

  public getDebugState(): {
    managedTabs: Array<{
      lastKnownLabel?: string;
      liveTabLabel?: string;
      liveTabViewColumn?: number;
      renderKey: string;
      sessionId: string;
      url: string;
    }>;
    trackedSessionIds: string[];
    workbench: ReturnType<typeof captureWorkbenchState>;
  } {
    return {
      managedTabs: [...this.managedTabsBySessionId.values()].map((managedTab) => {
        const liveTab = this.resolveLiveTab(managedTab.sessionId);
        return {
          lastKnownLabel: managedTab.lastKnownLabel,
          liveTabLabel: liveTab?.label,
          liveTabViewColumn: liveTab?.group.viewColumn,
          renderKey: managedTab.renderKey,
          sessionId: managedTab.sessionId,
          url: managedTab.url,
        };
      }),
      trackedSessionIds: [...this.sessionRecordBySessionId.keys()],
      workbench: captureWorkbenchState(),
    };
  }

  private async logState(tag: string, message: string, details?: unknown): Promise<void> {
    if (!this.trace.isEnabled()) {
      return;
    }

    await this.trace.log(tag, message, {
      details,
      state: this.getDebugState(),
    });
  }
}
