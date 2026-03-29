import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getSidebarGitDisabledReason, type SidebarGitAction } from "../../shared/sidebar-git";
import type { SidebarAgentButton } from "../../shared/sidebar-agents";
import { generateCommitMessage, generatePrContent } from "./text-generation";
import {
  getGitStatusDetails,
  loadSidebarGitState,
  resolveDefaultBranchName,
  type GitStatusDetails,
} from "./status";
import { buildCommandLine, runGitCommand, runGitStdout, runShellCommand } from "./process";

const COMMIT_TIMEOUT_MS = 180_000;
const GITHUB_CLI_TIMEOUT_MS = 60_000;

type RunnableSidebarAgentButton = SidebarAgentButton & {
  command: string;
};

export type RunSidebarGitActionInput = {
  action: SidebarGitAction;
  agent: RunnableSidebarAgentButton;
  cwd: string;
  onProgress?: (message: string) => void;
};

export type RunSidebarGitActionResult = {
  message: string;
  prUrl?: string;
};

export async function runSidebarGitActionWorkflow(
  input: RunSidebarGitActionInput,
): Promise<RunSidebarGitActionResult> {
  let status = await getGitStatusDetails(input.cwd);
  const sidebarState = await loadSidebarGitState(input.cwd, input.action, false);
  const disabledReason = getSidebarGitDisabledReason(sidebarState, input.action);
  if (disabledReason) {
    throw new Error(disabledReason);
  }

  if (input.action === "commit") {
    const commitResult = await commitWorkingTree(input.cwd, status, input.agent, input.onProgress);
    return {
      message: `Committed ${shortenSha(commitResult.commitSha)}: ${commitResult.subject}`,
    };
  }

  let latestCommit: { commitSha: string; subject: string } | undefined;
  if (status.hasWorkingTreeChanges) {
    latestCommit = await commitWorkingTree(input.cwd, status, input.agent, input.onProgress);
    status = await getGitStatusDetails(input.cwd);
  }

  if (input.action === "push") {
    input.onProgress?.("Pushing...");
    const pushResult = await pushCurrentBranch(input.cwd, status);
    const summaryPrefix = latestCommit
      ? `Committed ${shortenSha(latestCommit.commitSha)} and pushed`
      : "Pushed";
    const branchLabel = pushResult.upstreamBranch ?? pushResult.branch;
    return {
      message: `${summaryPrefix}${branchLabel ? ` to ${branchLabel}` : ""}.`,
    };
  }

  if (!status.hasGitHubCli) {
    throw new Error("Install GitHub CLI to create or view pull requests.");
  }

  if (!status.pr?.url) {
    input.onProgress?.("Checking pull request state...");
  }

  if (!status.hasUpstream || status.aheadCount > 0) {
    input.onProgress?.("Pushing...");
    await pushCurrentBranch(input.cwd, status);
    status = await getGitStatusDetails(input.cwd);
  }

  if (status.pr?.state === "open" && status.pr.url) {
    return {
      message: status.pr.number ? `Opened PR #${status.pr.number}.` : "Opened pull request.",
      prUrl: status.pr.url,
    };
  }

  const createdPr = await createPullRequest(input.cwd, status, input.agent, input.onProgress);
  return {
    message: createdPr.number ? `Created PR #${createdPr.number}.` : "Created pull request.",
    prUrl: createdPr.url,
  };
}

async function commitWorkingTree(
  cwd: string,
  status: GitStatusDetails,
  agent: RunnableSidebarAgentButton,
  onProgress?: (message: string) => void,
): Promise<{ commitSha: string; subject: string }> {
  onProgress?.("Staging changes...");
  const commitContext = await prepareCommitContext(cwd);
  if (!commitContext) {
    throw new Error("No working tree changes to commit.");
  }

  onProgress?.("Generating commit message...");
  const generated = await generateCommitMessage({
    agent,
    branch: status.branch,
    cwd,
    stagedPatch: commitContext.stagedPatch,
    stagedSummary: commitContext.stagedSummary,
  });

  onProgress?.("Committing...");
  const commitSha = await commitChanges(cwd, generated.subject, generated.body);
  return {
    commitSha,
    subject: generated.subject,
  };
}

