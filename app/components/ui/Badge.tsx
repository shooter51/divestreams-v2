import type { ReactNode } from "react";

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

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-1" : "text-sm px-3 py-1";

  return (
    <span className={`rounded-full inline-flex items-center ${sizeClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Pre-built status badges for common use cases
export function StatusBadge({ status }: { status: string }) {
  const statusVariants: Record<string, BadgeVariant> = {
    // Booking statuses
    confirmed: "success",
    pending: "warning",
    cancelled: "error",
    completed: "info",
    // Equipment statuses
    available: "success",
    rented: "info",
    maintenance: "warning",
    retired: "default",
    // Boat/general active status
    active: "success",
    inactive: "default",
    // Payment statuses
    paid: "success",
    unpaid: "warning",
    refunded: "error",
    partial: "warning",
  };

  return <Badge variant={statusVariants[status] || "default"}>{status}</Badge>;
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
