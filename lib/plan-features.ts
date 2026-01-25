/**
 * Plan Features Constants
 *
 * Defines all available plan features as boolean flags and quantity limits.
 * These are used in the admin plans editor and for feature enforcement.
 */

export const PLAN_FEATURES = {
  HAS_TOURS_BOOKINGS: "has_tours_bookings",
  HAS_EQUIPMENT_BOATS: "has_equipment_boats",
  HAS_TRAINING: "has_training",
  HAS_POS: "has_pos",
  HAS_PUBLIC_SITE: "has_public_site",
  HAS_ADVANCED_NOTIFICATIONS: "has_advanced_notifications",
  HAS_INTEGRATIONS: "has_integrations",
  HAS_API_ACCESS: "has_api_access",
  // Individual integration flags
  HAS_STRIPE: "has_stripe",
  HAS_GOOGLE_CALENDAR: "has_google_calendar",
  HAS_MAILCHIMP: "has_mailchimp",
  HAS_QUICKBOOKS: "has_quickbooks",
  HAS_ZAPIER: "has_zapier",
  HAS_TWILIO: "has_twilio",
  HAS_WHATSAPP: "has_whatsapp",
  HAS_XERO: "has_xero",
} as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES];

export const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  has_tours_bookings: "Tours & Bookings",
  has_equipment_boats: "Equipment & Boats",
  has_training: "Training Management",
  has_pos: "Point of Sale",
  has_public_site: "Public Website",
  has_advanced_notifications: "Advanced Notifications",
  has_integrations: "Integrations",
  has_api_access: "API Access",
  // Individual integrations
  has_stripe: "Stripe Payments",
  has_google_calendar: "Google Calendar",
  has_mailchimp: "Mailchimp",
  has_quickbooks: "QuickBooks",
  has_zapier: "Zapier",
  has_twilio: "Twilio SMS",
  has_whatsapp: "WhatsApp Business",
  has_xero: "Xero",
};

export const FEATURE_UPGRADE_INFO: Record<PlanFeatureKey, {
  title: string;
  description: string;
  requiredPlan: string;
}> = {
  has_tours_bookings: {
    title: "Tours & Bookings",
    description: "Create tours, manage trips, and accept bookings from customers.",
    requiredPlan: "Free",
  },
  has_equipment_boats: {
    title: "Equipment & Boats",
    description: "Manage your dive equipment inventory and boat fleet.",
    requiredPlan: "Starter",
  },
  has_training: {
    title: "Training Management",
    description: "Run certification courses with student tracking and scheduling.",
    requiredPlan: "Pro",
  },
  has_pos: {
    title: "Point of Sale",
    description: "Process sales, manage products, and track transactions.",
    requiredPlan: "Pro",
  },
  has_public_site: {
    title: "Public Website",
    description: "Your own branded website for customers to browse and book.",
    requiredPlan: "Starter",
  },
  has_advanced_notifications: {
    title: "Advanced Notifications",
    description: "Automated email reminders, booking confirmations, and more.",
    requiredPlan: "Pro",
  },
  has_integrations: {
    title: "Integrations",
    description: "Connect with Zapier, QuickBooks, and other business tools.",
    requiredPlan: "Enterprise",
  },
  has_api_access: {
    title: "API Access",
    description: "Build custom integrations with our REST API.",
    requiredPlan: "Enterprise",
  },
  // Individual integrations - requiredPlan is determined dynamically from plan configuration
  has_stripe: {
    title: "Stripe Payments",
    description: "Accept credit card payments and manage subscriptions.",
    requiredPlan: "", // Determined by admin
  },
  has_google_calendar: {
    title: "Google Calendar",
    description: "Sync trips and bookings with Google Calendar.",
    requiredPlan: "", // Determined by admin
  },
  has_mailchimp: {
    title: "Mailchimp",
    description: "Sync customers and send email marketing campaigns.",
    requiredPlan: "", // Determined by admin
  },
  has_quickbooks: {
    title: "QuickBooks",
    description: "Sync invoices and payments with QuickBooks Online.",
    requiredPlan: "", // Determined by admin
  },
  has_zapier: {
    title: "Zapier",
    description: "Connect to 5000+ apps with automated workflows.",
    requiredPlan: "", // Determined by admin
  },
  has_twilio: {
    title: "Twilio SMS",
    description: "Send SMS notifications and reminders.",
    requiredPlan: "", // Determined by admin
  },
  has_whatsapp: {
    title: "WhatsApp Business",
    description: "Chat with customers on WhatsApp.",
    requiredPlan: "", // Determined by admin
  },
  has_xero: {
    title: "Xero",
    description: "Sync invoices and payments with Xero accounting.",
    requiredPlan: "", // Determined by admin
  },
};

