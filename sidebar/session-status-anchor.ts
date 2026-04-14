export function getSessionStatusAnchorName(sessionId: string): `--session-status-${string}` {
  const normalizedSessionId = sessionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `--session-status-${normalizedSessionId || "session"}`;
}
