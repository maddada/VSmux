import { describe, expect, test } from "vite-plus/test";
import {
  createTsmBootstrapInvocation,
  getShellArgs,
  isMissingTsmSessionError,
} from "./tsm-session-runtime";

describe("createTsmBootstrapInvocation", () => {
  test("should launch bundled tsm through script on macOS", () => {
    expect(
      createTsmBootstrapInvocation("/ext/tsm", "session-1", ["/bin/zsh", "-il"], "darwin"),
    ).toEqual({
      args: ["-q", "/dev/null", "/ext/tsm", "new", "session-1", "/bin/zsh", "-il"],
      command: "/usr/bin/script",
    });
  });

  test("should launch bundled tsm through script -c on Linux", () => {
    expect(
      createTsmBootstrapInvocation("/ext/tsm", "session-1", ["/bin/zsh", "-il"], "linux"),
    ).toEqual({
      args: ["-q", "-e", "-f", "-c", "'/ext/tsm' 'new' 'session-1' '/bin/zsh' '-il'", "/dev/null"],
      command: "/usr/bin/script",
    });
  });

  test("should fall back when the platform is unsupported", () => {
    expect(
      createTsmBootstrapInvocation("/ext/tsm", "session-1", ["/bin/zsh", "-il"], "win32"),
    ).toBeUndefined();
  });
});

describe("getShellArgs", () => {
  test("should pass zsh interactive and login flags separately", () => {
    expect(getShellArgs("/bin/zsh")).toEqual(["-i", "-l"]);
  });
});

describe("isMissingTsmSessionError", () => {
  test("should treat missing socket errors as absent sessions", () => {
    expect(isMissingTsmSessionError({ code: "ENOENT" })).toBe(true);
    expect(isMissingTsmSessionError({ code: "ECONNREFUSED" })).toBe(true);
    expect(isMissingTsmSessionError({ code: "EACCES" })).toBe(false);
  });
});
