import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { createEditorLayoutPlan } from "../shared/editor-layout";
import type {
  ExtensionToWorkspacePanelMessage,
  WorkspacePanelPane,
  WorkspacePanelTerminalPane,
  WorkspacePanelHydrateMessage,
  WorkspacePanelSessionStateMessage,
} from "../shared/workspace-panel-contract";
import {
  getOrderedSessions,
  getVisiblePrimaryTitle,
  getVisibleTerminalTitle,
} from "../shared/session-grid-contract";
import { logWorkspaceDebug } from "./workspace-debug";
import { WorkspacePaneCloseButton } from "./workspace-pane-close-button";
import {
  buildFullSessionOrderFromVisiblePaneOrder,
  buildVisiblePaneOrderForDrop,
  sortPanesBySessionIds,
} from "./workspace-pane-reorder";
import { TerminalPane } from "./terminal-pane";
import { T3Pane } from "./t3-pane";

type MessageSource = Pick<Window, "addEventListener" | "removeEventListener">;
const INITIAL_TERMINAL_REMOUNT_DELAY_MS = 200;
const TERMINAL_HIDE_BEFORE_REMOUNT_DELAY_MS = 180;

export type WorkspaceAppProps = {
  messageSource?: MessageSource;
  vscode: {
    postMessage: (message: unknown) => void;
  };
};

