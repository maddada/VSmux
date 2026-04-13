import { describe, expect, test } from "vite-plus/test";
import type { SidebarSessionItem } from "../shared/session-grid-contract";
import { getGroupSessionSummary } from "./group-session-summary";

describe("getGroupSessionSummary", () => {
  test("should count running sessions as active and done sessions as done", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { lifecycleState: "running", isRunning: true }),
        createSession("session-2", { lifecycleState: "running", isRunning: true }),
        createSession("session-3", { lifecycleState: "done", isRunning: false }),
      ]),
    ).toEqual({
      activeCount: 2,
      doneCount: 1,
    });
  });

  test("should fall back to activity when lifecycle state is unavailable", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { activity: "working", lifecycleState: undefined }),
        createSession("session-2", { activity: "attention", lifecycleState: undefined }),
        createSession("session-3", { activity: "idle", lifecycleState: undefined }),
      ]),
    ).toEqual({
      activeCount: 1,
      doneCount: 1,
    });
  });

  test("should ignore sleeping and error sessions in the collapsed summary", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", {
          lifecycleState: "sleeping",
          isRunning: true,
          isSleeping: true,
        }),
        createSession("session-2", {
          lifecycleState: "sleeping",
          isRunning: false,
          isSleeping: true,
        }),
        createSession("session-3", { lifecycleState: "done", isRunning: false }),
        createSession("session-4", { lifecycleState: "error", isRunning: false }),
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
    lifecycleState: "running",
    isRunning: true,
    isVisible: false,
    primaryTitle: sessionId,
    row: 0,
    sessionId,
    shortcutLabel: "⌘⌥1",
    ...overrides,
  };
}
