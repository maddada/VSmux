import { createRoot } from "react-dom/client";
import { SidebarApp } from "./sidebar-app";
import "./styles.css";

declare global {
  function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void;
  };
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Sidebar root element was not found.");
}

const vscode = acquireVsCodeApi();
const root = createRoot(rootElement);

root.render(<SidebarApp vscode={vscode} />);