/**
 * Default features for each plan tier
 * Used when creating new plans or as fallback
 */
export const DEFAULT_PLAN_FEATURES: Record<string, Record<PlanFeatureKey, boolean>> = {
  free: {
    has_tours_bookings: true,
    has_equipment_boats: false,
    has_training: false,
    has_pos: false,
    has_public_site: false,
    has_advanced_notifications: false,
    has_integrations: false,
    has_api_access: false,
    // Integrations
    has_stripe: true,
    has_google_calendar: false,
    has_mailchimp: false,
    has_quickbooks: false,
    has_zapier: false,
    has_twilio: false,
    has_whatsapp: false,
    has_xero: false,
  },
  starter: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: false,
    has_pos: false,
    has_public_site: true,
    has_advanced_notifications: false,
    has_integrations: false,
    has_api_access: false,
    // Integrations
    has_stripe: true,
    has_google_calendar: true,
    has_mailchimp: false,
    has_quickbooks: false,
    has_zapier: false,
    has_twilio: false,
    has_whatsapp: false,
    has_xero: false,
  },
  pro: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: true,
    has_pos: true,
    has_public_site: true,
    has_advanced_notifications: true,
    has_integrations: true,
    has_api_access: false,
    // Integrations
    has_stripe: true,
    has_google_calendar: true,
    has_mailchimp: true,
    has_quickbooks: true,
    has_zapier: true,
    has_twilio: true,
    has_whatsapp: false,
    has_xero: false,
  },
  enterprise: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: true,
    has_pos: true,
    has_public_site: true,
    has_advanced_notifications: true,
    has_integrations: true,
    has_api_access: true,
    // Integrations
    has_stripe: true,
    has_google_calendar: true,
    has_mailchimp: true,
    has_quickbooks: true,
    has_zapier: true,
    has_twilio: true,
    has_whatsapp: true,
    has_xero: true,
  },
};

/**
 * Plan quantity limits
 * -1 indicates unlimited
 */
export interface PlanLimits {
  users: number;        // -1 = unlimited
  customers: number;
  toursPerMonth: number;
  storageGb: number;
}

export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { users: 1, customers: 50, toursPerMonth: 5, storageGb: 0.5 },
  starter: { users: 3, customers: 500, toursPerMonth: 25, storageGb: 5 },
  pro: { users: 10, customers: 5000, toursPerMonth: 100, storageGb: 25 },
  enterprise: { users: -1, customers: -1, toursPerMonth: -1, storageGb: 100 },
};

export const LIMIT_WARNING_THRESHOLD = 0.8;

export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  users: "Team Members",
  customers: "Customers",
  toursPerMonth: "Tours per Month",
  storageGb: "Storage",
};

/**
 * Type for the features object stored in the database
 */
export interface PlanFeaturesObject {
  has_tours_bookings?: boolean;
  has_equipment_boats?: boolean;
  has_training?: boolean;
  has_pos?: boolean;
  has_public_site?: boolean;
  has_advanced_notifications?: boolean;
  has_integrations?: boolean;
  has_api_access?: boolean;
  // Individual integrations
  has_stripe?: boolean;
  has_google_calendar?: boolean;
  has_mailchimp?: boolean;
  has_quickbooks?: boolean;
  has_zapier?: boolean;
  has_twilio?: boolean;
  has_whatsapp?: boolean;
  has_xero?: boolean;
  // Marketing descriptions (displayed on pricing page)
  descriptions?: string[];
}
