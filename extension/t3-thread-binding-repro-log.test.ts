import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  appendT3ThreadBindingReproLog,
  getT3ThreadBindingReproLogPath,
} from "./t3-thread-binding-repro-log";

describe("t3 thread binding repro log", () => {
  let workspaceRoot: string | undefined;

  afterEach(async () => {
    if (!workspaceRoot) {
      return;
    }
    await rm(workspaceRoot, { force: true, recursive: true });
    workspaceRoot = undefined;
  });

  test("writes thread binding repro entries to a dedicated log file", async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "t3-thread-binding-repro-"));

    await appendT3ThreadBindingReproLog(workspaceRoot, "controller.t3SessionCreate.requested", {
      sessionId: "session-01",
      threadId: "thread-01",
    });

    const logPath = getT3ThreadBindingReproLogPath(workspaceRoot);
    const logContent = await readFile(logPath, "utf8");

    expect(logPath).toBe(path.join(workspaceRoot, ".vsmux", "t3-thread-binding-repro.log"));
    expect(logContent).toContain("[t3-thread-binding-repro] controller.t3SessionCreate.requested");
    expect(logContent).toContain('"sessionId":"session-01"');
  });
});
