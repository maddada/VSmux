export const MONOSPACE_TERMINAL_FONT_FAMILY = "monospace";
export const UI_MONOSPACE_TERMINAL_FONT_FAMILY = "ui-monospace, monospace";
export const MESLO_TERMINAL_FONT_FAMILY =
  '"MesloLGL Nerd Font Mono", Menlo, Monaco, "Courier New", monospace';
export const CROSS_PLATFORM_MONO_TERMINAL_FONT_FAMILY =
  'Consolas, Menlo, Monaco, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace';
export const CONSOLAS_TERMINAL_FONT_FAMILY = "Consolas, monospace";
export const MENLO_TERMINAL_FONT_FAMILY = "Menlo, monospace";
export const MONACO_TERMINAL_FONT_FAMILY = "Monaco, monospace";
export const LIBERATION_MONO_TERMINAL_FONT_FAMILY = '"Liberation Mono", monospace';
export const DEJAVU_SANS_MONO_TERMINAL_FONT_FAMILY = '"DejaVu Sans Mono", monospace';
export const COURIER_NEW_TERMINAL_FONT_FAMILY = '"Courier New", monospace';
export const CASCADIA_MONO_TERMINAL_FONT_FAMILY = '"Cascadia Mono", monospace';
export const CASCADIA_CODE_TERMINAL_FONT_FAMILY = '"Cascadia Code", monospace';
export const JETBRAINS_MONO_TERMINAL_FONT_FAMILY = '"JetBrains Mono", monospace';
export const FIRA_CODE_TERMINAL_FONT_FAMILY = '"Fira Code", monospace';
export const SOURCE_CODE_PRO_TERMINAL_FONT_FAMILY = '"Source Code Pro", monospace';
export const IBM_PLEX_MONO_TERMINAL_FONT_FAMILY = '"IBM Plex Mono", monospace';
export const ROBOTO_MONO_TERMINAL_FONT_FAMILY = '"Roboto Mono", monospace';
export const NOTO_SANS_MONO_TERMINAL_FONT_FAMILY = '"Noto Sans Mono", monospace';
export const UBUNTU_MONO_TERMINAL_FONT_FAMILY = '"Ubuntu Mono", monospace';

export const TERMINAL_FONT_PRESETS = [
  { preset: "Monospace", fontFamily: MONOSPACE_TERMINAL_FONT_FAMILY },
  { preset: "UI Monospace", fontFamily: UI_MONOSPACE_TERMINAL_FONT_FAMILY },
  { preset: "Meslo", fontFamily: MESLO_TERMINAL_FONT_FAMILY },
  { preset: "Cross Platform Mono", fontFamily: CROSS_PLATFORM_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Consolas", fontFamily: CONSOLAS_TERMINAL_FONT_FAMILY },
  { preset: "Menlo", fontFamily: MENLO_TERMINAL_FONT_FAMILY },
  { preset: "Monaco", fontFamily: MONACO_TERMINAL_FONT_FAMILY },
  { preset: "Liberation Mono", fontFamily: LIBERATION_MONO_TERMINAL_FONT_FAMILY },
  { preset: "DejaVu Sans Mono", fontFamily: DEJAVU_SANS_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Courier New", fontFamily: COURIER_NEW_TERMINAL_FONT_FAMILY },
  { preset: "Cascadia Mono", fontFamily: CASCADIA_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Cascadia Code", fontFamily: CASCADIA_CODE_TERMINAL_FONT_FAMILY },
  { preset: "JetBrains Mono", fontFamily: JETBRAINS_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Fira Code", fontFamily: FIRA_CODE_TERMINAL_FONT_FAMILY },
  { preset: "Source Code Pro", fontFamily: SOURCE_CODE_PRO_TERMINAL_FONT_FAMILY },
  { preset: "IBM Plex Mono", fontFamily: IBM_PLEX_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Roboto Mono", fontFamily: ROBOTO_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Noto Sans Mono", fontFamily: NOTO_SANS_MONO_TERMINAL_FONT_FAMILY },
  { preset: "Ubuntu Mono", fontFamily: UBUNTU_MONO_TERMINAL_FONT_FAMILY },
] as const;

export type TerminalFontPreset = (typeof TERMINAL_FONT_PRESETS)[number]["preset"];

export const DEFAULT_TERMINAL_FONT_PRESET: TerminalFontPreset = "Monospace";

const normalizeComparableValue = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();

const TERMINAL_FONT_PRESET_BY_NORMALIZED_VALUE = new Map<string, TerminalFontPreset>(
  TERMINAL_FONT_PRESETS.flatMap(({ fontFamily, preset }) => [
    [normalizeComparableValue(preset), preset],
    [normalizeComparableValue(fontFamily), preset],
  ]),
);

TERMINAL_FONT_PRESET_BY_NORMALIZED_VALUE.set("ui-monospace", "UI Monospace");

export function normalizeTerminalFontPreset(value: string | undefined): TerminalFontPreset {
  const normalizedValue = normalizeComparableValue(value ?? "");
  return (
    TERMINAL_FONT_PRESET_BY_NORMALIZED_VALUE.get(normalizedValue) ?? DEFAULT_TERMINAL_FONT_PRESET
  );
}

export function getTerminalFontFamilyForPreset(preset: TerminalFontPreset): string {
  return (
    TERMINAL_FONT_PRESETS.find((candidate) => candidate.preset === preset)?.fontFamily ??
    MONOSPACE_TERMINAL_FONT_FAMILY
  );
}

export function getTerminalFontPresetFromFontFamily(
  fontFamily: string | undefined,
): TerminalFontPreset {
  return normalizeTerminalFontPreset(fontFamily);
}