export const WorkspaceApp: React.FC<WorkspaceAppProps> = ({ messageSource = window, vscode }) => {
  const [areTerminalsVisible, setAreTerminalsVisible] = useState(true);
  const [hasCompletedInitialTerminalRemount, setHasCompletedInitialTerminalRemount] =
    useState(false);
  const [isWorkspaceFocused, setIsWorkspaceFocused] = useState(
    () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus(),
  );
  const [serverState, setServerState] = useState<ExtensionToWorkspacePanelMessage | undefined>();
  const [terminalPaneRenderVersion, setTerminalPaneRenderVersion] = useState(0);
  const [localFocusedSessionId, setLocalFocusedSessionId] = useState<string | undefined>();
  const [localPaneOrder, setLocalPaneOrder] = useState<string[] | undefined>();
  const [draggedPaneId, setDraggedPaneId] = useState<string | undefined>();
  const [dropTargetPaneId, setDropTargetPaneId] = useState<string | undefined>();
  const pendingFocusedSessionIdRef = useRef<string>();
  const workspaceState =
    serverState && (serverState.type === "hydrate" || serverState.type === "sessionState")
      ? serverState
      : undefined;

  useEffect(() => {
    const syncWorkspaceFocusState = () => {
      setIsWorkspaceFocused(document.visibilityState === "visible" && document.hasFocus());
    };

    syncWorkspaceFocusState();
    window.addEventListener("blur", syncWorkspaceFocusState);
    window.addEventListener("focus", syncWorkspaceFocusState);
    window.addEventListener("focusin", syncWorkspaceFocusState);
    window.addEventListener("focusout", syncWorkspaceFocusState);
    document.addEventListener("visibilitychange", syncWorkspaceFocusState);

    return () => {
      window.removeEventListener("blur", syncWorkspaceFocusState);
      window.removeEventListener("focus", syncWorkspaceFocusState);
      window.removeEventListener("focusin", syncWorkspaceFocusState);
      window.removeEventListener("focusout", syncWorkspaceFocusState);
      document.removeEventListener("visibilitychange", syncWorkspaceFocusState);
    };
  }, []);

  useEffect(() => {
    const applyWorkspaceStateMessage = (
      message: WorkspacePanelHydrateMessage | WorkspacePanelSessionStateMessage,
    ) => {
      logWorkspaceDebug(message.debuggingMode, "message.received", {
        activeGroupId: message.activeGroupId,
        focusedSessionId: message.focusedSessionId,
        paneIds: message.panes.map((pane) => pane.sessionId),
        type: message.type,
      });
      setServerState(message);
    };

    const handleMessage = (event: MessageEvent<ExtensionToWorkspacePanelMessage>) => {
      if (!event.data) {
        return;
      }

      if (event.data.type === "terminalPresentationChanged") {
        setServerState((previousState) => {
          if (
            !previousState ||
            (previousState.type !== "hydrate" && previousState.type !== "sessionState")
          ) {
            return previousState;
          }

          return {
            ...previousState,
            panes: previousState.panes.map((pane) =>
              pane.kind !== "terminal" || pane.sessionId !== event.data.sessionId
                ? pane
                : {
                    ...pane,
                    snapshot: event.data.snapshot ?? pane.snapshot,
                    terminalTitle: event.data.terminalTitle,
                  },
            ),
          };
        });
        return;
      }

      if (event.data.type !== "hydrate" && event.data.type !== "sessionState") {
        return;
      }

      applyWorkspaceStateMessage(event.data);
    };

    const handleIframeFocus = (event: MessageEvent<{ sessionId?: string; type?: string }>) => {
      if (event.data?.type !== "vsmuxT3Focus" || typeof event.data.sessionId !== "string") {
        return;
      }

      vscode.postMessage({
        sessionId: event.data.sessionId,
        type: "focusSession",
      });
    };

    messageSource.addEventListener("message", handleMessage as EventListener);
    window.addEventListener("message", handleIframeFocus);
    vscode.postMessage({ type: "ready" });

    return () => {
      messageSource.removeEventListener("message", handleMessage as EventListener);
      window.removeEventListener("message", handleIframeFocus);
    };
  }, [messageSource, vscode]);

  const panes = useMemo(() => workspaceState?.panes ?? [], [workspaceState]);
  const workspacePaneIdsKey = panes.map((pane) => pane.sessionId).join("|");
  const orderedPanes = useMemo(
    () => (localPaneOrder ? sortPanesBySessionIds(panes, localPaneOrder) : panes),
    [localPaneOrder, panes],
  );
  const paneRows = useMemo(() => {
    const rowLengths = createEditorLayoutPlan(
      Math.max(1, orderedPanes.length),
      workspaceState?.viewMode ?? "grid",
    ).rowLengths;
    const rows: WorkspacePanelPane[][] = [];
    let nextPaneIndex = 0;

    for (const rowLength of rowLengths) {
      const row = orderedPanes.slice(nextPaneIndex, nextPaneIndex + rowLength);
      if (row.length > 0) {
        rows.push(row);
      }
      nextPaneIndex += rowLength;
    }

    return rows;
  }, [orderedPanes, workspaceState?.viewMode]);
  const presentedFocusedSessionId = localFocusedSessionId ?? workspaceState?.focusedSessionId;
  const terminalPaneIds = useMemo(
    () => orderedPanes.filter((pane) => pane.kind === "terminal").map((pane) => pane.sessionId),
    [orderedPanes],
  );
  const terminalPaneIdsKey = terminalPaneIds.join("|");
  const visiblePaneIds = useMemo(() => orderedPanes.map((pane) => pane.sessionId), [orderedPanes]);
  const reorderablePaneIds = useMemo(
    () => orderedPanes.filter((pane) => pane.kind === "terminal").map((pane) => pane.sessionId),
    [orderedPanes],
  );
  const workspaceShellStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--workspace-active-pane-border-color":
          workspaceState?.layoutAppearance.activePaneBorderColor,
        "--workspace-pane-gap": `${String(workspaceState?.layoutAppearance.paneGap ?? 12)}px`,
      }) as CSSProperties,
    [
      workspaceState?.layoutAppearance.activePaneBorderColor,
      workspaceState?.layoutAppearance.paneGap,
    ],
  );

  useEffect(() => {
    if (!workspaceState) {
      return;
    }

    if (pendingFocusedSessionIdRef.current) {
      if (workspaceState.focusedSessionId === pendingFocusedSessionIdRef.current) {
        pendingFocusedSessionIdRef.current = undefined;
      } else {
        return;
      }
    }

    setLocalFocusedSessionId(workspaceState.focusedSessionId);
  }, [workspaceState]);

  useEffect(() => {
    setLocalPaneOrder(undefined);
    setDraggedPaneId(undefined);
    setDropTargetPaneId(undefined);
  }, [workspacePaneIdsKey, workspaceState?.activeGroupId]);

  const requestFocusSession = (sessionId: string) => {
    pendingFocusedSessionIdRef.current = sessionId;
    setLocalFocusedSessionId(sessionId);
    vscode.postMessage({
      sessionId,
      type: "focusSession",
    });
  };

  const requestPaneReorder = (sourcePaneId: string, targetPaneId: string) => {
    if (!workspaceState) {
      return;
    }

    const activeGroup = workspaceState.workspaceSnapshot.groups.find(
      (group) => group.groupId === workspaceState.activeGroupId,
    );
    if (!activeGroup) {
      return;
    }

    const nextVisiblePaneOrder = buildVisiblePaneOrderForDrop(
      visiblePaneIds,
      reorderablePaneIds,
      sourcePaneId,
      targetPaneId,
    );
    if (!nextVisiblePaneOrder) {
      return;
    }

    const nextSessionOrder = buildFullSessionOrderFromVisiblePaneOrder(
      getOrderedSessions(activeGroup.snapshot).map((session) => session.sessionId),
      nextVisiblePaneOrder,
    );
    if (!nextSessionOrder) {
      return;
    }

    setLocalPaneOrder(nextVisiblePaneOrder);
    vscode.postMessage({
      groupId: workspaceState.activeGroupId,
      sessionIds: nextSessionOrder,
      type: "syncSessionOrder",
    });
  };

  const clearDragState = () => {
    setDraggedPaneId(undefined);
    setDropTargetPaneId(undefined);
  };

  useEffect(() => {
    if (terminalPaneIds.length === 0 || hasCompletedInitialTerminalRemount) {
      return;
    }

    const debuggingMode = workspaceState?.debuggingMode;
    const hideTimeoutId = window.setTimeout(() => {
      logWorkspaceDebug(debuggingMode, "workspace.initialTerminalHideRequested", {
        delayMs: TERMINAL_HIDE_BEFORE_REMOUNT_DELAY_MS,
        paneIds: terminalPaneIds,
      });
      setAreTerminalsVisible(false);
    }, TERMINAL_HIDE_BEFORE_REMOUNT_DELAY_MS);
    const remountTimeoutId = window.setTimeout(() => {
      logWorkspaceDebug(debuggingMode, "workspace.initialTerminalRemountRequested", {
        delayMs: INITIAL_TERMINAL_REMOUNT_DELAY_MS,
        paneIds: terminalPaneIds,
      });
      setTerminalPaneRenderVersion((currentVersion) => currentVersion + 1);
      requestAnimationFrame(() => {
        setAreTerminalsVisible(true);
        setHasCompletedInitialTerminalRemount(true);
      });
    }, INITIAL_TERMINAL_REMOUNT_DELAY_MS);

    return () => {
      window.clearTimeout(hideTimeoutId);
      window.clearTimeout(remountTimeoutId);
    };
  }, [hasCompletedInitialTerminalRemount, terminalPaneIdsKey, workspaceState?.debuggingMode]);

  if (!workspaceState) {
    return (
      <main className="workspace-shell workspace-shell-empty">
        <div className="workspace-empty-state">Loading VSmux workspace…</div>
      </main>
    );
  }

  if (panes.length === 0) {
    return (
      <main className="workspace-shell workspace-shell-empty">
        <div className="workspace-empty-state">No visible sessions in the active group.</div>
      </main>
    );
  }

  return (
    <main className="workspace-shell" style={workspaceShellStyle}>
      {paneRows.map((row, rowIndex) => (
        <div
          className={`workspace-row workspace-row-cols-${String(row.length)}`}
          key={`row-${String(rowIndex)}`}
        >
          {row.map((pane) => (
            <WorkspacePaneView
              connection={workspaceState.connection}
              debuggingMode={workspaceState.debuggingMode}
              isFocused={presentedFocusedSessionId === pane.sessionId}
              isWorkspaceFocused={isWorkspaceFocused}
              key={pane.sessionId}
              areTerminalsVisible={areTerminalsVisible}
              onLocalFocus={() => {
                setLocalFocusedSessionId(pane.sessionId);
              }}
              onFocus={() => requestFocusSession(pane.sessionId)}
              onClose={() =>
                vscode.postMessage({
                  sessionId: pane.sessionId,
                  type: "closeSession",
                })
              }
              pane={pane}
              terminalPaneRenderVersion={terminalPaneRenderVersion}
              terminalAppearance={workspaceState.terminalAppearance}
              canDrag={pane.kind === "terminal" && reorderablePaneIds.length > 1}
              isDragging={draggedPaneId === pane.sessionId}
              isDropTarget={dropTargetPaneId === pane.sessionId && draggedPaneId !== pane.sessionId}
              onDragEnd={clearDragState}
              onDragOver={(event) => {
                if (
                  pane.kind !== "terminal" ||
                  !draggedPaneId ||
                  draggedPaneId === pane.sessionId
                ) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetPaneId(pane.sessionId);
              }}
              onDragStart={(event) => {
                if (pane.kind !== "terminal") {
                  return;
                }

                setDraggedPaneId(pane.sessionId);
                setDropTargetPaneId(undefined);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", pane.sessionId);
              }}
              onDrop={(event) => {
                if (pane.kind !== "terminal") {
                  return;
                }

                event.preventDefault();
                const sourcePaneId = draggedPaneId ?? event.dataTransfer.getData("text/plain");
                clearDragState();
                if (!sourcePaneId) {
                  return;
                }

                requestPaneReorder(sourcePaneId, pane.sessionId);
              }}
            />
          ))}
        </div>
      ))}
    </main>
  );
};

