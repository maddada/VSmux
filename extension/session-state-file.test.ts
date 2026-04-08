import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  createDefaultPersistedSessionState,
  deletePersistedSessionStateFile,
  readPersistedSessionStateFromFile,
  readPersistedSessionStateSnapshotFromFile,
  serializePersistedSessionState,
  writePersistedSessionStateToFile,
} from "./session-state-file";

describe("deletePersistedSessionStateFile", () => {
  test("should remove the persisted session state file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-session-state-"));
    const filePath = path.join(tempDir, "session-00.state");

    await writePersistedSessionStateToFile(filePath, {
      agentName: "claude",
      agentStatus: "attention",
      lastActivityAt: "2026-04-08T10:00:00.000Z",
      title: "Claude Code",
    });
    await readFile(filePath, "utf8");

    await deletePersistedSessionStateFile(filePath);

    await expect(readPersistedSessionStateFromFile(filePath)).resolves.toEqual(
      createDefaultPersistedSessionState(),
    );
  });
});

describe("persisted session title normalization", () => {
  test("should strip indicators and trim when serializing titles", () => {
    expect(
      serializePersistedSessionState({
        agentName: "claude",
        agentStatus: "working",
        lastActivityAt: "2026-04-08T10:00:00.000Z",
        title: "  ✦ release audit  ",
      }),
    ).toContain("title=release audit");
  });

  test("should normalize stored titles when reading them back", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-session-state-"));
    const filePath = path.join(tempDir, "session-01.state");

    await writeFile(
      filePath,
      "status=working\nagent=codex\nlastActivityAt=2026-04-08T10:00:00.000Z\ntitle=  🤖 Copilot fix  \n",
      "utf8",
    );

    await expect(readPersistedSessionStateFromFile(filePath)).resolves.toEqual({
      agentName: "codex",
      agentStatus: "working",
      lastActivityAt: "2026-04-08T10:00:00.000Z",
      title: "Copilot fix",
    });
  });

  test("should expose the persisted state file modification time", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-session-state-"));
    const filePath = path.join(tempDir, "session-02.state");

    await writeFile(
      filePath,
      "status=attention\nagent=claude\nlastActivityAt=2026-04-08T10:00:00.000Z\ntitle=Claude Code\n",
      "utf8",
    );

    const snapshot = await readPersistedSessionStateSnapshotFromFile(filePath);
    expect(snapshot.state).toEqual({
      agentName: "claude",
      agentStatus: "attention",
      lastActivityAt: "2026-04-08T10:00:00.000Z",
      title: "Claude Code",
    });
    expect(snapshot.updatedAtMs).toEqual(expect.any(Number));
  });
});
