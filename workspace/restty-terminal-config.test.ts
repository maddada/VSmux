import { describe, expect, test } from "vite-plus/test";
import { getResttyFontSources } from "./restty-terminal-config";

describe("getResttyFontSources", () => {
  test("should return bundled font sources when local fonts are unavailable", () => {
    const originalQueryLocalFonts = globalThis.queryLocalFonts;
    // Mirror the VS Code webview case where the capability is not available at all.
    Object.defineProperty(globalThis, "queryLocalFonts", {
      configurable: true,
      value: undefined,
    });

    try {
      expect(getResttyFontSources('"Fira Code", monospace')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Bundled JetBrains Mono",
            type: "url",
            url: "../JetBrainsMono_wght_.ttf",
          }),
          expect.objectContaining({
            label: "Bundled Meslo Nerd Font Mono",
            type: "url",
            url: "../MesloLGLNerdFontMono-Regular.ttf",
          }),
        ]),
      );
    } finally {
      Object.defineProperty(globalThis, "queryLocalFonts", {
        configurable: true,
        value: originalQueryLocalFonts,
      });
    }
  });

  test("should fall back to bundled sources for generic default families", () => {
    expect(getResttyFontSources("monospace")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Bundled JetBrains Mono",
          type: "url",
          url: "../JetBrainsMono_wght_.ttf",
        }),
      ]),
    );
  });

  test("should return bundled sources when no font family is configured", () => {
    expect(getResttyFontSources(undefined)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Bundled JetBrains Mono",
          type: "url",
          url: "../JetBrainsMono_wght_.ttf",
        }),
      ]),
    );
  });

  test("should build local variants for custom font families and append bundled fallbacks", () => {
    const originalQueryLocalFonts = globalThis.queryLocalFonts;
    Object.defineProperty(globalThis, "queryLocalFonts", {
      configurable: true,
      value: async () => [],
    });

    try {
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
          expect.objectContaining({
            label: "Bundled Meslo Nerd Font Mono",
            type: "url",
            url: "../MesloLGLNerdFontMono-Regular.ttf",
          }),
        ]),
      );
    } finally {
      Object.defineProperty(globalThis, "queryLocalFonts", {
        configurable: true,
        value: originalQueryLocalFonts,
      });
    }
  });
});
