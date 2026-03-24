import { chmod } from "node:fs/promises";
import * as path from "node:path";
import type * as vscode from "vscode";

const SUPPORTED_TARGETS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
] as const);

export function getBundledTsmBinaryPath(context: vscode.ExtensionContext): string {
  const target = `${process.platform}-${process.arch}`;
  if (!SUPPORTED_TARGETS.has(target as never)) {
    throw new Error(
      `Bundled tsm sessions are unsupported on ${process.platform}/${process.arch}.`,
    );
  }

  return path.join(context.extensionUri.fsPath, "extension", "vendor", "tsm", target, "tsm");
}

export async function ensureBundledTsmBinaryIsExecutable(
  context: vscode.ExtensionContext,
): Promise<string> {
  const binaryPath = getBundledTsmBinaryPath(context);
  await chmod(binaryPath, 0o755).catch(() => undefined);
  return binaryPath;
}
