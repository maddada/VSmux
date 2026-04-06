import { z } from "zod";
import { type AssistantEntry, AssistantEntrySchema } from "./entry/AssistantEntrySchema";
import { FileHistorySnapshotEntrySchema } from "./entry/FileHistorySnapshotEntrySchema";
import { QueueOperationEntrySchema } from "./entry/QueueOperationEntrySchema";
import { SummaryEntrySchema } from "./entry/SummaryEntrySchema";
import { type SystemEntry, SystemEntrySchema } from "./entry/SystemEntrySchema";
import { type UserEntry, UserEntrySchema } from "./entry/UserEntrySchema";

type JsonRecord = Record<string, unknown>;

const SYSTEM_LEVELS = new Set(["info", "suggestion", "warning", "error"]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const getHookCommands = (entry: JsonRecord): string[] => {
  const hookInfos = entry.hookInfos;
  if (!Array.isArray(hookInfos)) return [];

  const commands = hookInfos
    .map((info) => {
      if (!isRecord(info)) return undefined;
      return getString(info.command);
    })
    .filter((command): command is string => typeof command === "string");

  return commands;
};

const buildStopHookSummaryContent = (entry: JsonRecord): string => {
  const hookCount = getNumber(entry.hookCount);
  const preventedContinuation = getBoolean(entry.preventedContinuation);
  const stopReason = getString(entry.stopReason);
  const commands = getHookCommands(entry);

  const parts: string[] = ["Stop hook summary"];

  if (typeof hookCount === "number") {
    parts.push(`${hookCount} hook(s) executed`);
  }

  if (commands.length > 0) {
    parts.push(`Commands: ${commands.join(", ")}`);
  }

  if (typeof preventedContinuation === "boolean") {
    parts.push(`Prevented continuation: ${preventedContinuation ? "yes" : "no"}`);
  }

  if (stopReason && stopReason.trim().length > 0) {
    parts.push(`Reason: ${stopReason}`);
  }

  return parts.join(". ");
};

const buildHookProgressContent = (data: JsonRecord): string => {
  const hookEvent = getString(data.hookEvent);
  const hookName = getString(data.hookName);
  const command = getString(data.command);

  const parts = ["Hook progress"];
  if (hookEvent) parts.push(`Event: ${hookEvent}`);
  if (hookName) parts.push(`Hook: ${hookName}`);
  if (command) parts.push(`Command: ${command}`);
  return parts.join(". ");
};

const buildBashProgressContent = (data: JsonRecord): string => {
  const elapsed = getNumber(data.elapsedTimeSeconds);
  const totalLines = getNumber(data.totalLines);
  const output = getString(data.output);

  const parts = ["Bash progress"];
  if (typeof elapsed === "number") parts.push(`Elapsed: ${elapsed}s`);
  if (typeof totalLines === "number") parts.push(`Lines: ${totalLines}`);
  if (output && output.trim().length > 0) parts.push(`Output: ${output}`);
  return parts.join(". ");
};

const normalizeProgressEntry = (entry: JsonRecord): JsonRecord => {
  if (entry.type !== "progress") return entry;

  const data = isRecord(entry.data) ? entry.data : {};
  const dataType = getString(data.type);

  let content = "Progress update";
  if (dataType === "hook_progress") {
    content = buildHookProgressContent(data);
  } else if (dataType === "bash_progress") {
    content = buildBashProgressContent(data);
  }

  return {
    ...entry,
    type: "system",
    content,
    toolUseID: getString(entry.toolUseID) ?? getString(entry.parentToolUseID) ?? "progress-update",
    level: "info",
    parentUuid: entry.parentUuid ?? null,
  };
};

const normalizeSystemEntry = (entry: JsonRecord): JsonRecord => {
  if (entry.type !== "system") return entry;

  const normalized: JsonRecord = { ...entry };
  const level = getString(normalized.level);
  normalized.level = level && SYSTEM_LEVELS.has(level) ? level : "info";

  if (!getString(normalized.toolUseID)) {
    normalized.toolUseID = getString(normalized.parentToolUseID) ?? "system";
  }

  if (!getString(normalized.content)) {
    const subtype = getString(normalized.subtype);
    normalized.content =
      subtype === "stop_hook_summary"
        ? buildStopHookSummaryContent(normalized)
        : subtype
          ? `System event: ${subtype}`
          : "System event";
  }

  normalized.parentUuid = normalized.parentUuid ?? null;

  return normalized;
};

const normalizeConversationEntry = (entry: unknown): unknown => {
  if (!isRecord(entry)) return entry;
  const maybeProgress = normalizeProgressEntry(entry);
  if (!isRecord(maybeProgress)) return maybeProgress;
  return normalizeSystemEntry(maybeProgress);
};

export const ConversationSchema = z.preprocess(
  normalizeConversationEntry,
  z.union([
    UserEntrySchema,
    AssistantEntrySchema,
    SummaryEntrySchema,
    SystemEntrySchema,
    FileHistorySnapshotEntrySchema,
    QueueOperationEntrySchema,
  ]),
);

export type Conversation = z.infer<typeof ConversationSchema>;
export type SidechainConversation = UserEntry | AssistantEntry | SystemEntry;

// Error type for schema validation failures
export type ErrorJsonl = {
  type: "x-error";
  line: string;
};