async function createPullRequest(
  cwd: string,
  status: GitStatusDetails,
  agent: RunnableSidebarAgentButton,
  onProgress?: (message: string) => void,
): Promise<{ number?: number; url: string }> {
  if (!status.branch) {
    throw new Error("Create and checkout a branch before creating a PR.");
  }

  const baseBranch = status.defaultBranch ?? (await resolveDefaultBranchName(cwd, status.hasOriginRemote));
  if (!baseBranch) {
    throw new Error("Unable to determine a base branch for the pull request.");
  }

  const [commitSummary, diffSummary, diffPatch] = await Promise.all([
    runGitStdout(cwd, ["log", "--oneline", `${baseBranch}..HEAD`]).catch(() => ""),
    runGitStdout(cwd, ["diff", "--stat", `${baseBranch}...HEAD`]).catch(() => ""),
    runGitStdout(cwd, ["diff", "--patch", "--minimal", `${baseBranch}...HEAD`]).catch(() => ""),
  ]);

  onProgress?.("Generating PR content...");
  const generated = await generatePrContent({
    agent,
    baseBranch,
    commitSummary,
    cwd,
    diffPatch,
    diffSummary,
    headBranch: status.branch,
  });

  onProgress?.("Creating PR...");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-git-pr-"));
  const bodyPath = path.join(tempDir, "body.md");

  try {
    await writeFile(bodyPath, generated.body, "utf8");
    const createResult = await runShellCommand(
      buildCommandLine("gh", [
        "pr",
        "create",
        "--base",
        baseBranch,
        "--head",
        status.branch,
        "--title",
        generated.title,
        "--body-file",
        bodyPath,
      ]),
      {
        cwd,
        timeoutMs: GITHUB_CLI_TIMEOUT_MS,
      },
    );
    if (createResult.exitCode !== 0) {
      throw new Error(
        createResult.stderr.trim() || createResult.stdout.trim() || "Failed to create pull request.",
      );
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }

  const openPr = await findCurrentPullRequest(cwd);
  if (!openPr?.url) {
    throw new Error("Pull request was created but could not be resolved.");
  }

  return openPr;
}

async function prepareCommitContext(
  cwd: string,
): Promise<{ stagedPatch: string; stagedSummary: string } | null> {
  await runGitCommand(cwd, ["add", "-A"]);
  const stagedSummary = (await runGitStdout(cwd, ["diff", "--cached", "--name-status"])).trim();
  if (!stagedSummary) {
    return null;
  }

  const stagedPatch = await runGitStdout(cwd, ["diff", "--cached", "--patch", "--minimal"]);
  return {
    stagedPatch,
    stagedSummary,
  };
}

async function commitChanges(cwd: string, subject: string, body: string): Promise<string> {
  const args = ["commit", "-m", subject];
  const trimmedBody = body.trim();
  if (trimmedBody) {
    args.push("-m", trimmedBody);
  }
  await runGitCommand(cwd, args, COMMIT_TIMEOUT_MS);
  return (await runGitStdout(cwd, ["rev-parse", "HEAD"])).trim();
}

async function pushCurrentBranch(
  cwd: string,
  status: GitStatusDetails,
): Promise<{ branch: string; upstreamBranch?: string }> {
  const branch = status.branch;
  if (!branch) {
    throw new Error("Create and checkout a branch before pushing.");
  }

  if (!status.hasUpstream) {
    const remoteName = status.hasOriginRemote ? "origin" : await resolveFirstRemoteName(cwd);
    if (!remoteName) {
      throw new Error('Add an "origin" remote before pushing.');
    }
    await runGitCommand(cwd, ["push", "-u", remoteName, branch], GITHUB_CLI_TIMEOUT_MS);
    return {
      branch,
      upstreamBranch: `${remoteName}/${branch}`,
    };
  }

  if (status.aheadCount === 0) {
    return {
      branch,
      upstreamBranch: status.upstreamRef ?? undefined,
    };
  }

  await runGitCommand(cwd, ["push"], GITHUB_CLI_TIMEOUT_MS);
  return {
    branch,
    upstreamBranch: status.upstreamRef ?? undefined,
  };
}

async function findCurrentPullRequest(cwd: string): Promise<{ number?: number; url: string } | null> {
  const result = await runShellCommand(
    buildCommandLine("gh", ["pr", "view", "--json", "number,url"]),
    {
      cwd,
      timeoutMs: 15_000,
    },
  );
  if (result.exitCode !== 0) {
    return null;
  }

  const parsed = JSON.parse(result.stdout) as { number?: number; url?: string };
  return parsed.url ? { number: parsed.number, url: parsed.url } : null;
}

async function resolveFirstRemoteName(cwd: string): Promise<string | null> {
  const stdout = await runGitStdout(cwd, ["remote"]).catch(() => "");
  const [firstRemote] = stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return firstRemote ?? null;
}

function shortenSha(value: string): string {
  return value.slice(0, 7);
}
