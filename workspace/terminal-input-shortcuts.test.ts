import { describe, expect, test } from "vitest";
import {
  getGhosttyResttyKeyRemap,
  getShiftEnterInputSequence,
  getWindowsCtrlWordDeleteInputSequence,
  isWindowsPowerShellShell,
} from "./terminal-input-shortcuts";

describe("terminal input shortcuts", () => {
  test("keeps the existing macOS Shift+Enter sequence", () => {
    expect(
      getShiftEnterInputSequence({
        isMac: true,
        shellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      }),
    ).toBe("\x1b[13;2u");
  });

  test("uses Ctrl+J for Windows PowerShell Shift+Enter", () => {
    expect(
      getShiftEnterInputSequence({
        isMac: false,
        shellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      }),
    ).toBe("\x0a");
  });

  test("uses Ctrl+J for PowerShell Core on Windows", () => {
    expect(
      getShiftEnterInputSequence({
        isMac: false,
        shellPath: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      }),
    ).toBe("\x0a");
  });

  test("uses Ctrl+J for bare pwsh on Windows", () => {
    expect(
      getShiftEnterInputSequence({
        isMac: false,
        shellPath: "pwsh",
      }),
    ).toBe("\x0a");
  });

  test("keeps the existing sequence for non-PowerShell shells", () => {
    expect(
      getShiftEnterInputSequence({
        isMac: false,
        shellPath: "C:\\Windows\\System32\\cmd.exe",
      }),
    ).toBe("\x1b[13;2u");
  });

  test("remaps ghostty/restty Shift+Enter to a Ctrl+J key event", () => {
    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: false,
          code: "Enter",
          ctrlKey: false,
          key: "Enter",
          metaKey: false,
          repeat: false,
          shiftKey: true,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: false,
      bubbles: true,
      cancelable: true,
      code: "KeyJ",
      ctrlKey: true,
      key: "j",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });
  });

  test("remaps ghostty/restty Cmd+Arrow to Ctrl+A and Ctrl+E key events", () => {
    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: false,
          code: "ArrowLeft",
          ctrlKey: false,
          key: "ArrowLeft",
          metaKey: true,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: false,
      bubbles: true,
      cancelable: true,
      code: "KeyA",
      ctrlKey: true,
      key: "a",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });

    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: false,
          code: "ArrowRight",
          ctrlKey: false,
          key: "ArrowRight",
          metaKey: true,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: false,
      bubbles: true,
      cancelable: true,
      code: "KeyE",
      ctrlKey: true,
      key: "e",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });
  });

  test("remaps ghostty/restty Ctrl or Option arrows to terminal Meta word jumps", () => {
    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: false,
          code: "ArrowLeft",
          ctrlKey: true,
          key: "ArrowLeft",
          metaKey: false,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: "KeyB",
      ctrlKey: false,
      key: "b",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });

    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: true,
          code: "ArrowRight",
          ctrlKey: false,
          key: "ArrowRight",
          metaKey: false,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: "KeyF",
      ctrlKey: false,
      key: "f",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });
  });

  test("remaps macOS Option text keys to terminal Meta input", () => {
    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: true,
          code: "KeyB",
          ctrlKey: false,
          key: "∫",
          metaKey: false,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toEqual({
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: "KeyB",
      ctrlKey: false,
      key: "b",
      metaKey: false,
      repeat: false,
      shiftKey: false,
    });
  });

  test("does not remap macOS Option when another primary modifier is present", () => {
    expect(
      getGhosttyResttyKeyRemap(
        {
          altKey: true,
          code: "KeyB",
          ctrlKey: false,
          key: "b",
          metaKey: true,
          repeat: false,
          shiftKey: false,
        },
        { isMac: true },
      ),
    ).toBeUndefined();
  });

  test("recognizes Windows PowerShell executables", () => {
    expect(isWindowsPowerShellShell("powershell.exe")).toBe(true);
    expect(
      isWindowsPowerShellShell("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"),
    ).toBe(true);
    expect(isWindowsPowerShellShell("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBe(true);
    expect(isWindowsPowerShellShell("pwsh")).toBe(true);
    expect(isWindowsPowerShellShell("/bin/zsh")).toBe(false);
  });

  test("maps Windows word delete shortcuts to terminal editing sequences", () => {
    expect(getWindowsCtrlWordDeleteInputSequence("Backspace")).toBe("\x17");
    expect(getWindowsCtrlWordDeleteInputSequence("Delete")).toBe("\x1bd");
    expect(getWindowsCtrlWordDeleteInputSequence("ArrowLeft")).toBeUndefined();
  });
});
