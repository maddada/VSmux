export const COMPLETION_SOUND_OPTIONS = [
  {
    fileName: "ping.mp3",
    label: "Ping",
    value: "ping",
  },
  {
    fileName: "pingdouble.mp3",
    label: "Ping Double",
    value: "pingdouble",
  },
  {
    fileName: "glass.mp3",
    label: "Glass",
    value: "glass",
  },
  {
    fileName: "glimmer.mp3",
    label: "Glimmer",
    value: "glimmer",
  },
  {
    fileName: "shamisen.mp3",
    label: "Shamisen",
    value: "shamisen",
  },
  {
    fileName: "shamisenreverb.mp3",
    label: "Shamisen Reverb",
    value: "shamisenreverb",
  },
  {
    fileName: "arcade.mp3",
    label: "Arcade",
    value: "arcade",
  },
  {
    fileName: "arcadeboost.mp3",
    label: "Arcade Boost",
    value: "arcadeboost",
  },
  {
    fileName: "codecompleteafrican.mp3",
    label: "African Code Complete",
    value: "codecompleteafrican",
  },
  {
    fileName: "africanspark.mp3",
    label: "African Spark",
    value: "africanspark",
  },
  {
    fileName: "codecompleteafrobeat.mp3",
    label: "Afrobeat Code Complete",
    value: "codecompleteafrobeat",
  },
  {
    fileName: "afrobeatbounce.mp3",
    label: "Afrobeat Bounce",
    value: "afrobeatbounce",
  },
  {
    fileName: "codecompleteedm.mp3",
    label: "EDM Code Complete",
    value: "codecompleteedm",
  },
  {
    fileName: "edmspark.mp3",
    label: "EDM Spark",
    value: "edmspark",
  },
  {
    fileName: "comebacktothecode.mp3",
    label: "Come Back To The Code",
    value: "comebacktothecode",
  },
] as const;

export type CompletionSoundSetting = (typeof COMPLETION_SOUND_OPTIONS)[number]["value"];

export const DEFAULT_COMPLETION_SOUND: CompletionSoundSetting = "arcade";

export function clampCompletionSoundSetting(value: string | undefined): CompletionSoundSetting {
  return (
    COMPLETION_SOUND_OPTIONS.find((option) => option.value === value)?.value ??
    DEFAULT_COMPLETION_SOUND
  );
}

export function getCompletionSoundLabel(value: CompletionSoundSetting): string {
  return (
    COMPLETION_SOUND_OPTIONS.find((option) => option.value === value)?.label ??
    getCompletionSoundLabel(DEFAULT_COMPLETION_SOUND)
  );
}

export function getCompletionSoundFileName(value: CompletionSoundSetting): string {
  return (
    COMPLETION_SOUND_OPTIONS.find((option) => option.value === value)?.fileName ??
    getCompletionSoundFileName(DEFAULT_COMPLETION_SOUND)
  );
}
