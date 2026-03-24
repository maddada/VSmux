import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile, copyFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const version = process.argv[2] ?? "v0.44.0";
const repo = "zellij-org/zellij";
const vendorRoot = resolve("extension/vendor/zellij");

const assets = [
  {
    archiveName: "zellij-no-web-aarch64-apple-darwin.tar.gz",
    binaryName: "zellij",
    target: "darwin-arm64",
  },
  {
    archiveName: "zellij-no-web-x86_64-apple-darwin.tar.gz",
    binaryName: "zellij",
    target: "darwin-x64",
  },
  {
    archiveName: "zellij-no-web-aarch64-unknown-linux-musl.tar.gz",
    binaryName: "zellij",
    target: "linux-arm64",
  },
  {
    archiveName: "zellij-no-web-x86_64-unknown-linux-musl.tar.gz",
    binaryName: "zellij",
    target: "linux-x64",
  },
  {
    archiveName: "zellij-no-web-x86_64-pc-windows-msvc.zip",
    binaryName: "zellij.exe",
    target: "win32-x64",
  },
];

const release = await fetchJson(`https://api.github.com/repos/${repo}/releases/tags/${version}`);
const releaseAssets = new Map(release.assets.map((asset) => [asset.name, asset.browser_download_url]));
const workspace = await mkdtemp(join(tmpdir(), "vsmux-zellij-"));

await rm(vendorRoot, { force: true, recursive: true });
await mkdir(vendorRoot, { recursive: true });

for (const asset of assets) {
  const archiveUrl = releaseAssets.get(asset.archiveName);
  const checksumUrl = releaseAssets.get(`${asset.archiveName.replace(/(\.tar\.gz|\.zip)$/u, "")}.sha256sum`);
  if (!archiveUrl || !checksumUrl) {
    throw new Error(`Missing release asset for ${asset.archiveName} in ${version}.`);
  }

  const archivePath = join(workspace, asset.archiveName);
  const checksumPath = join(workspace, basename(checksumUrl));
  await downloadFile(archiveUrl, archivePath);
  await downloadFile(checksumUrl, checksumPath);

  const extractDir = join(workspace, asset.target);
  await mkdir(extractDir, { recursive: true });
  extractArchive(archivePath, extractDir);

  const sourceBinaryPath = join(extractDir, asset.binaryName);
  await verifyChecksum(sourceBinaryPath, checksumPath);
  const targetDir = join(vendorRoot, asset.target);
  const targetBinaryPath = join(targetDir, asset.binaryName);
  await mkdir(targetDir, { recursive: true });
  await copyFile(sourceBinaryPath, targetBinaryPath);
  if (!asset.binaryName.endsWith(".exe")) {
    await chmod(targetBinaryPath, 0o755);
  }
}

const licenseUrl = `https://raw.githubusercontent.com/${repo}/${version}/LICENSE.md`;
await downloadFile(licenseUrl, join(vendorRoot, "LICENSE.md"));

const notice = [
  "# Bundled zellij",
  "",
  "These binaries are downloaded from the official `zellij-org/zellij` release assets.",
  "",
  `Release: ${version}`,
  "Assets:",
  ...assets.map((asset) => `- ${asset.target}: ${asset.archiveName}`),
  "",
  "Rebuild with:",
  `node ./scripts/rebuild-bundled-zellij.mjs ${version}`,
  "",
].join("\n");
await writeFile(join(vendorRoot, "NOTICE.md"), notice, "utf8");

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "VSmux bundler",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "VSmux bundler",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(arrayBuffer));
}

function extractArchive(archivePath, outputDir) {
  const command =
    archivePath.endsWith(".zip") ?
      ["unzip", ["-q", archivePath, "-d", outputDir]]
    : ["tar", ["-xzf", archivePath, "-C", outputDir]];
  const [binary, args] = command;
  const result = spawnSync(binary, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${archivePath} with ${binary}.`);
  }
}

async function verifyChecksum(archivePath, checksumPath) {
  const expectedChecksum = (await readFile(checksumPath, "utf8")).trim().split(/\s+/u)[0];
  const archiveContents = await readFile(archivePath);
  const actualChecksum = createHash("sha256").update(archiveContents).digest("hex");
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Checksum mismatch for ${basename(archivePath)}.`);
  }
}
