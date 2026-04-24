import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipBuild = args.includes("--skip-build");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const extensionId = `${packageJson.publisher}.${packageJson.name}`.toLowerCase();
const extensionDirectoryName = `${extensionId}-${packageJson.version}`;
const packageEntries = ["package.json", "README.md:readme.md", ...(packageJson.files ?? [])];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function log(message) {
  console.log(`[install:dev] ${message}`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveInstallRoot() {
  const explicitDirectory = process.env.VSMUX_DEV_EXTENSION_DIR?.trim();
  if (explicitDirectory) {
    return resolve(explicitDirectory);
  }

  const explicitExtensionsDirectory = process.env.VSMUX_EXTENSIONS_DIR?.trim();
  if (explicitExtensionsDirectory) {
    return resolve(explicitExtensionsDirectory, extensionDirectoryName);
  }

  const existingInstallRoot = findExistingInstallRoot();
  if (existingInstallRoot) {
    return existingInstallRoot;
  }

  return join(defaultExtensionsDirectory(), extensionDirectoryName);
}

function findExistingInstallRoot() {
  for (const extensionsDirectory of candidateExtensionsDirectories()) {
    const candidate = join(extensionsDirectory, extensionDirectoryName);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function candidateExtensionsDirectories() {
  const home = homedir();
  return [
    join(home, ".vscode", "extensions"),
    join(home, ".cursor", "extensions"),
    join(home, ".vscode-insiders", "extensions"),
    join(home, ".vscodium", "extensions"),
    join(home, ".windsurf", "extensions"),
  ];
}

function defaultExtensionsDirectory() {
  const override = process.env.VSMUX_CODE_CLI?.trim().toLowerCase() ?? "";
  const home = homedir();

  if (override.includes("cursor")) {
    return join(home, ".cursor", "extensions");
  }

  if (override.includes("insiders")) {
    return join(home, ".vscode-insiders", "extensions");
  }

  if (override.includes("codium")) {
    return join(home, ".vscodium", "extensions");
  }

  if (override.includes("windsurf")) {
    return join(home, ".windsurf", "extensions");
  }

  return join(home, ".vscode", "extensions");
}

function cleanPackageOwnedPaths(installRoot) {
  const ownedTopLevelNames = new Set(
    packageEntries.map((entry) => entry.split(":").at(-1).split("/")[0]),
  );

  for (const topLevelName of ownedTopLevelNames) {
    removePath(join(installRoot, topLevelName));
  }
}

function installPackageEntries(installRoot) {
  for (const entry of packageEntries) {
    const [sourcePattern, destinationPattern = sourcePattern] = entry.split(":");
    copyPackageEntry(sourcePattern, destinationPattern, installRoot);
  }
}

function copyPackageEntry(sourcePattern, destinationPattern, installRoot) {
  if (sourcePattern.endsWith("/**")) {
    const sourceRoot = sourcePattern.slice(0, -3);
    const destinationRoot = destinationPattern.slice(0, -3);
    copyPath(join(repoRoot, sourceRoot), join(installRoot, destinationRoot));
    return;
  }

  const recursiveMatch = sourcePattern.match(/^(.*)\/\*\*\/\*([^/]*)$/u);
  if (recursiveMatch) {
    const [, sourceRoot, suffix] = recursiveMatch;
    const destinationRoot = destinationPattern.match(/^(.*)\/\*\*\/\*[^/]*$/u)?.[1] ?? sourceRoot;
    for (const filePath of collectFiles(join(repoRoot, sourceRoot))) {
      if (!filePath.endsWith(suffix)) {
        continue;
      }

      const relativePath = filePath.slice(join(repoRoot, sourceRoot).length + 1);
      copyPath(filePath, join(installRoot, destinationRoot, relativePath));
    }
    return;
  }

  copyPath(join(repoRoot, sourcePattern), join(installRoot, destinationPattern));
}

function collectFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const stats = statSync(root);
  if (stats.isFile()) {
    return [root];
  }

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function removePath(targetPath) {
  if (dryRun) {
    log(`would remove ${targetPath}`);
    return;
  }

  rmSync(targetPath, { force: true, recursive: true });
}

function copyPath(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) {
    fail(`Missing build artifact: ${sourcePath}`);
  }

  if (dryRun) {
    log(`would copy ${sourcePath} -> ${destinationPath}`);
    return;
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, {
    dereference: true,
    force: true,
    recursive: true,
  });
}

function writeDevInstallMarker(installRoot) {
  if (dryRun) {
    log(`would write ${join(installRoot, ".vsmux-dev-install.json")}`);
    return;
  }

  writeFileSync(
    join(installRoot, ".vsmux-dev-install.json"),
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        source: repoRoot,
        version: packageJson.version,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

if (!skipBuild) {
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "build:extension"]);
}

const installRoot = resolveInstallRoot();
log(`${dryRun ? "Dry run for" : "Installing to"} ${installRoot}`);

if (!dryRun) {
  mkdirSync(installRoot, { recursive: true });
}

cleanPackageOwnedPaths(installRoot);
installPackageEntries(installRoot);
writeDevInstallMarker(installRoot);
log("Done. Reload the editor window to use the copied build.");
