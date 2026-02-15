import type { ReactNode } from "react";

type AlertVariant = "success" | "error" | "warning" | "info";

const variantClasses: Record<AlertVariant, string> = {
  success: "bg-success-muted text-success border-success",
  error: "bg-danger-muted text-danger border-danger",
  warning: "bg-warning-muted text-warning border-warning",
  info: "bg-brand-muted text-brand border-brand",
};

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant, children, className = "" }: AlertProps) {
  return (
    <div className={`p-4 rounded-lg border ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
