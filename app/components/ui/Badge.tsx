import type { ReactNode } from "react";
import { useT } from "../../i18n/use-t";

/**
 * Badge variant types that determine the color scheme.
 * - default: Neutral gray badge
 * - success: Green badge for positive states
 * - warning: Yellow/orange badge for warnings
 * - error: Red badge for errors
 * - info: Blue brand color badge for informational content
 */
type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "accent";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-overlay text-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  error: "bg-danger-muted text-danger",
  info: "bg-brand-muted text-brand",
  accent: "bg-accent-muted text-accent",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Generic badge component for displaying labels, tags, and status indicators.
 * Uses semantic color tokens for automatic dark mode support.
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="md">Pending</Badge>
 * ```
 */
export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-1" : "text-sm px-3 py-1";

  return (
    <span className={`rounded-full inline-flex items-center ${sizeClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Comprehensive status type covering all system entities.
 * Supports 37 different status values across bookings, trips, equipment,
 * payments, training, and other domain objects.
 *
 * Each status maps to a semantic variant (success/warning/error/info/default)
 * and a human-readable label for consistent display across the application.
 */
export type BadgeStatus =
  // Booking statuses
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "canceled"      // US spelling variant
  | "no_show"
  // Trip statuses
  | "scheduled"
  | "in_progress"
  | "open"
  | "full"
  // Availability statuses
  | "available"
  | "unavailable"
  // Equipment statuses
  | "rented"
  | "maintenance"
  | "retired"
  // Rental statuses
  | "overdue"
  | "returned"
  // Active/Inactive
  | "active"
  | "inactive"
  | "archived"
  // Payment statuses
  | "paid"
  | "unpaid"
  | "refunded"
  | "partial"
  | "failed"
  | "succeeded"
  // Training enrollment
  | "enrolled"
  | "dropped"
  // Content/messaging
  | "new"
  | "read"
  | "replied"
  | "draft"
  | "published"
  | "spam"
  // Subscription
  | "trialing"
  | "past_due"
  // Integration sync
  | "success";

const STATUS_VARIANTS: Record<BadgeStatus, BadgeVariant> = {
  // Booking statuses
  pending: "warning",
  confirmed: "success",
  checked_in: "info",
  completed: "default",
  cancelled: "error",
  canceled: "error",
  no_show: "info",
  // Trip statuses
  scheduled: "info",
  in_progress: "warning",
  open: "info",
  full: "warning",
  // Availability statuses
  available: "success",
  unavailable: "error",
  // Equipment statuses
  rented: "info",
  maintenance: "warning",
  retired: "default",
  // Rental statuses
  overdue: "error",
  returned: "success",
  // Active/Inactive
  active: "success",
  inactive: "default",
  archived: "default",
  // Payment statuses
  paid: "success",
  unpaid: "warning",
  refunded: "default",
  partial: "warning",
  failed: "error",
  succeeded: "success",
  // Training enrollment
  enrolled: "success",
  dropped: "error",
  // Content/messaging
  new: "warning",
  read: "info",
  replied: "success",
  draft: "warning",
  published: "success",
  spam: "error",
  // Subscription
  trialing: "info",
  past_due: "error",
  // Integration sync
  success: "success",
};

/**
 * Status badge component with pre-configured variants and labels.
 * Automatically maps status values to appropriate colors and readable labels.
 *
 * @example
 * ```tsx
 * // Booking statuses
 * <StatusBadge status="pending" />      // Yellow "Pending"
 * <StatusBadge status="confirmed" />    // Green "Confirmed"
 * <StatusBadge status="cancelled" />    // Red "Cancelled"
 *
 * // Payment statuses
 * <StatusBadge status="paid" />         // Green "Paid"
 * <StatusBadge status="refunded" />     // Gray "Refunded"
 *
 * // With size
 * <StatusBadge status="in_progress" size="md" />
 * ```
 */
export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: BadgeStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useT();
  const variant = STATUS_VARIANTS[status];
  const label = t(`common.status.${status}`);

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}

/**
 * Badge for displaying equipment condition.
 * Maps condition values (excellent, good, fair, poor) to semantic colors.
 *
 * @example
 * ```tsx
 * <ConditionBadge condition="excellent" />  // Green
 * <ConditionBadge condition="fair" />       // Yellow
 * ```
 */
export function ConditionBadge({ condition }: { condition: string }) {
  const conditionVariants: Record<string, BadgeVariant> = {
    excellent: "success",
    good: "info",
    fair: "warning",
    poor: "error",
  };

  return <Badge variant={conditionVariants[condition] || "default"}>{condition}</Badge>;
}

/**
 * Badge for displaying dive/course difficulty level.
 * Maps difficulty values (beginner, intermediate, advanced, expert) to semantic colors.
 *
 * @example
 * ```tsx
 * <DifficultyBadge difficulty="beginner" />     // Green
 * <DifficultyBadge difficulty="advanced" />     // Yellow
 * <DifficultyBadge difficulty="expert" />       // Red
 * ```
 */
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const difficultyVariants: Record<string, BadgeVariant> = {
    beginner: "success",
    intermediate: "info",
    advanced: "warning",
    expert: "error",
  };

  return <Badge variant={difficultyVariants[difficulty] || "default"}>{difficulty}</Badge>;
}
