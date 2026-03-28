import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExtensionToWorkspacePanelMessage,
  WorkspacePanelPane,
} from "../shared/workspace-panel-contract";
import { logWorkspaceDebug } from "./workspace-debug";
import { TerminalPane } from "./terminal-pane";
import { T3Pane } from "./t3-pane";

type MessageSource = Pick<Window, "addEventListener" | "removeEventListener">;
const INITIAL_TERMINAL_REMOUNT_DELAY_MS = 120;
const INITIAL_TERMINAL_REVEAL_DELAY_MS = 240;

export type WorkspaceAppProps = {
  messageSource?: MessageSource;
  vscode: {
    postMessage: (message: unknown) => void;
  };
};

export const WorkspaceApp: React.FC<WorkspaceAppProps> = ({ messageSource = window, vscode }) => {
  const [isInitialTerminalRevealReady, setIsInitialTerminalRevealReady] = useState(false);
  const [initialTerminalPaneRenderVersion, setInitialTerminalPaneRenderVersion] = useState(0);
  const [serverState, setServerState] = useState<ExtensionToWorkspacePanelMessage | undefined>();
  const [fitVersion, setFitVersion] = useState(0);
  const [localFocusedSessionId, setLocalFocusedSessionId] = useState<string | undefined>();
  const previousFocusedSessionIdRef = useRef<string | undefined>(undefined);
  const hasStartedInitialRevealRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWorkspacePanelMessage>) => {
      if (!event.data || (event.data.type !== "hydrate" && event.data.type !== "sessionState")) {
        return;
      }
      logWorkspaceDebug(event.data.debuggingMode, "message.received", {
        activeGroupId: event.data.activeGroupId,
        focusedSessionId: event.data.focusedSessionId,
        paneIds: event.data.panes.map((pane) => pane.sessionId),
        type: event.data.type,
      });
      setServerState(event.data);
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

  const panes = useMemo(() => serverState?.panes ?? [], [serverState?.panes]);
  const presentedFocusedSessionId = localFocusedSessionId ?? serverState?.focusedSessionId;

  useEffect(() => {
    setLocalFocusedSessionId(serverState?.focusedSessionId);
  }, [serverState?.activeGroupId, serverState?.focusedSessionId]);

  useEffect(() => {
    if (!serverState || hasStartedInitialRevealRef.current) {
      return;
    }

    hasStartedInitialRevealRef.current = true;
    const remountTimeoutId = window.setTimeout(() => {
      logWorkspaceDebug(serverState.debuggingMode, "workspace.initialTerminalRemountRequested", {
        delayMs: INITIAL_TERMINAL_REMOUNT_DELAY_MS,
        paneIds: serverState.panes.map((pane) => pane.sessionId),
      });
      setInitialTerminalPaneRenderVersion((currentVersion) => currentVersion + 1);
    }, INITIAL_TERMINAL_REMOUNT_DELAY_MS);

    const revealTimeoutId = window.setTimeout(() => {
      logWorkspaceDebug(serverState.debuggingMode, "workspace.initialTerminalRevealRequested", {
        delayMs: INITIAL_TERMINAL_REVEAL_DELAY_MS,
        paneIds: serverState.panes.map((pane) => pane.sessionId),
      });
      setIsInitialTerminalRevealReady(true);
    }, INITIAL_TERMINAL_REVEAL_DELAY_MS);

    return () => {
      window.clearTimeout(remountTimeoutId);
      window.clearTimeout(revealTimeoutId);
    };
  }, [serverState]);

  useEffect(() => {
    if (!isInitialTerminalRevealReady || !presentedFocusedSessionId) {
      return;
    }

    const previousFocusedSessionId = previousFocusedSessionIdRef.current;
    previousFocusedSessionIdRef.current = presentedFocusedSessionId;
    if (!previousFocusedSessionId || previousFocusedSessionId === presentedFocusedSessionId) {
      return;
    }

    logWorkspaceDebug(serverState?.debuggingMode, "focus.refitRequested", {
      focusedSessionId: presentedFocusedSessionId,
      paneIds: panes.map((pane) => pane.sessionId),
    });
    requestTerminalRefit({ dispatchBrowserResize: true });
  }, [isInitialTerminalRevealReady, panes, presentedFocusedSessionId, serverState?.debuggingMode]);

  useEffect(() => {
    let settleTimeoutId: number | undefined;
    let trailingTimeoutId: number | undefined;

    const handleWindowResize = () => {
      logWorkspaceDebug(serverState?.debuggingMode, "window.resizeRefitRequested", {
        paneIds: panes.map((pane) => pane.sessionId),
      });
      requestTerminalRefit();
      if (settleTimeoutId !== undefined) {
        window.clearTimeout(settleTimeoutId);
      }
      if (trailingTimeoutId !== undefined) {
        window.clearTimeout(trailingTimeoutId);
      }

      settleTimeoutId = window.setTimeout(() => {
        logWorkspaceDebug(serverState?.debuggingMode, "window.resizeSettleRefitRequested", {
          paneIds: panes.map((pane) => pane.sessionId),
        });
        requestTerminalRefit();
      }, 120);

      trailingTimeoutId = window.setTimeout(() => {
        logWorkspaceDebug(serverState?.debuggingMode, "window.resizeTrailingRefitRequested", {
          paneIds: panes.map((pane) => pane.sessionId),
        });
        requestTerminalRefit();
      }, 260);
    };

    window.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleWindowResize);
      if (settleTimeoutId !== undefined) {
        window.clearTimeout(settleTimeoutId);
      }
      if (trailingTimeoutId !== undefined) {
        window.clearTimeout(trailingTimeoutId);
      }
    };
  }, [panes, serverState?.debuggingMode]);

  function requestTerminalRefit(options?: { dispatchBrowserResize?: boolean }) {
    if (options?.dispatchBrowserResize) {
      window.dispatchEvent(new Event("resize"));
    }
    setFitVersion((currentVersion) => currentVersion + 1);
  }

  if (!serverState) {
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
    <main
      className={`workspace-shell ${panes.length > 1 ? "workspace-shell-split" : "workspace-shell-single"}`}
    >
      {panes.map((pane) => (
        <WorkspacePaneView
          connection={serverState.connection}
          debuggingMode={serverState.debuggingMode}
          fitVersion={fitVersion}
          isFocused={presentedFocusedSessionId === pane.sessionId}
          isInitialTerminalRevealReady={isInitialTerminalRevealReady}
          key={pane.sessionId}
          onLocalFocus={() => {
            setLocalFocusedSessionId(pane.sessionId);
          }}
          onFocus={() =>
            vscode.postMessage({
              sessionId: pane.sessionId,
              type: "focusSession",
            })
          }
          pane={pane}
          terminalPaneRenderVersion={initialTerminalPaneRenderVersion}
          terminalAppearance={serverState.terminalAppearance}
        />
      ))}
    </main>
  );
};

