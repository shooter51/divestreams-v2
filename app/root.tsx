import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import type { Locale } from "./i18n/types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./i18n/types";
import { getTranslations } from "./i18n/index";
import { LocaleContext } from "./i18n/use-t";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
];

function resolveLocale(request: Request): Locale {
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

export async function loader({ request }: Route.LoaderArgs) {
  const locale = resolveLocale(request);
  const translations = getTranslations(locale);
  return { locale, translations };
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Try to get locale from loader data, fallback to "en" during error boundaries
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const data = useLoaderData<typeof loader>();
    if (data?.locale) locale = data.locale;
  } catch {
    // useLoaderData throws during ErrorBoundary rendering — use default
  }

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded">
          Skip to main content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { locale, translations } = useLoaderData<typeof loader>();

  return (
    <LocaleContext.Provider value={{ locale, translations }}>
      <div id="main-content">
        <Outlet />
      </div>
    </LocaleContext.Provider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
