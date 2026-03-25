import * as vscode from "vscode";
import { getViewColumn } from "../terminal-workspace-helpers";

const WORKBENCH_SETTLE_TIMEOUT_MS = 750;
const WORKBENCH_SETTLE_POLL_MS = 25;

export function findTerminalGroupIndex(sessionTitle: string | undefined): number | undefined {
  return findTerminalGroupIndices(sessionTitle)[0];
}

export function findTerminalGroupIndices(sessionTitle: string | undefined): number[] {
  if (!sessionTitle) {
    return [];
  }

  return vscode.window.tabGroups.all
    .filter((group) => {
      return group.tabs.some((tab) => {
        return tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle;
      });
    })
    .map((group) => (group.viewColumn ?? 1) - 1)
    .sort((left, right) => left - right);
}

export function isTerminalTabForeground(
  sessionTitle: string | undefined,
  groupIndex: number,
): boolean {
  if (!sessionTitle) {
    return false;
  }

  const group = vscode.window.tabGroups.all.find((candidateGroup) => {
    return candidateGroup.viewColumn === getViewColumn(groupIndex);
  });
  if (!group) {
    return false;
  }

  return group.tabs.some((tab) => {
    return (
      tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle
    );
  });
}

export function isTerminalTabActive(
  sessionTitle: string | undefined,
  terminal: vscode.Terminal,
): boolean {
  if (vscode.window.activeTerminal !== terminal || !sessionTitle) {
    return false;
  }

  const activeGroup = vscode.window.tabGroups.activeTabGroup;
  if (!activeGroup) {
    return false;
  }

  return activeGroup.tabs.some((tab) => {
    return (
      tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle
    );
  });
}

export async function waitForActiveTerminal(terminal: vscode.Terminal): Promise<void> {
  const deadline = Date.now() + WORKBENCH_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (vscode.window.activeTerminal === terminal) {
      return;
    }
    await delay(WORKBENCH_SETTLE_POLL_MS);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
