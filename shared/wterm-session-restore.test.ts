import { describe, expect, test } from "vite-plus/test";
import { createWtermRestorePayload, createWtermSerializedSnapshot } from "./wterm-session-restore";

describe("wterm session restore", () => {
  test("should serialize bridge state into a replayable snapshot", () => {
    const bridge = createBridgeStub();
    const snapshot = createWtermSerializedSnapshot(bridge);

    expect(snapshot).toMatchObject({
      cols: 120,
      cursor: {
        col: 9,
        row: 4,
        visible: true,
      },
      modes: {
        altScreen: true,
        bracketedPaste: true,
        cursorKeysApp: true,
      },
      rows: 34,
      version: 1,
    });
    expect(snapshot.payload).toContain("\u001b[2J\u001b[H\u001b[0m");
    expect(snapshot.payload).toContain("\u001b[5;10H");
  });

  test("should append cursor and mode state to the replay payload", () => {
    const payload = createWtermRestorePayload(createBridgeStub());

    expect(payload).toContain("\u001b[2J\u001b[H\u001b[0m");
    expect(payload).toContain("\u001b[?1049h");
    expect(payload).toContain("\u001b[?1h");
    expect(payload).toContain("\u001b[?2004h");
    expect(payload).toContain("\u001b[5;10H");
    expect(payload).toContain("\u001b[?25h");
  });
});

function createBridgeStub() {
  return {
    bracketedPaste: () => true,
    cursorKeysApp: () => true,
    getCell: () => ({
      bg: 256,
      char: 32,
      fg: 256,
      flags: 0,
    }),
    getCols: () => 120,
    getCursor: () => ({
      col: 9,
      row: 4,
      visible: true,
    }),
    getRows: () => 34,
    getScrollbackCell: () => ({
      bg: 256,
      char: 32,
      fg: 256,
      flags: 0,
    }),
    getScrollbackCount: () => 0,
    getScrollbackLineLen: () => 0,
    usingAltScreen: () => true,
  };
}
