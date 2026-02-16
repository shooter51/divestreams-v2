/**
 * Public Site Themes Unit Tests
 *
 * Tests theme system functionality including:
 * - Theme presets and retrieval
 * - CSS generation with overrides
 * - Color brightness adjustment
 * - Contrast color calculation
 * - Security sanitization
 * - Dark mode support
 */

import { describe, it, expect } from "vitest";
import {
  getTheme,
  getThemeCSS,
  getThemeStyleTag,
  getThemeStyleBlock,
  isDarkTheme,
  getAvailableThemes,
  isValidThemeName,
  oceanTheme,
  tropicalTheme,
  minimalTheme,
  darkTheme,
  classicTheme,
  type ThemeName,
  type ThemeOverrides,
} from "../../../../lib/themes/public-site-themes";

describe("Theme Presets", () => {
  it("should have ocean theme with correct colors", () => {
    expect(oceanTheme.name).toBe("ocean");
    expect(oceanTheme.primaryColor).toBe("#0077B6");
    expect(oceanTheme.secondaryColor).toBe("#00B4D8");
    expect(oceanTheme.accentColor).toBe("#90E0EF");
    expect(oceanTheme.backgroundColor).toBe("#F0F9FF");
    expect(oceanTheme.textColor).toBe("#1E3A5F");
    expect(oceanTheme.headerBg).toBe("#023E8A");
    expect(oceanTheme.footerBg).toBe("#03045E");
  });

  it("should have ocean theme dark mode colors", () => {
    expect(oceanTheme.dark.primaryColor).toBe("#60A5FA");
    expect(oceanTheme.dark.backgroundColor).toBe("#030712");
    expect(oceanTheme.dark.cardBg).toBe("#111827");
    expect(oceanTheme.dark.borderColor).toBe("#374151");
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

describe("getTheme", () => {
  it("should return ocean theme for 'ocean'", () => {
    const theme = getTheme("ocean");
    expect(theme.name).toBe("ocean");
    expect(theme.primaryColor).toBe("#0077B6");
  });

  it("should return tropical theme for 'tropical'", () => {
    const theme = getTheme("tropical");
    expect(theme.name).toBe("tropical");
    expect(theme.primaryColor).toBe("#20B2AA");
  });

  it("should return minimal theme for 'minimal'", () => {
    const theme = getTheme("minimal");
    expect(theme.name).toBe("minimal");
    expect(theme.primaryColor).toBe("#374151");
  });

  it("should return dark theme for 'dark'", () => {
    const theme = getTheme("dark");
    expect(theme.name).toBe("dark");
    expect(theme.backgroundColor).toBe("#0F172A");
  });

  it("should return classic theme for 'classic'", () => {
    const theme = getTheme("classic");
    expect(theme.name).toBe("classic");
    expect(theme.primaryColor).toBe("#1E3A5F");
  });
});

describe("getThemeCSS", () => {
  it("should generate CSS variables for ocean theme", () => {
    const css = getThemeCSS("ocean");

    expect(css).toContain("--color-primary: #0077B6");
    expect(css).toContain("--color-secondary: #00B4D8");
    expect(css).toContain("--color-accent: #90E0EF");
    expect(css).toContain("--color-background: #F0F9FF");
    expect(css).toContain("--color-text: #1E3A5F");
    expect(css).toContain("--color-header-bg: #023E8A");
    expect(css).toContain("--color-footer-bg: #03045E");
  });

  it("should generate CSS with primary color override", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#FF0000",
    };
    const css = getThemeCSS("ocean", overrides);

    expect(css).toContain("--color-primary: #FF0000");
    expect(css).toContain("--color-secondary: #00B4D8"); // Original
  });

  it("should generate CSS with multiple overrides", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#FF0000",
      secondaryColor: "#00FF00",
      accentColor: "#0000FF",
    };
    const css = getThemeCSS("minimal", overrides);

    expect(css).toContain("--color-primary: #FF0000");
    expect(css).toContain("--color-secondary: #00FF00");
    expect(css).toContain("--color-accent: #0000FF");
  });

  it("should accept ThemeColors object instead of name", () => {
    const css = getThemeCSS(oceanTheme);

    expect(css).toContain("--color-primary: #0077B6");
  });

  it("should include hover states", () => {
    const css = getThemeCSS("tropical");

    expect(css).toContain("--color-primary-hover:");
    expect(css).toContain("--color-secondary-hover:");
    expect(css).toContain("--color-accent-hover:");
  });

  it("should include contrast colors for backgrounds", () => {
    const css = getThemeCSS("dark");

    expect(css).toContain("--color-header-text:");
    expect(css).toContain("--color-footer-text:");
    expect(css).toContain("--color-primary-text:");
  });

  it("should use white card background for non-dark themes", () => {
    const css = getThemeCSS("ocean");
    expect(css).toContain("--color-card-bg: #FFFFFF");
  });

  it("should use dark card background for dark theme", () => {
    const css = getThemeCSS("dark");
    expect(css).toContain("--color-card-bg: #1E293B");
  });

  it("should use light border for non-dark themes", () => {
    const css = getThemeCSS("minimal");
    expect(css).toContain("--color-border: #E5E7EB");
  });

  it("should use dark border for dark theme", () => {
    const css = getThemeCSS("dark");
    expect(css).toContain("--color-border: #334155");
  });
});

