import { execFile, spawn } from "node:child_process";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MESSAGE_HEADER_SIZE = 5;
const INFO_PAYLOAD_SIZE = 552;
const INFO_TAG = 6;
const INPUT_TAG = 0;
const KILL_TAG = 5;
const SESSION_PROBE_TIMEOUT_MS = 1_000;
const SESSION_START_RETRY_COUNT = 20;
const SESSION_START_RETRY_DELAY_MS = 50;

export type TsmSessionInfo = {
  attachedClientCount: number;
  cwd: string;
  processId: number;
};

export type EnsureTsmSessionOptions = {
  cwd: string;
  environment: Record<string, string>;
  shellPath: string;
};

type TsmBootstrapInvocation = {
  args: string[];
  command: string;
};

export class TsmSessionRuntime {
  public constructor(
    private readonly bundledBinaryPath: string,
    private readonly workspaceId: string,
  ) {}

  public createAttachEnvironment(
    environment: Record<string, string>,
  ): Record<string, string> {
    return {
      ...environment,
      TSM_DIR: this.getSocketDirectory(),
    };
  }

  public getSocketDirectory(): string {
    const uid =
      typeof process.getuid === "function" ? String(process.getuid()) : os.userInfo().username;
    return path.join("/tmp", `vsmux-tsm-${uid}-${this.workspaceId}`);
  }

  public getSocketPath(sessionId: string): string {
    return path.join(this.getSocketDirectory(), sessionId);
  }

  public async ensureSession(
    sessionId: string,
    options: EnsureTsmSessionOptions,
  ): Promise<void> {
    if (await this.probeSession(sessionId)) {
      return;
    }

    const command = createTsmShellCommand(options.shellPath, options.environment);
    try {
      await this.startSessionWithPty(sessionId, command, options);
    } catch (error) {
      if (await this.probeSession(sessionId)) {
        return;
      }

      throw error;
    }

    for (let index = 0; index < SESSION_START_RETRY_COUNT; index += 1) {
      if (await this.probeSession(sessionId)) {
        return;
      }

      await delay(SESSION_START_RETRY_DELAY_MS);
    }

    throw new Error(`Timed out while starting bundled tsm session ${sessionId}.`);
  }

  public async probeSession(sessionId: string): Promise<TsmSessionInfo | undefined> {
    let payload: Buffer | undefined;
    try {
      payload = await this.sendMessage(sessionId, INFO_TAG, Buffer.alloc(0), true);
    } catch (error) {
      if (isMissingTsmSessionError(error)) {
        return undefined;
      }

      throw error;
    }

    if (!payload || payload.length < INFO_PAYLOAD_SIZE) {
      return undefined;
    }

    return {
      attachedClientCount: Number(payload.readBigUInt64LE(0)),
      cwd: readSizedString(payload.subarray(272, 528), payload.readUInt16LE(14)),
      processId: payload.readInt32LE(8),
    };
  }

  public async sendInput(
    sessionId: string,
    data: string,
    shouldExecute: boolean,
  ): Promise<void> {
    const payload = Buffer.from(shouldExecute ? `${data}\n` : data, "utf8");
    await this.sendMessage(sessionId, INPUT_TAG, payload, false);
  }

  public async killSession(sessionId: string): Promise<void> {
    await this.sendMessage(sessionId, KILL_TAG, Buffer.alloc(0), false).catch(() => undefined);
  }

