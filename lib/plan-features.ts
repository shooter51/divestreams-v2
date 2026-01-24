/**
 * Plan Features Constants
 *
 * Defines all available plan features as boolean flags.
 * These are used in the admin plans editor and for feature enforcement.
 */

export const PLAN_FEATURES = {
  // Boolean features
  HAS_POS: "has_pos",
  HAS_EQUIPMENT_RENTALS: "has_equipment_rentals",
  HAS_ADVANCED_REPORTS: "has_advanced_reports",
  HAS_EMAIL_NOTIFICATIONS: "has_email_notifications",
  HAS_API_ACCESS: "has_api_access",
  HAS_CUSTOM_BRANDING: "has_custom_branding",
  HAS_MULTI_LOCATION: "has_multi_location",
  HAS_PRIORITY_SUPPORT: "has_priority_support",
} as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES];

export const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  has_pos: "Point of Sale",
  has_equipment_rentals: "Equipment Rentals",
  has_advanced_reports: "Advanced Reports",
  has_email_notifications: "Email Notifications",
  has_api_access: "API Access",
  has_custom_branding: "Custom Branding",
  has_multi_location: "Multi-Location Support",
  has_priority_support: "Priority Support",
};

/**
 * Default features for each plan tier
 * Used when creating new plans or as fallback
 */
export const DEFAULT_PLAN_FEATURES: Record<string, Record<PlanFeatureKey, boolean>> = {
  free: {
    has_pos: false,
    has_equipment_rentals: false,
    has_advanced_reports: false,
    has_email_notifications: false,
    has_api_access: false,
    has_custom_branding: false,
    has_multi_location: false,
    has_priority_support: false,
  },
  starter: {
    has_pos: true,
    has_equipment_rentals: true,
    has_advanced_reports: false,
    has_email_notifications: true,
    has_api_access: false,
    has_custom_branding: false,
    has_multi_location: false,
    has_priority_support: false,
  },
  pro: {
    has_pos: true,
    has_equipment_rentals: true,
    has_advanced_reports: true,
    has_email_notifications: true,
    has_api_access: true,
    has_custom_branding: true,
    has_multi_location: false,
    has_priority_support: false,
  },
  enterprise: {
    has_pos: true,
    has_equipment_rentals: true,
    has_advanced_reports: true,
    has_email_notifications: true,
    has_api_access: true,
    has_custom_branding: true,
    has_multi_location: true,
    has_priority_support: true,
  },
};

/**
 * Type for the features object stored in the database
 */
export interface PlanFeaturesObject {
  // Boolean feature flags
  has_pos?: boolean;
  has_equipment_rentals?: boolean;
  has_advanced_reports?: boolean;
  has_email_notifications?: boolean;
  has_api_access?: boolean;
  has_custom_branding?: boolean;
  has_multi_location?: boolean;
  has_priority_support?: boolean;
  // Marketing descriptions (displayed on pricing page)
  descriptions?: string[];
}
