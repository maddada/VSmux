import { describe, expect, test } from "vite-plus/test";
import type { SidebarSessionItem } from "../shared/session-grid-contract";
import { getGroupSessionSummary } from "./group-session-summary";

describe("getGroupSessionSummary", () => {
  test("should count running sessions as active and exited sessions as done", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { isRunning: true }),
        createSession("session-2", { isRunning: true }),
        createSession("session-3", { isRunning: false }),
      ]),
    ).toEqual({
      activeCount: 2,
      doneCount: 1,
    });
  });

  test("should ignore sleeping sessions in the collapsed summary", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { isRunning: true, isSleeping: true }),
        createSession("session-2", { isRunning: false, isSleeping: true }),
        createSession("session-3", { isRunning: false }),
      ]),
    ).toEqual({
      activeCount: 0,
      doneCount: 1,
    });
  });
});

function createSession(
  sessionId: string,
  overrides: Partial<SidebarSessionItem>,
): SidebarSessionItem {
  return {
    activity: "idle",
    activityLabel: undefined,
    alias: sessionId,
    column: 0,
    isFocused: false,
    isRunning: true,
    isVisible: false,
    primaryTitle: sessionId,
    row: 0,
    sessionId,
    shortcutLabel: "⌘⌥1",
    ...overrides,
  };
}
