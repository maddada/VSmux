import type { SidebarActionType, SidebarCommandRunMode } from "../shared/sidebar-commands";

export type SidebarCommandTerminalRunPlan =
  | {
      target: "vscode-terminal";
      closeOnExit: boolean;
    }
  | {
      target: "vsmux-terminal";
    };

export function getSidebarCommandTerminalRunPlan(
  actionType: SidebarActionType,
  closeTerminalOnExit: boolean,
  runMode: SidebarCommandRunMode = "default",
): SidebarCommandTerminalRunPlan | undefined {
  if (actionType !== "terminal") {
    return undefined;
  }

  if (runMode === "debug") {
    return {
      target: "vsmux-terminal",
    };
  }

  return {
    closeOnExit: closeTerminalOnExit,
    target: "vscode-terminal",
  };
}

export function getSidebarCommandWorkspaceSessionTitle(
  actionName: string,
  command: string,
  runMode: SidebarCommandRunMode = "default",
): string {
  const normalizedActionName = actionName.trim();
  const baseTitle =
    normalizedActionName.length > 0 ? normalizedActionName : command.trim().slice(0, 20);

  return runMode === "debug" ? `Debug: ${baseTitle}` : baseTitle;
}
