import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    }),
  },
}));

import { buildZellijUiProfile } from "./zellij-ui-profile";

describe("buildZellijUiProfile", () => {
  test("should build the minimal preset without a custom layout", () => {
    expect(
      buildZellijUiProfile({
        customConfigKdl: "",
        customLayoutKdl: "",
        mode: "minimal",
      }),
    ).toEqual({
      configContent: [
        "show_release_notes false",
        "show_startup_tips false",
        "simplified_ui true",
        "",
      ].join("\n"),
      layoutContent: undefined,
    });
  });

  test("should build the native preset with the one-pane layout", () => {
    expect(
      buildZellijUiProfile({
        customConfigKdl: "",
        customLayoutKdl: "",
        mode: "native",
      }),
    ).toEqual({
      configContent: [
        "show_release_notes false",
        "show_startup_tips false",
        "simplified_ui true",
        'default_mode "locked"',
        "pane_frames false",
        "mouse_mode true",
        "mouse_hover_effects false",
        "advanced_mouse_actions false",
        "visual_bell false",
        "keybinds clear-defaults=true {}",
        "",
      ].join("\n"),
      layoutContent: ["layout {", "    pane", "}", ""].join("\n"),
    });
  });

  test("should build the passthrough preset with host-terminal mouse handling", () => {
    expect(
      buildZellijUiProfile({
        customConfigKdl: "",
        customLayoutKdl: "",
        mode: "passthrough",
      }),
    ).toEqual({
      configContent: [
        "show_release_notes false",
        "show_startup_tips false",
        "simplified_ui true",
        'default_mode "locked"',
        "pane_frames false",
        "mouse_mode true",
        "mouse_hover_effects false",
        "advanced_mouse_actions false",
        "visual_bell false",
        "keybinds clear-defaults=true {}",
        "",
      ].join("\n"),
      layoutContent: ["layout {", "    pane", "}", ""].join("\n"),
    });
  });

  test("should append custom config and replace layout when overrides are provided", () => {
    expect(
      buildZellijUiProfile({
        customConfigKdl: "copy_on_select true",
        customLayoutKdl: "layout {\n    pane command=\"htop\"\n}\n",
        mode: "ultra",
      }),
    ).toEqual({
      configContent: [
        "show_release_notes false",
        "show_startup_tips false",
        "simplified_ui true",
        'default_mode "locked"',
        "pane_frames false",
        "mouse_mode true",
        "mouse_hover_effects false",
        "advanced_mouse_actions false",
        "visual_bell false",
        "keybinds clear-defaults=true {}",
        "styled_underlines false",
        "support_kitty_keyboard_protocol false",
        "copy_on_select false",
        "focus_follows_mouse false",
        "mouse_click_through false",
        "",
        "copy_on_select true",
        "",
      ].join("\n"),
      layoutContent: ['layout {', '    pane command="htop"', "}", ""].join("\n"),
    });
  });
});
