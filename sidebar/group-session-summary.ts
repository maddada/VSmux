import type { SidebarSessionItem } from "../shared/session-grid-contract";

export type GroupSessionSummary = {
  activeCount: number;
  doneCount: number;
};

export function getGroupSessionSummary(
  sessions: readonly SidebarSessionItem[],
): GroupSessionSummary {
  let activeCount = 0;
  let doneCount = 0;

  for (const session of sessions) {
    if (session.isSleeping) {
      continue;
    }

    if (session.isRunning) {
      activeCount += 1;
      continue;
    }

    doneCount += 1;
  }

  return {
    activeCount,
    doneCount,
  };
}
