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

export function findTerminalTabIndex(
  sessionTitle: string | undefined,
  groupIndex: number,
): number | undefined {
  if (!sessionTitle) {
    return undefined;
  }

  const viewColumn = getViewColumn(groupIndex);
  const group = vscode.window.tabGroups.all.find((candidateGroup) => {
    return candidateGroup.viewColumn === viewColumn;
  });
  if (!group) {
    return undefined;
  }

  const tabIndex = group.tabs.findIndex(
    (tab) => tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle,
  );
  return tabIndex >= 0 ? tabIndex : undefined;
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

export async function waitForActiveEditorGroup(groupIndex: number): Promise<void> {
  await waitForCondition(() => {
    return vscode.window.tabGroups.activeTabGroup?.viewColumn === getViewColumn(groupIndex);
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

export async function waitForTerminalInGroup(
  sessionTitle: string | undefined,
  targetGroupIndex: number,
): Promise<number | undefined> {
  return waitForCondition(() => {
    const groupIndices = findTerminalGroupIndices(sessionTitle);
    return groupIndices.includes(targetGroupIndex) ? targetGroupIndex : undefined;
  });
}

export async function waitForTerminalMove(
  sessionTitle: string | undefined,
  sourceGroupIndex: number,
  targetGroupIndex: number,
): Promise<number | undefined> {
  return waitForCondition(() => {
    const groupIndices = findTerminalGroupIndices(sessionTitle);
    if (groupIndices.length !== 1) {
      return undefined;
    }

    return groupIndices[0] === targetGroupIndex && !groupIndices.includes(sourceGroupIndex)
      ? targetGroupIndex
      : undefined;
  });
}

export async function waitForTerminalTabForeground(
  sessionTitle: string | undefined,
  groupIndex: number,
): Promise<void> {
  await waitForCondition(() => isTerminalTabForeground(sessionTitle, groupIndex));
}

async function waitForCondition<T>(getValue: () => T | undefined | false): Promise<T | undefined> {
  const deadline = Date.now() + WORKBENCH_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const value = getValue();
    if (value !== undefined && value !== false) {
      return value;
    }
    await delay(WORKBENCH_SETTLE_POLL_MS);
  }

  return undefined;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
