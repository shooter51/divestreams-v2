import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icons } from "./Icons";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: string;
  features: string[];
  available: boolean;
  onConnect: () => void;
  connectLabel?: string;
  upgradeLabel?: string;
  requiresPlanLabel?: string;
  notAvailableLabel?: string;
  /** Optional slot for rendering action buttons in connected state */
  actions?: ReactNode;
}

export function IntegrationCard({
  name,
  description,
  icon,
  features,
  available,
  onConnect,
  connectLabel = "Connect",
  upgradeLabel = "Upgrade to unlock",
  requiresPlanLabel,
  notAvailableLabel = "Not available on your plan",
  actions,
}: IntegrationCardProps) {
  const IconComponent = Icons[icon as keyof typeof Icons] as React.ComponentType<{ className?: string }> | undefined;

  return (
    <div className={`bg-surface-raised rounded-xl p-6 shadow-sm ${!available ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 text-foreground-muted">
            {IconComponent && <IconComponent className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold">{name}</h3>
            <p className="text-sm text-foreground-muted">{description}</p>
          </div>
        </div>
      </div>

      <ul className="space-y-1 mb-4">
        {features.map((feature) => (
          <li key={feature} className="text-xs text-foreground-muted flex items-center gap-1">
            <Icons.Check className="w-3 h-3 text-success" />
            {feature}
          </li>
        ))}
      </ul>

      {actions ?? (
        available ? (
          <button
            type="button"
            onClick={onConnect}
            className="w-full py-2 bg-brand text-white rounded-lg hover:bg-brand-hover text-sm"
          >
            {connectLabel}
          </button>
        ) : (
          <div className="text-center">
            <p className="text-xs text-foreground-muted mb-2">
              {requiresPlanLabel ?? notAvailableLabel}
            </p>
            <Link to="/tenant/settings/billing" className="text-sm text-brand hover:underline">
              {upgradeLabel}
            </Link>
          </div>
        )
      )}
    </div>
  );
}
