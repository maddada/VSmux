import { isT3Session, type SessionRecord } from "../../shared/session-grid-contract";
import type {
  TerminalAgentStatus,
  TerminalSessionSnapshot,
} from "../../shared/terminal-host-protocol";
import { createDisconnectedSessionSnapshot } from "../terminal-workspace-helpers";
import {
  getTitleDerivedSessionActivity,
  type TitleDerivedSessionActivity,
} from "../session-title-activity";
import { WORKING_ACTIVITY_STALE_TIMEOUT_MS } from "./settings";

type SessionActivityContext = {
  getCompletionBellEnabled: () => boolean;
  getSessionSnapshot: (sessionId: string) => TerminalSessionSnapshot | undefined;
  getT3ActivityState: (sessionRecord: SessionRecord) => {
    activity: TerminalAgentStatus;
    isRunning: boolean;
  };
  lastKnownActivityBySessionId: Map<string, TerminalAgentStatus>;
  playCompletionSound: () => Promise<void>;
  terminalTitleBySessionId: ReadonlyMap<string, string>;
  titleDerivedActivityBySessionId: ReadonlyMap<string, TitleDerivedSessionActivity>;
  workspaceId: string;
  getLastTerminalActivityAt: (sessionId: string) => number | undefined;
};

export function getEffectiveSessionActivity(
  context: SessionActivityContext,
  sessionRecord: SessionRecord,
  sessionSnapshot: TerminalSessionSnapshot,
): { activity: TerminalAgentStatus; agentName: string | undefined } {
  if (isT3Session(sessionRecord)) {
    return {
      activity: context.getT3ActivityState(sessionRecord).activity,
      agentName: "t3",
    };
  }

  if (sessionSnapshot.agentStatus !== "idle") {
    if (
      sessionSnapshot.agentStatus === "working" &&
      shouldExpireWorkingActivity(
        context.getLastTerminalActivityAt(sessionRecord.sessionId),
        sessionSnapshot.agentName,
      )
    ) {
      return {
        activity: "idle",
        agentName: sessionSnapshot.agentName,
      };
    }

    return {
      activity: sessionSnapshot.agentStatus,
      agentName: sessionSnapshot.agentName,
    };
  }

  const titleDerivedActivity = getTitleDerivedSessionActivity(
    context.terminalTitleBySessionId.get(sessionRecord.sessionId) ?? "",
    context.titleDerivedActivityBySessionId.get(sessionRecord.sessionId),
  );
  if (!titleDerivedActivity) {
    return {
      activity: "idle",
      agentName: sessionSnapshot.agentName,
    };
  }

  if (
    titleDerivedActivity.activity === "working" &&
    shouldExpireWorkingActivity(
      context.getLastTerminalActivityAt(sessionRecord.sessionId),
      titleDerivedActivity.agentName,
    )
  ) {
    return {
      activity: "idle",
      agentName: titleDerivedActivity.agentName,
    };
  }

  return {
    activity: titleDerivedActivity.activity,
    agentName: titleDerivedActivity.agentName,
  };
}

export async function syncKnownSessionActivities(
  context: SessionActivityContext,
  sessionRecords: readonly SessionRecord[],
  playSound: boolean,
): Promise<void> {
  const nextActivityBySessionId = new Map<string, TerminalAgentStatus>();
  let shouldPlayCompletionSound = false;

  for (const sessionRecord of sessionRecords) {
    const sessionSnapshot =
      context.getSessionSnapshot(sessionRecord.sessionId) ??
      createDisconnectedSessionSnapshot(sessionRecord.sessionId, context.workspaceId);
    const effectiveActivity = getEffectiveSessionActivity(context, sessionRecord, sessionSnapshot);
    nextActivityBySessionId.set(sessionRecord.sessionId, effectiveActivity.activity);

    if (
      playSound &&
      effectiveActivity.activity === "attention" &&
      context.lastKnownActivityBySessionId.get(sessionRecord.sessionId) !== "attention"
    ) {
      shouldPlayCompletionSound = true;
    }
  }

  context.lastKnownActivityBySessionId.clear();
  for (const [sessionId, activity] of nextActivityBySessionId) {
    context.lastKnownActivityBySessionId.set(sessionId, activity);
  }

  if (!shouldPlayCompletionSound || !context.getCompletionBellEnabled()) {
    return;
  }

  await context.playCompletionSound();
}

function shouldExpireWorkingActivity(
  lastTerminalActivityAt: number | undefined,
  agentName: string | undefined,
): boolean {
  const normalizedAgentName = agentName?.trim().toLowerCase();
  if (normalizedAgentName !== "claude" && normalizedAgentName !== "codex") {
    return false;
  }

  if (!lastTerminalActivityAt) {
    return false;
  }

  return Date.now() - lastTerminalActivityAt >= WORKING_ACTIVITY_STALE_TIMEOUT_MS;
}
