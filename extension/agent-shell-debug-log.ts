export async function appendAgentShellDebugLog(
  _event: string,
  _details?: unknown,
  _logFilePath = process.env.VSMUX_AGENT_SHELL_DEBUG_LOG_PATH?.trim(),
): Promise<void> {}
