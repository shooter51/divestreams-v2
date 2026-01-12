import { Link } from "react-router";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl p-12 shadow-sm text-center">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 mb-4">{description}</p>}
      {action && (
        <Link
          to={action.href}
          className="inline-block text-blue-600 hover:underline font-medium"
        >
          {action.label}
        </Link>
      )}
      {children}
    </div>
  );
}
