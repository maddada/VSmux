import { mkdir, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

const SETTINGS_SECTION = "VSmux";
const ZELLIJ_CUSTOM_CONFIG_SETTING = "zellijCustomConfigKdl";
const ZELLIJ_CUSTOM_LAYOUT_SETTING = "zellijCustomLayoutKdl";
const ZELLIJ_UI_MODE_SETTING = "zellijUiMode";
const ZELLIJ_UI_PROFILE_DIR_NAME = "zellij-ui-profiles";

const MINIMAL_CONFIG_LINES = [
  "show_release_notes false",
  "show_startup_tips false",
  "simplified_ui true",
];

const NATIVE_CONFIG_LINES = [
  ...MINIMAL_CONFIG_LINES,
  'default_mode "locked"',
  "pane_frames false",
  "mouse_mode true",
  "mouse_hover_effects false",
  "advanced_mouse_actions false",
  "visual_bell false",
  "keybinds clear-defaults=true {}",
];

const PASSTHROUGH_CONFIG_LINES = [
  ...MINIMAL_CONFIG_LINES,
  'default_mode "locked"',
  "pane_frames false",
  "mouse_mode true",
  "mouse_hover_effects false",
  "advanced_mouse_actions false",
  "visual_bell false",
  "keybinds clear-defaults=true {}",
];

const ULTRA_CONFIG_LINES = [
  ...NATIVE_CONFIG_LINES,
  "styled_underlines false",
  "support_kitty_keyboard_protocol false",
  "copy_on_select false",
  "focus_follows_mouse false",
  "mouse_click_through false",
];

const ONE_PANE_LAYOUT = `layout {
    pane
}
`;

export type ZellijUiMode = "minimal" | "native" | "passthrough" | "ultra";

export type ZellijUiSettings = {
  customConfigKdl: string;
  customLayoutKdl: string;
  mode: ZellijUiMode;
};

export type ResolvedZellijUiProfile = {
  configContent: string;
  layoutContent: string | undefined;
};

export type ResolvedZellijUiProfilePaths = {
  configPath: string;
  layoutPath: string | undefined;
};

export function readZellijUiSettings(
  configuration = vscode.workspace.getConfiguration(SETTINGS_SECTION),
): ZellijUiSettings {
  return {
    customConfigKdl: normalizeMultilineSetting(
      configuration.get<string>(ZELLIJ_CUSTOM_CONFIG_SETTING, ""),
    ),
    customLayoutKdl: normalizeMultilineSetting(
      configuration.get<string>(ZELLIJ_CUSTOM_LAYOUT_SETTING, ""),
    ),
    mode: normalizeUiMode(configuration.get<string>(ZELLIJ_UI_MODE_SETTING, "native")),
  };
}

export function buildZellijUiProfile(settings: ZellijUiSettings): ResolvedZellijUiProfile {
  const configLines = getPresetConfigLines(settings.mode);
  const configContent = appendOverrideBlock(configLines.join("\n"), settings.customConfigKdl);

  const presetLayoutContent = settings.mode === "minimal" ? undefined : ONE_PANE_LAYOUT.trimEnd();
  const layoutContent = settings.customLayoutKdl || presetLayoutContent;

  return {
    configContent: ensureTrailingNewline(configContent),
    layoutContent: layoutContent ? ensureTrailingNewline(layoutContent) : undefined,
  };
}

export async function writeZellijUiProfile(
  globalStoragePath: string,
  workspaceId: string,
  profile: ResolvedZellijUiProfile,
): Promise<ResolvedZellijUiProfilePaths> {
  const profileDirectory = path.join(globalStoragePath, ZELLIJ_UI_PROFILE_DIR_NAME);
  await mkdir(profileDirectory, { recursive: true });

  const configPath = path.join(profileDirectory, `${workspaceId}.config.kdl`);
  await writeFile(configPath, profile.configContent, "utf8");

  const layoutPath = path.join(profileDirectory, `${workspaceId}.layout.kdl`);
  if (profile.layoutContent) {
    await writeFile(layoutPath, profile.layoutContent, "utf8");
    return {
      configPath,
      layoutPath,
    };
  }

  await rm(layoutPath, { force: true });
  return {
    configPath,
    layoutPath: undefined,
  };
}

function appendOverrideBlock(baseContent: string, overrideContent: string): string {
  const normalizedOverride = overrideContent.trim();
  if (normalizedOverride.length === 0) {
    return baseContent;
  }

  return `${baseContent}\n\n${normalizedOverride}`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function getPresetConfigLines(mode: ZellijUiMode): string[] {
  switch (mode) {
    case "minimal":
      return MINIMAL_CONFIG_LINES;
    case "passthrough":
      return PASSTHROUGH_CONFIG_LINES;
    case "ultra":
      return ULTRA_CONFIG_LINES;
    case "native":
    default:
      return NATIVE_CONFIG_LINES;
  }
}

function normalizeMultilineSetting(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeUiMode(value: string): ZellijUiMode {
  switch (value) {
    case "minimal":
    case "native":
    case "passthrough":
    case "ultra":
      return value;
    default:
      return "native";
  }
}
