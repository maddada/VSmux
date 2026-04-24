import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const chatHistoryRoot = join(repoRoot, "chat-history");
const stampPath = join(repoRoot, "out", ".vsmux-chat-history-webview-build-stamp.json");
const cacheVersion = 1;
const forceBuild = isTruthyEnv("VSMUX_FORCE_CHAT_HISTORY_BUILD");

function log(message) {
  console.log(`[build-chat-history] ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function isTruthyEnv(name) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function shouldReuseBuild(fingerprint) {
  if (forceBuild) {
    return false;
  }

  if (!hasOutputs()) {
    return false;
  }

  return readStampedFingerprint() === fingerprint;
}

function hasOutputs() {
  return (
    existsSync(join(chatHistoryRoot, "dist", "webview.css")) &&
    existsSync(join(chatHistoryRoot, "dist", "webview.js"))
  );
}

function readStampedFingerprint() {
  try {
    const stamp = JSON.parse(readFileSync(stampPath, "utf8"));
    return typeof stamp?.fingerprint === "string" ? stamp.fingerprint : undefined;
  } catch {
    return undefined;
  }
}

function writeStamp(fingerprint) {
  mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(
    stampPath,
    `${JSON.stringify(
      {
        cacheVersion,
        fingerprint,
        source: chatHistoryRoot,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function getBuildFingerprint() {
  return hashJson({
    cacheVersion,
    scripts: [
      getFileFingerprint(fileURLToPath(import.meta.url)),
      getFileFingerprint(join(chatHistoryRoot, "esbuild.webview.ts")),
    ],
    sourceFingerprint: getSourceFingerprint(),
    tailwindInput: getFileFingerprint(join(chatHistoryRoot, "src", "webview", "index.css")),
  });
}

function getSourceFingerprint() {
  return getGitSourceFingerprint() ?? getFilesystemSourceFingerprint();
}

function getGitSourceFingerprint() {
  const head = runGit(["rev-parse", "HEAD"]);
  if (!head.ok) {
    return undefined;
  }

  const status = runGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...sourcePathspecs(),
  ]);
  if (!status.ok) {
    return undefined;
  }

  const dirtyFiles = new Set([
    ...gitPathList(["diff", "--name-only", "-z", "--", ...sourcePathspecs()]),
    ...gitPathList(["diff", "--cached", "--name-only", "-z", "--", ...sourcePathspecs()]),
    ...gitPathList([
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...sourcePathspecs(),
    ]),
  ]);

  return {
    dirtyFiles: [...dirtyFiles].sort().map((filePath) => ({
      filePath,
      fingerprint: getOptionalFileFingerprint(join(repoRoot, filePath)),
    })),
    head: head.stdout.trim(),
    status: status.stdout,
    type: "git",
  };
}

function gitPathList(args) {
  const result = runGit(args, "buffer");
  if (!result.ok) {
    return [];
  }

  return result.stdout
    .toString("utf8")
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function runGit(args, encoding = "utf8") {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
  };
}

function sourcePathspecs() {
  return [
    "package.json",
    "pnpm-lock.yaml",
    "chat-history/package.json",
    "chat-history/tsconfig.json",
    "chat-history/esbuild.webview.ts",
    "chat-history/src/webview",
    ":(exclude)chat-history/dist/**",
    ":(exclude)chat-history/node_modules/**",
  ];
}

function getFilesystemSourceFingerprint() {
  return {
    files: [
      ...[
        join(repoRoot, "package.json"),
        join(repoRoot, "pnpm-lock.yaml"),
        join(chatHistoryRoot, "package.json"),
        join(chatHistoryRoot, "tsconfig.json"),
        join(chatHistoryRoot, "esbuild.webview.ts"),
      ].map((filePath) => ({
        filePath,
        fingerprint: getOptionalFileFingerprint(filePath),
      })),
      ...collectFileFingerprints(join(chatHistoryRoot, "src", "webview")),
    ],
    type: "filesystem",
  };
}

function collectFileFingerprints(root) {
  if (!existsSync(root)) {
    return [];
  }

  const stats = statSync(root);
  if (stats.isFile()) {
    return [{ filePath: root, fingerprint: getFileFingerprint(root) }];
  }

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFileFingerprints(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push({ filePath: entryPath, fingerprint: getFileFingerprint(entryPath) });
    }
  }

  return files.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function getOptionalFileFingerprint(filePath) {
  return existsSync(filePath) ? getFileFingerprint(filePath) : "missing";
}

function getFileFingerprint(filePath) {
  const stats = statSync(filePath);
  return {
    hash: createHash("sha256").update(readFileSync(filePath)).digest("hex"),
    size: stats.size,
  };
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const fingerprint = getBuildFingerprint();
if (shouldReuseBuild(fingerprint)) {
  log("Reusing conversation webview; inputs are unchanged.");
  process.exit(0);
}

run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
  "exec",
  "tailwindcss",
  "-i",
  "./chat-history/src/webview/index.css",
  "-o",
  "./chat-history/dist/webview.css",
  "--minify",
]);
run(process.platform === "win32" ? "bun.exe" : "bun", ["run", "./chat-history/esbuild.webview.ts"]);
writeStamp(fingerprint);
log("Built conversation webview.");
