/**
 * Onboarding Button
 *
 * Floating action button that shows onboarding progress and opens the sidebar.
 */

import { useOnboarding } from "./OnboardingContext";

export function OnboardingButton() {
  const { progress, toggleSidebar, completedCount, totalCount, progressPercentage } =
    useOnboarding();

  // Don't show if dismissed or 100% complete
  if (progress?.dismissed || progressPercentage === 100) {
    return null;
  }

  return (
    <button
      onClick={toggleSidebar}
      className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-40 flex items-center gap-2"
      aria-label="Open setup checklist"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
      <span className="text-sm font-medium">
        {completedCount}/{totalCount}
      </span>
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        <span className="text-xs font-bold">{progressPercentage}%</span>
      </div>
    </button>
  );
}
