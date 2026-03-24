import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ZellijSessionInfo = {
  sessionId: string;
};

export type EnsureZellijSessionOptions = {
  cwd: string;
  environment: Record<string, string>;
  shellPath: string;
};

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type ExecFileError = Error & {
  code?: number | string;
  stderr?: Buffer | string;
  stdout?: Buffer | string;
};

export class ZellijSessionRuntime {
  public constructor(private readonly bundledBinaryPath: string) {}

  public async probeSession(sessionId: string): Promise<ZellijSessionInfo | undefined> {
    const sessions = await this.listSessions();
    return sessions.includes(sessionId) ? { sessionId } : undefined;
  }

  public async sendInput(
    sessionId: string,
    data: string,
    shouldExecute: boolean,
  ): Promise<void> {
    await this.runCommand([
      "--session",
      sessionId,
      "action",
      "write-chars",
      shouldExecute ? `${data}\n` : data,
    ]);
  }

  public async killSession(sessionId: string): Promise<void> {
    try {
      await this.runCommand(["kill-session", sessionId]);
    } catch (error) {
      if (isMissingZellijSessionError(error)) {
        return;
      }
      throw error;
    }
  }

  private async listSessions(): Promise<string[]> {
    const result = await this.runCommand(
      ["list-sessions", "--short", "--no-formatting"],
      undefined,
      true,
    );
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    if (result.exitCode !== 0 && output.length > 0 && !isMissingZellijSessionMessage(output)) {
      throw new Error(`Bundled zellij command failed (list-sessions): ${output}`);
    }

    return result.stdout
      .split(/\r?\n/u)
      .map((sessionName) => sessionName.trim())
      .filter((sessionName) => sessionName.length > 0);
  }

  private async runCommand(
    args: string[],
    options?: Partial<EnsureZellijSessionOptions>,
    allowNonZeroExit = false,
  ): Promise<CommandResult> {
    try {
      const result = await execFileAsync(this.bundledBinaryPath, args, {
        cwd: options?.cwd,
        env: this.createCommandEnvironment(options),
      });
      return {
        exitCode: 0,
        stderr: bufferToString(result.stderr),
        stdout: bufferToString(result.stdout),
      };
    } catch (error) {
      const normalizedError = normalizeExecFileError(error);
      if (allowNonZeroExit && typeof normalizedError.code === "number") {
        return {
          exitCode: normalizedError.code,
          stderr: normalizedError.stderr,
          stdout: normalizedError.stdout,
        };
      }
      throw createZellijCommandError(args, normalizedError);
    }
  }

  private createCommandEnvironment(
    options?: Partial<EnsureZellijSessionOptions>,
  ): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...options?.environment,
    };

    if (options?.shellPath) {
      environment.SHELL = options.shellPath;
      if (process.platform === "win32") {
        environment.COMSPEC = options.shellPath;
      }
    }

    return environment;
  }
}

export function isMissingZellijSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return isMissingZellijSessionMessage(error.message);
}

function isMissingZellijSessionMessage(message: string): boolean {
  return (
    message.includes("No session named") ||
    message.includes("There is no active session!") ||
    message.includes("No active zellij sessions found.")
  );
}

function createZellijCommandError(args: string[], error: {
  code?: number | string;
  stderr: string;
  stdout: string;
}): Error {
  const output = [error.stdout.trim(), error.stderr.trim()].filter(Boolean).join("\n");
  return new Error(
    `Bundled zellij command failed (${args.join(" ")}): ${output || `exit ${error.code ?? "unknown"}`}`,
  );
}

function normalizeExecFileError(error: unknown): {
  code?: number | string;
  stderr: string;
  stdout: string;
} {
  const nextError = error as ExecFileError;
  return {
    code: nextError?.code,
    stderr: bufferToString(nextError?.stderr),
    stdout: bufferToString(nextError?.stdout),
  };
}

function bufferToString(value: Buffer | string | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  return value?.toString("utf8") ?? "";
}
