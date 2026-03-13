export type Locale = "en" | "es";
export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES: Locale[] = ["en", "es"];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};
