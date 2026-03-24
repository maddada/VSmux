import { chmod } from "node:fs/promises";
import * as path from "node:path";
import type * as vscode from "vscode";

const SUPPORTED_TARGETS = {
  "darwin-arm64": {
    binaryName: "zellij",
    targetDirectory: "darwin-arm64",
  },
  "darwin-x64": {
    binaryName: "zellij",
    targetDirectory: "darwin-x64",
  },
  "linux-arm64": {
    binaryName: "zellij",
    targetDirectory: "linux-arm64",
  },
  "linux-x64": {
    binaryName: "zellij",
    targetDirectory: "linux-x64",
  },
  "win32-x64": {
    binaryName: "zellij.exe",
    targetDirectory: "win32-x64",
  },
} as const satisfies Record<
  string,
  {
    binaryName: string;
    targetDirectory: string;
  }
>;

export function getBundledZellijBinaryPath(context: vscode.ExtensionContext): string {
  const target = `${process.platform}-${process.arch}`;
  const targetDetails = SUPPORTED_TARGETS[target as keyof typeof SUPPORTED_TARGETS];
  if (!targetDetails) {
    throw new Error(
      `Bundled zellij sessions are unsupported on ${process.platform}/${process.arch}.`,
    );
  }

  return path.join(
    context.extensionUri.fsPath,
    "extension",
    "vendor",
    "zellij",
    targetDetails.targetDirectory,
    targetDetails.binaryName,
  );
}

export async function ensureBundledZellijBinaryIsExecutable(
  context: vscode.ExtensionContext,
): Promise<string> {
  const binaryPath = getBundledZellijBinaryPath(context);
  if (process.platform !== "win32") {
    await chmod(binaryPath, 0o755).catch(() => undefined);
  }
  return binaryPath;
}
