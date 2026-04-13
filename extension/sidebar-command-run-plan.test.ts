import { describe, expect, test } from "vite-plus/test";
import {
  getSidebarCommandTerminalRunPlan,
  getSidebarCommandWorkspaceSessionTitle,
} from "./sidebar-command-run-plan";

describe("getSidebarCommandTerminalRunPlan", () => {
  test("should keep default terminal runs in a VS Code terminal", () => {
    expect(getSidebarCommandTerminalRunPlan("terminal", false, "default")).toEqual({
      closeOnExit: false,
      target: "vscode-terminal",
    });
  });

  test("should preserve close-on-exit behavior for default terminal runs", () => {
    expect(getSidebarCommandTerminalRunPlan("terminal", true, "default")).toEqual({
      closeOnExit: true,
      target: "vscode-terminal",
    });
  });

  test("should route debug terminal runs into VSmux", () => {
    expect(getSidebarCommandTerminalRunPlan("terminal", true, "debug")).toEqual({
      target: "vsmux-terminal",
    });
  });

  test("should ignore browser actions", () => {
    expect(getSidebarCommandTerminalRunPlan("browser", false, "debug")).toBeUndefined();
  });
});

describe("getSidebarCommandWorkspaceSessionTitle", () => {
  test("should preserve the action name for default runs", () => {
    expect(getSidebarCommandWorkspaceSessionTitle("Build", "pnpm build", "default")).toBe("Build");
  });

  test("should prefix debug runs with the debug label", () => {
    expect(getSidebarCommandWorkspaceSessionTitle("Build", "pnpm build", "debug")).toBe(
      "Debug: Build",
    );
  });

  test("should fall back to the first 20 command characters when the action only has an icon", () => {
    expect(
      getSidebarCommandWorkspaceSessionTitle("", "pnpm build --watch --filter web", "debug"),
    ).toBe("Debug: pnpm build --watch -");
  });
});
