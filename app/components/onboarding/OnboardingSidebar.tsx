/**
 * Onboarding Sidebar
 *
 * Slide-out panel displaying the onboarding checklist with task completion tracking.
 */

import { useEffect } from "react";
import { Link } from "react-router";
import { useOnboarding } from "./OnboardingContext";
import { ONBOARDING_SECTIONS } from "./checklist-config";

export function OnboardingSidebar() {
  const {
    progress,
    isSidebarOpen,
    closeSidebar,
    markComplete,
    markIncomplete,
    dismiss,
    completedCount,
    totalCount,
    progressPercentage,
  } = useOnboarding();

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        closeSidebar();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen, closeSidebar]);

  if (!isSidebarOpen) return null;

  const completedTasks = progress?.completedTasks || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className="fixed right-0 top-0 h-full w-96 max-w-full bg-white shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-sidebar-title"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 id="onboarding-sidebar-title" className="font-semibold text-lg">
              Setup Checklist
            </h2>
            <p className="text-sm text-gray-500">
              {completedCount} of {totalCount} complete
            </p>
          </div>
          <button
            onClick={closeSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close sidebar"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            {progressPercentage}% complete
          </p>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {ONBOARDING_SECTIONS.map((section) => (
            <div key={section.id}>
              <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.tasks.map((task) => {
                  const isComplete = completedTasks.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border ${
                        isComplete
                          ? "bg-green-50 border-green-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            isComplete
                              ? markIncomplete(task.id)
                              : markComplete(task.id)
                          }
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isComplete
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-gray-300 hover:border-blue-500"
                          }`}
                          aria-label={
                            isComplete
                              ? `Mark "${task.title}" as incomplete`
                              : `Mark "${task.title}" as complete`
                          }
                        >
                          {isComplete && (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={task.href}
                            onClick={closeSidebar}
                            className={`font-medium text-sm hover:text-blue-600 ${
                              isComplete ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {task.title}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {task.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={dismiss}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Dismiss checklist
          </button>
        </div>
      </div>
    </>
  );
}
