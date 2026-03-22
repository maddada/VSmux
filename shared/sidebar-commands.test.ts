import { describe, expect, test } from "vite-plus/test";
import {
  createSidebarCommandButtons,
  normalizeStoredSidebarCommandOrder,
  normalizeStoredSidebarCommands,
} from "./sidebar-commands";

describe("createSidebarCommandButtons", () => {
  test("should expose the default terminal action slots when no actions are configured", () => {
    expect(createSidebarCommandButtons([])).toEqual([
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
        url: undefined,
      },
    ]);
  });

  test("should merge configured defaults and append custom terminal and browser actions", () => {
    expect(
      createSidebarCommandButtons([
        {
          actionType: "terminal",
          closeTerminalOnExit: false,
          command: "vp dev",
          commandId: "dev",
          isDefault: true,
          name: "App",
        },
        {
          actionType: "browser",
          closeTerminalOnExit: false,
          commandId: "custom-docs",
          isDefault: false,
          name: "Docs",
          url: "https://example.com/docs",
        },
      ]),
    ).toEqual([
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: "vp dev",
        commandId: "dev",
        isDefault: true,
        name: "App",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
        url: undefined,
      },
      {
        actionType: "browser",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "custom-docs",
        isDefault: false,
        name: "Docs",
        url: "https://example.com/docs",
      },
    ]);
  });

  test("should respect a stored action order for defaults and custom actions", () => {
    expect(
      createSidebarCommandButtons(
        [
          {
            actionType: "browser",
            closeTerminalOnExit: false,
            commandId: "custom-docs",
            isDefault: false,
            name: "Docs",
            url: "https://example.com/docs",
          },
        ],
        ["test", "custom-docs", "dev"],
      ),
    ).toEqual([
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
        url: undefined,
      },
      {
        actionType: "browser",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "custom-docs",
        isDefault: false,
        name: "Docs",
        url: "https://example.com/docs",
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
        url: undefined,
      },
    ]);
  });

  test("should hide deleted default actions", () => {
    expect(createSidebarCommandButtons([], [], ["build", "test"])).toEqual([
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
        url: undefined,
      },
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
        url: undefined,
      },
    ]);
  });
});

describe("normalizeStoredSidebarCommands", () => {
  test("should normalize legacy terminal actions and trim valid values", () => {
    expect(
      normalizeStoredSidebarCommands([
        {
          closeTerminalOnExit: false,
          command: "  vp dev  ",
          commandId: " dev ",
          isDefault: true,
          name: "  Dev server ",
        },
      ]),
    ).toEqual([
      {
        actionType: "terminal",
        closeTerminalOnExit: false,
        command: "vp dev",
        commandId: "dev",
        isDefault: true,
        name: "Dev server",
      },
    ]);
  });

  test("should normalize browser actions and reject invalid values", () => {
    expect(
      normalizeStoredSidebarCommands([
        {
          actionType: "browser",
          commandId: " docs ",
          isDefault: false,
          name: " Docs ",
          url: " https://example.com/docs ",
        },
        {
          actionType: "browser",
          commandId: "missing-url",
          isDefault: false,
          name: "Broken",
        },
      ]),
    ).toEqual([
      {
        actionType: "browser",
        closeTerminalOnExit: false,
        commandId: "docs",
        isDefault: false,
        name: "Docs",
        url: "https://example.com/docs",
      },
    ]);
  });
});

describe("normalizeStoredSidebarCommandOrder", () => {
  test("should ignore invalid ids, trim values, and dedupe entries", () => {
    expect(normalizeStoredSidebarCommandOrder([" test ", "", "dev", "test", 42, null])).toEqual([
      "test",
      "dev",
    ]);
  });
});
