import { Link } from "react-router";
import type { ReactNode } from "react";

type UpgradePromptVariant = "banner" | "inline" | "overlay";

type UpgradePromptProps = {
  feature: string;
  currentCount?: number;
  limit?: number;
  variant?: UpgradePromptVariant;
};

function UpgradeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M12 1.5l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.51L12 1.5z" />
    </svg>
  );
}

function getMessage(feature: string, currentCount?: number, limit?: number): string {
  if (currentCount !== undefined && limit !== undefined) {
    return `You've reached ${currentCount}/${limit} ${feature} on the Free plan`;
  }
  return `${feature} is a Premium feature`;
}

function BannerPrompt({ feature, currentCount, limit }: Omit<UpgradePromptProps, "variant">) {
  const message = getMessage(feature, currentCount, limit);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg px-4 py-3 text-white shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CrownIcon />
          <div>
            <p className="font-medium">{message}</p>
            <p className="text-sm text-blue-100">
              Upgrade to Premium to unlock unlimited access
            </p>
          </div>
        </div>
        <Link
          to="/app/settings/billing"
          className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          <UpgradeIcon />
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}

function InlinePrompt({ feature, currentCount, limit }: Omit<UpgradePromptProps, "variant">) {
  const message = getMessage(feature, currentCount, limit);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CrownIcon />
          <span>{message}</span>
        </div>
        <Link
          to="/app/settings/billing"
          className="text-amber-700 font-medium hover:text-amber-900 hover:underline whitespace-nowrap"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}

function OverlayPrompt({ feature, currentCount, limit }: Omit<UpgradePromptProps, "variant">) {
  const message = getMessage(feature, currentCount, limit);

  return (
    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm mx-4 text-center">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
          <CrownIcon />
        </div>
        <h3 className="font-semibold text-lg mb-2">Premium Feature</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        <p className="text-sm text-gray-500 mb-4">
          Upgrade your plan to unlock this feature and more
        </p>
        <Link
          to="/app/settings/billing"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <UpgradeIcon />
          Upgrade to Premium
        </Link>
      </div>
    </div>
  );
}

export function UpgradePrompt({
  feature,
  currentCount,
  limit,
  variant = "banner",
}: UpgradePromptProps) {
  const props = { feature, currentCount, limit };

  switch (variant) {
    case "inline":
      return <InlinePrompt {...props} />;
    case "overlay":
      return <OverlayPrompt {...props} />;
    case "banner":
    default:
      return <BannerPrompt {...props} />;
  }
}

// Wrapper component for blocking premium content with overlay
interface PremiumGateProps {
  feature: string;
  currentCount?: number;
  limit?: number;
  isPremium: boolean;
  children: ReactNode;
}

export function PremiumGate({
  feature,
  currentCount,
  limit,
  isPremium,
  children,
}: PremiumGateProps) {
  return (
    <div className="relative">
      {children}
      {!isPremium && (
        <UpgradePrompt
          feature={feature}
          currentCount={currentCount}
          limit={limit}
          variant="overlay"
        />
      )}
    </div>
  );
}