type WorkspacePaneViewProps = {
  connection: ExtensionToWorkspacePanelMessage["connection"];
  debuggingMode: boolean;
  fitVersion: number;
  isFocused: boolean;
  isInitialTerminalRevealReady: boolean;
  onLocalFocus: () => void;
  onFocus: () => void;
  pane: WorkspacePanelPane;
  terminalPaneRenderVersion: number;
  terminalAppearance: ExtensionToWorkspacePanelMessage["terminalAppearance"];
};

const WorkspacePaneView: React.FC<WorkspacePaneViewProps> = ({
  connection,
  debuggingMode,
  fitVersion,
  isFocused,
  isInitialTerminalRevealReady,
  onLocalFocus,
  onFocus,
  pane,
  terminalPaneRenderVersion,
  terminalAppearance,
}) => {
  const primaryTitle = pane.sessionRecord.title.trim() || pane.sessionRecord.alias;

  return (
    <section
      className={`workspace-pane ${isFocused ? "workspace-pane-focused" : ""}`}
      onMouseDown={onFocus}
    >
      <header className="workspace-pane-header">
        <div className="workspace-pane-title">{primaryTitle}</div>
      </header>
      <div className="workspace-pane-body">
        {pane.kind === "terminal" ? (
          <TerminalPane
            connection={connection}
            debuggingMode={debuggingMode}
            fitVersion={fitVersion}
            isVisible={isInitialTerminalRevealReady}
            key={`${pane.sessionId}:${String(terminalPaneRenderVersion)}`}
            onActivate={onLocalFocus}
            pane={pane}
            terminalAppearance={terminalAppearance}
          />
        ) : (
          <T3Pane isFocused={isFocused} onFocus={onFocus} pane={pane} />
        )}
      </div>
    </section>
  );
};
