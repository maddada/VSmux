import { describe, expect, test } from "vite-plus/test";
import { getSessionPresentationTitle } from "./terminal-daemon-process";

describe("getSessionPresentationTitle", () => {
  test("should preserve ordinary live titles", () => {
    expect(getSessionPresentationTitle("Claude Code")).toBe("Claude Code");
  });

  test("should sanitize OpenCode prefixed titles for presentation", () => {
    expect(getSessionPresentationTitle("OC | Project overview question")).toBe(
      "Project overview question",
    );
  });

  test("should drop empty OpenCode prefixed titles after sanitization", () => {
    expect(getSessionPresentationTitle("OC |   ")).toBeUndefined();
  });
});
