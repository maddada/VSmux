import { describe, expect, test } from "vite-plus/test";
import { getSessionPresentationTitle } from "./terminal-daemon-process";

describe("getSessionPresentationTitle", () => {
  test("should preserve ordinary live titles", () => {
    expect(getSessionPresentationTitle("Implement title filtering")).toBe(
      "Implement title filtering",
    );
  });

  test("should drop bare agent titles for presentation", () => {
    expect(getSessionPresentationTitle("Codex")).toBeUndefined();
    expect(getSessionPresentationTitle("Codex CLI")).toBeUndefined();
    expect(getSessionPresentationTitle("OpenAI Codex")).toBeUndefined();
    expect(getSessionPresentationTitle("Claude")).toBeUndefined();
    expect(getSessionPresentationTitle("Claude Code")).toBeUndefined();
    expect(getSessionPresentationTitle("⠸ Codex")).toBeUndefined();
    expect(getSessionPresentationTitle("✳ Claude Code")).toBeUndefined();
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
