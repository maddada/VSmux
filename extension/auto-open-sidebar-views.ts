import * as vscode from "vscode";
import {
  getAutoOpenSidebarViewsOnStartup,
  SESSIONS_VIEW_ID,
} from "./native-terminal-workspace/settings";

type SidebarRevealTarget = {
  revealSidebar: () => Promise<void>;
};

export async function maybeAutoOpenSidebarViewsOnStartup(
  target: SidebarRevealTarget,
): Promise<void> {
  if (!getAutoOpenSidebarViewsOnStartup()) {
    return;
  }

  await target.revealSidebar();
  await focusViewOnStartup(SESSIONS_VIEW_ID);
}

async function focusViewOnStartup(viewId: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(`${viewId}.focus`);
  } catch {
    return;
  }
}
