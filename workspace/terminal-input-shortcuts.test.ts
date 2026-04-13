import { describe, expect, test } from "vitest";
import {
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
