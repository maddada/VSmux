import type { SidebarSessionItem } from "../../shared/session-grid-contract";

export function shouldSkipSessionForIndicatorProtectedGroupAction(
  session: Pick<SidebarSessionItem, "activity">,
): boolean {
  return session.activity === "working" || session.activity === "attention";
}

export const shouldSkipSessionForGroupFullReload =
  shouldSkipSessionForIndicatorProtectedGroupAction;
