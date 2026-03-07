import { useLocale } from "./use-t";
import {
  formatCurrency as rawFormatCurrency,
  formatDisplayDate as rawFormatDisplayDate,
  formatTime as rawFormatTime,
} from "../lib/format";
import { useCallback, useMemo } from "react";

export function useFormat() {
  const locale = useLocale();

  const formatCurrency = useCallback(
    (amount: number | string | null | undefined) =>
      rawFormatCurrency(amount, locale),
    [locale],
  );

  const formatDisplayDate = useCallback(
    (date: string | null | undefined) => rawFormatDisplayDate(date, locale),
    [locale],
  );

  const formatTime = useCallback(
    (time: string | null | undefined) => rawFormatTime(time, locale),
    [locale],
  );

  return useMemo(
    () => ({ formatCurrency, formatDisplayDate, formatTime }),
    [formatCurrency, formatDisplayDate, formatTime],
  );
}
