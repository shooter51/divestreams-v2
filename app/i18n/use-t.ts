import { createContext, useContext, useCallback } from "react";
import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";
import { t, type Translations } from "./index";

interface LocaleContextValue {
  locale: Locale;
  translations: Translations;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  translations: {},
});

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const { translations } = useContext(LocaleContext);
  return useCallback(
    (key: string, params?: Record<string, string | number>) =>
      t(translations, key, params),
    [translations],
  );
}
