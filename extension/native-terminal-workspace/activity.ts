import { isT3Session, type SessionRecord } from "../../shared/session-grid-contract";
import type {
  TerminalAgentStatus,
  TerminalSessionSnapshot,
} from "../../shared/terminal-host-protocol";
import { createDisconnectedSessionSnapshot } from "../terminal-workspace-helpers";

type SessionActivityContext = {
  getCompletionBellEnabled: () => boolean;
  getSessionSnapshot: (sessionId: string) => TerminalSessionSnapshot | undefined;
  getT3ActivityState: (sessionRecord: SessionRecord) => {
    activity: TerminalAgentStatus;
    isRunning: boolean;
  };
  lastKnownActivityBySessionId: Map<string, TerminalAgentStatus>;
  playCompletionSound: () => Promise<void>;
  workspaceId: string;
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

  return {
    activity: sessionSnapshot.agentStatus,
    agentName: sessionSnapshot.agentName,
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
