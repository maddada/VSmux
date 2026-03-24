import { describe, expect, test } from "vite-plus/test";
import { createZellijAttachArgs } from "./zellij-shell-command";

describe("createZellijAttachArgs", () => {
  test("should create reattach args", () => {
    expect(
      createZellijAttachArgs(
        "/path with space/config.kdl",
        "session-'1",
      ),
    ).toEqual([
      "--config",
      "/path with space/config.kdl",
      "attach",
      "session-'1",
    ]);
  });

  test("should create bootstrap args", () => {
    expect(
      createZellijAttachArgs(
        "/path with space/config.kdl",
        "session-'1",
        true,
        "/path with space/layout.kdl",
      ),
    ).toEqual([
      "--config",
      "/path with space/config.kdl",
      "--layout",
      "/path with space/layout.kdl",
      "attach",
      "--create",
      "session-'1",
    ]);
  });

  test("should omit layout args for bootstrap when no layout is provided", () => {
    expect(createZellijAttachArgs("/path/config.kdl", "session-1", true)).toEqual([
      "--config",
      "/path/config.kdl",
      "attach",
      "--create",
      "session-1",
    ]);
  });
});
