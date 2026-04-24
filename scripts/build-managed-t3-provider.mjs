import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, parse, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LICENSE_FILE_NAME_PATTERN = /^(licen[sc]e|notice|copying)(\..+)?$/iu;
const MANAGED_T3_BUILD_CACHE_VERSION = 1;
const PRUNABLE_MARKDOWN_FILE_NAME_PATTERN = /\.(md|markdown|mkd)$/iu;
const PRUNABLE_RUNTIME_FILE_SUFFIXES = [
  ".cts",
  ".d.ts",
  ".d.ts.map",
  ".js.map",
  ".map",
  ".mts",
  ".pdb",
  ".ts",
  ".tsbuildinfo",
  ".tsx",
];
const PRUNABLE_RUNTIME_FILE_NAMES = new Set([
  ".npmignore",
  ".travis.yml",
  ".vscodeignore",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.build.json",
  "tsconfig.json",
  "yarn.lock",
]);
const PRUNABLE_PACKAGE_DIRECTORY_NAMES = new Set([
  ".devcontainer",
  ".github",
  ".vscode",
  "__mocks__",
  "__tests__",
  "example",
  "examples",
  "fixture",
  "fixtures",
  "test",
  "tests",
]);
const PACKAGE_PRUNE_RULES = [
  {
    packageName: "@types",
    removePackageRoot: true,
  },
  {
    directories: ["src"],
    packageName: "effect",
  },
  {
    directories: ["deps", "scripts", "src", "third_party", "typings"],
    files: ["binding.gyp"],
    packageName: "node-pty",
  },
];

