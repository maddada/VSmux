import { describe, expect, test } from "vite-plus/test";
import { getCandidateExecutableNames } from "./agent-shell-wrapper-runner";

describe("getCandidateExecutableNames", () => {
  test("should prefer Windows PATHEXT launchers over the extensionless shim", () => {
    expect(getCandidateExecutableNames("codex", "win32", ".COM;.EXE;.BAT;.CMD")).toEqual([
      "codex.com",
      "codex.exe",
      "codex.bat",
      "codex.cmd",
    ]);
  });

  test("should keep the bare executable name on non-Windows platforms", () => {
    expect(getCandidateExecutableNames("codex", "linux")).toEqual(["codex"]);
  });

  test("should not include the extensionless codex shim on Windows", () => {
    expect(getCandidateExecutableNames("codex", "win32", ".CMD")).not.toContain("codex");
  });
});
