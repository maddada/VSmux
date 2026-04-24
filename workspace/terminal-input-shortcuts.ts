const SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";
const CTRL_J_SEQUENCE = "\x0a";
const CTRL_W_SEQUENCE = "\x17";
const ALT_D_SEQUENCE = "\x1bd";

const UNSHIFTED_KEY_BY_CODE: Record<string, string> = {
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Digit0: "0",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9",
  Equal: "=",
  Minus: "-",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
  Space: " ",
};

function getShellBasename(shellPath: string | undefined): string | undefined {
  const normalizedShellPath = shellPath?.trim();
  if (!normalizedShellPath) {
    return undefined;
  }

  const slashIndex = Math.max(
    normalizedShellPath.lastIndexOf("/"),
    normalizedShellPath.lastIndexOf("\\"),
  );
  const shellName =
    slashIndex >= 0 ? normalizedShellPath.slice(slashIndex + 1) : normalizedShellPath;
  return shellName.toLowerCase();
}

export function isWindowsPowerShellShell(shellPath: string | undefined): boolean {
  const shellName = getShellBasename(shellPath);
  return (
    shellName === "powershell.exe" ||
    shellName === "powershell" ||
    shellName === "pwsh.exe" ||
    shellName === "pwsh"
  );
}

export function getShiftEnterInputSequence(options: {
  isMac: boolean;
  shellPath: string | undefined;
}): string {
  if (options.isMac) {
    return SHIFT_ENTER_SEQUENCE;
  }

  if (isWindowsPowerShellShell(options.shellPath)) {
    return CTRL_J_SEQUENCE;
  }

  return SHIFT_ENTER_SEQUENCE;
}

export function getGhosttyResttyKeyRemap(
  event: {
    altKey: boolean;
    code: string;
    ctrlKey: boolean;
    key: string;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
  },
  options: { isMac: boolean },
): KeyboardEventInit | undefined {
  if (event.key === "Enter" && event.shiftKey) {
    return createCtrlKeyEvent("j", "KeyJ", event.repeat);
  }

  if (
    options.isMac &&
    event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    isLeftArrowKeyEvent(event)
  ) {
    return createCtrlKeyEvent("a", "KeyA", event.repeat);
  }

  if (
    options.isMac &&
    event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    isRightArrowKeyEvent(event)
  ) {
    return createCtrlKeyEvent("e", "KeyE", event.repeat);
  }

  if (
    !event.metaKey &&
    !event.shiftKey &&
    isLeftArrowKeyEvent(event) &&
    (event.ctrlKey || (options.isMac && event.altKey))
  ) {
    return createTerminalMetaKeyEvent("b", "KeyB", event.repeat);
  }

  if (
    !event.metaKey &&
    !event.shiftKey &&
    isRightArrowKeyEvent(event) &&
    (event.ctrlKey || (options.isMac && event.altKey))
  ) {
    return createTerminalMetaKeyEvent("f", "KeyF", event.repeat);
  }

  if (!options.isMac || !event.altKey || event.ctrlKey || event.metaKey || event.key === "Alt") {
    return undefined;
  }

  const unmodifiedKey = getUnmodifiedKeyForCode(event.code, event.shiftKey);
  if (!unmodifiedKey) {
    return undefined;
  }

  return {
    altKey: true,
    bubbles: true,
    cancelable: true,
    code: event.code,
    ctrlKey: false,
    key: unmodifiedKey,
    metaKey: false,
    repeat: event.repeat,
    shiftKey: event.shiftKey,
  };
}

export function getWindowsCtrlWordDeleteInputSequence(key: string): string | undefined {
  if (key === "Backspace") {
    return CTRL_W_SEQUENCE;
  }

  if (key === "Delete") {
    return ALT_D_SEQUENCE;
  }

  return undefined;
}

function createCtrlKeyEvent(key: string, code: string, repeat: boolean): KeyboardEventInit {
  return {
    altKey: false,
    bubbles: true,
    cancelable: true,
    code,
    ctrlKey: true,
    key,
    metaKey: false,
    repeat,
    shiftKey: false,
  };
}

function createTerminalMetaKeyEvent(key: string, code: string, repeat: boolean): KeyboardEventInit {
  return {
    altKey: true,
    bubbles: true,
    cancelable: true,
    code,
    ctrlKey: false,
    key,
    metaKey: false,
    repeat,
    shiftKey: false,
  };
}

function getUnmodifiedKeyForCode(code: string, shiftKey: boolean): string | undefined {
  if (code.startsWith("Key") && code.length === 4) {
    const letter = code.slice(3).toLowerCase();
    return shiftKey ? letter.toUpperCase() : letter;
  }

  return UNSHIFTED_KEY_BY_CODE[code];
}

function isLeftArrowKeyEvent(event: { code: string; key: string }): boolean {
  return event.key === "ArrowLeft" || event.code === "ArrowLeft" || event.key === "Left";
}

function isRightArrowKeyEvent(event: { code: string; key: string }): boolean {
  return event.key === "ArrowRight" || event.code === "ArrowRight" || event.key === "Right";
}
