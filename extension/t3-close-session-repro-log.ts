import { appendFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

const REPRO_LOG_DIR_NAME = ".vsmux";
const REPRO_LOG_FILE_NAME = "t3-close-session-repro.log";
const REPRO_LOG_TAG = "[t3-close-repro]";

let fileWriteQueue: Promise<void> = Promise.resolve();

export function getT3CloseSessionReproLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, REPRO_LOG_DIR_NAME, REPRO_LOG_FILE_NAME);
}

export async function appendT3CloseSessionReproLog(
  workspaceRoot: string,
  event: string,
  details?: unknown,
): Promise<void> {
  const logFilePath = getT3CloseSessionReproLogPath(workspaceRoot);
  const line = buildLogLine(event, details);

  fileWriteQueue = fileWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(logFilePath), { recursive: true });
      await appendFile(logFilePath, `${line}\n`, "utf8");
    })
    .catch(() => undefined);

  await fileWriteQueue;
}

function buildLogLine(event: string, details?: unknown): string {
  const suffix = details === undefined ? "" : ` ${safeSerialize(details)}`;
  return `${new Date().toISOString()} ${REPRO_LOG_TAG} ${event}${suffix}`;
}

function safeSerialize(details: unknown): string {
  try {
    return JSON.stringify(details);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      unserializable: true,
    });
  }
}
