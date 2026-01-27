/**
 * Public Site Theme System
 *
 * Defines theme presets with CSS variables for tenant public sites.
 * Each theme provides a consistent color palette and styling for
 * the public-facing dive shop website.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ThemeName = "ocean" | "tropical" | "minimal" | "dark" | "classic";

export interface ThemeColors {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerBg: string;
  footerBg: string;
  /** Dark mode overrides — applied via @media (prefers-color-scheme: dark) */
  dark: ThemeDarkColors;
}

export interface ThemeDarkColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerBg: string;
  footerBg: string;
  /** Card/raised surface background */
  cardBg: string;
  /** Border color for dark mode */
  borderColor: string;
}

export interface ThemeOverrides {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headerBg?: string;
  footerBg?: string;
}

// ============================================================================
// THEME PRESETS
// ============================================================================

/**
 * Ocean Theme - Blue/cyan oceanic feel
 * Perfect for dive shops wanting a deep sea vibe
 */
export const oceanTheme: ThemeColors = {
  name: "ocean",
  primaryColor: "#0077B6",      // Deep ocean blue
  secondaryColor: "#00B4D8",    // Bright cyan
  accentColor: "#90E0EF",       // Light seafoam
  backgroundColor: "#F0F9FF",   // Very light blue tint
  textColor: "#1E3A5F",         // Dark navy text
  headerBg: "#023E8A",          // Deep navy header
  footerBg: "#03045E",          // Darker navy footer
  dark: {
    primaryColor: "#60A5FA",    // Blue-400 (brighter for dark bg)
    secondaryColor: "#22D3EE",  // Cyan-400
    accentColor: "#172554",     // Blue-950 (muted accent)
    backgroundColor: "#030712", // Gray-950
    textColor: "#E0F2FE",       // Sky-100
    headerBg: "#030712",        // Gray-950
    footerBg: "#020617",        // Slate-950
    cardBg: "#111827",          // Gray-900
    borderColor: "#374151",     // Gray-700
  },
};

/**
 * Tropical Theme - Green/turquoise tropical vibe
 * Ideal for tropical dive destinations
 */
export const tropicalTheme: ThemeColors = {
  name: "tropical",
  primaryColor: "#20B2AA",      // Light sea green
  secondaryColor: "#3CB371",    // Medium sea green
  accentColor: "#FFD700",       // Golden yellow (sun)
  backgroundColor: "#F0FFF4",   // Mint cream background
  textColor: "#1A4D2E",         // Dark forest text
  headerBg: "#006D5B",          // Teal header
  footerBg: "#004D40",          // Dark teal footer
  dark: {
    primaryColor: "#34D399",    // Emerald-400
    secondaryColor: "#4ADE80",  // Green-400
    accentColor: "#FBBF24",     // Amber-400
    backgroundColor: "#030712", // Gray-950
    textColor: "#D1FAE5",       // Emerald-100
    headerBg: "#030712",        // Gray-950
    footerBg: "#020617",        // Slate-950
    cardBg: "#111827",          // Gray-900
    borderColor: "#374151",     // Gray-700
  },
};

/**
 * Minimal Theme - Clean grayscale professional
 * For dive shops wanting a modern, clean look
 */
export const minimalTheme: ThemeColors = {
  name: "minimal",
  primaryColor: "#374151",      // Gray-700
  secondaryColor: "#6B7280",    // Gray-500
  accentColor: "#3B82F6",       // Blue-500 accent
  backgroundColor: "#FFFFFF",   // Pure white
  textColor: "#1F2937",         // Gray-800 text
  headerBg: "#F9FAFB",          // Gray-50 header
  footerBg: "#111827",          // Gray-900 footer
  dark: {
    primaryColor: "#D1D5DB",    // Gray-300 (inverted)
    secondaryColor: "#9CA3AF",  // Gray-400
    accentColor: "#60A5FA",     // Blue-400
    backgroundColor: "#030712", // Gray-950
    textColor: "#F3F4F6",       // Gray-100
    headerBg: "#111827",        // Gray-900
    footerBg: "#030712",        // Gray-950
    cardBg: "#1F2937",          // Gray-800
    borderColor: "#374151",     // Gray-700
  },
};

/**
 * Dark Theme - Dark mode with blue accents
 * Modern dark mode for evening browsing
 */
