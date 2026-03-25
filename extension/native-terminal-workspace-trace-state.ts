import type { ExtensionToNativeTerminalDebugMessage } from "../shared/native-terminal-debug-contract";
import {
  getOrderedSessions,
  isBrowserSession,
  isT3Session,
  isTerminalSession,
  type GroupedSessionWorkspaceSnapshot,
  type SessionGridSnapshot,
  type SessionRecord,
  type SidebarHydrateMessage,
  type SidebarSessionGroup,
  type TerminalViewMode,
  type VisibleSessionCount,
} from "../shared/session-grid-contract";
import type { BrowserSessionManager } from "./browser-session-manager";
import { captureWorkbenchState } from "./session-layout-trace";
import type { T3WebviewManager } from "./t3-webview-manager";
import type { TerminalWorkspaceBackend } from "./terminal-workspace-backend";

export function createDebugInspectorMessage(options: {
  backendState: ReturnType<TerminalWorkspaceBackend["getDebugState"]>;
  sidebarGroups: SidebarSessionGroup[];
  sidebarHud: SidebarHydrateMessage["hud"];
  workspaceId: string;
}): ExtensionToNativeTerminalDebugMessage {
  return {
    state: {
      backend: options.backendState,
      observedAt: new Date().toISOString(),
      sidebar: {
        groups: options.sidebarGroups,
        hud: options.sidebarHud,
      },
      workspaceId: options.workspaceId,
    },
    type: "hydrate",
  };
}

export function captureControllerTraceState(options: {
  activeSnapshot: SessionGridSnapshot;
  allSessionRecords: SessionRecord[];
  backendState: ReturnType<TerminalWorkspaceBackend["getDebugState"]>;
  browserState: ReturnType<BrowserSessionManager["getDebugState"]>;
  ownsNativeTerminalControl: boolean;
  sidebarGroups: SidebarSessionGroup[];
  sidebarHud: SidebarHydrateMessage["hud"];
  storeSnapshot: GroupedSessionWorkspaceSnapshot;
  t3State: ReturnType<T3WebviewManager["getDebugState"]>;
  workspaceId: string;
}): {
  activeSnapshot: ReturnType<typeof captureSnapshotTraceState>;
  backend: ReturnType<TerminalWorkspaceBackend["getDebugState"]>;
  browser: ReturnType<BrowserSessionManager["getDebugState"]>;
  ownsNativeTerminalControl: boolean;
  sidebar: {
    groups: SidebarSessionGroup[];
    hud: SidebarHydrateMessage["hud"];
  };
  store: {
    activeGroupId: string;
    groups: Array<{
      focusedSessionId?: string;
      fullscreenRestoreVisibleCount?: VisibleSessionCount;
      groupId: string;
      sessions: Array<{
        alias: string;
        displayId: string;
        kind: SessionRecord["kind"];
        sessionId: string;
        slotIndex: number;
        title: string;
      }>;
      title: string;
      viewMode: TerminalViewMode;
      visibleCount: VisibleSessionCount;
      visibleSessionIds: string[];
    }>;
  };
  t3: ReturnType<T3WebviewManager["getDebugState"]>;
  workbench: ReturnType<typeof captureWorkbenchState>;
  workspaceId: string;
} {
  const { storeSnapshot } = options;

  return {
    activeSnapshot: captureSnapshotTraceState(options.activeSnapshot, options.allSessionRecords),
    backend: options.backendState,
    browser: options.browserState,
    ownsNativeTerminalControl: options.ownsNativeTerminalControl,
    sidebar: {
      groups: options.sidebarGroups,
      hud: options.sidebarHud,
    },
    store: {
      activeGroupId: storeSnapshot.activeGroupId,
      groups: storeSnapshot.groups.map((group) => ({
        focusedSessionId: group.snapshot.focusedSessionId,
        fullscreenRestoreVisibleCount: group.snapshot.fullscreenRestoreVisibleCount,
        groupId: group.groupId,
        sessions: getOrderedSessions(group.snapshot).map((sessionRecord) => ({
          alias: sessionRecord.alias,
          displayId: sessionRecord.displayId,
          kind: sessionRecord.kind,
          sessionId: sessionRecord.sessionId,
          slotIndex: sessionRecord.slotIndex,
          title: sessionRecord.title,
        })),
        title: group.title,
        viewMode: group.snapshot.viewMode,
        visibleCount: group.snapshot.visibleCount,
        visibleSessionIds: [...group.snapshot.visibleSessionIds],
      })),
    },
    t3: options.t3State,
    workbench: captureWorkbenchState(),
    workspaceId: options.workspaceId,
  };
}

export function captureSnapshotTraceState(
  snapshot: SessionGridSnapshot,
  allSessionRecords: readonly SessionRecord[],
): {
  expectedProjection: {
    browser: Array<{
      isFocused: boolean;
      isVisible: boolean;
      sessionId: string;
      targetGroupIndex: number;
    }>;
    focusedSessionId?: string;
    t3: Array<{
      isFocused: boolean;
      isVisible: boolean;
      sessionId: string;
      targetGroupIndex: number;
    }>;
    terminals: Array<{
      isFocused: boolean;
      isVisible: boolean;
      sessionId: string;
      targetGroupIndex: number;
    }>;
    viewMode: TerminalViewMode;
    visibleCount: VisibleSessionCount;
    visibleSessionIds: string[];
  };
  focusedSessionId?: string;
  fullscreenRestoreVisibleCount?: VisibleSessionCount;
  sessions: Array<{
    alias: string;
    displayId: string;
    kind: SessionRecord["kind"];
    sessionId: string;
    slotIndex: number;
    title: string;
  }>;
  viewMode: TerminalViewMode;
  visibleCount: VisibleSessionCount;
  visibleSessionIds: string[];
} {
  const focusedSessionId = snapshot.focusedSessionId ?? snapshot.visibleSessionIds[0];
  const expectedProjection = allSessionRecords.reduce(
    (state, sessionRecord) => {
      const visibleIndex = snapshot.visibleSessionIds.indexOf(sessionRecord.sessionId);
      const placement = {
        isFocused: focusedSessionId === sessionRecord.sessionId,
        isVisible: visibleIndex >= 0,
        sessionId: sessionRecord.sessionId,
        targetGroupIndex: visibleIndex >= 0 ? visibleIndex : 0,
      };

      if (isTerminalSession(sessionRecord)) {
        state.terminals.push(placement);
      } else if (isT3Session(sessionRecord)) {
        state.t3.push(placement);
      } else if (isBrowserSession(sessionRecord)) {
        state.browser.push(placement);
      }

      return state;
    },
    {
      browser: [] as Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>,
      focusedSessionId,
      t3: [] as Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>,
      terminals: [] as Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>,
      viewMode: snapshot.viewMode,
      visibleCount: snapshot.visibleCount,
      visibleSessionIds: [...snapshot.visibleSessionIds],
    },
  );

  return {
    expectedProjection,
    focusedSessionId: snapshot.focusedSessionId,
    fullscreenRestoreVisibleCount: snapshot.fullscreenRestoreVisibleCount,
    sessions: getOrderedSessions(snapshot).map((sessionRecord) => ({
      alias: sessionRecord.alias,
      displayId: sessionRecord.displayId,
      kind: sessionRecord.kind,
      sessionId: sessionRecord.sessionId,
      slotIndex: sessionRecord.slotIndex,
      title: sessionRecord.title,
    })),
    viewMode: snapshot.viewMode,
    visibleCount: snapshot.visibleCount,
    visibleSessionIds: [...snapshot.visibleSessionIds],
  };
}
