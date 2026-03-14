import { useFetcher, useRouteLoaderData } from "react-router";
import { CSRF_FIELD_NAME } from "../../lib/security/csrf-constants";

interface TenantLayoutData {
  csrfToken?: string;
}

/**
 * A wrapper around useFetcher that automatically injects the CSRF token
 * into all submit calls. Prevents 403 Forbidden from CSRF middleware
 * when using fetcher.submit() programmatically.
 */
export function useCsrfFetcher<T = unknown>() {
  const fetcher = useFetcher<T>();
  const layoutData = useRouteLoaderData("routes/tenant/layout") as TenantLayoutData | undefined;
  const csrfToken = layoutData?.csrfToken ?? "";

  const originalSubmit = fetcher.submit;

  const csrfSubmit: typeof fetcher.submit = (target, options) => {
    // If target is FormData, append CSRF token
    if (target instanceof FormData) {
      if (!target.has(CSRF_FIELD_NAME)) {
        target.set(CSRF_FIELD_NAME, csrfToken);
      }
      return originalSubmit(target, options);
    }

    // If target is a plain object (Record<string, string>), add CSRF token
    if (target && typeof target === "object" && !(target instanceof HTMLFormElement) && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLInputElement) && !("currentTarget" in target)) {
      const withCsrf = { ...target as Record<string, string>, [CSRF_FIELD_NAME]: csrfToken };
      return originalSubmit(withCsrf, options);
    }

    // For HTMLFormElement, HTMLButtonElement, etc. — CsrfInput should handle it
    return originalSubmit(target, options);
  };

  return {
    ...fetcher,
    submit: csrfSubmit,
  };
}