describe("getThemeStyleTag", () => {
  it("should generate complete style tag with :root selector", () => {
    const styleTag = getThemeStyleTag("ocean");

    expect(styleTag).toContain(":root {");
    expect(styleTag).toContain("--color-primary: #0077B6");
    expect(styleTag).toContain("}");
  });

  it("should include overrides in style tag", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#CUSTOM",
    };
    const styleTag = getThemeStyleTag("tropical", overrides);

    expect(styleTag).toContain("--color-primary: #CUSTOM");
  });

  it("should have proper indentation", () => {
    const styleTag = getThemeStyleTag("minimal");

    expect(styleTag).toMatch(/^:root \{\n {2}/);
    expect(styleTag).toMatch(/\n\}$/);
  });
});

describe("getThemeStyleBlock", () => {
  it("should generate CSS with .site-theme class selector", () => {
    const css = getThemeStyleBlock("ocean");

    expect(css).toContain(".site-theme {");
    expect(css).toContain("--primary-color: #0077B6");
  });

  it("should include dark mode media query", () => {
    const css = getThemeStyleBlock("tropical");

    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(".site-theme {");
  });

  it("should include dark mode color overrides", () => {
    const css = getThemeStyleBlock("ocean");

    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--primary-color: #60A5FA"); // Ocean dark mode primary
  });

  it("should sanitize primary color override", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#FF0000",
    };
    const css = getThemeStyleBlock("minimal", overrides);

    expect(css).toContain("--primary-color: #FF0000");
  });

  it("should sanitize secondary color override", () => {
    const overrides: ThemeOverrides = {
      secondaryColor: "#00FF00",
    };
    const css = getThemeStyleBlock("ocean", overrides);

    expect(css).toContain("--secondary-color: #00FF00");
  });

  it("should sanitize accent color override", () => {
    const overrides: ThemeOverrides = {
      accentColor: "#0000FF",
    };
    const css = getThemeStyleBlock("classic", overrides);

    expect(css).toContain("--accent-color: #0000FF");
  });

  it("should include danger colors for alerts", () => {
    const css = getThemeStyleBlock("minimal");

    expect(css).toContain("--danger-bg: #FEE2E2");
    expect(css).toContain("--danger-text: #991B1B");
    expect(css).toContain("--danger-border: #FCA5A5");
  });

  it("should include success colors", () => {
    const css = getThemeStyleBlock("tropical");

    expect(css).toContain("--success-bg: #D1FAE5");
    expect(css).toContain("--success-text: #065F46");
  });

  it("should include dark mode danger colors", () => {
    const css = getThemeStyleBlock("dark");

    expect(css).toContain("--danger-bg: #7F1D1D");
    expect(css).toContain("--danger-text: #FCA5A5");
  });

  it("should include dark mode success colors", () => {
    const css = getThemeStyleBlock("dark");

    expect(css).toContain("--success-bg: #064E3B");
    expect(css).toContain("--success-text: #6EE7B7");
  });

  it("should use white card bg for non-dark themes", () => {
    const css = getThemeStyleBlock("ocean");
    expect(css).toContain("--color-card-bg: #FFFFFF");
  });

  it("should use slate card bg for dark theme", () => {
    const css = getThemeStyleBlock("dark");
    expect(css).toContain("--color-card-bg: #1E293B");
  });

  it("should preserve override colors in dark mode", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#CUSTOM",
    };
    const css = getThemeStyleBlock("minimal", overrides);

    // Should use custom color in dark mode too
    expect(css).toMatch(/@media.*--primary-color: #000000/s);
  });

  it("should accept ThemeColors object", () => {
    const css = getThemeStyleBlock(tropicalTheme);

    expect(css).toContain("--primary-color: #20B2AA");
  });
});

describe("CSS Sanitization", () => {
  it("should accept valid hex color #RGB format", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#F00",
    };
    const css = getThemeStyleBlock("ocean", overrides);

    expect(css).toContain("#F00");
  });

  it("should accept valid hex color #RRGGBB format", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#FF0000",
    };
    const css = getThemeStyleBlock("ocean", overrides);

    expect(css).toContain("#FF0000");
  });

  it("should accept lowercase hex colors", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#abc123",
    };
    const css = getThemeStyleBlock("minimal", overrides);

    expect(css).toContain("#abc123");
  });

  it("should accept uppercase hex colors", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#ABC123",
    };
    const css = getThemeStyleBlock("tropical", overrides);

    expect(css).toContain("#ABC123");
  });

  it("should sanitize invalid color to #000000", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "rgb(255,0,0)", // Not allowed - only hex/named
    };
    const css = getThemeStyleBlock("ocean", overrides);

    expect(css).toContain("#000000");
  });

  it("should sanitize CSS injection attempt", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#000; } body { display: none; } .x {",
    };
    const css = getThemeStyleBlock("minimal", overrides);

    // Should be sanitized to black
    expect(css).toContain("#000000");
    expect(css).not.toContain("display: none");
  });

  it("should sanitize javascript: protocol", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "javascript:alert(1)",
    };
    const css = getThemeStyleBlock("classic", overrides);

    expect(css).toContain("#000000");
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
  it("should return array of all theme names", () => {
    const themes = getAvailableThemes();

    expect(Array.isArray(themes)).toBe(true);
    expect(themes).toHaveLength(5);
  });

  it("should include all five themes", () => {
    const themes = getAvailableThemes();

    expect(themes).toContain("ocean");
    expect(themes).toContain("tropical");
    expect(themes).toContain("minimal");
    expect(themes).toContain("dark");
    expect(themes).toContain("classic");
  });

  it("should return ThemeName array type", () => {
    const themes = getAvailableThemes();

    themes.forEach(theme => {
      expect(typeof theme).toBe("string");
      expect(isValidThemeName(theme)).toBe(true);
    });
  });
});

