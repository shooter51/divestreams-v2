/**
 * Zod Validation Schemas
 *
 * Shared validation schemas for forms and API requests.
 */

import { z } from "zod";

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
  duration: z.number().int().positive().optional(), // minutes
  maxParticipants: z.number().int().positive("Max participants required"),
  minParticipants: z.number().int().positive().default(1),
  price: z.number().positive("Price required"),
  currency: z.string().default("USD"),
  includesEquipment: z.boolean().default(false),
  includesMeals: z.boolean().default(false),
  includesTransport: z.boolean().default(false),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  minCertLevel: z.string().optional(),
  minAge: z.number().int().positive().optional(),
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
  maxParticipants: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  weatherNotes: z.string().optional(),
  notes: z.string().optional(),
  staffIds: z.array(z.string().uuid()).optional(),
});

export type TripInput = z.infer<typeof tripSchema>;

// ============================================================================
// Booking Schemas
// ============================================================================

export const bookingSchema = z.object({
  tripId: z.string().uuid("Trip required"),
  customerId: z.string().uuid("Customer required"),
  participants: z.number().int().positive().default(1),
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
        price: z.number(),
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  maxDepth: z.number().int().positive("Max depth required"),
  minDepth: z.number().int().positive().optional(),
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
  capacity: z.number().int().positive("Capacity required"),
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
  rentalPrice: z.number().positive().optional(),
  isRentable: z.boolean().default(true),
  lastServiceDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  serviceNotes: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive().optional(),
  notes: z.string().optional(),
});

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
      depositPercent: z.number().min(0).max(100).optional(),
      cancellationPolicy: z.string().optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailBookingConfirmation: z.boolean().optional(),
      emailReminders: z.boolean().optional(),
      reminderDaysBefore: z.number().int().positive().optional(),
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
