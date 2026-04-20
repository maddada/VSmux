import { readFile } from "node:fs/promises";
import * as path from "node:path";
import type { SidebarProjectHeader, SidebarProjectWorktree } from "../shared/session-grid-contract";
import { resolveSidebarProjectWorktrees } from "./sidebar-project-worktrees";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const FAVICON_CANDIDATES = [
  "favicon.svg",
  "favicon.ico",
  "favicon.png",
  "icon.svg",
  "icon.png",
  "icon.ico",
  "logo.svg",
  "logo.png",
  "apple-touch-icon.png",
  "icons/icon.svg",
  "icons/icon.png",
  "icons/icon.ico",
  "media/icon.svg",
  "media/icon.png",
  "media/icon.ico",
  "media/icon1.svg",
  "media/icon1.png",
  "media/icon1.ico",
  "public/icons/icon.svg",
  "public/icons/icon.png",
  "public/icons/icon.ico",
  "public/icon.svg",
  "public/icon.png",
  "public/icon.ico",
  "public/logo.svg",
  "public/logo.png",
  "public/apple-touch-icon.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/favicon.png",
  "extension/public/icon.svg",
  "extension/public/icon.png",
  "extension/public/icon.ico",
  "extension/public/icons/icon.svg",
  "extension/public/icons/icon.png",
  "extension/public/icons/icon.ico",
  "apps/extension/public/icon.svg",
  "apps/extension/public/icon.png",
  "apps/extension/public/icon.ico",
  "apps/extension/public/icons/icon.svg",
  "apps/extension/public/icons/icon.png",
  "apps/extension/public/icons/icon.ico",
  "apps/web/public/icon.svg",
  "apps/web/public/icon.png",
  "apps/web/public/icon.ico",
  "apps/web/public/logo.svg",
  "apps/web/public/logo.png",
  "apps/web/public/apple-touch-icon.png",
  "apps/www/public/icon.svg",
  "apps/www/public/icon.png",
  "apps/www/public/icon.ico",
  "apps/www/public/logo.svg",
  "apps/www/public/logo.png",
  "apps/site/public/icon.svg",
  "apps/site/public/icon.png",
  "apps/site/public/icon.ico",
  "apps/site/public/logo.svg",
  "apps/site/public/logo.png",
  "apps/website/public/icon.svg",
  "apps/website/public/icon.png",
  "apps/website/public/icon.ico",
  "apps/website/public/logo.svg",
  "apps/website/public/logo.png",
  "app/favicon.ico",
  "app/favicon.png",
  "app/icon.svg",
  "app/icon.png",
  "app/icon.ico",
  "src/favicon.ico",
  "src/favicon.svg",
  "src/app/favicon.ico",
  "src/app/icon.svg",
  "src/app/icon.png",
  "build/icon.png",
  "build/icon.ico",
  "build/icon.icns",
  "resources/icon.png",
  "resources/icon.ico",
  "resources/icon.icns",
  "src-tauri/icons/icon.png",
  "src-tauri/icons/icon.ico",
  "src-tauri/icons/icon.icns",
  "src-tauri/icons/128x128.png",
  "src-tauri/icons/32x32.png",
  "assets/icon.svg",
  "assets/icon.png",
  "assets/logo.svg",
  "assets/logo.png",
] as const;

const ICON_SOURCE_FILES = [
  "index.html",
  "manifest.json",
  "manifest.webmanifest",
  "site.webmanifest",
  "manifest.template.json",
  "package.json",
  "public/index.html",
  "public/manifest.json",
  "public/manifest.webmanifest",
  "public/site.webmanifest",
  "public/manifest.template.json",
  "extension/package.json",
  "extension/public/manifest.webmanifest",
  "extension/public/site.webmanifest",
  "extension/public/manifest.json",
  "extension/public/manifest.template.json",
  "apps/extension/package.json",
  "apps/extension/public/manifest.webmanifest",
  "apps/extension/public/site.webmanifest",
  "apps/extension/public/manifest.json",
  "apps/extension/public/manifest.template.json",
  "apps/web/package.json",
  "apps/web/public/manifest.json",
  "apps/web/public/manifest.webmanifest",
  "apps/web/public/site.webmanifest",
  "apps/www/package.json",
  "apps/www/public/manifest.json",
  "apps/www/public/manifest.webmanifest",
  "apps/www/public/site.webmanifest",
  "apps/site/package.json",
  "apps/site/public/manifest.json",
  "apps/site/public/manifest.webmanifest",
  "apps/site/public/site.webmanifest",
  "apps/website/package.json",
  "apps/website/public/manifest.json",
  "apps/website/public/manifest.webmanifest",
  "apps/website/public/site.webmanifest",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "app/root.tsx",
  "src/root.tsx",
  "src/index.html",
] as const;

