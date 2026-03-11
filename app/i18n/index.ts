/**
 * Minimal i18n utility for the public site.
 *
 * Supports two locales: "en" (English) and "es" (Spanish).
 * Keys use dot-notation (e.g. "auth.invalidCredentials").
 * Interpolation uses {{placeholder}} syntax.
 */

import en from "./locales/en.json";
import es from "./locales/es.json";

type LocaleData = typeof en;

const LOCALES: Record<string, LocaleData> = { en, es };

/**
 * Resolve a dot-notation key from a locale object.
 * Returns the key itself if not found (safe fallback).
 */
function resolve(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "string") return current;
  return key;
}

/**
 * Substitute {{placeholder}} variables in a translated string.
 */
function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = vars[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

/**
 * Create a translation function bound to a locale.
 *
 * @param locale - "en" or "es" (defaults to "en")
 * @returns t(key, vars?) function
 */
export function createT(locale = "en") {
  const data = (LOCALES[locale] ?? LOCALES.en) as Record<string, unknown>;
  return function t(
    key: string,
    vars?: Record<string, string | number>
  ): string {
    const template = resolve(data, key);
    return interpolate(template, vars);
  };
}

/**
 * Locale-aware date formatter.
 *
 * @param dateStr  - ISO date string or "YYYY-MM-DD"
 * @param locale   - "en" | "es" (defaults to "en")
 * @param options  - Intl.DateTimeFormatOptions
 */
export function formatLocalizedDate(
  dateStr: string,
  locale = "en",
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const intlLocale = locale === "es" ? "es-ES" : "en-US";
  const date = new Date(
    dateStr.includes("T") ? dateStr : dateStr + "T00:00:00"
  );
  return date.toLocaleDateString(intlLocale, { ...options, timeZone: "UTC" });
}
