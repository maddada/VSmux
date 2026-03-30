import { describe, expect, test } from "vite-plus/test";
import {
  createGroupDropData,
  createSessionDragData,
  getSidebarDropData,
  moveSessionIdsByDropTarget,
  type SidebarSessionDropTarget,
} from "./sidebar-dnd";

describe("getSidebarDropData", () => {
  test("should parse session and group drop payloads", () => {
    expect(getSidebarDropData({ data: createSessionDragData("group-1", "session-1") })).toEqual({
      groupId: "group-1",
      kind: "session",
      sessionId: "session-1",
    });

    expect(getSidebarDropData({ data: createGroupDropData("group-2") })).toEqual({
      groupId: "group-2",
      kind: "group",
    });
  });
});

describe("moveSessionIdsByDropTarget", () => {
  test("should move a session into an empty group", () => {
    const nextSessionIdsByGroup = moveSessionIdsByDropTarget(
      {
        "group-1": ["session-1"],
        "group-2": [],
      },
      "session-1",
      {
        groupId: "group-2",
        kind: "group",
        position: "start",
      },
    );

    expect(nextSessionIdsByGroup).toEqual({
      "group-1": [],
      "group-2": ["session-1"],
    });
  });

  test("should leave the order unchanged when dropping a session on itself", () => {
    const sessionIdsByGroup = {
      "group-1": ["session-1", "session-2"],
    };

    const nextSessionIdsByGroup = moveSessionIdsByDropTarget(
      sessionIdsByGroup,
      "session-1",
      {
        groupId: "group-1",
        kind: "session",
        position: "before",
        sessionId: "session-1",
      },
    );

    expect(nextSessionIdsByGroup).toBe(sessionIdsByGroup);
  });

  test("should insert after the hovered session in another group", () => {
    const nextSessionIdsByGroup = moveSessionIdsByDropTarget(
      {
        "group-1": ["session-1"],
        "group-2": ["session-2", "session-3"],
      },
      "session-1",
      {
        groupId: "group-2",
        kind: "session",
        position: "after",
        sessionId: "session-2",
      } satisfies SidebarSessionDropTarget,
    );

    expect(nextSessionIdsByGroup).toEqual({
      "group-1": [],
      "group-2": ["session-2", "session-1", "session-3"],
    });
  });
});
