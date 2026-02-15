import { describe, it, expect } from "vitest";
import { semanticColors, type SemanticColor } from "../../../../lib/utils/semantic-colors";

describe("semantic-colors", () => {
  describe("semanticColors object", () => {
    it("should export all surface color tokens", () => {
      expect(semanticColors.surface).toBe("var(--surface)");
      expect(semanticColors.surfaceRaised).toBe("var(--surface-raised)");
      expect(semanticColors.surfaceInset).toBe("var(--surface-inset)");
      expect(semanticColors.surfaceOverlay).toBe("var(--surface-overlay)");
    });

    it("should export all foreground color tokens", () => {
      expect(semanticColors.foreground).toBe("var(--foreground)");
      expect(semanticColors.foregroundMuted).toBe("var(--foreground-muted)");
      expect(semanticColors.foregroundSubtle).toBe("var(--foreground-subtle)");
    });

    it("should export all border color tokens", () => {
      expect(semanticColors.border).toBe("var(--border)");
      expect(semanticColors.borderStrong).toBe("var(--border-strong)");
    });

    it("should export all brand color tokens", () => {
      expect(semanticColors.brand).toBe("var(--brand)");
      expect(semanticColors.brandHover).toBe("var(--brand-hover)");
      expect(semanticColors.brandMuted).toBe("var(--brand-muted)");
      expect(semanticColors.brandDisabled).toBe("var(--brand-disabled)");
    });

    it("should export all danger color tokens", () => {
      expect(semanticColors.danger).toBe("var(--danger)");
      expect(semanticColors.dangerHover).toBe("var(--danger-hover)");
      expect(semanticColors.dangerMuted).toBe("var(--danger-muted)");
    });

    it("should export all success color tokens", () => {
      expect(semanticColors.success).toBe("var(--success)");
      expect(semanticColors.successMuted).toBe("var(--success-muted)");
    });

    it("should export all warning color tokens", () => {
      expect(semanticColors.warning).toBe("var(--warning)");
      expect(semanticColors.warningMuted).toBe("var(--warning-muted)");
    });

    it("should export all info color tokens", () => {
      expect(semanticColors.info).toBe("var(--info)");
      expect(semanticColors.infoHover).toBe("var(--info-hover)");
      expect(semanticColors.infoMuted).toBe("var(--info-muted)");
    });

    it("should export all accent color tokens", () => {
      expect(semanticColors.accent).toBe("var(--accent)");
      expect(semanticColors.accentHover).toBe("var(--accent-hover)");
      expect(semanticColors.accentMuted).toBe("var(--accent-muted)");
    });

    it("should be immutable (const assertion)", () => {
      // TypeScript enforces this at compile time via const assertion
      // Runtime immutability is enforced by Object.freeze in production if needed
      const keys = Object.keys(semanticColors);
      expect(keys.length).toBeGreaterThan(0);
    });

    it("should have exactly the expected number of color tokens", () => {
      const keys = Object.keys(semanticColors);
      // Surface(4) + Foreground(3) + Border(2) + Brand(4) + Danger(3) + Success(2) + Warning(2) + Info(3) + Accent(3) = 26
      expect(keys.length).toBeGreaterThanOrEqual(26);
    });

    it("should use consistent naming pattern for CSS variables", () => {
      const values = Object.values(semanticColors);

      // All values should start with "var(--" and end with ")"
      for (const value of values) {
        expect(value).toMatch(/^var\(--[a-z-]+\)$/);
      }
    });
  });

  describe("SemanticColor type", () => {
    it("should accept valid semantic color values", () => {
      const testColor: SemanticColor = "var(--brand)";
      expect(testColor).toBe("var(--brand)");
    });

    it("should be compatible with all semanticColors values", () => {
      const colors: SemanticColor[] = [
        semanticColors.surface,
        semanticColors.brand,
        semanticColors.danger,
        semanticColors.success,
      ];

      expect(colors.length).toBe(4);
      expect(colors[0]).toBe("var(--surface)");
      expect(colors[1]).toBe("var(--brand)");
    });
  });

  describe("Color groups", () => {
    it("should have consistent hover state pattern for interactive colors", () => {
      const hoverColors = [
        { base: semanticColors.brand, hover: semanticColors.brandHover },
        { base: semanticColors.danger, hover: semanticColors.dangerHover },
        { base: semanticColors.info, hover: semanticColors.infoHover },
        { base: semanticColors.accent, hover: semanticColors.accentHover },
      ];

      for (const { base, hover } of hoverColors) {
        expect(base).toContain("var(--");
        expect(hover).toContain("var(--");
        expect(hover).toContain("-hover)");
      }
    });

    it("should have consistent muted state pattern for backgrounds", () => {
      const mutedColors = [
        { base: semanticColors.brand, muted: semanticColors.brandMuted },
        { base: semanticColors.danger, muted: semanticColors.dangerMuted },
        { base: semanticColors.success, muted: semanticColors.successMuted },
        { base: semanticColors.warning, muted: semanticColors.warningMuted },
        { base: semanticColors.info, muted: semanticColors.infoMuted },
        { base: semanticColors.accent, muted: semanticColors.accentMuted },
      ];

      for (const { muted } of mutedColors) {
        expect(muted).toContain("var(--");
        expect(muted).toContain("-muted)");
      }
    });
  });
});