type WorkspacePaneViewProps = {
  connection: WorkspacePanelHydrateMessage["connection"];
  debuggingMode: boolean;
  isFocused: boolean;
  isWorkspaceFocused: boolean;
  areTerminalsVisible: boolean;
  canDrag: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onLocalFocus: () => void;
  onFocus: () => void;
  onClose: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  pane: WorkspacePanelPane;
  terminalPaneRenderVersion: number;
  terminalAppearance: WorkspacePanelHydrateMessage["terminalAppearance"];
};

const WorkspacePaneView: React.FC<WorkspacePaneViewProps> = ({
  connection,
  debuggingMode,
  isFocused,
  isWorkspaceFocused,
  areTerminalsVisible,
  canDrag,
  isDragging,
  isDropTarget,
  onLocalFocus,
  onFocus,
  onClose,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  pane,
  terminalPaneRenderVersion,
  terminalAppearance,
}) => {
  const primaryTitle = getWorkspacePanePrimaryTitle(pane);

  return (
    <section
      className={[
        "workspace-pane",
        isFocused && isWorkspaceFocused ? "workspace-pane-focused" : "",
        canDrag ? "workspace-pane-reorderable" : "",
        isDragging ? "workspace-pane-dragging" : "",
        isDropTarget ? "workspace-pane-drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={canDrag ? onDragOver : undefined}
      onDrop={canDrag ? onDrop : undefined}
      onMouseDown={() => {
        onLocalFocus();
        if (!isFocused) {
          onFocus();
        }
      }}
    >
      <header
        className={`workspace-pane-header ${canDrag ? "workspace-pane-header-draggable" : ""}`}
        draggable={canDrag}
        onDragEnd={canDrag ? onDragEnd : undefined}
        onDragStart={canDrag ? onDragStart : undefined}
      >
        <div className="workspace-pane-title">{primaryTitle}</div>
        {pane.kind === "terminal" ? <WorkspacePaneCloseButton onConfirmClose={onClose} /> : null}
      </header>
      <div className="workspace-pane-body">
        {pane.kind === "terminal" ? (
          <div style={{ height: "100%", visibility: areTerminalsVisible ? "visible" : "hidden" }}>
            <TerminalPane
              connection={connection}
              debuggingMode={debuggingMode}
              key={`${pane.sessionId}:${String(terminalPaneRenderVersion)}`}
              onActivate={() => {
                onLocalFocus();
                if (!isFocused) {
                  onFocus();
                }
              }}
              pane={pane}
              terminalAppearance={terminalAppearance}
            />
          </div>
        ) : (
          <T3Pane isFocused={isFocused} onFocus={onFocus} pane={pane} />
        )}
      </div>
    </section>
  );
};

function getWorkspacePanePrimaryTitle(pane: WorkspacePanelPane): string {
  const userTitle = getVisiblePrimaryTitle(pane.sessionRecord.title);
  if (userTitle) {
    return userTitle;
  }

  if (pane.kind === "terminal") {
    const terminalTitle = getVisibleTerminalTitle(
      (pane as WorkspacePanelTerminalPane).terminalTitle,
    );
    if (terminalTitle) {
      return terminalTitle;
    }
  }

  return pane.sessionRecord.alias;
}
