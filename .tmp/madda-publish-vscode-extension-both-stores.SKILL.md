---
name: madda-publish-vscode-extension-both-stores
description: Explain or carry out publishing a VS Code extension to both the Visual Studio Marketplace and Open VSX. Use whenever the user asks how to publish a VS Code extension, release to both stores, set up `vsce` or `ovsx`, create Marketplace or Open VSX publisher credentials, or troubleshoot dual-store publishing problems.
license: MIT
metadata:
  author: madda
  version: "1.1"
---

# Publish A VS Code Extension To Both Stores

Help the user publish a VS Code extension to both distribution channels:

- Visual Studio Marketplace
- Open VSX

Use this skill for four kinds of requests:

1. Explain-only: the user wants the process, not the release executed.
2. Setup: the user needs publishers, namespaces, tokens, or CI secrets configured.
3. Publish-now: the user wants the extension actually released from the current repo.
4. Troubleshooting: one or both stores rejected the release.

Treat dashboard-only work as user-driven unless you are explicitly using a browser tool to walk them through it. Do not imply you clicked store UI buttons if you did not.

## Preferred Execution Order

Use this order by default:

1. Primary method: CLI-first release using the repo's package / publish helpers plus interactive tokens.
2. Secondary method: Chrome DevTools MCP against the user's already-authenticated browser when token creation, manual upload, or browser-only store work is required.

Do not default to a separate headless browser, Playwright, or a fresh browser profile when the Chrome DevTools MCP bridge can use the user's real session.

## Chrome DevTools MCP As Secondary Path

When browser work is needed, prefer the user's already-open authenticated Chrome session through the DevTools MCP bridge.

Use this model:

1. Attach to the user's real Chrome session through the Chrome DevTools MCP bridge.
2. Enumerate the user's currently open tabs.
3. Select the relevant store tab or navigate within that same authenticated browser context.
4. Perform only the browser-only part of the release flow there, then return to the CLI path for publishing whenever possible.

If the environment exposes the Chrome DevTools MCP tools, use the live-session flow the user described:

- `mcp__chrome_devtools__list_pages` to enumerate open tabs
- `mcp__chrome_devtools__select_page` to attach to the relevant tab
- other `mcp__chrome_devtools__*` calls to inspect, click, and upload within that same live browser

Be explicit that this means:

- you are using the user's already-open browser context
- you are not using a fake session
- you are not using a separate headless browser
- you are not relying on stored passwords outside the browser session

## Source Of Truth

- VS Code official publishing docs: `https://code.visualstudio.com/api/working-with-extensions/publishing-extension`
- Open VSX official publishing docs: `https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions`

If the user asks for the latest or current process, verify against those sources before answering. Store policies and publish flows change.

## First Step: Inspect The Repo

Before giving repo-specific guidance or publishing:

1. Read `package.json`.
2. Collect:
   - `name`
   - `displayName`
   - `publisher`
   - `version`
   - `engines.vscode`
   - `scripts.vscode:prepublish`
   - any custom packaging scripts such as `vsix:package`, `build`, `compile`, or release scripts
3. Check whether the repo already has a preferred `.vsix` packaging helper. If it does, prefer that over inventing a new package command.
4. Check that `README`, `LICENSE`, and ideally `CHANGELOG` exist, because Marketplace metadata depends on them.

If `package.json.publisher` does not match the intended Marketplace publisher or Open VSX namespace, stop and explain the mismatch before continuing.

## Explain-Only Response Shape

When the user only wants to know how publishing works, explain it in this order:

1. Make sure extension metadata and version are ready.
2. Build and package the extension.
3. Publish to Visual Studio Marketplace.
4. Publish the same version to Open VSX.
5. Verify both listings.

Keep the explanation concise. Prefer a compact checklist plus the exact commands the repo would use.

## One-Time Setup

### Visual Studio Marketplace

The Marketplace side uses `vsce`.

The user needs:

- an Azure DevOps Personal Access Token with Marketplace `Publish` and `Manage` scope
- a Marketplace publisher whose identifier matches `package.json.publisher`

Preferred setup flow:

1. If a working PAT is already available, use it.
2. Otherwise create a dedicated PAT interactively.
3. Prefer feeding the PAT to the release command through `VSCE_PAT` or `vsce login <publisher>` without printing it.

Preferred PAT creation flow:

- First try the normal CLI path if the token already exists.
- If the token does not exist and Chrome DevTools MCP access to the user's authenticated browser is available, open Azure DevOps personal access token settings in that live browser session and create a dedicated Marketplace token there.
- Prefer a dedicated token name that reflects the release use case.
- Do not print, commit, or log the token value.

CLI login option:

```bash
vsce login <publisher>
```

Direct env option:

```bash
VSCE_PAT=... pnpm exec vsce publish
```

### Open VSX

The Open VSX side uses `ovsx`.

The user needs:

- an eclipse.org account
- the Open VSX publisher agreement accepted
- an Open VSX access token
- a namespace that matches `package.json.publisher`

The namespace creation is a one-time step per publisher:

```bash
npx ovsx create-namespace <publisher> -p <token>
```

## Preferred Release Strategy

Prefer one of these two release styles and tell the user which one you are using:

### Style A: repo-native CLI release

Use this first when the repo already has release helpers or when the user wants the fastest reliable publish flow.

Typical pattern:

1. Run the repo's preferred package / publish helper.
2. Inject the Marketplace PAT interactively through `VSCE_PAT` or a prior `vsce login`.
3. Publish to Open VSX with `ovsx`.
4. Tag and push the release commit.

