/**
 * Onboarding Checklist Configuration
 *
 * Defines all tasks and sections for the new tenant onboarding experience.
 */

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  href: string;
  tourTarget?: string;
}

export interface OnboardingSection {
  id: string;
  title: string;
  tasks: OnboardingTask[];
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    tasks: [
      {
        id: "view-dashboard",
        title: "View your dashboard",
        description: "See an overview of your dive shop",
        href: "/tenant/dashboard",
        tourTarget: "[data-tour='dashboard']",
      },
      {
        id: "explore-settings",
        title: "Explore settings",
        description: "Configure your shop preferences",
        href: "/tenant/settings",
        tourTarget: "[data-tour='settings']",
      },
    ],
  },
  {
    id: "shop-setup",
    title: "Set Up Your Shop",
    tasks: [
      {
        id: "add-shop-info",
        title: "Add shop information",
        description: "Enter your business details",
        href: "/tenant/settings",
        tourTarget: "[data-tour='shop-info']",
      },
      {
        id: "upload-logo",
        title: "Upload your logo",
        description: "Brand your dive shop",
        href: "/tenant/settings",
        tourTarget: "[data-tour='logo']",
      },
      {
        id: "set-hours",
        title: "Set operating hours",
        description: "Let customers know when you're open",
        href: "/tenant/settings",
        tourTarget: "[data-tour='hours']",
      },
    ],
  },
  {
    id: "team",
    title: "Build Your Team",
    tasks: [
      {
        id: "add-staff",
        title: "Add staff members",
        description: "Invite your team to DiveStreams",
        href: "/tenant/settings/team",
        tourTarget: "[data-tour='team']",
      },
      {
        id: "assign-roles",
        title: "Assign roles",
        description: "Set permissions for each team member",
        href: "/tenant/settings/team",
        tourTarget: "[data-tour='roles']",
      },
    ],
  },
  {
    id: "customers",
    title: "Manage Customers",
    tasks: [
      {
        id: "add-customer",
        title: "Add your first customer",
        description: "Start building your customer base",
        href: "/tenant/customers",
        tourTarget: "[data-tour='customers']",
      },
      {
        id: "import-customers",
        title: "Import existing customers",
        description: "Bring in your contact list",
        href: "/tenant/customers",
        tourTarget: "[data-tour='import']",
      },
    ],
  },
  {
    id: "tours",
    title: "Create Tours",
    tasks: [
      {
        id: "create-dive-site",
        title: "Add a dive site",
        description: "Set up your diving locations",
        href: "/tenant/dive-sites",
        tourTarget: "[data-tour='dive-sites']",
      },
      {
        id: "create-tour",
        title: "Create your first tour",
        description: "Set up a diving experience",
        href: "/tenant/tours",
        tourTarget: "[data-tour='tours']",
      },
      {
        id: "set-pricing",
        title: "Set tour pricing",
        description: "Configure prices and deposits",
        href: "/tenant/tours",
        tourTarget: "[data-tour='pricing']",
      },
    ],
  },
  {
    id: "equipment",
    title: "Equipment & Boats",
    tasks: [
      {
        id: "add-equipment",
        title: "Add equipment",
        description: "Track your rental gear",
        href: "/tenant/equipment",
        tourTarget: "[data-tour='equipment']",
      },
      {
        id: "add-boat",
        title: "Add a boat",
        description: "Set up your vessels",
        href: "/tenant/boats",
        tourTarget: "[data-tour='boats']",
      },
    ],
  },
  {
    id: "payments",
    title: "Accept Payments",
    tasks: [
      {
        id: "connect-stripe",
        title: "Connect Stripe",
        description: "Accept online payments",
        href: "/tenant/settings/integrations",
        tourTarget: "[data-tour='stripe']",
      },
      {
        id: "test-booking",
        title: "Make a test booking",
        description: "Verify everything works",
        href: "/tenant/bookings",
        tourTarget: "[data-tour='bookings']",
      },
    ],
  },
];

export function getAllTasks(): OnboardingTask[] {
  return ONBOARDING_SECTIONS.flatMap((section) => section.tasks);
}

export function getTaskById(id: string): OnboardingTask | undefined {
  return getAllTasks().find((task) => task.id === id);
}

export function calculateProgress(completedTasks: string[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = getAllTasks().length;
  const completed = completedTasks.length;
  return { completed, total, percentage: Math.round((completed / total) * 100) };
}
