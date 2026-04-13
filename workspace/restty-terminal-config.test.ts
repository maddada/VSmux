import { describe, expect, test } from "vite-plus/test";
import { getResttyFontSources } from "./restty-terminal-config";

describe("getResttyFontSources", () => {
  test("should ignore generic default families like xterm's monospace", () => {
    expect(getResttyFontSources("monospace")).toEqual([]);
  });

  test("should return no custom font sources when no font family is configured", () => {
    expect(getResttyFontSources(undefined)).toEqual([]);
  });

  test("should build local variants for custom font families", () => {
    expect(getResttyFontSources('"Fira Code", monospace')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Fira Code Regular",
          matchers: expect.arrayContaining([
            "Fira Code",
            "FiraCode",
            "Fira Code regular",
            "FiraCoderegular",
          ]),
          required: false,
          type: "local",
        }),
        expect.objectContaining({
          label: "Fira Code Bold Italic",
          matchers: expect.arrayContaining(["Fira Code bold italic", "FiraCodebolditalic"]),
          required: false,
          type: "local",
        }),
      ]),
    );
  });
});
