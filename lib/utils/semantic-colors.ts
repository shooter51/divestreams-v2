/**
 * Semantic Color Utilities
 *
 * Centralized color constants using CSS custom properties.
 * Enforces use of semantic tokens instead of hardcoded colors.
 *
 * Usage:
 *   import { semanticColors } from './lib/utils/semantic-colors';
 *   style={{ backgroundColor: semanticColors.surface }}
 */

export const semanticColors = {
  // ============================================================================
  // SURFACES (Backgrounds)
  // ============================================================================

  /** Main page background */
  surface: "var(--surface)",

  /** Card/modal backgrounds (elevated surfaces) */
  surfaceRaised: "var(--surface-raised)",

  /** Depressed areas, subtle backgrounds, inset sections */
  surfaceInset: "var(--surface-inset)",

  /** Hover states, overlays, temporary surfaces */
  surfaceOverlay: "var(--surface-overlay)",

  // ============================================================================
  // FOREGROUND (Text)
  // ============================================================================

  /** Primary text color */
  foreground: "var(--foreground)",

  /** Secondary text, labels, less important text */
  foregroundMuted: "var(--foreground-muted)",

  /** Tertiary text, placeholders, disabled states */
  foregroundSubtle: "var(--foreground-subtle)",

  // ============================================================================
  // BORDERS
  // ============================================================================

  /** Standard border color */
  border: "var(--border)",

  /** Emphasized borders, dividers */
  borderStrong: "var(--border-strong)",

  // ============================================================================
  // BRAND (Primary Actions)
  // ============================================================================

  /** Primary brand color */
  brand: "var(--brand)",

  /** Brand hover state */
  brandHover: "var(--brand-hover)",

  /** Muted brand backgrounds */
  brandMuted: "var(--brand-muted)",

  /** Disabled brand state */
  brandDisabled: "var(--brand-disabled)",

  // ============================================================================
  // SEMANTIC (Status Colors)
  // ============================================================================

  /** Error/danger text */
  danger: "var(--danger)",

  /** Danger hover state */
  dangerHover: "var(--danger-hover)",

  /** Danger background (muted) */
  dangerMuted: "var(--danger-muted)",

  /** Success text */
  success: "var(--success)",

  /** Success background (muted) */
  successMuted: "var(--success-muted)",

  /** Warning text */
  warning: "var(--warning)",

  /** Warning background (muted) */
  warningMuted: "var(--warning-muted)",

  /** Info text */
  info: "var(--info)",

  /** Info hover state */
  infoHover: "var(--info-hover)",

  /** Info background (muted) */
  infoMuted: "var(--info-muted)",

  /** Accent color */
  accent: "var(--accent)",

  /** Accent hover state */
  accentHover: "var(--accent-hover)",

  /** Accent background (muted) */
  accentMuted: "var(--accent-muted)",
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SemanticColor = typeof semanticColors[keyof typeof semanticColors];
