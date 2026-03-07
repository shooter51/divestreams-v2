import type { Locale } from "./types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./types";

/**
 * Resolve the user's preferred locale from request headers.
 * Priority: ds_locale cookie > Accept-Language header > DEFAULT_LOCALE.
 */
export function resolveLocale(request: Request): Locale {
  // 1. Check ds_locale cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/ds_locale=(\w+)/);
  if (cookieMatch) {
    const cookieLocale = cookieMatch[1] as Locale;
    if (SUPPORTED_LOCALES.includes(cookieLocale)) return cookieLocale;
  }

  // 2. Parse Accept-Language header
  const acceptLanguage = request.headers.get("Accept-Language") || "";
  const languages = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, q] = part.trim().split(";q=");
      return { lang: lang.trim().split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of languages) {
    if (SUPPORTED_LOCALES.includes(lang as Locale)) return lang as Locale;
  }

  return DEFAULT_LOCALE;
}
