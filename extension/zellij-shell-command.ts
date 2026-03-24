export function createZellijAttachArgs(
  configPath: string,
  sessionId: string,
  bootstrapSession = false,
  layoutPath?: string,
): string[] {
  const args = ["--config", configPath];
  if (bootstrapSession && layoutPath) {
    args.push("--layout", layoutPath);
  }

  args.push("attach");
  if (bootstrapSession) {
    args.push("--create");
  }
  args.push(sessionId);
  return args;
}