export const darkTheme: ThemeColors = {
  name: "dark",
  primaryColor: "#60A5FA",      // Blue-400
  secondaryColor: "#818CF8",    // Indigo-400
  accentColor: "#34D399",       // Emerald-400
  backgroundColor: "#0F172A",   // Slate-900
  textColor: "#F1F5F9",         // Slate-100 text
  headerBg: "#1E293B",          // Slate-800 header
  footerBg: "#020617",          // Slate-950 footer
  dark: {
    primaryColor: "#60A5FA",    // Same (already light-on-dark)
    secondaryColor: "#818CF8",  // Same
    accentColor: "#34D399",     // Same
    backgroundColor: "#030712", // Deepened to gray-950
    textColor: "#E2E8F0",       // Slate-200
    headerBg: "#030712",        // Gray-950
    footerBg: "#020617",        // Slate-950
    cardBg: "#0F172A",          // Slate-900
    borderColor: "#1E293B",     // Slate-800
  },
};

/**
 * Classic Theme - Traditional navy/gold dive shop
 * Timeless look for established dive operations
 */
export const classicTheme: ThemeColors = {
  name: "classic",
  primaryColor: "#1E3A5F",      // Navy blue
  secondaryColor: "#2C5282",    // Lighter navy
  accentColor: "#D4A942",       // Gold accent
  backgroundColor: "#FFFBF0",   // Warm white background
  textColor: "#1A202C",         // Near black text
  headerBg: "#1A365D",          // Deep navy header
  footerBg: "#0D1B2A",          // Darker navy footer
  dark: {
    primaryColor: "#818CF8",    // Indigo-400
    secondaryColor: "#A5B4FC",  // Indigo-300
    accentColor: "#FBBF24",     // Amber-400 (gold)
    backgroundColor: "#030712", // Gray-950
    textColor: "#E0E7FF",       // Indigo-100
    headerBg: "#030712",        // Gray-950
    footerBg: "#020617",        // Slate-950
    cardBg: "#111827",          // Gray-900
    borderColor: "#374151",     // Gray-700
  },
};

// ============================================================================
// THEME MAP
// ============================================================================

