import * as vscode from "vscode";
import { getT3SessionSurfaceTitle, type T3SessionRecord } from "../../shared/session-grid-contract";

export const T3_PANEL_TYPE = "VSmux.t3Session";

export function getPlacementRank(isVisible: boolean, isFocused: boolean): number {
  if (isFocused) {
    return 2;
  }

  return isVisible ? 1 : 0;
}

export function getPanelTitle(sessionRecord: T3SessionRecord): string {
  return getT3SessionSurfaceTitle(sessionRecord);
}

export function getRenderKey(sessionRecord: T3SessionRecord): string {
  return [
    sessionRecord.alias,
    sessionRecord.t3.projectId,
    sessionRecord.t3.serverOrigin,
    sessionRecord.t3.threadId,
    sessionRecord.t3.workspaceRoot,
  ].join("|");
}

export function getObservedPanelViewColumn(panelTitle: string): vscode.ViewColumn | undefined {
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn === undefined) {
      continue;
    }

    const hasMatchingTab = group.tabs.some(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        tab.input.viewType === T3_PANEL_TYPE &&
        tab.label === panelTitle,
    );
    if (hasMatchingTab) {
      return group.viewColumn;
    }
  }

  return undefined;
}

export function isT3WebviewMessage(message: unknown): message is { type: "vsmuxReady" } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "vsmuxReady"
  );
}