const LINK_ICON_HTML_RE =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon)["'])(?=[^>]*\bhref=["']([^"'?]+))[^>]*>/i;
const LINK_ICON_OBJ_RE =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'?]+))[^}]*/i;

export async function resolveSidebarProjectHeader(input: {
  worktrees?: SidebarProjectWorktree[];
  workspaceName?: string;
  workspaceRoot: string;
}): Promise<SidebarProjectHeader> {
  const workspaceRoot = input.workspaceRoot.trim();
  const worktrees = input.worktrees ?? (await resolveSidebarProjectWorktrees(workspaceRoot));

  return {
    directory: workspaceRoot,
    faviconDataUrl: await resolveProjectFaviconDataUrl(workspaceRoot),
    name: resolveProjectName(workspaceRoot, input.workspaceName),
    ...(worktrees.length > 0 ? { worktrees } : {}),
  };
}

function resolveProjectName(workspaceRoot: string, workspaceName?: string): string {
  const normalizedWorkspaceName = workspaceName?.trim();
  if (normalizedWorkspaceName) {
    return normalizedWorkspaceName;
  }

  const basename = path.basename(workspaceRoot).trim();
  return basename || workspaceRoot;
}

async function resolveProjectFaviconDataUrl(workspaceRoot: string): Promise<string | undefined> {
  const faviconPath = await resolveProjectFaviconPath(workspaceRoot);
  if (!faviconPath) {
    return undefined;
  }

  const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(faviconPath).toLowerCase()];
  if (!contentType) {
    return undefined;
  }

  try {
    const fileContents = await readFile(faviconPath);
    return `data:${contentType};base64,${fileContents.toString("base64")}`;
  } catch {
    return undefined;
  }
}

async function resolveProjectFaviconPath(workspaceRoot: string): Promise<string | undefined> {
  for (const candidate of FAVICON_CANDIDATES) {
    const resolvedCandidate = path.join(workspaceRoot, candidate);
    if (await isExistingProjectFile(workspaceRoot, resolvedCandidate)) {
      return resolvedCandidate;
    }
  }

  for (const sourceFile of ICON_SOURCE_FILES) {
    const sourcePath = path.join(workspaceRoot, sourceFile);
    let sourceContents: string;

    try {
      sourceContents = await readFile(sourcePath, "utf8");
    } catch {
      continue;
    }

    if (isManifestFile(sourceFile)) {
      for (const manifestIconPath of extractManifestIconCandidates(sourcePath, sourceContents)) {
        if (await isExistingProjectFile(workspaceRoot, manifestIconPath)) {
          return manifestIconPath;
        }
      }
    }

    if (isPackageJsonFile(sourceFile)) {
      for (const packageIconPath of extractPackageJsonIconCandidates(sourcePath, sourceContents)) {
        if (await isExistingProjectFile(workspaceRoot, packageIconPath)) {
          return packageIconPath;
        }
      }
    }

    const iconHref = extractIconHref(sourceContents);
    if (!iconHref) {
      continue;
    }

    for (const resolvedHrefCandidate of resolveIconHrefCandidates(workspaceRoot, iconHref)) {
      if (await isExistingProjectFile(workspaceRoot, resolvedHrefCandidate)) {
        return resolvedHrefCandidate;
      }
    }
  }

  return undefined;
}

function isManifestFile(sourceFile: string): boolean {
  const basename = path.basename(sourceFile).toLowerCase();
  return (
    basename.startsWith("manifest.") ||
    basename === "site.webmanifest" ||
    basename === "manifest.webmanifest"
  );
}

function isPackageJsonFile(sourceFile: string): boolean {
  return path.basename(sourceFile).toLowerCase() === "package.json";
}

