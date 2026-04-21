import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const vendorRoot = path.join(repoRoot, ".vendor", "wterm");
const defaultSourceRoot = "/Users/madda/dev/_active/wterm";
const sourceRoot = path.resolve(process.env.VSMUX_WTERM_SOURCE_DIR ?? defaultSourceRoot);

const packages = [
  { name: "@wterm/core", dir: path.join("packages", "@wterm", "core") },
  { name: "@wterm/dom", dir: path.join("packages", "@wterm", "dom") },
  { name: "@wterm/search", dir: path.join("packages", "@wterm", "search") },
  { name: "@wterm/serialize", dir: path.join("packages", "@wterm", "serialize") },
];

const importRewrites = [
  {
    relativePath: path.join("dom", "src", "index.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("dom", "src", "wterm.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("dom", "src", "renderer.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("dom", "src", "input.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("dom", "src", "debug.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("search", "src", "index.ts"),
    replacements: [['from "@wterm/dom";', 'from "../../dom/src/index.js";']],
  },
  {
    relativePath: path.join("serialize", "src", "index.ts"),
    replacements: [['from "@wterm/dom";', 'from "../../dom/src/index.js";']],
  },
  {
    relativePath: path.join("serialize", "src", "encode.ts"),
    replacements: [['from "@wterm/core";', 'from "../../core/src/index.js";']],
  },
  {
    relativePath: path.join("core", "src", "wasm-bridge.ts"),
    replacements: [
      [
        [
          "function decodeBase64(base64: string): ArrayBuffer {",
          "  const binary = atob(base64);",
          "  const bytes = new Uint8Array(binary.length);",
          "  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);",
          "  return bytes.buffer;",
          "}",
        ].join("\n"),
        [
          "function decodeBase64(base64: string): ArrayBuffer {",
          '  if (typeof atob === "function") {',
          "    const binary = atob(base64);",
          "    const bytes = new Uint8Array(binary.length);",
          "    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);",
          "    return bytes.buffer;",
          "  }",
          "",
          '  if (typeof Buffer === "function") {',
          '    const bytes = Buffer.from(base64, "base64");',
          "    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);",
          "  }",
          "",
          '  throw new Error("wterm: no base64 decoder available");',
          "}",
        ].join("\n"),
      ],
    ],
  },
];

async function main() {
  await ensureSourceRoot();
  await buildSourcePackages();
  await rm(vendorRoot, { force: true, recursive: true });
  await mkdir(vendorRoot, { recursive: true });

  for (const pkg of packages) {
    await copyPackage(pkg);
  }

  await rewriteImports();
  await writeProvenanceFile();
}

async function ensureSourceRoot() {
  const packageJsonPath = path.join(sourceRoot, "package.json");
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    if (packageJson?.name !== "wterm") {
      throw new Error(`Unexpected package name in ${packageJsonPath}`);
    }
  } catch (error) {
    throw new Error(
      `Unable to access the upstream wterm source at ${sourceRoot}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function buildSourcePackages() {
  await run(
    process.execPath,
    [path.join(sourceRoot, "packages", "@wterm", "core", "scripts", "inline-wasm.js")],
    {
      cwd: sourceRoot,
    },
  );
}

async function copyPackage(pkg) {
  const sourcePackageDir = path.join(sourceRoot, pkg.dir);
  const targetPackageDir = path.join(vendorRoot, path.basename(pkg.dir));
  await mkdir(targetPackageDir, { recursive: true });
  await cp(path.join(sourcePackageDir, "src"), path.join(targetPackageDir, "src"), {
    recursive: true,
  });
  await cp(
    path.join(sourcePackageDir, "package.json"),
    path.join(targetPackageDir, "package.json"),
  );
}

async function rewriteImports() {
  for (const rewrite of importRewrites) {
    const targetFilePath = path.join(vendorRoot, rewrite.relativePath);
    let content = await readFile(targetFilePath, "utf8");
    for (const [from, to] of rewrite.replacements) {
      if (!content.includes(from)) {
        throw new Error(`Expected to find ${JSON.stringify(from)} in ${targetFilePath}`);
      }
      content = content.replace(from, to);
    }
    await writeFile(targetFilePath, content, "utf8");
  }
}

async function writeProvenanceFile() {
  const branch = await capture("git", ["branch", "--show-current"], sourceRoot);
  const commit = await capture("git", ["rev-parse", "HEAD"], sourceRoot);
  const serializeCommit = await capture("git", ["rev-parse", "9ebce87^{commit}"], sourceRoot);
  const searchCommit = await capture("git", ["rev-parse", "35d2d8e^{commit}"], sourceRoot);

  const content = [
    "This directory is generated by scripts/sync-wterm-vendor.mjs.",
    `Source repo: ${sourceRoot}`,
    `Source branch: ${branch}`,
    `Source HEAD: ${commit}`,
    `Serialize reference: ${serializeCommit} (requested commit 9ebce87)`,
    `Search reference: ${searchCommit} (requested commit 35d2d8e)`,
  ].join("\n");

  await writeFile(path.join(vendorRoot, "README.generated.txt"), `${content}\n`, "utf8");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

function capture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
