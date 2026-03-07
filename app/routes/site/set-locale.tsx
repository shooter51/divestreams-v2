import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { SUPPORTED_LOCALES, type Locale } from "../../i18n/types";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const locale = formData.get("locale") as string;

  // Validate redirect target to prevent open redirect via Referer header
  const referer = request.headers.get("Referer") || "/site";
  let safeRedirect = "/site";
  try {
    const refererUrl = new URL(referer, request.url);
    const origin = new URL(request.url).origin;
    if (refererUrl.origin === origin) {
      safeRedirect = refererUrl.pathname + refererUrl.search;
    }
  } catch {
    // Invalid URL — use default
  }

  // Validate locale
  const validLocale: Locale = SUPPORTED_LOCALES.includes(locale as Locale)
    ? (locale as Locale)
    : "en";

  return redirect(safeRedirect, {
    headers: {
      "Set-Cookie": `ds_locale=${validLocale}; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax; Secure`,
    },
  });
}
