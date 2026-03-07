import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";
import en from "./locales/en.json";
import es from "./locales/es.json";

export type Translations = Record<string, string>;

const translationCache: Partial<Record<Locale, Translations>> = {};

const localeModules: Record<Locale, Translations> = { en, es };

export function getTranslations(locale: Locale): Translations {
  if (translationCache[locale]) return translationCache[locale];
  const translations = localeModules[locale] ?? localeModules[DEFAULT_LOCALE];
  translationCache[locale] = translations;
  return translations;
}

/**
 * Look up a translation key with optional interpolation.
 * Falls back to English, then to the key itself.
 * Interpolation uses {{name}} syntax.
 */
export function t(
  translations: Translations,
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = translations[key];

  // Fallback to English
  if (value === undefined) {
    const enTranslations = getTranslations(DEFAULT_LOCALE);
    value = enTranslations[key];
  }

  // Fallback to key
  if (value === undefined) return key;

  // Interpolation — escape paramKey for safe regex construction
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      const escaped = paramKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      value = value.replace(
        new RegExp(`\\{\\{${escaped}\\}\\}`, "g"),
        String(paramValue),
      );
    }
  }

  return value;
}