This is the default release style.

### Style B: package once, then publish that artifact

Use this when the user wants the exact same `.vsix` artifact shared across stores.

1. Package once with the repo's preferred package command.
2. Publish that `.vsix` to Open VSX:

```bash
npx ovsx publish path/to/extension.vsix -p <token>
```

3. For Visual Studio Marketplace:
   - prefer `vsce publish --packagePath path/to/extension.vsix` if the repo and toolchain support it cleanly
   - otherwise use the repo's CLI publish helper
   - use manual browser upload only as a fallback

If you are explaining the process, mention this tradeoff explicitly. It prevents confusion about whether both stores received identical artifacts.

## Publish-Now Workflow

When the user wants you to actually release:

### 1. Preflight

Check:

- git status is clean enough for release work
- the version in `package.json` is already bumped to the intended release version
- the repo builds successfully
- required credentials are available or can be entered interactively

Do not silently bump the version or create extra release commits unless the user asked for that. If the user asked you to actually publish a release, create and push a Git tag for that release commit.

### 2. Build Or Package

Prefer the repo's existing helper. If none exists, fall back to:

```bash
pnpm exec vsce package
```

If the repo uses npm instead of pnpm, adapt accordingly. If it uses Yarn and Open VSX needs it, remember `ovsx` supports `--yarn`.

### 3. Publish To Visual Studio Marketplace

Preferred approach:

- Use the repo's preferred CLI release helper first.
- Prefer passing the PAT through `VSCE_PAT` or a successful `vsce login`.
- If the PAT does not exist yet, create it interactively first. If browser help is needed for PAT creation, use Chrome DevTools MCP against the user's signed-in browser as the secondary path.

Typical CLI path:

```bash
pnpm exec vsce publish
```

Artifact path when needed:

```bash
pnpm exec vsce publish --packagePath path/to/extension.vsix
```

Browser fallback:

- Use Chrome DevTools MCP against the already-authenticated browser to create the PAT, inspect the publisher UI, or manually upload the `.vsix` only if the CLI path is blocked.

### 4. Publish To Open VSX

Preferred approach:

- Use the CLI path first.
- Use browser automation only if the user's Open VSX release flow is genuinely browser-only.

If publishing from source:

```bash
npx ovsx publish -p <token>
```

If publishing a packaged artifact:

```bash
npx ovsx publish path/to/extension.vsix -p <token>
```

### 5. Verify

Verify:

- the exact version appears in both stores
- the release commit is tagged on GitHub, preferably as `v<version>`
- the listing uses the correct publisher / namespace
- README, icon, and metadata rendered correctly

If you actually published, report:

- extension identifier: `<publisher>.<name>`
- released version
- git tag pushed, for example `v<version>`
- Marketplace URL
- Open VSX URL
- which command path you used

## Git Tagging

Every published release should have a GitHub tag that points to the release commit.

Preferred convention:

```bash
git tag v<version>
git push origin v<version>
```

Rules:

- Tag the commit that corresponds to the published extension version.
- Prefer `v<version>` unless the repo already uses a different release tag convention.
- If the tag already exists, stop and explain the conflict instead of moving it.
- Do not retag a different commit under the same version.
- When reporting a completed release, include the tag name.

## Troubleshooting

### Marketplace problems

- `vsce` asks for authentication every time: the publisher was not logged in successfully; rerun `vsce login <publisher>`.
- `TF400813` or publisher authorization errors: the PAT is wrong, expired, or missing Marketplace `Publish` / `Manage` scope; rotate the token and retry.
- publish rejected because of images or SVGs: check icon, badges, and `README` image URLs.
- publish fails because the version already exists: bump `package.json.version` first.
- publisher mismatch: `package.json.publisher` must match the Marketplace publisher id.
- network / DNS failures such as `ENOTFOUND marketplace.visualstudio.com`: treat that as an environment or sandbox networking problem, not a credential problem.

### Open VSX problems

- namespace does not exist: run `npx ovsx create-namespace <publisher> -p <token>` once.
- namespace ownership / verification confusion: namespace creation and verified ownership are different things.
- token rejected: rotate the token in Open VSX settings and retry.
- version already exists: bump `package.json.version` first.
- build command differences: if the repo uses Yarn, add `--yarn`.

### Cross-store problems

- one store updated and the other did not: state clearly which store succeeded and do not claim a full release.
- artifact drift: if exact parity matters, package once and reuse the `.vsix`.
- repo-specific scripts exist: prefer them; do not replace working release helpers with raw `vsce` commands unless necessary.

## Response Rules

- Be explicit about what is one-time setup versus per-release work.
- Be explicit about what you actually executed versus what the user still needs to do in the browser.
- Prefer the repo's CLI release path first.
- Use Chrome DevTools MCP as the second option for PAT creation, manual upload, verification, or browser-only store work.
- Never print or commit PATs or access tokens.
- Prefer interactive token entry or environment injection over embedding tokens in command lines or files.
- Never claim both stores are live until both are verified.
- Never claim the release is fully complete until the matching Git tag exists on GitHub too.
- Prefer concrete commands over vague advice.
- If the current repo already contains packaging scripts, mention them by name.

## Minimal Example

Use this only when the repo has no custom release helper:

```bash
pnpm exec vsce login <publisher>
pnpm exec vsce publish
npx ovsx create-namespace <publisher> -p <token>
npx ovsx publish -p <token>
```

Explain that `create-namespace` is only needed the first time for a new publisher namespace, and note that browser-based PAT creation is a fallback / setup aid rather than the primary publish path.
