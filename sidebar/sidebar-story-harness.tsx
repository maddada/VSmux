import { useEffect, useRef } from "react";
import type { SidebarHydrateMessage } from "../shared/session-grid-contract";
import { SidebarApp } from "./sidebar-app";
import type { WebviewApi } from "./webview-api";

export type SidebarStoryHarnessProps = {
  message: SidebarHydrateMessage;
};

export function SidebarStoryHarness({ message }: SidebarStoryHarnessProps) {
  const vscode = useRef<WebviewApi>({
    postMessage() {},
  }).current;
  const messageKey = JSON.stringify(message);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.postMessage(message, "*");
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, messageKey]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <SidebarApp vscode={vscode} />
    </div>
  );
}
