import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import * as path from "node:path";

const AGENT_CONTROL_COMMAND = "9001";
const AGENT_CONTROL_NAMESPACE = "VSmux";

async function main(): Promise<void> {
  const input = await readInput();
  const normalizedEvent = getNormalizedEventType(input);
  if (!normalizedEvent) {
    return;
  }

  const agentName = getJsonStringField(input, "agent") ?? process.env.VSMUX_AGENT ?? "unknown";

  await writeSessionState(normalizedEvent, agentName);
  process.stdout.write(
    `\u001b]${AGENT_CONTROL_COMMAND};${AGENT_CONTROL_NAMESPACE};${normalizedEvent};${agentName}\u0007`,
  );
}

async function readInput(): Promise<string> {
  const cliInput = process.argv[2];
  if (cliInput) {
    return cliInput;
  }

  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  }

  return chunks.join("");
}

function getNormalizedEventType(input: string): "start" | "stop" | undefined {
  const hookEventName = getJsonStringField(input, "hook_event_name");
  if (hookEventName && /^start$/i.test(hookEventName)) {
    return "start";
  }

  if (hookEventName && /^stop$/i.test(hookEventName)) {
    return "stop";
  }

  const rawType = getJsonStringField(input, "type");
  if (rawType === "agent-turn-complete" || rawType === "task_complete") {
    return "stop";
  }

  return undefined;
}

function getJsonStringField(input: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]*)"`, "i"));
  return match?.[1] || undefined;
}

async function writeSessionState(eventType: "start" | "stop", agentName: string): Promise<void> {
  const stateFilePath = process.env.VSMUX_SESSION_STATE_FILE?.trim();
  if (!stateFilePath) {
    return;
  }

  const stateDirectory = path.dirname(stateFilePath);
  await mkdir(stateDirectory, { recursive: true }).catch(() => undefined);

  const title = await readExistingTitle(stateFilePath);
  const nextStatus = eventType === "start" ? "working" : "attention";
  const nextState = `status=${nextStatus}\nagent=${agentName}\ntitle=${title}\n`;
  const tempStateFilePath = `${stateFilePath}.tmp.${process.pid}`;

  await writeFile(tempStateFilePath, nextState, "utf8");
  await rename(tempStateFilePath, stateFilePath).catch(() => undefined);
}

async function readExistingTitle(stateFilePath: string): Promise<string> {
  try {
    const stateFile = await readFile(stateFilePath, "utf8");
    for (const line of stateFile.split(/\r?\n/)) {
      if (line.startsWith("title=")) {
        return line.slice("title=".length).trim();
      }
    }
  } catch {
    return "";
  }

  return "";
}

void main().catch(() => {
  process.exit(0);
});
