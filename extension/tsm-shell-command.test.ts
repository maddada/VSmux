import { describe, expect, test } from "vite-plus/test";
import { createTsmAttachShellCommand } from "./tsm-shell-command";

describe("createTsmAttachShellCommand", () => {
  test("should quote the bundled binary path and session id for a shell attach command", () => {
    expect(createTsmAttachShellCommand("/path with space/tsm", "session-'1", "/tmp/dir name")).toBe(
      "TSM_DIR='/tmp/dir name' '/path with space/tsm' attach 'session-'\\''1'",
    );
  });
});
