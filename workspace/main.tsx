import { createRoot } from "react-dom/client";
import type {
  WorkspacePanelHydrateMessage,
  WorkspacePanelSessionStateMessage,
} from "../shared/workspace-panel-contract";
import { WorkspaceApp } from "./workspace-app";
import "./styles.css";

declare global {
  function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void;
  };

  interface Window {
    __VSMUX_WORKSPACE_VSCODE__?: {
      postMessage: (message: unknown) => void;
    };
    __VSMUX_WORKSPACE_APP_MOUNTED__?: boolean;
    __VSMUX_WORKSPACE_BOOTSTRAP__?:
      | WorkspacePanelHydrateMessage
      | WorkspacePanelSessionStateMessage;
    __VSMUX_WORKSPACE_EARLY_LOG__?: (event: string, details?: Record<string, unknown>) => void;
    __VSMUX_WORKSPACE_REACT_RENDER_SCHEDULED__?: boolean;
    __VSMUX_WORKSPACE_READY_POSTED__?: boolean;
  }
}

window.__VSMUX_WORKSPACE_EARLY_LOG__?.("workspaceStartup.bundleEvaluated");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Workspace root element was not found.");
}

const root = createRoot(rootElement);
const vscodeApi = window.__VSMUX_WORKSPACE_VSCODE__ ?? acquireVsCodeApi();
window.__VSMUX_WORKSPACE_VSCODE__ = vscodeApi;
window.__VSMUX_WORKSPACE_REACT_RENDER_SCHEDULED__ = true;
window.__VSMUX_WORKSPACE_EARLY_LOG__?.("workspaceStartup.reactRenderScheduled", {
  hasBootstrapState: window.__VSMUX_WORKSPACE_BOOTSTRAP__ !== undefined,
});
root.render(<WorkspaceApp vscode={vscodeApi} />);
