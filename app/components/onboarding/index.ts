/**
 * Onboarding Components
 *
 * Export barrel for the onboarding system.
 */

export { OnboardingProvider, useOnboarding } from "./OnboardingContext";
export type { OnboardingProgress } from "./OnboardingContext";
export { OnboardingButton } from "./OnboardingButton";
export { OnboardingSidebar } from "./OnboardingSidebar";
export {
  ONBOARDING_SECTIONS,
  getAllTasks,
  getTaskById,
  calculateProgress,
} from "./checklist-config";
export type { OnboardingTask, OnboardingSection } from "./checklist-config";
