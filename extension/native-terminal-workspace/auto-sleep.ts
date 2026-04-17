import {
  getSidebarSessionLifecycleState,
  type SidebarSessionItem,
} from "../../shared/session-grid-contract";

const MIN_AUTO_SLEEP_CHECK_INTERVAL_MS = 5_000;
const MAX_AUTO_SLEEP_CHECK_INTERVAL_MS = 30_000;

export function shouldAutoSleepSidebarSession(
  session: Pick<
    SidebarSessionItem,
    "activity" | "agentIcon" | "isRunning" | "isSleeping" | "lifecycleState"
  >,
): boolean {
  if (session.isSleeping === true) {
    return false;
  }

  return (
    (session.agentIcon === "claude" || session.agentIcon === "codex") &&
    session.activity === "idle" &&
    getSidebarSessionLifecycleState(session) === "running"
  );
}

export function hasReachedAutoSleepTimeout(args: {
  activityAt: string | undefined;
  now?: number;
  timeoutMs: number | null;
}): boolean {
  const { activityAt, now = Date.now(), timeoutMs } = args;
  if (timeoutMs === null || timeoutMs <= 0 || !activityAt) {
    return false;
  }

  const activityAtMs = Date.parse(activityAt);
  if (!Number.isFinite(activityAtMs)) {
    return false;
  }

  return Math.max(0, now - activityAtMs) >= timeoutMs;
}

export function getAutoSleepCheckIntervalMs(timeoutMs: number | null): number | undefined {
  if (timeoutMs === null || timeoutMs <= 0) {
    return undefined;
  }

  return Math.max(
    MIN_AUTO_SLEEP_CHECK_INTERVAL_MS,
    Math.min(MAX_AUTO_SLEEP_CHECK_INTERVAL_MS, Math.floor(timeoutMs / 3)),
  );
}
