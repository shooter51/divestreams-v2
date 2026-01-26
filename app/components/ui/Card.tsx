import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div className={`bg-surface-raised rounded-xl shadow-sm ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-foreground-muted text-sm mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface ClickableCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
}

export function ClickableCard({ children, onClick, className = "", selected = false }: ClickableCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-raised rounded-xl shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-brand transition-all ${
        selected ? "ring-2 ring-brand" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
