import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-overlay text-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  error: "bg-danger-muted text-danger",
  info: "bg-brand-muted text-brand",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-1" : "text-sm px-3 py-1";

  return (
    <span className={`rounded-full inline-flex items-center ${sizeClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Enhanced status badge with proper typing and human-readable labels
export type BadgeStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"
  | "available"
  | "unavailable"
  | "rented"
  | "maintenance"
  | "retired"
  | "active"
  | "inactive"
  | "paid"
  | "unpaid"
  | "refunded"
  | "partial"
  | "failed";

interface StatusConfig {
  variant: BadgeVariant;
  label: string;
}

const STATUS_MAP: Record<BadgeStatus, StatusConfig> = {
  // Booking statuses
  pending: { variant: "warning", label: "Pending" },
  confirmed: { variant: "success", label: "Confirmed" },
  checked_in: { variant: "info", label: "Checked In" },
  completed: { variant: "default", label: "Completed" },
  cancelled: { variant: "error", label: "Cancelled" },
  no_show: { variant: "info", label: "No Show" },
  // Availability statuses
  available: { variant: "success", label: "Available" },
  unavailable: { variant: "error", label: "Unavailable" },
  // Equipment statuses
  rented: { variant: "info", label: "Rented" },
  maintenance: { variant: "warning", label: "Maintenance" },
  retired: { variant: "default", label: "Retired" },
  // Active/Inactive
  active: { variant: "success", label: "Active" },
  inactive: { variant: "default", label: "Inactive" },
  // Payment statuses
  paid: { variant: "success", label: "Paid" },
  unpaid: { variant: "warning", label: "Unpaid" },
  refunded: { variant: "default", label: "Refunded" },
  partial: { variant: "warning", label: "Partial" },
  failed: { variant: "error", label: "Failed" },
};

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: BadgeStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const config = STATUS_MAP[status];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
}

export function ConditionBadge({ condition }: { condition: string }) {
  const conditionVariants: Record<string, BadgeVariant> = {
    excellent: "success",
    good: "info",
    fair: "warning",
    poor: "error",
  };

  return <Badge variant={conditionVariants[condition] || "default"}>{condition}</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const difficultyVariants: Record<string, BadgeVariant> = {
    beginner: "success",
    intermediate: "info",
    advanced: "warning",
    expert: "error",
  };

  return <Badge variant={difficultyVariants[difficulty] || "default"}>{difficulty}</Badge>;
}
