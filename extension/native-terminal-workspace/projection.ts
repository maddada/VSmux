import {
  getT3SessionSurfaceTitle,
  getTerminalSessionSurfaceTitle,
  isBrowserSession,
  isT3Session,
  isTerminalSession,
  type SessionGridSnapshot,
  type SessionRecord,
} from "../../shared/session-grid-contract";
import { applyEditorLayout, doesCurrentEditorLayoutMatch } from "../terminal-workspace-helpers";
import { captureWorkbenchState, type SessionLayoutTraceOperation } from "../session-layout-trace";
import type { BrowserSessionManager } from "../browser-session-manager";
import type { T3WebviewManager } from "../t3-webview-manager";
import type { TerminalWorkspaceBackend } from "../terminal-workspace-backend";

type ProjectionContext = {
  applyDisabledVsMuxMode: () => Promise<void>;
  backend: Pick<
    TerminalWorkspaceBackend,
    "focusSession" | "hasLiveTerminal" | "reconcileVisibleTerminals" | "syncSessions"
  >;
  browserSessions: Pick<BrowserSessionManager, "reconcileVisibleSessions" | "syncSessions">;
  ensureT3RuntimeForStoredSessions: (sessionRecords: readonly SessionRecord[]) => Promise<void>;
  getAllSessionRecords: () => SessionRecord[];
  isVsMuxDisabled: () => boolean;
  logControllerEvent: (tag: string, message: string, details?: unknown) => Promise<void>;
  operation: SessionLayoutTraceOperation;
  preserveFocus: boolean;
  snapshot: SessionGridSnapshot;
  storeGetSession: (sessionId: string) => SessionRecord | undefined;
  syncT3RuntimeLease: () => Promise<void>;
  t3Webviews: Pick<T3WebviewManager, "focusComposer" | "reconcileVisibleSessions" | "syncSessions">;
  captureSnapshotTraceState: (snapshot: SessionGridSnapshot) => unknown;
};

export async function executeProjectionReconcile(context: ProjectionContext): Promise<void> {
  if (context.isVsMuxDisabled()) {
    await context.operation.step("vsmux-disabled-before-apply");
    await context.applyDisabledVsMuxMode();
    await context.operation.step("vsmux-disabled-after-apply");
    return;
  }

  const sessionRecords = context.getAllSessionRecords();
  await context.operation.step("start", {
    expected: context.captureSnapshotTraceState(context.snapshot),
    preserveFocus: context.preserveFocus,
  });
  context.backend.syncSessions(sessionRecords);
  context.t3Webviews.syncSessions(sessionRecords);
  context.browserSessions.syncSessions(sessionRecords);
  await context.operation.step("after-sync-session-managers");
  await context.ensureT3RuntimeForStoredSessions(sessionRecords);
  await context.syncT3RuntimeLease();
  await context.operation.step("after-sync-t3-runtime");
  const layoutMatches = await doesCurrentEditorLayoutMatch(
    context.snapshot.visibleCount,
    context.snapshot.viewMode,
  );
  if (!layoutMatches) {
    await applyEditorLayout(context.snapshot.visibleCount, context.snapshot.viewMode, {
      joinAllGroups: true,
    });
    await context.operation.step("after-apply-editor-layout-decision", {
      joinAllGroups: true,
    });
  }
  await context.operation.step("after-apply-editor-layout", {
    layoutMatches,
  });
  await context.backend.reconcileVisibleTerminals(context.snapshot, context.preserveFocus);
  await context.operation.step("after-reconcile-terminals");
  await context.t3Webviews.reconcileVisibleSessions(context.snapshot, context.preserveFocus);
  await context.operation.step("after-reconcile-t3");
  await context.browserSessions.reconcileVisibleSessions(context.snapshot, context.preserveFocus);
  await context.operation.step("after-reconcile-browser");
  await restoreFocusedSessionProjection(context);
  await context.operation.step("after-restore-focused-session");
  await verifyProjectedSessions(context);
  await context.operation.step("after-verify");
}

async function restoreFocusedSessionProjection(context: ProjectionContext): Promise<void> {
  if (context.preserveFocus) {
    return;
  }

  const focusedSessionId =
    context.snapshot.focusedSessionId ?? context.snapshot.visibleSessionIds[0];
  if (!focusedSessionId) {
    return;
  }

  const sessionRecord = context.storeGetSession(focusedSessionId);
  if (!sessionRecord) {
    return;
  }

  if (isTerminalSession(sessionRecord)) {
    if (!context.backend.hasLiveTerminal(focusedSessionId)) {
      return;
    }

    await context.backend.focusSession(focusedSessionId, false);
    return;
  }

  if (isT3Session(sessionRecord)) {
    await context.t3Webviews.focusComposer(sessionRecord.sessionId);
  }
}

async function verifyProjectedSessions(context: ProjectionContext): Promise<void> {
  const workbench = captureWorkbenchState();
  const visibleSessionIds = [...context.snapshot.visibleSessionIds];
  const observedLabels = workbench.tabGroups
    .filter((group) => group.viewColumn !== undefined)
    .sort((left, right) => (left.viewColumn ?? 0) - (right.viewColumn ?? 0))
    .map((group) => group.activeTabLabel)
    .filter((label): label is string => typeof label === "string" && label.length > 0);
  const expectedLabels = visibleSessionIds
    .map((sessionId) => context.storeGetSession(sessionId))
    .map((sessionRecord) => {
      if (!sessionRecord) {
        return undefined;
      }
      if (isTerminalSession(sessionRecord)) {
        return getTerminalSessionSurfaceTitle(sessionRecord);
      }
      if (isT3Session(sessionRecord)) {
        return getT3SessionSurfaceTitle(sessionRecord);
      }
      if (isBrowserSession(sessionRecord)) {
        return sessionRecord.title;
      }
      return undefined;
    })
    .filter((label): label is string => typeof label === "string" && label.length > 0);
  const matches =
    expectedLabels.length === observedLabels.length &&
    expectedLabels.every((label, index) => label === observedLabels[index]);
  await context.logControllerEvent("VERIFY", matches ? "projection-match" : "projection-mismatch", {
    expectedFocusedSessionId: context.snapshot.focusedSessionId,
    expectedLabels,
    expectedVisibleSessionIds: visibleSessionIds,
    observedActiveTabGroupViewColumn: workbench.activeTabGroupViewColumn,
    observedLabels,
  });
}
