import { appendFile, mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

const SETTINGS_SECTION = "VSmux";
const DEBUGGING_MODE_SETTING = "debuggingMode";
const DEBUG_LOG_DIR_NAME = ".vsmux";
const DEBUG_LOG_FILE_NAME = "full-reload-terminal-reconnect.log";
const DEBUG_EVENT_PREFIX_ALLOWLIST = [
  "workspace.webview.workspace.terminal",
  "daemon.runtime.",
  "controller.fullReloadSession.",
  "controller.waitForTerminalFrontendConnectionAfterReload.",
] as const;
const DEBUG_EVENT_ALLOWLIST = new Set<string>([
  "backend.daemon.sessionPresentationChanged",
  "backend.daemon.sessionPresentationDiff",
  "backend.daemon.syncSessionLeases.failed",
]);

let fileWriteQueue: Promise<void> = Promise.resolve();

export function initializeVSmuxDebugLog(_context: vscode.ExtensionContext): void {}

export function resetVSmuxDebugLog(): void {
  if (!isDebugLoggingEnabled()) {
    return;
  }

  const logFilePath = resolveWorkspaceDebugLogFilePath();
  if (!logFilePath) {
    return;
  }

  fileWriteQueue = fileWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(logFilePath), { recursive: true });
      await writeFile(logFilePath, "", "utf8");
    })
    .catch(() => undefined);
}

export function logVSmuxDebug(event: string, details?: unknown): void {
  if (!isDebugLoggingEnabled() || !shouldLogDebugEvent(event)) {
    return;
  }

  queueDebugLogFileAppend(buildLogLine(event, details));
}

export function logVSmuxReproTrace(event: string, details?: unknown): void {
  if (!isDebugLoggingEnabled()) {
    return;
  }

  queueDebugLogFileAppend(buildLogLine(event, details));
}

export function disposeVSmuxDebugLog(): void {}

export function getVSmuxDebugLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, DEBUG_LOG_DIR_NAME, DEBUG_LOG_FILE_NAME);
}

function buildLogLine(event: string, details?: unknown): string {
  const suffix = details === undefined ? "" : ` ${safeSerialize(details)}`;
  return `${new Date().toISOString()} ${event}${suffix}\n`;
}

function resolveWorkspaceDebugLogFilePath(): string | undefined {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return workspaceRoot ? getVSmuxDebugLogPath(workspaceRoot) : undefined;
}

function queueDebugLogFileAppend(text: string): void {
  const logFilePath = resolveWorkspaceDebugLogFilePath();
  if (!logFilePath) {
    return;
  }

  fileWriteQueue = fileWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(logFilePath), { recursive: true });
      await appendFile(logFilePath, text, "utf8");
    })
    .catch(() => undefined);
}

function isDebugLoggingEnabled(): boolean {
  return (
    vscode.workspace.getConfiguration(SETTINGS_SECTION).get<boolean>(DEBUGGING_MODE_SETTING) ??
    false
  );
}

function shouldLogDebugEvent(event: string): boolean {
  if (DEBUG_EVENT_ALLOWLIST.has(event)) {
    return true;
  }

  return DEBUG_EVENT_PREFIX_ALLOWLIST.some((prefix) => event.startsWith(prefix));
}

function safeSerialize(details: unknown): string {
  try {
    return JSON.stringify(details, (_key, value) => {
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
        };
      }

      return value;
    });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      unserializable: true,
    });
  }
}
