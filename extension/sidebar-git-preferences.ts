import * as vscode from "vscode";
import {
  DEFAULT_SIDEBAR_GIT_ACTION,
  normalizeSidebarGitAction,
  type SidebarGitAction,
} from "../shared/sidebar-git";
import { getWorkspaceStorageKey } from "./terminal-workspace-environment";

const PRIMARY_SIDEBAR_GIT_ACTION_KEY = "VSmux.primarySidebarGitAction";

export function getPrimarySidebarGitAction(
  context: vscode.ExtensionContext,
  workspaceId: string,
): SidebarGitAction {
  return normalizeSidebarGitAction(
    context.workspaceState.get<string>(getWorkspaceStorageKey(PRIMARY_SIDEBAR_GIT_ACTION_KEY, workspaceId)),
  );
}

export async function savePrimarySidebarGitAction(
  context: vscode.ExtensionContext,
  workspaceId: string,
  action: SidebarGitAction,
): Promise<void> {
  await context.workspaceState.update(
    getWorkspaceStorageKey(PRIMARY_SIDEBAR_GIT_ACTION_KEY, workspaceId),
    action,
  );
}

export function getDefaultPrimarySidebarGitAction(): SidebarGitAction {
  return DEFAULT_SIDEBAR_GIT_ACTION;
}
