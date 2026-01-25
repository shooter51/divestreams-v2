/**
 * Onboarding Context
 *
 * Provides state management for the onboarding checklist with optimistic updates.
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { useFetcher } from "react-router";
import { calculateProgress } from "./checklist-config";

// Import type from the schema
import type { OnboardingProgress } from "../../../lib/db/schema/onboarding";
export type { OnboardingProgress };

interface OnboardingContextType {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  markComplete: (taskId: string) => void;
  markIncomplete: (taskId: string) => void;
  dismiss: () => void;
  undismiss: () => void;
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({
  children,
  initialProgress,
}: {
  children: ReactNode;
  initialProgress: OnboardingProgress | null;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fetcher = useFetcher();

  const isLoading = fetcher.state !== "idle";

  // Sync with fetcher data when it completes
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const data = fetcher.data as { progress?: OnboardingProgress };
      if (data.progress) {
        setProgress(data.progress);
      }
    }
  }, [fetcher.data, fetcher.state]);

  const markComplete = useCallback(
    (taskId: string) => {
      fetcher.submit(
        { taskId },
        { method: "post", action: "/tenant/onboarding/complete" }
      );
      // Optimistic update
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              completedTasks: [...(prev.completedTasks || []), taskId],
            }
          : null
      );
    },
    [fetcher]
  );

  const markIncomplete = useCallback(
    (taskId: string) => {
      fetcher.submit(
        { taskId },
        { method: "post", action: "/tenant/onboarding/incomplete" }
      );
      // Optimistic update
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              completedTasks: (prev.completedTasks || []).filter((t) => t !== taskId),
            }
          : null
      );
    },
    [fetcher]
  );

  const dismiss = useCallback(() => {
    fetcher.submit(
      { action: "dismiss" },
      { method: "post", action: "/tenant/onboarding/dismiss" }
    );
    setProgress((prev) => (prev ? { ...prev, dismissed: true } : null));
    setIsSidebarOpen(false);
  }, [fetcher]);

  const undismiss = useCallback(() => {
    fetcher.submit(
      { action: "undismiss" },
      { method: "post", action: "/tenant/onboarding/dismiss" }
    );
    setProgress((prev) => (prev ? { ...prev, dismissed: false } : null));
  }, [fetcher]);

  const { completed, total, percentage } = calculateProgress(
    progress?.completedTasks || []
  );

  return (
    <OnboardingContext.Provider
      value={{
        progress,
        isLoading,
        isSidebarOpen,
        openSidebar: () => setIsSidebarOpen(true),
        closeSidebar: () => setIsSidebarOpen(false),
        toggleSidebar: () => setIsSidebarOpen((prev) => !prev),
        markComplete,
        markIncomplete,
        dismiss,
        undismiss,
        completedCount: completed,
        totalCount: total,
        progressPercentage: percentage,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
