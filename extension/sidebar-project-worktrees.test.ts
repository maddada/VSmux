import { describe, expect, test, vi } from "vite-plus/test";
import { parseGitWorktreeList, resolveSidebarProjectWorktrees } from "./sidebar-project-worktrees";

const runGitStdout = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());

vi.mock("./git/process", () => ({
  runGitStdout,
}));

describe("parseGitWorktreeList", () => {
  test("should parse worktree directories and branches from porcelain output", () => {
    expect(
      parseGitWorktreeList(
        [
          "worktree /workspace/agent-tiler",
          "HEAD 1111111",
          "branch refs/heads/main",
          "",
          "worktree /workspace/agent-tiler-feature",
          "HEAD 2222222",
          "branch refs/heads/feature/sidebar",
          "",
          "worktree /workspace/agent-tiler-detached",
          "HEAD 3333333",
          "detached",
          "",
        ].join("\n"),
      ),
    ).toEqual([
      {
        branch: "main",
        directory: "/workspace/agent-tiler",
      },
      {
        branch: "feature/sidebar",
        directory: "/workspace/agent-tiler-feature",
      },
      {
        directory: "/workspace/agent-tiler-detached",
      },
    ]);
  });
});

describe("resolveSidebarProjectWorktrees", () => {
  test("should return alternate worktrees for the current repo", async () => {
    runGitStdout.mockImplementation(async (_cwd, args) => {
      if (Array.isArray(args) && args[0] === "rev-parse") {
        return "/workspace/agent-tiler\n";
      }

      return [
        "worktree /workspace/agent-tiler",
        "HEAD 1111111",
        "branch refs/heads/main",
        "",
        "worktree /workspace/agent-tiler-feature",
        "HEAD 2222222",
        "branch refs/heads/feature/sidebar",
        "",
        "worktree /workspace/agent-tiler-bugfix",
        "HEAD 3333333",
        "branch refs/heads/bugfix/run-on-worktree",
        "",
      ].join("\n");
    });

    await expect(resolveSidebarProjectWorktrees("/workspace/agent-tiler")).resolves.toEqual([
      {
        branch: "bugfix/run-on-worktree",
        directory: "/workspace/agent-tiler-bugfix",
        name: "agent-tiler-bugfix",
      },
      {
        branch: "feature/sidebar",
        directory: "/workspace/agent-tiler-feature",
        name: "agent-tiler-feature",
      },
    ]);
  });

  test("should return an empty list when the workspace is not part of a git worktree", async () => {
    runGitStdout.mockRejectedValue(new Error("not a git repository"));

    await expect(resolveSidebarProjectWorktrees("/workspace/agent-tiler")).resolves.toEqual([]);
  });
});
