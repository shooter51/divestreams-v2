import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useToast } from "./toast-context";
import type { ToastType } from "../app/components/ui/Toast";

/**
 * Hook to automatically show toast notifications from URL search params
 * Usage: Add to any route component where you want to show notifications
 *
 * Search params:
 * - ?success=Message text
 * - ?error=Message text
 * - ?info=Message text
 * - ?warning=Message text
 */
export function useNotification() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    const types: ToastType[] = ["success", "error", "info", "warning"];
    let hasNotification = false;

    // Build a key from current notification params to detect duplicates
    const notificationKey = types
      .map((type) => searchParams.get(type))
      .filter(Boolean)
      .join("|");

    // Skip if we already processed these exact notifications
    if (!notificationKey || processedRef.current === notificationKey) {
      return;
    }

    processedRef.current = notificationKey;

    for (const type of types) {
      const message = searchParams.get(type);
      if (message) {
        showToast(message, type);
        hasNotification = true;
      }
    }

    // Clean up notification params from URL after showing
    if (hasNotification) {
      const newParams = new URLSearchParams(searchParams);
      types.forEach((type) => newParams.delete(type));
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);
}

/**
 * Helper to create redirect URLs with notification messages
 */
export function redirectWithNotification(
  path: string,
  message: string,
  type: ToastType = "success"
): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(type, message);
  return `${url.pathname}${url.search}`;
}

/**
 * Helper to create Response redirects with notifications
 */
export function redirectResponse(
  path: string,
  message: string,
  type: ToastType = "success"
): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectWithNotification(path, message, type),
    },
  });
}
