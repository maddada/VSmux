const SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";
const CTRL_J_SEQUENCE = "\x0a";
const CTRL_W_SEQUENCE = "\x17";
const ALT_D_SEQUENCE = "\x1bd";

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

export function getWindowsCtrlWordDeleteInputSequence(key: string): string | undefined {
  if (key === "Backspace") {
    return CTRL_W_SEQUENCE;
  }

  if (key === "Delete") {
    return ALT_D_SEQUENCE;
  }

  return undefined;
}
