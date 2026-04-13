import { describe, expect, test } from "vite-plus/test";
import { createSessionRecord } from "../shared/session-grid-contract";
import { getWorkspacePanePrimaryTitle } from "./workspace-app";

describe("getWorkspacePanePrimaryTitle", () => {
  test("should ignore the generic VSmux terminal title", () => {
    const sessionRecord = createSessionRecord(1, 0);

    expect(
      getWorkspacePanePrimaryTitle({
        isVisible: true,
        kind: "terminal",
        renderNonce: 0,
        sessionId: sessionRecord.sessionId,
        sessionRecord,
        terminalTitle: "VSmux",
      }),
    ).toBe("00");
  });

  test("should ignore the default Windows PowerShell executable title", () => {
    const sessionRecord = createSessionRecord(1, 0);

    expect(
      getWorkspacePanePrimaryTitle({
        isVisible: true,
        kind: "terminal",
        renderNonce: 0,
        sessionId: sessionRecord.sessionId,
        sessionRecord,
        terminalTitle: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe .",
      }),
    ).toBe("00");
  });

  test("should keep meaningful terminal titles", () => {
    const sessionRecord = createSessionRecord(1, 0);

    expect(
      getWorkspacePanePrimaryTitle({
        isVisible: true,
        kind: "terminal",
        renderNonce: 0,
        sessionId: sessionRecord.sessionId,
        sessionRecord,
        terminalTitle: "Implement release checks",
      }),
    ).toBe("Implement release checks");
  });

  test("should keep explicit user titles authoritative for generic agents", () => {
    const sessionRecord = createSessionRecord(1, 0, {
      title: "Bug Fix",
    });

    expect(
      getWorkspacePanePrimaryTitle({
        isVisible: true,
        kind: "terminal",
        renderNonce: 0,
        sessionId: sessionRecord.sessionId,
        sessionRecord,
        terminalTitle: "Codex",
      }),
    ).toBe("Bug Fix");
  });
});
