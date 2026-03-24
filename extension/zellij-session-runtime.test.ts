import { describe, expect, test } from "vite-plus/test";
import { isMissingZellijSessionError } from "./zellij-session-runtime";

describe("isMissingZellijSessionError", () => {
  test("should treat missing-session messages as absent sessions", () => {
    expect(isMissingZellijSessionError(new Error('No session named "missing" found.'))).toBe(true);
    expect(isMissingZellijSessionError(new Error("There is no active session!"))).toBe(true);
    expect(isMissingZellijSessionError(new Error("No active zellij sessions found."))).toBe(true);
    expect(isMissingZellijSessionError(new Error("permission denied"))).toBe(false);
  });
});
