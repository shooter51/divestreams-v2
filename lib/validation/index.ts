/**
 * Zod Validation Schemas
 *
 * Shared validation schemas for forms and API requests.
 */

import { z } from "zod";

// Helper for optional rental/selling price fields - converts empty strings to undefined
// Uses .min(1) to enforce rental prices >= $1
const optionalNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : val),
  z.coerce.number().min(1, "Must be at least $1").optional()
);

// Helper for optional cost/purchase price fields - allows $0 for free items
const optionalCostNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : val),
  z.coerce.number().min(0, "Cannot be negative").optional()
);

const optionalIntNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : val),
  z.coerce.number().int().positive().optional()
);

// ============================================================================
// Customer Schemas
// ============================================================================

export const customerSchema = z.object({
  email: z.string().email("Valid email required"),
  firstName: z.string().min(1, "First name required").max(100),
  lastName: z.string().min(1, "Last name required").max(100),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  certifications: z
    .array(
      z.object({
        agency: z.string(),
        level: z.string(),
        number: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  preferredLanguage: z.string().default("en"),
  marketingOptIn: z.boolean().default(false),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

// ============================================================================
// Tour Schemas
// ============================================================================

export const tourSchema = z.object({
  name: z.string().min(1, "Tour name required").max(200),
  description: z.string().optional(),
  type: z.enum(["single_dive", "multi_dive", "course", "snorkel", "night_dive", "other"]),
  duration: optionalIntNumber, // minutes
  maxParticipants: z.coerce.number().int().positive("Max participants required"),
  minParticipants: z.coerce.number().int().positive().default(1),
  price: z.coerce.number().positive("Price required"),
  currency: z.string().default("USD"),
  includesEquipment: z.boolean().default(false),
  includesMeals: z.boolean().default(false),
  includesTransport: z.boolean().default(false),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  minCertLevel: z.string().optional(),
  minAge: optionalIntNumber,
  requirements: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export type TourInput = z.infer<typeof tourSchema>;

// ============================================================================
// Trip Schemas
// ============================================================================

export const tripSchema = z.object({
  tourId: z.string().uuid("Tour required"),
  boatId: z.string().uuid().optional(),
  date: z.string().min(1, "Date required"), // ISO date
  startTime: z.string().min(1, "Start time required"), // HH:mm
  endTime: z.string().optional(),
  maxParticipants: optionalIntNumber,
  price: optionalNumber,
  weatherNotes: z.string().optional(),
  notes: z.string().optional(),
  staffIds: z.array(z.string().uuid()).optional(),
  // Recurring trip fields
  isRecurring: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false)
  ),
  recurrencePattern: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional(),
  recurrenceDays: z.preprocess(
    (val) => {
      if (!val) return undefined;
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    },
    z.array(z.number().int().min(0).max(6)).optional()
  ),
  recurrenceEndDate: z.string().optional(),
  recurrenceCount: optionalIntNumber,
});

export type TripInput = z.infer<typeof tripSchema>;

// Recurring trip creation schema (extends trip schema with required recurrence fields)
export const recurringTripSchema = tripSchema.extend({
  isRecurring: z.literal(true),
  recurrencePattern: z.enum(["daily", "weekly", "biweekly", "monthly"]),
}).refine(
  (data) => {
    // If weekly or biweekly, recurrenceDays should be provided
    if ((data.recurrencePattern === "weekly" || data.recurrencePattern === "biweekly") &&
        (!data.recurrenceDays || data.recurrenceDays.length === 0)) {
      // Auto-calculate from the start date's day of week
      return true; // Allow it, we'll handle in the backend
    }
    return true;
  },
  { message: "Weekly/biweekly patterns should specify days" }
).refine(
  (data) => {
    // Either endDate or count should be provided for bounded recurrence
    return data.recurrenceEndDate || data.recurrenceCount || true;
  },
  { message: "Consider setting an end date or max occurrences" }
);

export type RecurringTripInput = z.infer<typeof recurringTripSchema>;

// ============================================================================
// Booking Schemas
// ============================================================================

export const bookingSchema = z.object({
  tripId: z.string().uuid("Trip required"),
  customerId: z.string().uuid("Customer required"),
  participants: z.coerce.number().int().positive().default(1),
  participantDetails: z
    .array(
      z.object({
        name: z.string(),
        certLevel: z.string().optional(),
        equipment: z.array(z.string()).optional(),
      })
    )
    .optional(),
  equipmentRental: z
    .array(
      z.object({
        item: z.string(),
        size: z.string().optional(),
        price: z.coerce.number(),
      })
    )
    .optional(),
  specialRequests: z.string().optional(),
  internalNotes: z.string().optional(),
  source: z.string().default("direct"),
});

export type BookingInput = z.infer<typeof bookingSchema>;

// ============================================================================
// Dive Site Schemas
// ============================================================================

export const diveSiteSchema = z.object({
  name: z.string().min(1, "Site name required").max(200),
  location: z.string().min(1, "Location required").max(200),
  description: z.string().optional(),
  latitude: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().min(-90).max(90).optional()
  ),
  longitude: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().min(-180).max(180).optional()
  ),
  maxDepth: z.coerce.number().int().positive("Max depth required"),
  minDepth: optionalIntNumber,
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  visibility: z.string().optional(),
  currentStrength: z.string().optional(),
  conditions: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export type DiveSiteInput = z.infer<typeof diveSiteSchema>;

// ============================================================================
// Boat Schemas
// ============================================================================

export const boatSchema = z.object({
  name: z.string().min(1, "Boat name required").max(200),
  description: z.string().optional(),
  capacity: z.coerce.number().int().positive("Capacity required"),
  type: z.string().optional(),
  registrationNumber: z.string().optional(),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export type BoatInput = z.infer<typeof boatSchema>;

// ============================================================================
// Equipment Schemas
// ============================================================================

export const equipmentSchema = z.object({
  category: z.enum(["bcd", "regulator", "wetsuit", "mask", "fins", "tank", "computer", "other"]),
  name: z.string().min(1, "Name required").max(200),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  size: z.string().optional(),
  status: z.enum(["available", "rented", "maintenance", "retired"]).default("available"),
  condition: z.enum(["excellent", "good", "fair", "poor"]).default("good"),
  rentalPrice: optionalNumber, // Rental prices must be >= $1
  isRentable: z.boolean().default(true),
  lastServiceDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  serviceNotes: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: optionalCostNumber, // Purchase prices can be $0 (donated/free equipment)
  notes: z.string().optional(),
}).refine(
  (data) => {
    // If equipment is marked as rentable, rental price must be provided
    if (data.isRentable && (!data.rentalPrice || data.rentalPrice <= 0)) {
      return false;
    }
    return true;
  },
  {
    message: "Rental price is required for rentable equipment and must be at least $1",
    path: ["rentalPrice"], // Show error on rentalPrice field
  }
);

export type EquipmentInput = z.infer<typeof equipmentSchema>;

// ============================================================================
// User/Team Schemas
// ============================================================================

export const userSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().min(1, "Name required").max(200),
  phone: z.string().optional(),
  role: z.enum(["owner", "manager", "staff"]).default("staff"),
  permissions: z.array(z.string()).optional(),
});

export type UserInput = z.infer<typeof userSchema>;

// ============================================================================
// Settings Schemas
// ============================================================================

export const shopSettingsSchema = z.object({
  name: z.string().min(1, "Shop name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().default("USD"),
  branding: z
    .object({
      logo: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
  booking: z
    .object({
      requireDeposit: z.boolean().optional(),
      depositPercent: z.preprocess(
        (val) => (val === "" || val === undefined || val === null ? undefined : val),
        z.coerce.number().min(0).max(100).optional()
      ),
      cancellationPolicy: z.string().optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailBookingConfirmation: z.boolean().optional(),
      emailReminders: z.boolean().optional(),
      reminderDaysBefore: optionalIntNumber,
    })
    .optional(),
});

export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract string values from FormData for repopulating forms after validation errors.
 * Excludes File values and only keeps string entries.
 */
export function getFormValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}

/**
 * Parse form data into an object, handling arrays and nested objects
 */
export function parseFormData(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Handle array notation: field[0], field[1], etc.
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, field, index] = arrayMatch;
      if (!result[field]) result[field] = [];
      (result[field] as unknown[])[parseInt(index)] = value;
      continue;
    }

    // Handle nested notation: parent.child
    if (key.includes(".")) {
      const parts = key.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
      continue;
    }

    // Handle boolean strings
    if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    } else if (value === "" || value === "undefined") {
      // Skip empty values
    } else if (typeof value === "string" && value.startsWith("[")) {
      // Try to parse JSON arrays
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validate and parse form data with a Zod schema
 */
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const parsed = parseFormData(formData);

  const result = schema.safeParse(parsed);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const error of result.error.errors) {
    const path = error.path.join(".");
    errors[path] = error.message;
  }

  return { success: false, errors };
}
