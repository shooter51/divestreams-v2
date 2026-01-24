import { Link } from "react-router";
import type { PlanFeatureKey, PlanLimits } from "../../lib/plan-features";
import { FEATURE_UPGRADE_INFO, LIMIT_LABELS } from "../../lib/plan-features";

interface UpgradeModalProps {
  feature?: PlanFeatureKey | null;
  limitType?: string | null;
  onClose: () => void;
}

export function UpgradeModal({ feature, limitType, onClose }: UpgradeModalProps) {
  if (!feature && !limitType) return null;

  let title: string;
  let description: string;
  let requiredPlan: string;

  if (feature && FEATURE_UPGRADE_INFO[feature]) {
    const info = FEATURE_UPGRADE_INFO[feature];
    title = info.title;
    description = info.description;
    requiredPlan = info.requiredPlan;
  } else if (limitType) {
    const limitLabel = LIMIT_LABELS[limitType as keyof PlanLimits] ?? limitType;
    title = `${limitLabel} Limit Reached`;
    description = `You've reached your plan's limit for ${limitLabel.toLowerCase()}. Upgrade to add more.`;
    requiredPlan = "a higher plan";
  } else {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          {/* Lock icon */}
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-2 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-medium text-gray-900">
            Upgrade to {requiredPlan} to unlock this feature
          </p>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Maybe Later
            </button>
            <Link
              to="/tenant/settings/billing"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
