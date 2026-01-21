/**
 * Validation Module Tests
 *
 * Tests for Zod schemas and form helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  customerSchema,
  tourSchema,
  tripSchema,
  recurringTripSchema,
  bookingSchema,
  diveSiteSchema,
  boatSchema,
  equipmentSchema,
  userSchema,
  shopSettingsSchema,
  getFormValues,
  parseFormData,
  validateFormData,
} from "../../../../lib/validation/index";

describe("Validation Module", () => {
  // ============================================================================
  // customerSchema Tests
  // ============================================================================

  describe("customerSchema", () => {
    it("should validate a customer with required fields only", () => {
      const data = {
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate a customer with all fields", () => {
      const data = {
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+1-555-0100",
        dateOfBirth: "1990-01-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "+1-555-0101",
        emergencyContactRelation: "Spouse",
        medicalConditions: "None",
        medications: "None",
        certifications: [{ agency: "PADI", level: "Advanced Open Water" }],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        preferredLanguage: "en",
        marketingOptIn: true,
        notes: "VIP customer",
        tags: ["VIP", "Repeat"],
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const data = {
        email: "invalid-email",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Valid email required");
    });

    it("should reject empty first name", () => {
      const data = {
        email: "john@example.com",
        firstName: "",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject empty last name", () => {
      const data = {
        email: "john@example.com",
        firstName: "John",
        lastName: "",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should set default preferredLanguage", () => {
      const data = {
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preferredLanguage).toBe("en");
      }
    });

    it("should set default marketingOptIn", () => {
      const data = {
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.marketingOptIn).toBe(false);
      }
    });
  });

  // ============================================================================
  // tourSchema Tests
  // ============================================================================

  describe("tourSchema", () => {
    it("should validate a tour with required fields", () => {
      const data = {
        name: "Beginner Dive",
        type: "single_dive",
        maxParticipants: 8,
        price: 99,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate all tour types", () => {
      const types = ["single_dive", "multi_dive", "course", "snorkel", "night_dive", "other"];
      types.forEach((type) => {
        const data = { name: "Test", type, maxParticipants: 4, price: 50 };
        const result = tourSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid tour type", () => {
      const data = {
        name: "Test Tour",
        type: "invalid_type",
        maxParticipants: 4,
        price: 50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should coerce string price to number", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: "8",
        price: "99.99",
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(99.99);
        expect(result.data.maxParticipants).toBe(8);
      }
    });

    it("should reject negative price", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: 4,
        price: -50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should set default values", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: 4,
        price: 50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minParticipants).toBe(1);
        expect(result.data.currency).toBe("USD");
        expect(result.data.includesEquipment).toBe(false);
        expect(result.data.includesMeals).toBe(false);
        expect(result.data.includesTransport).toBe(false);
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should handle optional duration as empty string", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: 4,
        price: 50,
        duration: "",
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBeUndefined();
      }
    });
  });

  // ============================================================================
  // tripSchema Tests
  // ============================================================================

  describe("tripSchema", () => {
    it("should validate a trip with required fields", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject invalid tourId UUID", () => {
      const data = {
        tourId: "not-a-uuid",
        date: "2025-03-15",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject missing date", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject empty date", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should validate optional fields", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        boatId: "550e8400-e29b-41d4-a716-446655440001",
        date: "2025-03-15",
        startTime: "09:00",
        endTime: "12:00",
        maxParticipants: 10,
        price: 150,
        weatherNotes: "Clear skies expected",
        notes: "Special trip",
        staffIds: ["550e8400-e29b-41d4-a716-446655440002"],
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    // LINE 113 COVERAGE: Invalid JSON in recurrenceDays
    it("should handle invalid JSON in recurrenceDays (line 113)", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        recurrenceDays: "{invalid json}",
      };
      const result = tripSchema.safeParse(data);
      // Should fail because preprocessor returns undefined for invalid JSON
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurrenceDays).toBeUndefined();
      }
    });

    it("should parse valid JSON array in recurrenceDays", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        recurrenceDays: "[1,3,5]",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurrenceDays).toEqual([1, 3, 5]);
      }
    });
  });

  // ============================================================================
  // recurringTripSchema Tests - LINES 133-144 COVERAGE
  // ============================================================================

  describe("recurringTripSchema", () => {
    it("should validate recurring trip with all required fields", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "daily",
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    // LINE 133-140 COVERAGE: Weekly pattern without recurrenceDays
    it("should validate weekly pattern without recurrenceDays (lines 133-140)", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "weekly",
        // No recurrenceDays - should still pass (backend will handle)
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    // LINE 133-140 COVERAGE: Biweekly pattern without recurrenceDays
    it("should validate biweekly pattern without recurrenceDays (lines 133-140)", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "biweekly",
        recurrenceDays: [], // Empty array - should still pass
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    // LINE 142-145 COVERAGE: No endDate or count (optional validation)
    it("should validate recurring trip without endDate or count (lines 142-145)", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "monthly",
        // No recurrenceEndDate or recurrenceCount - should still pass
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate recurring trip with endDate", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "weekly",
        recurrenceDays: [1, 3, 5],
        recurrenceEndDate: "2025-12-31",
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate recurring trip with count", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "daily",
        recurrenceCount: 10,
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject non-recurring trip (isRecurring must be true)", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: false,
        recurrencePattern: "daily",
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject recurring trip without pattern", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-03-15",
        startTime: "09:00",
        isRecurring: true,
      };
      const result = recurringTripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // bookingSchema Tests
  // ============================================================================

  describe("bookingSchema", () => {
    it("should validate a booking with required fields", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should set default participants to 1", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participants).toBe(1);
      }
    });

    it("should set default source to direct", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe("direct");
      }
    });

    it("should validate participant details", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        participants: 2,
        participantDetails: [
          { name: "John Doe", certLevel: "Advanced", equipment: ["mask", "fins"] },
          { name: "Jane Doe" },
        ],
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate equipment rental", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        equipmentRental: [
          { item: "BCD", size: "L", price: 25 },
          { item: "Regulator", price: 30 },
        ],
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // diveSiteSchema Tests
  // ============================================================================

  describe("diveSiteSchema", () => {
    it("should validate a dive site with required fields", () => {
      const data = {
        name: "Coral Garden",
        location: "Miami Beach",
        maxDepth: 25,
        difficulty: "beginner",
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate all difficulty levels", () => {
      const levels = ["beginner", "intermediate", "advanced", "expert"];
      levels.forEach((difficulty) => {
        const data = {
          name: "Test Site",
          location: "Test",
          maxDepth: 30,
          difficulty,
        };
        const result = diveSiteSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should validate latitude/longitude ranges", () => {
      const data = {
        name: "GPS Site",
        location: "Ocean",
        maxDepth: 30,
        difficulty: "intermediate",
        latitude: 25.7617,
        longitude: -80.1918,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject invalid latitude (> 90)", () => {
      const data = {
        name: "GPS Site",
        location: "Ocean",
        maxDepth: 30,
        difficulty: "intermediate",
        latitude: 95,
        longitude: -80,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude (< -180)", () => {
      const data = {
        name: "GPS Site",
        location: "Ocean",
        maxDepth: 30,
        difficulty: "intermediate",
        latitude: 25,
        longitude: -185,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should handle empty latitude/longitude as undefined", () => {
      const data = {
        name: "Test Site",
        location: "Test",
        maxDepth: 30,
        difficulty: "beginner",
        latitude: "",
        longitude: "",
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.latitude).toBeUndefined();
        expect(result.data.longitude).toBeUndefined();
      }
    });
  });

  // ============================================================================
  // boatSchema Tests
  // ============================================================================

  describe("boatSchema", () => {
    it("should validate a boat with required fields", () => {
      const data = {
        name: "Sea Explorer",
        capacity: 12,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should set default isActive to true", () => {
      const data = {
        name: "Sea Explorer",
        capacity: 12,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should coerce string capacity to number", () => {
      const data = {
        name: "Sea Explorer",
        capacity: "12",
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capacity).toBe(12);
      }
    });

    it("should reject zero capacity", () => {
      const data = {
        name: "Sea Explorer",
        capacity: 0,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject negative capacity", () => {
      const data = {
        name: "Sea Explorer",
        capacity: -5,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // equipmentSchema Tests
  // ============================================================================

  describe("equipmentSchema", () => {
    it("should validate equipment with required fields", () => {
      const data = {
        category: "bcd",
        name: "BCD Large",
      };
      const result = equipmentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate all equipment categories", () => {
      const categories = ["bcd", "regulator", "wetsuit", "mask", "fins", "tank", "computer", "other"];
      categories.forEach((category) => {
        const data = { category, name: "Test Equipment" };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should validate all status values", () => {
      const statuses = ["available", "rented", "maintenance", "retired"];
      statuses.forEach((status) => {
        const data = { category: "bcd", name: "Test", status };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should validate all condition values", () => {
      const conditions = ["excellent", "good", "fair", "poor"];
      conditions.forEach((condition) => {
        const data = { category: "bcd", name: "Test", condition };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should set default status to available", () => {
      const data = { category: "bcd", name: "Test" };
      const result = equipmentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("available");
      }
    });

    it("should set default condition to good", () => {
      const data = { category: "bcd", name: "Test" };
      const result = equipmentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.condition).toBe("good");
      }
    });

    it("should set default isRentable to true", () => {
      const data = { category: "bcd", name: "Test" };
      const result = equipmentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRentable).toBe(true);
      }
    });
  });

  // ============================================================================
  // userSchema Tests
  // ============================================================================

  describe("userSchema", () => {
    it("should validate a user with required fields", () => {
      const data = {
        email: "staff@example.com",
        name: "Staff Member",
      };
      const result = userSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate all role values", () => {
      const roles = ["owner", "manager", "staff"];
      roles.forEach((role) => {
        const data = { email: "test@example.com", name: "Test", role };
        const result = userSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should set default role to staff", () => {
      const data = { email: "test@example.com", name: "Test" };
      const result = userSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("staff");
      }
    });

    it("should reject invalid email", () => {
      const data = { email: "invalid", name: "Test" };
      const result = userSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // shopSettingsSchema Tests
  // ============================================================================

  describe("shopSettingsSchema", () => {
    it("should validate settings with required fields", () => {
      const data = {
        name: "Ocean Dive Shop",
        email: "shop@example.com",
      };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should set default timezone", () => {
      const data = { name: "Shop", email: "shop@example.com" };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timezone).toBe("UTC");
      }
    });

    it("should set default currency", () => {
      const data = { name: "Shop", email: "shop@example.com" };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("USD");
      }
    });

    it("should validate nested branding object", () => {
      const data = {
        name: "Shop",
        email: "shop@example.com",
        branding: {
          logo: "https://example.com/logo.png",
          primaryColor: "#0066CC",
          secondaryColor: "#003366",
        },
      };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate nested booking object", () => {
      const data = {
        name: "Shop",
        email: "shop@example.com",
        booking: {
          requireDeposit: true,
          depositPercent: 25,
          cancellationPolicy: "24-hour cancellation policy",
        },
      };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // getFormValues Tests
  // ============================================================================

  describe("getFormValues", () => {
    it("should extract string values from FormData", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("email", "john@example.com");

      const values = getFormValues(formData);
      expect(values).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    it("should handle empty FormData", () => {
      const formData = new FormData();
      const values = getFormValues(formData);
      expect(values).toEqual({});
    });

    it("should use last value for duplicate keys", () => {
      const formData = new FormData();
      formData.append("name", "First");
      formData.append("name", "Second");

      const values = getFormValues(formData);
      expect(values.name).toBe("Second");
    });
  });

  // ============================================================================
  // parseFormData Tests
  // ============================================================================

  describe("parseFormData", () => {
    it("should parse simple form fields", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("email", "john@example.com");

      const parsed = parseFormData(formData);
      expect(parsed).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    it("should convert true string to boolean", () => {
      const formData = new FormData();
      formData.append("isActive", "true");

      const parsed = parseFormData(formData);
      expect(parsed.isActive).toBe(true);
    });

    it("should convert false string to boolean", () => {
      const formData = new FormData();
      formData.append("isActive", "false");

      const parsed = parseFormData(formData);
      expect(parsed.isActive).toBe(false);
    });

    it("should skip empty strings", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("phone", "");

      const parsed = parseFormData(formData);
      expect(parsed.name).toBe("John");
      expect("phone" in parsed).toBe(false);
    });

    it("should handle array notation (field[0], field[1])", () => {
      const formData = new FormData();
      formData.append("tags[0]", "VIP");
      formData.append("tags[1]", "Repeat");

      const parsed = parseFormData(formData);
      expect(parsed.tags).toEqual(["VIP", "Repeat"]);
    });

    it("should handle nested notation (parent.child)", () => {
      const formData = new FormData();
      formData.append("address.city", "Miami");
      formData.append("address.state", "FL");

      const parsed = parseFormData(formData);
      expect(parsed.address).toEqual({ city: "Miami", state: "FL" });
    });

    it("should parse JSON arrays", () => {
      const formData = new FormData();
      formData.append("tags", '["VIP", "Repeat"]');

      const parsed = parseFormData(formData);
      expect(parsed.tags).toEqual(["VIP", "Repeat"]);
    });

    // LINE 365 COVERAGE: Invalid JSON array parsing
    it("should handle malformed JSON arrays as strings (line 365)", () => {
      const formData = new FormData();
      formData.append("tags", "[invalid json");

      const parsed = parseFormData(formData);
      // Should keep as string when JSON parsing fails
      expect(parsed.tags).toBe("[invalid json");
    });

    it("should handle JSON-like strings that aren't arrays", () => {
      const formData = new FormData();
      formData.append("config", "{key: value}");

      const parsed = parseFormData(formData);
      // Should keep as string (doesn't start with "[")
      expect(parsed.config).toBe("{key: value}");
    });
  });

  // ============================================================================
  // validateFormData Tests
  // ============================================================================

  describe("validateFormData", () => {
    it("should return success with valid data", () => {
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");

      const result = validateFormData(formData, customerSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("john@example.com");
      }
    });

    it("should return errors with invalid data", () => {
      const formData = new FormData();
      formData.append("email", "invalid");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");

      const result = validateFormData(formData, customerSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBe("Valid email required");
      }
    });

    it("should return multiple errors", () => {
      const formData = new FormData();
      formData.append("email", "invalid");
      formData.append("firstName", "");
      formData.append("lastName", "");

      const result = validateFormData(formData, customerSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThan(1);
      }
    });
  });
});
