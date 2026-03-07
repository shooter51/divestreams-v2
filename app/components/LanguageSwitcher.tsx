import { Form } from "react-router";
import { useLocale } from "../i18n/use-t";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "../i18n/types";

export function LanguageSwitcher() {
  const currentLocale = useLocale();

  return (
    <Form method="post" action="/site/set-locale" className="inline-flex">
      <select
        name="locale"
        defaultValue={currentLocale}
        onChange={(e) => {
          const form = e.currentTarget.closest("form");
          if (form) form.requestSubmit();
        }}
        className="text-sm bg-transparent border border-current/20 rounded px-2 py-1 cursor-pointer"
        aria-label="Select language"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </Form>
  );
}