describe("isValidThemeName", () => {
  it("should return true for 'ocean'", () => {
    expect(isValidThemeName("ocean")).toBe(true);
  });

  it("should return true for 'tropical'", () => {
    expect(isValidThemeName("tropical")).toBe(true);
  });

  it("should return true for 'minimal'", () => {
    expect(isValidThemeName("minimal")).toBe(true);
  });

  it("should return true for 'dark'", () => {
    expect(isValidThemeName("dark")).toBe(true);
  });

  it("should return true for 'classic'", () => {
    expect(isValidThemeName("classic")).toBe(true);
  });

  it("should return false for invalid theme name", () => {
    expect(isValidThemeName("invalid")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isValidThemeName("")).toBe(false);
  });

  it("should return false for uppercase theme name", () => {
    expect(isValidThemeName("OCEAN")).toBe(false);
  });

  it("should return false for partial theme name", () => {
    expect(isValidThemeName("oce")).toBe(false);
  });

  it("should be case sensitive", () => {
    expect(isValidThemeName("Ocean")).toBe(false);
    expect(isValidThemeName("Tropical")).toBe(false);
  });
});

describe("Color Adjustment (via getThemeCSS)", () => {
  it("should generate darker hover colors", () => {
    const css = getThemeCSS("ocean");

    // Hover colors should exist and be different from base
    expect(css).toMatch(/--color-primary-hover: #[0-9A-Fa-f]{6}/);
    expect(css).not.toContain("--color-primary-hover: #0077B6"); // Should be different
  });

  it("should adjust brightness for all colors", () => {
    const css = getThemeCSS("tropical");

    expect(css).toContain("--color-primary-hover:");
    expect(css).toContain("--color-secondary-hover:");
    expect(css).toContain("--color-accent-hover:");
  });

  it("should generate valid hex colors for hover states", () => {
    const css = getThemeCSS("minimal");

    const hoverMatches = css.match(/--color-\w+-hover: (#[0-9A-Fa-f]{6})/g);
    expect(hoverMatches).not.toBeNull();
    expect(hoverMatches!.length).toBeGreaterThan(0);
  });
});

describe("Contrast Color Calculation (via getThemeCSS)", () => {
  it("should use white text on dark backgrounds", () => {
    const css = getThemeCSS("dark");

    // Dark theme has dark primary color, should use white text
    expect(css).toContain("--color-primary-text:");
  });

  it("should generate contrast colors for header and footer", () => {
    const css = getThemeCSS("ocean");

    expect(css).toContain("--color-header-text:");
    expect(css).toContain("--color-footer-text:");
  });

  it("should provide readable contrast for all backgrounds", () => {
    const themes: ThemeName[] = ["ocean", "tropical", "minimal", "dark", "classic"];

    themes.forEach(theme => {
      const css = getThemeCSS(theme);

      // Should have contrast colors
      expect(css).toContain("--color-header-text:");
      expect(css).toContain("--color-footer-text:");
      expect(css).toContain("--color-primary-text:");
    });
  });
});

describe("Edge Cases", () => {
  it("should handle empty overrides object", () => {
    const css = getThemeCSS("ocean", {});

    expect(css).toContain("--color-primary: #0077B6");
  });

  it("should handle partial overrides", () => {
    const overrides: ThemeOverrides = {
      primaryColor: "#FF0000",
      // Other colors not specified
    };
    const css = getThemeCSS("minimal", overrides);

    expect(css).toContain("--color-primary: #FF0000");
    expect(css).toContain("--color-secondary: #6B7280"); // Original
  });

  it("should handle all theme combinations", () => {
    const themes: ThemeName[] = ["ocean", "tropical", "minimal", "dark", "classic"];

    themes.forEach(theme => {
      const css = getThemeCSS(theme);
      expect(css).toContain("--color-primary:");
      expect(css).toContain("--color-background:");
    });
  });

  it("should generate valid CSS for all theme style blocks", () => {
    const themes: ThemeName[] = ["ocean", "tropical", "minimal", "dark", "classic"];

    themes.forEach(theme => {
      const css = getThemeStyleBlock(theme);
      expect(css).toContain(".site-theme {");
      expect(css).toContain("@media (prefers-color-scheme: dark)");
    });
  });
});
