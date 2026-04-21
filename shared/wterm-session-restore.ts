import { encodeStream } from "./wterm-vendor-serialize";
import type { WasmBridge } from "./wterm-vendor-core";

export type WtermSerializedSnapshot = {
  version: 1;
  cols: number;
  rows: number;
  payload: string;
  cursor: {
    row: number;
    col: number;
    visible: boolean;
  };
  modes: {
    altScreen: boolean;
    cursorKeysApp: boolean;
    bracketedPaste: boolean;
  };
};

export function createWtermSerializedSnapshot(bridge: WasmBridge): WtermSerializedSnapshot {
  const cursor = bridge.getCursor();

  return {
    version: 1,
    cols: bridge.getCols(),
    cursor: {
      col: cursor.col,
      row: cursor.row,
      visible: cursor.visible,
    },
    modes: {
      altScreen: bridge.usingAltScreen(),
      bracketedPaste: bridge.bracketedPaste(),
      cursorKeysApp: bridge.cursorKeysApp(),
    },
    payload: encodeStream(bridge),
    rows: bridge.getRows(),
  };
}

export function createWtermRestorePayload(bridge: WasmBridge): string {
  return createWtermRestorePayloadFromSnapshot(createWtermSerializedSnapshot(bridge));
}

export function createWtermRestorePayloadFromSnapshot(snapshot: WtermSerializedSnapshot): string {
  const parts = [snapshot.payload];

  if (snapshot.modes.altScreen) {
    parts.push("\x1b[?1049h");
  }
  if (snapshot.modes.cursorKeysApp) {
    parts.push("\x1b[?1h");
  }
  if (snapshot.modes.bracketedPaste) {
    parts.push("\x1b[?2004h");
  }

  parts.push(`\x1b[${snapshot.cursor.row + 1};${snapshot.cursor.col + 1}H`);
  parts.push(snapshot.cursor.visible ? "\x1b[?25h" : "\x1b[?25l");

  return parts.join("");
}
