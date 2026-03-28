import { useEffect, useMemo, useState } from "react";
import type {
  ExtensionToWorkspacePanelMessage,
  WorkspacePanelPane,
} from "../shared/workspace-panel-contract";
import { TerminalPane } from "./terminal-pane";
import { T3Pane } from "./t3-pane";

export type WorkspaceAppProps = {
  vscode: {
    postMessage: (message: unknown) => void;
  };
};

export const WorkspaceApp: React.FC<WorkspaceAppProps> = ({ vscode }) => {
  const [serverState, setServerState] = useState<ExtensionToWorkspacePanelMessage | undefined>();

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWorkspacePanelMessage>) => {
      if (!event.data || (event.data.type !== "hydrate" && event.data.type !== "sessionState")) {
        return;
      }
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

    window.addEventListener("message", handleMessage);
    window.addEventListener("message", handleIframeFocus);
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("message", handleIframeFocus);
    };
  }, [vscode]);

  const panes = useMemo(() => serverState?.panes ?? [], [serverState?.panes]);

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
          isFocused={serverState.focusedSessionId === pane.sessionId}
          key={pane.sessionId}
          onFocus={() =>
            vscode.postMessage({
              sessionId: pane.sessionId,
              type: "focusSession",
            })
          }
          pane={pane}
          terminalAppearance={serverState.terminalAppearance}
        />
      ))}
    </main>
  );
};

type WorkspacePaneViewProps = {
  connection: ExtensionToWorkspacePanelMessage["connection"];
  isFocused: boolean;
  onFocus: () => void;
  pane: WorkspacePanelPane;
  terminalAppearance: ExtensionToWorkspacePanelMessage["terminalAppearance"];
};

const WorkspacePaneView: React.FC<WorkspacePaneViewProps> = ({
  connection,
  isFocused,
  onFocus,
  pane,
  terminalAppearance,
}) => {
  const primaryTitle = pane.sessionRecord.title.trim() || pane.sessionRecord.alias;
  const surfaceLabel = pane.kind === "terminal" ? "Terminal" : "T3";

  return (
    <section
      className={`workspace-pane ${isFocused ? "workspace-pane-focused" : ""}`}
      onMouseDown={onFocus}
    >
      <header className="workspace-pane-header">
        <div className="workspace-pane-title">{primaryTitle}</div>
        <div className="workspace-pane-meta">
          <span>{pane.sessionRecord.displayId}</span>
          <span>{surfaceLabel}</span>
        </div>
      </header>
      <div className="workspace-pane-body">
        {pane.kind === "terminal" ? (
          <TerminalPane
            connection={connection}
            isFocused={isFocused}
            onFocus={onFocus}
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