function extractIconHref(source: string): string | undefined {
  const htmlMatch = source.match(LINK_ICON_HTML_RE);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  const objectMatch = source.match(LINK_ICON_OBJ_RE);
  return objectMatch?.[1];
}

function extractManifestIconCandidates(manifestPath: string, source: string): string[] {
  let manifest: unknown;

  try {
    manifest = JSON.parse(source);
  } catch {
    return [];
  }

  if (!isObjectRecord(manifest)) {
    return [];
  }

  const candidates = [
    ...extractManifestIconsField(manifest.icons),
    ...extractManifestIconsField(extractNestedManifestValue(manifest.action, "default_icon")),
    ...extractManifestIconsField(
      extractNestedManifestValue(manifest.browser_action, "default_icon"),
    ),
    ...extractManifestIconsField(extractNestedManifestValue(manifest.page_action, "default_icon")),
  ];

  const manifestDirectory = path.dirname(manifestPath);
  const dedupedCandidates = [...new Set(candidates)]
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .filter((candidate) => !candidate.startsWith("http://") && !candidate.startsWith("https://"))
    .map((candidate) => path.resolve(manifestDirectory, candidate));

  dedupedCandidates.sort(compareManifestIconCandidates);
  return dedupedCandidates;
}

function extractPackageJsonIconCandidates(packageJsonPath: string, source: string): string[] {
  let packageJson: unknown;

  try {
    packageJson = JSON.parse(source);
  } catch {
    return [];
  }

  if (!isObjectRecord(packageJson) || typeof packageJson.icon !== "string") {
    return [];
  }

  const iconValue = packageJson.icon.trim();
  if (
    iconValue.length === 0 ||
    iconValue.startsWith("http://") ||
    iconValue.startsWith("https://") ||
    iconValue.startsWith("data:")
  ) {
    return [];
  }

  return [path.resolve(path.dirname(packageJsonPath), iconValue)];
}

function extractNestedManifestValue(input: unknown, key: string): unknown {
  if (!isObjectRecord(input) || !(key in input)) {
    return undefined;
  }

  return input[key];
}

function extractManifestIconsField(input: unknown): string[] {
  if (typeof input === "string") {
    return [input];
  }

  if (Array.isArray(input)) {
    return input.flatMap((entry) => {
      if (typeof entry === "string") {
        return [entry];
      }

      if (isObjectRecord(entry) && typeof entry.src === "string") {
        return [entry.src];
      }

      return [];
    });
  }

  if (!isObjectRecord(input)) {
    return [];
  }

  return Object.values(input).flatMap((value) => (typeof value === "string" ? [value] : []));
}

function compareManifestIconCandidates(left: string, right: string): number {
  return getManifestIconCandidateScore(right) - getManifestIconCandidateScore(left);
}

function getManifestIconCandidateScore(candidatePath: string): number {
  const normalizedBasename = path.basename(candidatePath).toLowerCase();
  const extension = path.extname(normalizedBasename);
  const sizeMatch = normalizedBasename.match(/(\d{2,4})/g);
  const maxSize = sizeMatch ? Math.max(...sizeMatch.map((value) => Number.parseInt(value, 10))) : 0;

  const extensionScore =
    extension === ".svg" ? 10_000 : extension === ".png" ? 5_000 : extension === ".ico" ? 2_500 : 0;

  return extensionScore + maxSize;
}

function resolveIconHrefCandidates(workspaceRoot: string, href: string): string[] {
  const normalizedHref = href.trim();
  if (
    normalizedHref.length === 0 ||
    normalizedHref.startsWith("http://") ||
    normalizedHref.startsWith("https://") ||
    normalizedHref.startsWith("data:")
  ) {
    return [];
  }

  const cleanedHref = normalizedHref.replace(/^\//, "");
  return [path.join(workspaceRoot, "public", cleanedHref), path.join(workspaceRoot, cleanedHref)];
}

async function isExistingProjectFile(
  workspaceRoot: string,
  candidatePath: string,
): Promise<boolean> {
  if (!isPathWithinProject(workspaceRoot, candidatePath)) {
    return false;
  }

  try {
    const fileContents = await readFile(candidatePath);
    return fileContents.length > 0;
  } catch {
    return false;
  }
}

function isPathWithinProject(workspaceRoot: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(workspaceRoot), path.resolve(candidatePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