export function buildManagedT3Provider(input) {
  const repoRoot = process.cwd();
  const provider = input.provider;
  const displayName = input.displayName;
  const embedRoot = input.embedRoot;
  const vendorWebRoot = resolve(embedRoot, "apps", "web");
  const serverRoot = resolve(embedRoot, "apps", "server");
  const webDistRoot = resolve(vendorWebRoot, "dist");
  const serverDistRoot = resolve(serverRoot, "dist");
  const packagedWebDistRoot = resolve(repoRoot, "out", input.packagedWebDirectoryName);
  const packagedServerRoot = resolve(repoRoot, "out", input.packagedServerDirectoryName);
  const packagedServerDistRoot = resolve(packagedServerRoot, "dist");
  const packagedServerNodeModulesRoot = resolve(packagedServerRoot, "node_modules");
  const embedNodeModulesRoot = resolve(embedRoot, "node_modules");
  const embedPackageJsonPath = resolve(embedRoot, "package.json");
  const serverPackageJsonPath = resolve(serverRoot, "package.json");
  const embedLockfilePaths = [resolve(embedRoot, "bun.lock"), resolve(embedRoot, "bun.lockb")];
  const embedInstallStampPath = resolve(embedNodeModulesRoot, ".vsmux-install-stamp");
  const buildStampPath = resolve(repoRoot, "out", `.vsmux-${provider}-embed-build-stamp.json`);

  if (!existsSync(vendorWebRoot)) {
    throw new Error(
      `Missing ${vendorWebRoot}. Sync the sibling ${provider}-embed checkout or set ${input.envVarName}.`,
    );
  }

  if (!existsSync(serverRoot)) {
    throw new Error(
      `Missing ${serverRoot}. Sync the sibling ${provider}-embed checkout or set ${input.envVarName}.`,
    );
  }

  ensureEmbedDependencies();
  const buildFingerprint = getBuildFingerprint();
  if (shouldReusePackagedBuild(buildFingerprint)) {
    console.log(`[build-t3-embed] Reusing bundled ${displayName}; inputs are unchanged.`);
    return;
  }

  run("bun", ["run", "build"], {
    cwd: vendorWebRoot,
    env: {
      ...process.env,
      T3CODE_WEB_SOURCEMAP: "false",
    },
  });
  run("bun", ["run", "build"], { cwd: serverRoot });
  pruneMaps(webDistRoot);
  pruneMaps(serverDistRoot);
  syncPackagedArtifacts(webDistRoot, packagedWebDistRoot);
  bundleServerRuntime();
  writeBuildStamp(buildFingerprint);

  function copyTree(source, destination) {
    cpSync(source, destination, {
      dereference: true,
      force: true,
      recursive: true,
    });
  }

  function run(command, args, options) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      ...(options.env ? { env: options.env } : {}),
      stdio: "inherit",
    });

    if (result.status !== 0) {
      throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
  }

  function shouldReusePackagedBuild(fingerprint) {
    if (isTruthyEnv("VSMUX_FORCE_T3_BUILD") || isTruthyEnv("VSMUX_FORCE_T3CODE_EMBED_BUILD")) {
      return false;
    }

    if (!hasPackagedBuildOutputs()) {
      return false;
    }

    const stampedFingerprint = readStampedBuildFingerprint();
    return stampedFingerprint === fingerprint;
  }

  function isTruthyEnv(name) {
    const value = process.env[name]?.trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
  }

  function hasPackagedBuildOutputs() {
    return (
      existsSync(resolve(packagedWebDistRoot, "index.html")) &&
      existsSync(resolve(packagedServerDistRoot, "bin.mjs")) &&
      existsSync(packagedServerNodeModulesRoot) &&
      existsSync(resolve(packagedServerRoot, "package.json"))
    );
  }

  function readStampedBuildFingerprint() {
    try {
      const stamp = JSON.parse(readFileSync(buildStampPath, "utf8"));
      return typeof stamp?.fingerprint === "string" ? stamp.fingerprint : undefined;
    } catch {
      return undefined;
    }
  }

  function writeBuildStamp(fingerprint) {
    mkdirSync(dirname(buildStampPath), { recursive: true });
    writeFileSync(
      buildStampPath,
      `${JSON.stringify(
        {
          cacheVersion: MANAGED_T3_BUILD_CACHE_VERSION,
          fingerprint,
          provider,
          source: embedRoot,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  function getBuildFingerprint() {
    return hashJson({
      buildScript: getFileFingerprint(fileURLToPath(import.meta.url)),
      cacheVersion: MANAGED_T3_BUILD_CACHE_VERSION,
      dependencyFingerprint: getDependencyFingerprint(),
      provider,
      prunePackagedRuntime: input.prunePackagedRuntime !== false,
      sourceFingerprint: getSourceFingerprint(),
      webSourcemap: false,
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
        fingerprint: getOptionalFileFingerprint(resolve(embedRoot, filePath)),
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
    const result = spawnSync("git", ["-C", embedRoot, ...args], {
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
      "bun.lock",
      "bun.lockb",
      "apps/web",
      "apps/server",
      ":(exclude)apps/web/dist/**",
      ":(exclude)apps/web/node_modules/**",
      ":(exclude)apps/server/dist/**",
      ":(exclude)apps/server/node_modules/**",
    ];
  }

  function getFilesystemSourceFingerprint() {
    return {
      files: [
        ...collectFileFingerprints(embedRoot, ["package.json", "bun.lock", "bun.lockb"]),
        ...collectFileFingerprints(vendorWebRoot),
        ...collectFileFingerprints(serverRoot),
      ],
      type: "filesystem",
    };
  }

  function collectFileFingerprints(root, fileNames) {
    if (!existsSync(root)) {
      return [];
    }

    const stats = statSync(root);
    if (stats.isFile()) {
      return [{ filePath: root, fingerprint: getFileFingerprint(root) }];
    }

    if (fileNames) {
      return fileNames
        .map((fileName) => resolve(root, fileName))
        .filter((filePath) => existsSync(filePath))
        .map((filePath) => ({ filePath, fingerprint: getFileFingerprint(filePath) }));
    }

    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }

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

  function ensureEmbedDependencies() {
    if (!shouldInstallEmbedDependencies()) {
      return;
    }

    run("bun", ["install"], { cwd: embedRoot });
    writeInstallStamp();
  }

  function shouldInstallEmbedDependencies() {
    if (!existsSync(embedNodeModulesRoot)) {
      return true;
    }

    if (!existsSync(embedInstallStampPath)) {
      return true;
    }

    return readFileSync(embedInstallStampPath, "utf8") !== getDependencyFingerprint();
  }

  function writeInstallStamp() {
    writeFileSync(embedInstallStampPath, getDependencyFingerprint(), "utf8");
  }

  function getDependencyFingerprint() {
    const dependencyInputs = [
      embedPackageJsonPath,
      ...embedLockfilePaths.filter((filePath) => existsSync(filePath)),
    ];

    return JSON.stringify(
      dependencyInputs.map((filePath) => ({
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
        size: statSync(filePath).size,
      })),
    );
  }

  function pruneMaps(root) {
    for (const entry of readdirSync(root)) {
      const entryPath = resolve(root, entry);
      const stats = statSync(entryPath);
      if (stats.isDirectory()) {
        pruneMaps(entryPath);
        continue;
      }

      if (entry.endsWith(".map")) {
        rmSync(entryPath, { force: true });
      }
    }
  }

  function syncPackagedArtifacts(sourceRoot, destinationRoot) {
    rmSync(destinationRoot, { force: true, recursive: true });
    mkdirSync(destinationRoot, { recursive: true });
    copyTree(sourceRoot, destinationRoot);
  }

  function bundleServerRuntime() {
    syncPackagedArtifacts(serverDistRoot, packagedServerDistRoot);
    rmSync(packagedServerNodeModulesRoot, { force: true, recursive: true });
    mkdirSync(packagedServerNodeModulesRoot, { recursive: true });

    const serverPackageJson = JSON.parse(readFileSync(serverPackageJsonPath, "utf8"));
    const copiedPackageNames = new Set();
    for (const dependencyName of Object.keys(serverPackageJson.dependencies ?? {})) {
      copyInstalledDependencyClosure(dependencyName, copiedPackageNames);
    }
    if (input.prunePackagedRuntime !== false) {
      prunePackagedServerRuntime();
    }

    writeFileSync(
      resolve(packagedServerRoot, "package.json"),
      JSON.stringify(
        {
          name: `vsmux-${provider}-server`,
          private: true,
          type: "module",
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  function copyInstalledDependencyClosure(packageName, copiedPackageNames, parentPackageDir) {
    if (copiedPackageNames.has(packageName)) {
      return;
    }

    const sourceDir = resolveInstalledPackageDir(packageName, parentPackageDir);
    if (!sourceDir) {
      return;
    }
    const resolvedSourceDir = realpathSync(sourceDir);

    copiedPackageNames.add(packageName);
    const destinationDir = resolve(packagedServerNodeModulesRoot, packageName);
    mkdirSync(dirname(destinationDir), { recursive: true });
    copyTree(resolvedSourceDir, destinationDir);

    const packageJsonPath = resolve(resolvedSourceDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const dependencyNames = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ]);

    for (const dependencyName of dependencyNames) {
      copyInstalledDependencyClosure(dependencyName, copiedPackageNames, resolvedSourceDir);
    }
  }

  function resolveInstalledPackageDir(packageName, parentPackageDir) {
    let currentDir = parentPackageDir ?? serverRoot;
    const filesystemRoot = parse(currentDir).root;

    while (true) {
      const candidateDir = resolve(currentDir, "node_modules", packageName);
      if (existsSync(candidateDir)) {
        return candidateDir;
      }

      if (currentDir === filesystemRoot) {
        return undefined;
      }

      const nextDir = dirname(currentDir);
      if (nextDir === currentDir) {
        return undefined;
      }
      currentDir = nextDir;
    }
  }

  function prunePackagedServerRuntime() {
    const stats = {
      bytes: 0,
      directories: 0,
      files: 0,
    };

    for (const rule of PACKAGE_PRUNE_RULES) {
      prunePackagedDependency(rule, stats);
    }

    pruneRuntimeFiles(packagedServerNodeModulesRoot, stats);
    console.log(
      `[build-t3-embed] Pruned ${stats.files} files and ${stats.directories} directories (${formatBytes(stats.bytes)}) from bundled ${input.packagedServerDirectoryName} runtime.`,
    );
  }

  function prunePackagedDependency(rule, stats) {
    const packageRoot = resolve(packagedServerNodeModulesRoot, ...rule.packageName.split("/"));
    if (!existsSync(packageRoot)) {
      return;
    }

    if (rule.removePackageRoot) {
      removePath(packageRoot, stats);
      return;
    }

    for (const directoryName of rule.directories ?? []) {
      removePath(resolve(packageRoot, directoryName), stats);
    }

    for (const fileName of rule.files ?? []) {
      removePath(resolve(packageRoot, fileName), stats);
    }
  }

  function pruneRuntimeFiles(root, stats, insidePackage = false) {
    if (!existsSync(root)) {
      return;
    }

    const currentInsidePackage = insidePackage || existsSync(resolve(root, "package.json"));
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const entryPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        if (currentInsidePackage && PRUNABLE_PACKAGE_DIRECTORY_NAMES.has(entry.name)) {
          removePath(entryPath, stats);
          continue;
        }

        pruneRuntimeFiles(entryPath, stats, currentInsidePackage);

        if (readdirSync(entryPath).length === 0) {
          rmSync(entryPath, { force: true, recursive: true });
          stats.directories += 1;
        }
        continue;
      }

      if (!shouldPruneRuntimeFile(entry.name)) {
        continue;
      }

      removePath(entryPath, stats);
    }
  }

  function shouldPruneRuntimeFile(fileName) {
    if (PRUNABLE_RUNTIME_FILE_NAMES.has(fileName)) {
      return true;
    }

    if (
      PRUNABLE_MARKDOWN_FILE_NAME_PATTERN.test(fileName) &&
      !LICENSE_FILE_NAME_PATTERN.test(fileName)
    ) {
      return true;
    }

    return PRUNABLE_RUNTIME_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
  }

  function removePath(targetPath, stats) {
    if (!existsSync(targetPath)) {
      return;
    }

    const targetStats = statSync(targetPath);
    if (targetStats.isDirectory()) {
      const measured = measureDirectory(targetPath);
      rmSync(targetPath, { force: true, recursive: true });
      stats.bytes += measured.bytes;
      stats.files += measured.files;
      stats.directories += 1;
      return;
    }

    rmSync(targetPath, { force: true });
    stats.bytes += targetStats.size;
    stats.files += 1;
  }

  function measureDirectory(root) {
    let bytes = 0;
    let files = 0;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const entryPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        const child = measureDirectory(entryPath);
        bytes += child.bytes;
        files += child.files;
        continue;
      }

      bytes += statSync(entryPath).size;
      files += 1;
    }

    return { bytes, files };
  }

  function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  console.log(`[build-t3-embed] Bundled ${displayName} from ${embedRoot}.`);
}