export const themePresets: Record<ThemeName, ThemeColors> = {
  ocean: oceanTheme,
  tropical: tropicalTheme,
  minimal: minimalTheme,
  dark: darkTheme,
  classic: classicTheme,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a theme by name
 * @param name - The theme name
 * @returns The theme colors or ocean theme as fallback
 */
export function getTheme(name: ThemeName): ThemeColors {
  return themePresets[name] ?? oceanTheme;
}

/**
 * Generate CSS custom properties string from theme
 * @param theme - Theme name or theme colors object
 * @param overrides - Optional color overrides from tenant settings
 * @returns CSS custom properties string for use in style tags
 */
export function getThemeCSS(
  theme: ThemeName | ThemeColors,
  overrides?: ThemeOverrides
): string {
  // Get base theme colors
  const baseTheme = typeof theme === "string" ? getTheme(theme) : theme;

  // Apply overrides
  const finalColors: ThemeColors = {
    name: baseTheme.name,
    primaryColor: overrides?.primaryColor ?? baseTheme.primaryColor,
    secondaryColor: overrides?.secondaryColor ?? baseTheme.secondaryColor,
    accentColor: overrides?.accentColor ?? baseTheme.accentColor,
    backgroundColor: overrides?.backgroundColor ?? baseTheme.backgroundColor,
    textColor: overrides?.textColor ?? baseTheme.textColor,
    headerBg: overrides?.headerBg ?? baseTheme.headerBg,
    footerBg: overrides?.footerBg ?? baseTheme.footerBg,
    dark: baseTheme.dark,
  };

  // Generate CSS custom properties
  return `
    --color-primary: ${finalColors.primaryColor};
    --color-secondary: ${finalColors.secondaryColor};
    --color-accent: ${finalColors.accentColor};
    --color-background: ${finalColors.backgroundColor};
    --color-text: ${finalColors.textColor};
    --color-header-bg: ${finalColors.headerBg};
    --color-footer-bg: ${finalColors.footerBg};
    --color-card-bg: ${isDarkTheme(finalColors.name as ThemeName) ? "#1E293B" : "#FFFFFF"};
    --color-border: ${isDarkTheme(finalColors.name as ThemeName) ? "#334155" : "#E5E7EB"};

    /* Derived colors for common use cases */
    --color-primary-hover: ${adjustBrightness(finalColors.primaryColor, -10)};
    --color-secondary-hover: ${adjustBrightness(finalColors.secondaryColor, -10)};
    --color-accent-hover: ${adjustBrightness(finalColors.accentColor, -10)};

    /* Text colors for backgrounds */
    --color-header-text: ${getContrastColor(finalColors.headerBg)};
    --color-footer-text: ${getContrastColor(finalColors.footerBg)};
    --color-primary-text: ${getContrastColor(finalColors.primaryColor)};
  `.trim();
}

/**
 * Generate a complete style tag content for a theme
 * @param theme - Theme name or theme colors object
 * @param overrides - Optional color overrides
 * @returns Complete CSS for the :root selector
 */
export function getThemeStyleTag(
  theme: ThemeName | ThemeColors,
  overrides?: ThemeOverrides
): string {
  return `:root {\n  ${getThemeCSS(theme, overrides)}\n}`;
}

/**
 * Generate complete CSS style block for a theme including dark mode overrides.
 * Uses `.site-theme` scoping class to avoid inline style specificity issues.
 * Returns both light and dark mode CSS for use in a <style> tag.
 */
export function getThemeStyleBlock(
  theme: ThemeName | ThemeColors,
  overrides?: ThemeOverrides
): string {
  const baseTheme = typeof theme === "string" ? getTheme(theme) : theme;
  const dark = baseTheme.dark;

  const finalPrimary = overrides?.primaryColor ?? baseTheme.primaryColor;
  const finalSecondary = overrides?.secondaryColor ?? baseTheme.secondaryColor;
  const finalAccent = overrides?.accentColor ?? baseTheme.accentColor;
  const darkFinal = baseTheme.name === "dark";

  return `.site-theme {
  --primary-color: ${finalPrimary};
  --secondary-color: ${finalSecondary};
  --background-color: ${baseTheme.backgroundColor};
  --text-color: ${baseTheme.textColor};
  --accent-color: ${finalAccent};
  --color-card-bg: ${darkFinal ? "#1E293B" : "#FFFFFF"};
  --color-border: ${darkFinal ? "#334155" : "#E5E7EB"};
  --color-primary-hover: ${adjustBrightness(finalPrimary, -10)};
  --color-primary-text: ${getContrastColor(finalPrimary)};
  --danger-bg: #FEE2E2;
  --danger-text: #991B1B;
  --danger-border: #FCA5A5;
  --success-bg: #D1FAE5;
  --success-text: #065F46;
}
@media (prefers-color-scheme: dark) {
  .site-theme {
    --primary-color: ${overrides?.primaryColor ?? dark.primaryColor};
    --secondary-color: ${overrides?.secondaryColor ?? dark.secondaryColor};
    --accent-color: ${overrides?.accentColor ?? dark.accentColor};
    --background-color: ${dark.backgroundColor};
    --text-color: ${dark.textColor};
    --color-card-bg: ${dark.cardBg};
    --color-border: ${dark.borderColor};
    --color-primary-hover: ${adjustBrightness(overrides?.primaryColor ?? dark.primaryColor, 15)};
    --color-primary-text: ${getContrastColor(overrides?.primaryColor ?? dark.primaryColor)};
    --danger-bg: #7F1D1D;
    --danger-text: #FCA5A5;
    --danger-border: #991B1B;
    --success-bg: #064E3B;
    --success-text: #6EE7B7;
  }
}`;
}

/**
 * Check if a theme is a dark theme (for proper text contrast)
 * @param theme - Theme name
 * @returns True if the theme uses a dark background
 */
export function isDarkTheme(theme: ThemeName): boolean {
  return theme === "dark";
}

/**
 * Get all available theme names
 * @returns Array of theme names
 */
export function getAvailableThemes(): ThemeName[] {
  return Object.keys(themePresets) as ThemeName[];
}

/**
 * Validate if a string is a valid theme name
 * @param name - String to validate
 * @returns True if valid theme name
 */
export function isValidThemeName(name: string): name is ThemeName {
  return name in themePresets;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Adjust brightness of a hex color
 * @param hex - Hex color string
 * @param percent - Positive for lighter, negative for darker
 * @returns Adjusted hex color
 */
function adjustBrightness(hex: string, percent: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Adjust each channel
  const adjustChannel = (channel: number) => {
    const adjusted = Math.round(channel + (channel * percent) / 100);
    return Math.min(255, Math.max(0, adjusted));
  };

  const newR = adjustChannel(r);
  const newG = adjustChannel(g);
  const newB = adjustChannel(b);

  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

/**
 * Get contrasting text color (black or white) for a background
 * @param backgroundColor - Hex color of the background
 * @returns "#FFFFFF" or "#000000" for best contrast
 */
function getContrastColor(backgroundColor: string): string {
  // Remove # if present
  const hex = backgroundColor.replace("#", "");

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? "#1F2937" : "#FFFFFF";
}
