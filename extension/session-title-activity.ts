import type { SidebarSessionActivityState } from "../shared/session-grid-contract";

const CLAUDE_CODE_IDLE_MARKERS = ["✳", "*"] as const;
const CLAUDE_CODE_WORKING_MARKERS = ["·"] as const;
const CLAUDE_CODE_TITLE = "Claude Code";
const CODEX_TITLE_KEYWORD = "codex";
const CODEX_WORKING_MARKERS = ["⠸", "⠴", "⠼", "⠧", "⠦", "⠏", "⠋"] as const;
export const TITLE_ACTIVITY_WINDOW_MS = 1_000;

export type TitleDerivedSessionActivity = {
  activity: SidebarSessionActivityState;
  agentName: string;
  hasSeenWorking?: boolean;
  isAcknowledged?: boolean;
  lastTitleChangeAt?: number;
};

export function getTitleDerivedSessionActivity(
  title: string,
  previousDerivedActivity?: TitleDerivedSessionActivity,
  knownAgentName?: string,
): TitleDerivedSessionActivity | undefined {
  const titleState = getTitleState(title, knownAgentName);
  if (!titleState) {
    return getFallbackActivity(previousDerivedActivity);
  }

  const sameAgent = previousDerivedActivity?.agentName === titleState.agentName;
  const hasSeenWorking = sameAgent
    ? (previousDerivedActivity?.hasSeenWorking ?? false) ||
      previousDerivedActivity?.activity === "working" ||
      previousDerivedActivity?.activity === "attention"
    : false;
  const isAcknowledged = sameAgent ? previousDerivedActivity?.isAcknowledged ?? false : false;
  const lastTitleChangeAt = sameAgent ? previousDerivedActivity?.lastTitleChangeAt : undefined;
  if (titleState.state === "idle") {
    return {
      activity: hasSeenWorking && !isAcknowledged ? "attention" : "idle",
      agentName: titleState.agentName,
      hasSeenWorking,
      isAcknowledged,
      lastTitleChangeAt,
    };
  }

  const effectiveLastTitleChangeAt = lastTitleChangeAt ?? Date.now();
  return {
    activity:
      Date.now() - effectiveLastTitleChangeAt <= TITLE_ACTIVITY_WINDOW_MS
        ? "working"
        : isAcknowledged
          ? "idle"
          : "attention",
    agentName: titleState.agentName,
    hasSeenWorking: true,
    isAcknowledged,
    lastTitleChangeAt: effectiveLastTitleChangeAt,
  };
}

export function getTitleDerivedSessionActivityFromTransition(
  previousTitle: string | undefined,
  nextTitle: string,
  previousDerivedActivity?: TitleDerivedSessionActivity,
  knownAgentName?: string,
): TitleDerivedSessionActivity | undefined {
  const nextTitleState = getTitleState(nextTitle, knownAgentName);
  if (nextTitleState) {
    const sameAgent = previousDerivedActivity?.agentName === nextTitleState.agentName;
    const hasSeenWorking = sameAgent
      ? (previousDerivedActivity?.hasSeenWorking ?? false) ||
        previousDerivedActivity?.activity === "working" ||
        previousDerivedActivity?.activity === "attention"
      : false;
    const isAcknowledged = sameAgent ? previousDerivedActivity?.isAcknowledged ?? false : false;
    return {
      activity:
        nextTitleState.state === "working"
          ? "working"
          : hasSeenWorking && !isAcknowledged
            ? "attention"
            : "idle",
      agentName: nextTitleState.agentName,
      hasSeenWorking: nextTitleState.state === "working" ? true : hasSeenWorking,
      isAcknowledged: nextTitleState.state === "working" ? false : isAcknowledged,
      lastTitleChangeAt:
        nextTitleState.state === "working"
          ? previousDerivedActivity?.agentName === nextTitleState.agentName &&
            previousTitle?.trim() === nextTitle.trim()
            ? previousDerivedActivity.lastTitleChangeAt ?? Date.now()
            : Date.now()
          : previousDerivedActivity?.agentName === nextTitleState.agentName
            ? previousDerivedActivity.lastTitleChangeAt
            : undefined,
    };
  }

  return getFallbackActivity(previousDerivedActivity);
}

export function haveSameTitleDerivedSessionActivity(
  left: TitleDerivedSessionActivity | undefined,
  right: TitleDerivedSessionActivity | undefined,
): boolean {
  return (
    left?.activity === right?.activity &&
    left?.agentName === right?.agentName &&
    left?.isAcknowledged === right?.isAcknowledged
  );
}

export function acknowledgeTitleDerivedSessionActivity(
  activity: TitleDerivedSessionActivity | undefined,
): TitleDerivedSessionActivity | undefined {
  if (!activity || activity.activity !== "attention") {
    return activity;
  }

  return {
    ...activity,
    activity: "idle",
    isAcknowledged: true,
  };
}

function getTitleState(
  title: string,
  knownAgentName?: string,
): { agentName: "claude" | "codex"; state: "idle" | "working" } | undefined {
  const normalizedAgentName = normalizeKnownAgentName(knownAgentName);

  const claudeCodeTitleState = getClaudeCodeTitleState(title, normalizedAgentName === "claude");
  if (claudeCodeTitleState) {
    return {
      agentName: "claude",
      state: claudeCodeTitleState,
    };
  }

  const codexTitleState = getCodexTitleState(title, normalizedAgentName === "codex");
  if (codexTitleState) {
    return {
      agentName: "codex",
      state: codexTitleState,
    };
  }

  return undefined;
}

function getClaudeCodeTitleState(
  title: string,
  allowAgentHintMatch = false,
): "idle" | "working" | undefined {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  const lowerTitle = normalizedTitle.toLowerCase();
  const lowerClaudeCodeTitle = CLAUDE_CODE_TITLE.toLowerCase();

  if (!allowAgentHintMatch && !lowerTitle.includes(lowerClaudeCodeTitle)) {
    return undefined;
  }

  if (containsAnyMarker(normalizedTitle, CLAUDE_CODE_IDLE_MARKERS)) {
    return "idle";
  }

  if (containsAnyMarker(normalizedTitle, CLAUDE_CODE_WORKING_MARKERS)) {
    return "working";
  }

  return undefined;
}

function getCodexTitleState(title: string, allowAgentHintMatch = false): "idle" | "working" | undefined {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  if (!allowAgentHintMatch && !normalizedTitle.toLowerCase().includes(CODEX_TITLE_KEYWORD)) {
    return undefined;
  }

  if (getCodexWorkingMarker(normalizedTitle) !== undefined) {
    return "working";
  }

  return "idle";
}

function getCodexWorkingMarker(title: string): string | undefined {
  return CODEX_WORKING_MARKERS.find((marker) => title.includes(marker));
}

function containsAnyMarker(title: string, markers: readonly string[]): boolean {
  return markers.some((marker) => title.includes(marker));
}

function normalizeKnownAgentName(
  knownAgentName: string | undefined,
): "claude" | "codex" | undefined {
  const normalizedAgentName = knownAgentName?.trim().toLowerCase();
  if (normalizedAgentName === "claude" || normalizedAgentName === "codex") {
    return normalizedAgentName;
  }

  return undefined;
}

function getFallbackActivity(
  previousDerivedActivity: TitleDerivedSessionActivity | undefined,
): TitleDerivedSessionActivity | undefined {
  if (!previousDerivedActivity?.hasSeenWorking) {
    return undefined;
  }

  return {
    ...previousDerivedActivity,
    activity: previousDerivedActivity.isAcknowledged ? "idle" : "attention",
  };
}
