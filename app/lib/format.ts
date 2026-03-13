/**
 * Shared formatting utilities for display values.
 */

/**
 * Format an ISO date string (YYYY-MM-DD) to a human-readable date (e.g. "Mar 4, 2026").
 * Appends T00:00:00 to avoid timezone shifts when parsing date-only strings.
 */
export function formatDisplayDate(date: string | null | undefined, locale = "en-US"): string {
  if (!date) return "";
  return new Date(date + "T00:00:00").toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a time string from HH:MM:SS or HH:MM to locale-appropriate format.
 */
export function formatTime(time: string | null | undefined, locale = "en-US"): string {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  if (isNaN(hour)) return time;
  // Use Intl for locale-aware time formatting
  const d = new Date(2000, 0, 1, hour, parseInt(minute, 10));
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/**
 * Format a number as currency (e.g. 1200 → "$1,200.00").
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  locale = "en-US",
  currency = "USD",
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return new Intl.NumberFormat(locale, { style: "currency", currency }).format(0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Format a limit value, showing "Unlimited" for Infinity or -1.
 */
export function formatLimit(value: number): string {
  if (value === Infinity || value === -1) return "Unlimited";
  return value.toLocaleString();
}

/**
 * Format a capacity display: "X/Y" or "X/Unlimited" when max is 0/null/undefined.
 */
export function formatCapacity(current: number, max: number | null | undefined): string {
  if (!max || max <= 0) return `${current}/Unlimited`;
  return `${current}/${max}`;
}

/**
 * Pluralize a word based on count. e.g. pluralize(1, "booking") → "1 booking"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural || `${singular}s`);
  return `${count} ${word}`;
}

/**
 * Capitalize the first letter of a string and replace underscores with spaces.
 * e.g. "in_progress" → "In Progress", "weekly" → "Weekly"
 */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Recurrence pattern labels */
const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

export function formatRecurrencePattern(pattern: string | null | undefined): string {
  if (!pattern) return "";
  return RECURRENCE_LABELS[pattern] || formatLabel(pattern);
}

/** Transaction type labels */
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  refund: "Refund",
  deposit: "Deposit",
  payment: "Payment",
};

export function formatTransactionType(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] || formatLabel(type);
}

/** Payment method labels */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  stripe: "Stripe",
  bank_transfer: "Bank Transfer",
};

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "N/A";
  return PAYMENT_METHOD_LABELS[method] || formatLabel(method);
}
