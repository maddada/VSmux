export function createTsmAttachShellCommand(
  bundledBinaryPath: string,
  sessionId: string,
  socketDirectory: string,
): string {
  return `TSM_DIR=${quotePosixShellArgument(socketDirectory)} ${quotePosixShellArgument(bundledBinaryPath)} attach ${quotePosixShellArgument(sessionId)}`;
}

function quotePosixShellArgument(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replaceAll("'", `'\\''`)}'`;
}
