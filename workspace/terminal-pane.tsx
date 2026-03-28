import { useEffect, useRef, useState } from "react";
import { FitAddon, Ghostty, Terminal } from "ghostty-web";
import ghosttyWasmUrl from "ghostty-web/ghostty-vt.wasm?url";
import type {
  WorkspacePanelConnection,
  WorkspacePanelTerminalAppearance,
  WorkspacePanelTerminalPane,
} from "../shared/workspace-panel-contract";
import type {
  TerminalOutputMessage,
  TerminalStateMessage,
} from "../shared/terminal-host-protocol";

const ghosttyPromise = Ghostty.load(ghosttyWasmUrl);

type TerminalWithPrivateSelection = Terminal & {
  selectionManager?: {
    copyToClipboard?: (text: string) => Promise<void>;
  };
};

const disableSelectionCopy = (terminal: Terminal): void => {
  const terminalWithPrivateSelection = terminal as TerminalWithPrivateSelection;
  if (!terminalWithPrivateSelection.selectionManager) {
    return;
  }

  terminalWithPrivateSelection.selectionManager.copyToClipboard = async () => undefined;
};

export type TerminalPaneProps = {
  connection: WorkspacePanelConnection;
  isFocused: boolean;
  onFocus: () => void;
  pane: WorkspacePanelTerminalPane;
  terminalAppearance: WorkspacePanelTerminalAppearance;
};

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  connection,
  isFocused,
  onFocus,
  pane,
  terminalAppearance,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | undefined>(undefined);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  useEffect(() => {
    let cancelled = false;
    let websocket: WebSocket | undefined;
    let fitAddon: FitAddon | undefined;

    const run = async () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const ghostty = await ghosttyPromise;
      if (cancelled) {
        return;
      }

      const terminal = new Terminal({
        cursorBlink: false,
        cursorStyle: terminalAppearance.cursorStyle,
        fontFamily: terminalAppearance.fontFamily,
        fontSize: terminalAppearance.fontSize,
        ghostty,
        letterSpacing: terminalAppearance.letterSpacing,
        lineHeight: terminalAppearance.lineHeight,
        theme: {
          background: "#101722",
          foreground: "#d8e1ee",
        },
      });
      terminalRef.current = terminal;
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      await terminal.open(container);
      disableSelectionCopy(terminal);
      fitAddon.fit();
      fitAddon.observeResize();

      const socketUrl = new URL("/session", connection.baseUrl);
      socketUrl.searchParams.set("token", connection.token);
      socketUrl.searchParams.set("sessionId", pane.sessionId);
      socketUrl.searchParams.set("cols", String(terminal.cols));
      socketUrl.searchParams.set("rows", String(terminal.rows));

      let didApplyHistory = false;
      websocket = new WebSocket(socketUrl.toString());
      websocket.onopen = () => {
        setConnectionState("connected");
      };
      websocket.onclose = () => {
        setConnectionState("disconnected");
      };
      websocket.onerror = () => {
        setConnectionState("disconnected");
      };
      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data) as TerminalOutputMessage | TerminalStateMessage;
        if (message.type === "terminalSessionState") {
          if (!didApplyHistory) {
            terminal.reset();
            if (message.session.history) {
              terminal.write(message.session.history);
            }
            didApplyHistory = true;
          }
          return;
        }

        terminal.write(message.data);
      };

      terminal.onData((data) => {
        websocket?.send(
          JSON.stringify({
            data,
            sessionId: pane.sessionId,
            type: "terminalInput",
          }),
        );
      });
      terminal.onResize((size) => {
        websocket?.send(
          JSON.stringify({
            cols: size.cols,
            rows: size.rows,
            sessionId: pane.sessionId,
            type: "terminalResize",
          }),
        );
      });
    };

    void run();

    return () => {
      cancelled = true;
      websocket?.close();
      terminalRef.current?.dispose();
      terminalRef.current = undefined;
      fitAddon?.dispose();
    };
  }, [
    connection.baseUrl,
    connection.token,
    pane.sessionId,
    terminalAppearance.cursorStyle,
    terminalAppearance.fontFamily,
    terminalAppearance.fontSize,
    terminalAppearance.letterSpacing,
    terminalAppearance.lineHeight,
  ]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    terminalRef.current?.focus();
  }, [isFocused]);

  return (
    <div className="terminal-pane-root" onMouseDown={onFocus}>
      {connectionState !== "connected" ? (
        <div className={`terminal-pane-status terminal-pane-status-${connectionState}`}>
          {connectionState}
        </div>
      ) : null}
      <div className="terminal-pane-canvas" ref={containerRef} />
    </div>
  );
};
