/**
 * Public Site Theme System Tests
 *
 * Comprehensive tests for theme presets, CSS generation, and color utilities.
 */

import { describe, it, expect } from "vitest";
import {
  oceanTheme,
  tropicalTheme,
  minimalTheme,
  darkTheme,
  classicTheme,
  themePresets,
  getTheme,
  getThemeCSS,
  getThemeStyleTag,
  isDarkTheme,
  getAvailableThemes,
  isValidThemeName,
  type ThemeName,
  type ThemeColors,
  type ThemeOverrides,
} from "../../../../lib/themes/public-site-themes";

describe("Public Site Theme System", () => {
  describe("Theme Presets", () => {
    it("should have ocean theme with correct colors", () => {
      expect(oceanTheme.name).toBe("ocean");
      expect(oceanTheme.primaryColor).toBe("#0077B6");
      expect(oceanTheme.secondaryColor).toBe("#00B4D8");
      expect(oceanTheme.accentColor).toBe("#90E0EF");
    });

    it("should have tropical theme with correct colors", () => {
      expect(tropicalTheme.name).toBe("tropical");
      expect(tropicalTheme.primaryColor).toBe("#20B2AA");
      expect(tropicalTheme.secondaryColor).toBe("#3CB371");
      expect(tropicalTheme.accentColor).toBe("#FFD700");
    });

    it("should have minimal theme with correct colors", () => {
      expect(minimalTheme.name).toBe("minimal");
      expect(minimalTheme.primaryColor).toBe("#374151");
      expect(minimalTheme.backgroundColor).toBe("#FFFFFF");
    });

    it("should have dark theme with correct colors", () => {
      expect(darkTheme.name).toBe("dark");
      expect(darkTheme.backgroundColor).toBe("#0F172A");
      expect(darkTheme.textColor).toBe("#F1F5F9");
    });

    it("should have classic theme with correct colors", () => {
      expect(classicTheme.name).toBe("classic");
      expect(classicTheme.primaryColor).toBe("#1E3A5F");
      expect(classicTheme.accentColor).toBe("#D4A942");
    });
  });

  describe("themePresets", () => {
    it("should contain all theme presets", () => {
      expect(themePresets.ocean).toEqual(oceanTheme);
      expect(themePresets.tropical).toEqual(tropicalTheme);
      expect(themePresets.minimal).toEqual(minimalTheme);
      expect(themePresets.dark).toEqual(darkTheme);
      expect(themePresets.classic).toEqual(classicTheme);
    });

    it("should have exactly 5 themes", () => {
      expect(Object.keys(themePresets)).toHaveLength(5);
    });
  });

  describe("getTheme", () => {
    it("should return ocean theme by name", () => {
      expect(getTheme("ocean")).toEqual(oceanTheme);
    });

    it("should return tropical theme by name", () => {
      expect(getTheme("tropical")).toEqual(tropicalTheme);
    });

    it("should return minimal theme by name", () => {
      expect(getTheme("minimal")).toEqual(minimalTheme);
    });

    it("should return dark theme by name", () => {
      expect(getTheme("dark")).toEqual(darkTheme);
    });

    it("should return classic theme by name", () => {
      expect(getTheme("classic")).toEqual(classicTheme);
    });

    it("should fallback to ocean theme for invalid name", () => {
      // TypeScript will complain, but test runtime behavior
      expect(getTheme("invalid" as ThemeName)).toEqual(oceanTheme);
    });
  });

  describe("getThemeCSS", () => {
    it("should generate CSS variables for ocean theme", () => {
      const css = getThemeCSS("ocean");
      expect(css).toContain("--color-primary: #0077B6");
      expect(css).toContain("--color-secondary: #00B4D8");
      expect(css).toContain("--color-accent: #90E0EF");
    });

    it("should generate CSS variables for tropical theme", () => {
      const css = getThemeCSS("tropical");
      expect(css).toContain("--color-primary: #20B2AA");
      expect(css).toContain("--color-secondary: #3CB371");
    });

    it("should generate CSS variables from theme object", () => {
      const css = getThemeCSS(oceanTheme);
      expect(css).toContain("--color-primary: #0077B6");
      expect(css).toContain("--color-background: #F0F9FF");
    });

    it("should include hover colors", () => {
      const css = getThemeCSS("ocean");
      expect(css).toContain("--color-primary-hover:");
      expect(css).toContain("--color-secondary-hover:");
      expect(css).toContain("--color-accent-hover:");
    });

    it("should include contrast text colors", () => {
      const css = getThemeCSS("ocean");
      expect(css).toContain("--color-header-text:");
      expect(css).toContain("--color-footer-text:");
      expect(css).toContain("--color-primary-text:");
    });

    it("should apply overrides to primary color", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#FF0000",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #FF0000");
    });

    it("should apply overrides to secondary color", () => {
      const overrides: ThemeOverrides = {
        secondaryColor: "#00FF00",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-secondary: #00FF00");
    });

    it("should apply multiple overrides", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#FF0000",
        secondaryColor: "#00FF00",
        backgroundColor: "#FFFFFF",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #FF0000");
      expect(css).toContain("--color-secondary: #00FF00");
      expect(css).toContain("--color-background: #FFFFFF");
    });

    it("should keep default colors when not overridden", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#FF0000",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #FF0000"); // Overridden
      expect(css).toContain("--color-secondary: #00B4D8"); // Default
    });

    it("should override all theme colors", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#111111",
        secondaryColor: "#222222",
        accentColor: "#333333",
        backgroundColor: "#444444",
        textColor: "#555555",
        headerBg: "#666666",
        footerBg: "#777777",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #111111");
      expect(css).toContain("--color-secondary: #222222");
      expect(css).toContain("--color-accent: #333333");
      expect(css).toContain("--color-background: #444444");
      expect(css).toContain("--color-text: #555555");
      expect(css).toContain("--color-header-bg: #666666");
      expect(css).toContain("--color-footer-bg: #777777");
    });
  });

  describe("getThemeStyleTag", () => {
    it("should wrap CSS in :root selector", () => {
      const styleTag = getThemeStyleTag("ocean");
      expect(styleTag).toMatch(/^:root \{/);
      expect(styleTag).toMatch(/\}$/);
    });

    it("should include all CSS variables", () => {
      const styleTag = getThemeStyleTag("ocean");
      expect(styleTag).toContain("--color-primary:");
      expect(styleTag).toContain("--color-secondary:");
      expect(styleTag).toContain("--color-accent:");
    });

    it("should apply overrides in style tag", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#FF0000",
      };
      const styleTag = getThemeStyleTag("ocean", overrides);
      expect(styleTag).toContain("--color-primary: #FF0000");
    });

    it("should work with theme object", () => {
      const styleTag = getThemeStyleTag(oceanTheme);
      expect(styleTag).toContain(":root {");
      expect(styleTag).toContain("--color-primary: #0077B6");
    });
  });

  describe("isDarkTheme", () => {
    it("should return true for dark theme", () => {
      expect(isDarkTheme("dark")).toBe(true);
    });

    it("should return false for ocean theme", () => {
      expect(isDarkTheme("ocean")).toBe(false);
    });

    it("should return false for tropical theme", () => {
      expect(isDarkTheme("tropical")).toBe(false);
    });

    it("should return false for minimal theme", () => {
      expect(isDarkTheme("minimal")).toBe(false);
    });

    it("should return false for classic theme", () => {
      expect(isDarkTheme("classic")).toBe(false);
    });
  });

  describe("getAvailableThemes", () => {
    it("should return all theme names", () => {
      const themes = getAvailableThemes();
      expect(themes).toContain("ocean");
      expect(themes).toContain("tropical");
      expect(themes).toContain("minimal");
      expect(themes).toContain("dark");
      expect(themes).toContain("classic");
    });

    it("should return exactly 5 themes", () => {
      const themes = getAvailableThemes();
      expect(themes).toHaveLength(5);
    });
  });

  describe("isValidThemeName", () => {
    it("should return true for ocean", () => {
      expect(isValidThemeName("ocean")).toBe(true);
    });

    it("should return true for tropical", () => {
      expect(isValidThemeName("tropical")).toBe(true);
    });

    it("should return true for minimal", () => {
      expect(isValidThemeName("minimal")).toBe(true);
    });

    it("should return true for dark", () => {
      expect(isValidThemeName("dark")).toBe(true);
    });

    it("should return true for classic", () => {
      expect(isValidThemeName("classic")).toBe(true);
    });

    it("should return false for invalid name", () => {
      expect(isValidThemeName("invalid")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidThemeName("")).toBe(false);
    });

    it("should return false for number", () => {
      expect(isValidThemeName("123" as any)).toBe(false);
    });
  });

  describe("Color adjustment logic", () => {
    it("should generate darker hover colors", () => {
      const css = getThemeCSS("ocean");
      // Extract primary color and hover color
      const primaryMatch = css.match(/--color-primary: (#[0-9A-F]{6})/i);
      const hoverMatch = css.match(/--color-primary-hover: (#[0-9A-F]{6})/i);

      expect(primaryMatch).toBeTruthy();
      expect(hoverMatch).toBeTruthy();

      // Hover color should be different from primary
      expect(primaryMatch![1]).not.toBe(hoverMatch![1]);
    });

    it("should handle bright colors for hover", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#FFFFFF",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #FFFFFF");
      expect(css).toContain("--color-primary-hover:");
    });

    it("should handle dark colors for hover", () => {
      const overrides: ThemeOverrides = {
        primaryColor: "#000000",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-primary: #000000");
      expect(css).toContain("--color-primary-hover:");
    });
  });

  describe("Contrast color logic", () => {
    it("should use white text on dark backgrounds", () => {
      const overrides: ThemeOverrides = {
        headerBg: "#000000",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-header-text: #FFFFFF");
    });

    it("should use dark text on light backgrounds", () => {
      const overrides: ThemeOverrides = {
        headerBg: "#FFFFFF",
      };
      const css = getThemeCSS("ocean", overrides);
      expect(css).toContain("--color-header-text: #1F2937");
    });

    it("should calculate contrast for footer", () => {
      const css = getThemeCSS("ocean");
      expect(css).toContain("--color-footer-text:");
    });

    it("should calculate contrast for primary button", () => {
      const css = getThemeCSS("ocean");
      expect(css).toContain("--color-primary-text:");
    });
  });

  describe("Theme completeness", () => {
    it("ocean theme should have all required properties", () => {
      expect(oceanTheme).toHaveProperty("name");
      expect(oceanTheme).toHaveProperty("primaryColor");
      expect(oceanTheme).toHaveProperty("secondaryColor");
      expect(oceanTheme).toHaveProperty("accentColor");
      expect(oceanTheme).toHaveProperty("backgroundColor");
      expect(oceanTheme).toHaveProperty("textColor");
      expect(oceanTheme).toHaveProperty("headerBg");
      expect(oceanTheme).toHaveProperty("footerBg");
    });

    it("all themes should have hex color format", () => {
      const themes: ThemeColors[] = Object.values(themePresets);
      const hexPattern = /^#[0-9A-F]{6}$/i;

      themes.forEach((theme) => {
        expect(theme.primaryColor).toMatch(hexPattern);
        expect(theme.secondaryColor).toMatch(hexPattern);
        expect(theme.accentColor).toMatch(hexPattern);
        expect(theme.backgroundColor).toMatch(hexPattern);
        expect(theme.textColor).toMatch(hexPattern);
        expect(theme.headerBg).toMatch(hexPattern);
        expect(theme.footerBg).toMatch(hexPattern);
      });
    });
  });
});
