import { describe, expect, test } from "vite-plus/test";
import {
  mergeClaudeHookSettingsContent,
  resolveActiveClaudeSettingsPath,
} from "./claude-hooks-config";

describe("resolveActiveClaudeSettingsPath", () => {
  test("should prefer CLAUDE_CONFIG_DIR when it is set", () => {
    expect(
      resolveActiveClaudeSettingsPath({
        CLAUDE_CONFIG_DIR: "/Users/test/.claude-profiles/work",
      } as NodeJS.ProcessEnv),
    ).toBe("/Users/test/.claude-profiles/work/settings.json");
  });

  test("should fall back to the default Claude home directory", () => {
    expect(
      resolveActiveClaudeSettingsPath({} as NodeJS.ProcessEnv, {
        homeDir: "/Users/test",
      }),
    ).toBe("/Users/test/.claude/settings.json");
  });
});

describe("mergeClaudeHookSettingsContent", () => {
  test("should append the VSmux Claude hooks without removing existing settings", () => {
    const mergedSettings = JSON.parse(
      mergeClaudeHookSettingsContent(
        JSON.stringify(
          {
            autoUpdatesChannel: "latest",
            hooks: {
              Notification: [
                {
                  hooks: [
                    {
                      command: "/Users/test/.claude/hooks/notify-local-tts.sh",
                      type: "command",
                    },
                  ],
                  matcher: "",
                },
              ],
              Stop: [],
            },
          },
          null,
          2,
        ),
        "/tmp/vsmux-notify.sh",
        "linux",
      ),
    ) as {
      autoUpdatesChannel: string;
      hooks: Record<
        string,
        Array<{ hooks: Array<{ command: string; type: string }>; matcher?: string }>
      >;
    };

    expect(mergedSettings.autoUpdatesChannel).toBe("latest");
    expect(mergedSettings.hooks.UserPromptSubmit).toEqual([
      {
        hooks: [
          {
            command: "'/tmp/vsmux-notify.sh'",
            type: "command",
          },
        ],
      },
    ]);
    expect(mergedSettings.hooks.Notification).toEqual([
      {
        hooks: [
          {
            command: "/Users/test/.claude/hooks/notify-local-tts.sh",
            type: "command",
          },
        ],
        matcher: "",
      },
      {
        hooks: [
          {
            command: "'/tmp/vsmux-notify.sh'",
            type: "command",
          },
        ],
        matcher: "permission_prompt|idle_prompt",
      },
    ]);
  });

  test("should avoid duplicating the same VSmux Claude hooks", () => {
    const mergedSettings = JSON.parse(
      mergeClaudeHookSettingsContent(
        JSON.stringify(
          {
            hooks: {
              Notification: [
                {
                  hooks: [
                    {
                      command: "'/tmp/vsmux-notify.sh'",
                      type: "command",
                    },
                  ],
                  matcher: "permission_prompt|idle_prompt",
                },
              ],
              Stop: [
                {
                  hooks: [
                    {
                      command: "'/tmp/vsmux-notify.sh'",
                      type: "command",
                    },
                  ],
                },
              ],
              StopFailure: [
                {
                  hooks: [
                    {
                      command: "'/tmp/vsmux-notify.sh'",
                      type: "command",
                    },
                  ],
                },
              ],
              UserPromptSubmit: [
                {
                  hooks: [
                    {
                      command: "'/tmp/vsmux-notify.sh'",
                      type: "command",
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ),
        "/tmp/vsmux-notify.sh",
        "linux",
      ),
    ) as {
      hooks: Record<
        string,
        Array<{ hooks: Array<{ command: string; type: string }>; matcher?: string }>
      >;
    };

    expect(mergedSettings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(mergedSettings.hooks.Stop).toHaveLength(1);
    expect(mergedSettings.hooks.StopFailure).toHaveLength(1);
    expect(mergedSettings.hooks.Notification).toHaveLength(1);
  });

  test("should replace stale versioned VSmux Claude hook commands with the current one", () => {
    const mergedSettings = JSON.parse(
      mergeClaudeHookSettingsContent(
        JSON.stringify(
          {
            hooks: {
              UserPromptSubmit: [
                {
                  hooks: [
                    {
                      command:
                        "'/Users/test/Library/Application Support/Code/User/globalStorage/maddada.vsmux/terminal-host-daemon/agent-shell-integration/hooks/claude/notify.sh'",
                      type: "command",
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ),
        "/tmp/vsmux-notify.sh",
        "linux",
      ),
    ) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; type: string }> }>>;
    };

    expect(mergedSettings.hooks.UserPromptSubmit).toEqual([
      {
        hooks: [
          {
            command: "'/tmp/vsmux-notify.sh'",
            type: "command",
          },
        ],
      },
    ]);
  });

  test("should preserve non-VSmux hooks that share the same event", () => {
    const mergedSettings = JSON.parse(
      mergeClaudeHookSettingsContent(
        JSON.stringify(
          {
            hooks: {
              UserPromptSubmit: [
                {
                  hooks: [
                    {
                      command: "/Users/test/.claude/hooks/custom-submit.sh",
                      type: "command",
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ),
        "/tmp/vsmux-notify.sh",
        "linux",
      ),
    ) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; type: string }> }>>;
    };

    expect(mergedSettings.hooks.UserPromptSubmit).toEqual([
      {
        hooks: [
          {
            command: "/Users/test/.claude/hooks/custom-submit.sh",
            type: "command",
          },
        ],
      },
      {
        hooks: [
          {
            command: "'/tmp/vsmux-notify.sh'",
            type: "command",
          },
        ],
      },
    ]);
  });
});
