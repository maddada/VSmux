import { describe, expect, test } from "vite-plus/test";
import {
  COMPLETION_SOUND_OPTIONS,
  DEFAULT_COMPLETION_SOUND,
  clampCompletionSoundSetting,
  getCompletionSoundFileName,
  getCompletionSoundLabel,
} from "./completion-sound";

describe("completion sound settings", () => {
  test("should keep supported sound ids", () => {
    expect(clampCompletionSoundSetting("glass")).toBe("glass");
    expect(clampCompletionSoundSetting("pingdouble")).toBe("pingdouble");
  });

  test("should fall back to the default sound for unknown ids", () => {
    expect(clampCompletionSoundSetting(undefined)).toBe(DEFAULT_COMPLETION_SOUND);
    expect(clampCompletionSoundSetting("nope")).toBe(DEFAULT_COMPLETION_SOUND);
  });

  test("should expose labels and filenames for supported sounds", () => {
    expect(getCompletionSoundLabel("ping")).toBe("Ping");
    expect(getCompletionSoundFileName("ping")).toBe("ping.mp3");
    expect(getCompletionSoundLabel("edmspark")).toBe("EDM Spark");
    expect(getCompletionSoundFileName("edmspark")).toBe("edmspark.mp3");
  });

  test("should include the bundled sound variants in the picker order", () => {
    expect(COMPLETION_SOUND_OPTIONS.map((option) => option.value)).toEqual([
      "ping",
      "pingdouble",
      "glass",
      "glimmer",
      "shamisen",
      "shamisenreverb",
      "arcade",
      "arcadeboost",
      "codecompleteafrican",
      "africanspark",
      "codecompleteafrobeat",
      "afrobeatbounce",
      "codecompleteedm",
      "edmspark",
      "comebacktothecode",
    ]);
  });
});
