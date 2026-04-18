import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  appendT3CloseSessionReproLog,
  getT3CloseSessionReproLogPath,
} from "./t3-close-session-repro-log";

describe("t3 close session repro log", () => {
  test("should write tagged repro lines into the workspace .vsmux folder", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "t3-close-session-repro-"));

    try {
      await appendT3CloseSessionReproLog(workspaceRoot, "controller.closeSession.start", {
        sessionId: "session-12",
        source: "sidebar",
      });

      const logPath = getT3CloseSessionReproLogPath(workspaceRoot);
      const logContent = await readFile(logPath, "utf8");

      expect(logPath).toBe(path.join(workspaceRoot, ".vsmux", "t3-close-session-repro.log"));
      expect(logContent).toContain("[t3-close-repro] controller.closeSession.start");
      expect(logContent).toContain('"sessionId":"session-12"');
      expect(logContent).toContain('"source":"sidebar"');
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });
});