  private async sendMessage(
    sessionId: string,
    tag: number,
    payload: Buffer,
    expectReply: boolean,
  ): Promise<Buffer | undefined> {
    const socketPath = this.getSocketPath(sessionId);

    return new Promise<Buffer | undefined>((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      let settled = false;
      let buffer = Buffer.alloc(0);
      let expectedPayloadLength: number | undefined;
      let expectedTag: number | undefined;

      const finish = (handler: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        handler();
      };

      const timeout = setTimeout(() => {
        finish(() => reject(new Error(`Timed out while talking to bundled tsm session ${sessionId}.`)));
      }, SESSION_PROBE_TIMEOUT_MS);

      socket.once("error", (error) => {
        clearTimeout(timeout);
        finish(() => reject(error));
      });

      socket.on("data", (chunk) => {
        if (!expectReply) {
          return;
        }

        const nextChunk = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
        buffer = Buffer.concat([buffer, nextChunk]);
        if (expectedPayloadLength === undefined && buffer.length >= MESSAGE_HEADER_SIZE) {
          expectedTag = buffer.readUInt8(0);
          expectedPayloadLength = buffer.readUInt32LE(1);
        }

        if (
          expectedPayloadLength !== undefined &&
          buffer.length >= MESSAGE_HEADER_SIZE + expectedPayloadLength
        ) {
          clearTimeout(timeout);
          const responseTag = expectedTag ?? -1;
          const responsePayload = buffer.subarray(
            MESSAGE_HEADER_SIZE,
            MESSAGE_HEADER_SIZE + expectedPayloadLength,
          );
          finish(() => {
            if (responseTag !== INFO_TAG) {
              reject(new Error(`Unexpected bundled tsm response tag ${responseTag}.`));
              return;
            }

            resolve(responsePayload);
          });
        }
      });

      socket.once("connect", () => {
        const header = Buffer.alloc(MESSAGE_HEADER_SIZE);
        header.writeUInt8(tag, 0);
        header.writeUInt32LE(payload.length, 1);
        socket.write(Buffer.concat([header, payload]), (error) => {
          if (error) {
            clearTimeout(timeout);
            finish(() => reject(error));
            return;
          }

          if (!expectReply) {
            clearTimeout(timeout);
            finish(() => resolve(undefined));
          }
        });
      });
    });
  }

  private async startSessionWithPty(
    sessionId: string,
    command: string[],
    options: EnsureTsmSessionOptions,
  ): Promise<void> {
    const environment = {
      ...process.env,
      TSM_DIR: this.getSocketDirectory(),
    };
    const invocation = createTsmBootstrapInvocation(this.bundledBinaryPath, sessionId, command);

    if (!invocation) {
      await execFileAsync(this.bundledBinaryPath, ["new", sessionId, ...command], {
        cwd: options.cwd,
        env: environment,
        timeout: 10_000,
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        env: environment,
        stdio: "ignore",
      });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`Timed out while starting bundled tsm session ${sessionId}.`));
      }, 10_000);

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `Bundled tsm bootstrap exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`,
          ),
        );
      });
    });
  }
}

function createTsmShellCommand(
  shellPath: string,
  environment: Record<string, string>,
): string[] {
  return [
    "/usr/bin/env",
    ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
    shellPath,
    ...getShellArgs(shellPath),
  ];
}

export function getShellArgs(shellPath: string): string[] {
  const shellName = path.basename(shellPath).toLowerCase();
  switch (shellName) {
    case "zsh":
      return ["-i", "-l"];
    case "bash":
      return ["--login", "-i"];
    case "fish":
      return ["-i", "-l"];
    default:
      return ["-i"];
  }
}

function readSizedString(buffer: Buffer, byteLength: number): string {
  return buffer.subarray(0, Math.max(0, Math.min(buffer.length, byteLength))).toString("utf8");
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createTsmBootstrapInvocation(
  bundledBinaryPath: string,
  sessionId: string,
  command: readonly string[],
  platform: NodeJS.Platform = process.platform,
): TsmBootstrapInvocation | undefined {
  const args = ["new", sessionId, ...command];

  switch (platform) {
    case "darwin":
      return {
        args: ["-q", "/dev/null", bundledBinaryPath, ...args],
        command: "/usr/bin/script",
      };
    case "linux":
      return {
        args: ["-q", "-e", "-f", "-c", quoteShellCommand([bundledBinaryPath, ...args]), "/dev/null"],
        command: "/usr/bin/script",
      };
    default:
      return undefined;
  }
}

function quoteShellCommand(argv: readonly string[]): string {
  return argv.map(quoteShellArgument).join(" ");
}

function quoteShellArgument(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function isMissingTsmSessionError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return code === "ENOENT" || code === "ECONNREFUSED";
}
