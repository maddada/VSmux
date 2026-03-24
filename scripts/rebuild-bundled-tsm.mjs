import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sourceDir = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!sourceDir) {
  console.error("Usage: node scripts/rebuild-bundled-tsm.mjs /path/to/tsm");
  process.exit(1);
}

const targets = [
  { goarch: "arm64", goos: "darwin", id: "darwin-arm64" },
  { goarch: "amd64", goos: "darwin", id: "darwin-x64" },
  { goarch: "arm64", goos: "linux", id: "linux-arm64" },
  { goarch: "amd64", goos: "linux", id: "linux-x64" },
];

const vendorRoot = resolve("extension/vendor/tsm");
await mkdir(vendorRoot, { recursive: true });

for (const target of targets) {
  const outputDir = join(vendorRoot, target.id);
  const outputPath = join(outputDir, "tsm");
  await mkdir(outputDir, { recursive: true });

  const result = spawnSync("go", ["build", "-o", outputPath, "."], {
    cwd: sourceDir,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOARCH: target.goarch,
      GOOS: target.goos,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await copyFile(join(sourceDir, "LICENSE"), join(vendorRoot, "LICENSE"));

const commitResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDir,
  encoding: "utf8",
});
const commit =
  commitResult.status === 0 ? commitResult.stdout.trim() : "unknown";
const notice = [
  "# Bundled tsm",
  "",
  "These binaries are built from the upstream `adibhanna/tsm` repository.",
  "",
  `Source: ${basename(sourceDir)}`,
  `Commit: ${commit}`,
  "",
  "Rebuild with:",
  `node ./scripts/rebuild-bundled-tsm.mjs ${sourceDir}`,
  "",
].join("\n");
await writeFile(join(vendorRoot, "NOTICE.md"), notice, "utf8");
