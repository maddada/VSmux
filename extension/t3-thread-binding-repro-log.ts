import { appendFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

const REPRO_LOG_DIR_NAME = ".vsmux";
const REPRO_LOG_FILE_NAME = "t3-thread-binding-repro.log";
const REPRO_LOG_TAG = "[t3-thread-binding-repro]";

let fileWriteQueue: Promise<void> = Promise.resolve();

export function getT3ThreadBindingReproLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, REPRO_LOG_DIR_NAME, REPRO_LOG_FILE_NAME);
}

export async function appendT3ThreadBindingReproLog(
  workspaceRoot: string,
  event: string,
  details?: unknown,
): Promise<void> {
  const logFilePath = getT3ThreadBindingReproLogPath(workspaceRoot);
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
