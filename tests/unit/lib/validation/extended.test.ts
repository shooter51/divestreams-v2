/**
 * Extended Validation Tests
 *
 * Additional tests for validation schemas and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  customerSchema,
  tourSchema,
  tripSchema,
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

describe("validation extended", () => {
  // ============================================================================
  // Customer Schema Tests
  // ============================================================================
  describe("customerSchema", () => {
    it("validates minimal customer data", () => {
      const data = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates full customer data", () => {
      const data = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+1-555-0100",
        dateOfBirth: "1990-01-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "+1-555-0101",
        emergencyContactRelation: "Spouse",
        medicalConditions: "None",
        medications: "None",
        certifications: [
          { agency: "PADI", level: "Open Water", number: "12345" },
        ],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        preferredLanguage: "en",
        marketingOptIn: true,
        notes: "VIP customer",
        tags: ["vip", "frequent"],
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const data = {
        email: "not-an-email",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects empty first name", () => {
      const data = {
        email: "test@example.com",
        firstName: "",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects empty last name", () => {
      const data = {
        email: "test@example.com",
        firstName: "John",
        lastName: "",
      };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("applies default values", () => {
      const data = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = customerSchema.safeParse(data);
      if (result.success) {
        expect(result.data.preferredLanguage).toBe("en");
        expect(result.data.marketingOptIn).toBe(false);
      }
    });
  });

  // ============================================================================
  // Tour Schema Tests
  // ============================================================================
  describe("tourSchema", () => {
    it("validates minimal tour data", () => {
      const data = {
        name: "Morning Dive",
        type: "single_dive",
        maxParticipants: 10,
        price: 99,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates all tour types", () => {
      const types = ["single_dive", "multi_dive", "course", "snorkel", "night_dive", "other"];
      types.forEach((type) => {
        const data = {
          name: "Test Tour",
          type,
          maxParticipants: 10,
          price: 50,
        };
        const result = tourSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("rejects invalid tour type", () => {
      const data = {
        name: "Test Tour",
        type: "invalid_type",
        maxParticipants: 10,
        price: 50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative price", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: 10,
        price: -50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects zero max participants", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: 0,
        price: 50,
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("coerces string numbers", () => {
      const data = {
        name: "Test Tour",
        type: "single_dive",
        maxParticipants: "10",
        price: "99.99",
      };
      const result = tourSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxParticipants).toBe(10);
        expect(result.data.price).toBe(99.99);
      }
    });
  });

  // ============================================================================
  // Trip Schema Tests
  // ============================================================================
  describe("tripSchema", () => {
    it("validates minimal trip data", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-20",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates trip with all optional fields", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        boatId: "550e8400-e29b-41d4-a716-446655440001",
        date: "2025-01-20",
        startTime: "09:00",
        endTime: "12:00",
        maxParticipants: 8,
        price: 149.99,
        weatherNotes: "Clear skies expected",
        notes: "Bring extra sunscreen",
        staffIds: ["550e8400-e29b-41d4-a716-446655440002"],
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid tour UUID", () => {
      const data = {
        tourId: "not-a-uuid",
        date: "2025-01-20",
        startTime: "09:00",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("validates recurring trip fields", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-20",
        startTime: "09:00",
        isRecurring: true,
        recurrencePattern: "weekly",
        recurrenceDays: [1, 3, 5], // Mon, Wed, Fri
        recurrenceEndDate: "2025-03-20",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("handles isRecurring as string 'true'", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-20",
        startTime: "09:00",
        isRecurring: "true",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRecurring).toBe(true);
      }
    });

    it("parses recurrenceDays from JSON string", () => {
      const data = {
        tourId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-20",
        startTime: "09:00",
        recurrenceDays: "[1, 3, 5]",
      };
      const result = tripSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurrenceDays).toEqual([1, 3, 5]);
      }
    });
  });

  // ============================================================================
  // Booking Schema Tests
  // ============================================================================
  describe("bookingSchema", () => {
    it("validates minimal booking data", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates booking with participants", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        participants: 4,
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("coerces participants from string", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        participants: "3",
      };
      const result = bookingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participants).toBe(3);
      }
    });

    it("applies default values", () => {
      const data = {
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const result = bookingSchema.safeParse(data);
      if (result.success) {
        expect(result.data.participants).toBe(1);
        expect(result.data.source).toBe("direct");
      }
    });
  });

  // ============================================================================
  // Dive Site Schema Tests
  // ============================================================================
  describe("diveSiteSchema", () => {
    it("validates minimal dive site data", () => {
      const data = {
        name: "Blue Hole",
        location: "Belize",
        maxDepth: 40,
        difficulty: "advanced",
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates all difficulty levels", () => {
      const difficulties = ["beginner", "intermediate", "advanced", "expert"];
      difficulties.forEach((difficulty) => {
        const data = {
          name: "Test Site",
          location: "Test Location",
          maxDepth: 20,
          difficulty,
        };
        const result = diveSiteSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("validates coordinates", () => {
      const data = {
        name: "Test Site",
        location: "Test Location",
        maxDepth: 20,
        difficulty: "beginner",
        latitude: 25.7617,
        longitude: -80.1918,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid latitude (too high)", () => {
      const data = {
        name: "Test Site",
        location: "Test Location",
        maxDepth: 20,
        difficulty: "beginner",
        latitude: 91,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects invalid longitude (too low)", () => {
      const data = {
        name: "Test Site",
        location: "Test Location",
        maxDepth: 20,
        difficulty: "beginner",
        longitude: -181,
      };
      const result = diveSiteSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("handles empty string coordinates", () => {
      const data = {
        name: "Test Site",
        location: "Test Location",
        maxDepth: 20,
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
  // Boat Schema Tests
  // ============================================================================
  describe("boatSchema", () => {
    it("validates minimal boat data", () => {
      const data = {
        name: "Sea Explorer",
        capacity: 12,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates full boat data", () => {
      const data = {
        name: "Sea Explorer",
        description: "A beautiful dive boat",
        capacity: 12,
        type: "Catamaran",
        registrationNumber: "FL-12345",
        images: ["image1.jpg", "image2.jpg"],
        amenities: ["Restroom", "Shade", "Fresh Water"],
        isActive: true,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects zero capacity", () => {
      const data = {
        name: "Small Boat",
        capacity: 0,
      };
      const result = boatSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Equipment Schema Tests
  // ============================================================================
  describe("equipmentSchema", () => {
    it("validates minimal equipment data", () => {
      const data = {
        category: "bcd",
        name: "Aqualung Pro HD",
        isRentable: false,
      };
      const result = equipmentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates all equipment categories", () => {
      const categories = ["bcd", "regulator", "wetsuit", "mask", "fins", "tank", "computer", "other"];
      categories.forEach((category) => {
        const data = { category, name: "Test Equipment", isRentable: false };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("validates all status values", () => {
      const statuses = ["available", "rented", "maintenance", "retired"];
      statuses.forEach((status) => {
        const data = { category: "bcd", name: "Test", status, isRentable: false };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("validates all condition values", () => {
      const conditions = ["excellent", "good", "fair", "poor"];
      conditions.forEach((condition) => {
        const data = { category: "bcd", name: "Test", condition, isRentable: false };
        const result = equipmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // User Schema Tests
  // ============================================================================
  describe("userSchema", () => {
    it("validates minimal user data", () => {
      const data = {
        email: "staff@diveshop.com",
        name: "John Staff",
      };
      const result = userSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates all user roles", () => {
      const roles = ["owner", "manager", "staff"];
      roles.forEach((role) => {
        const data = { email: "test@test.com", name: "Test", role };
        const result = userSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("applies default role", () => {
      const data = {
        email: "staff@diveshop.com",
        name: "John Staff",
      };
      const result = userSchema.safeParse(data);
      if (result.success) {
        expect(result.data.role).toBe("staff");
      }
    });
  });

  // ============================================================================
  // Shop Settings Schema Tests
  // ============================================================================
  describe("shopSettingsSchema", () => {
    it("validates minimal shop settings", () => {
      const data = {
        name: "Dive Shop",
        email: "info@diveshop.com",
      };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates full shop settings", () => {
      const data = {
        name: "Dive Shop",
        email: "info@diveshop.com",
        phone: "+1-555-0100",
        timezone: "America/New_York",
        currency: "USD",
        branding: {
          logo: "logo.png",
          primaryColor: "#0066cc",
          secondaryColor: "#ffffff",
        },
        booking: {
          requireDeposit: true,
          depositPercent: 25,
          cancellationPolicy: "24 hours notice required",
        },
        notifications: {
          emailBookingConfirmation: true,
          emailReminders: true,
          reminderDaysBefore: 1,
        },
      };
      const result = shopSettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("applies default values", () => {
      const data = {
        name: "Dive Shop",
        email: "info@diveshop.com",
      };
      const result = shopSettingsSchema.safeParse(data);
      if (result.success) {
        expect(result.data.timezone).toBe("UTC");
        expect(result.data.currency).toBe("USD");
      }
    });
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================
  describe("getFormValues", () => {
    it("extracts string values from FormData", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("email", "john@example.com");

      const values = getFormValues(formData);

      expect(values.name).toBe("John");
      expect(values.email).toBe("john@example.com");
    });

    it("excludes File values", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("file", new Blob(["content"]), "test.txt");

      const values = getFormValues(formData);

      expect(values.name).toBe("John");
      expect(values.file).toBeUndefined();
    });

    it("handles empty FormData", () => {
      const formData = new FormData();
      const values = getFormValues(formData);

      expect(Object.keys(values)).toHaveLength(0);
    });
  });

  describe("parseFormData", () => {
    it("parses simple key-value pairs", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("age", "30");

      const result = parseFormData(formData);

      expect(result.name).toBe("John");
      expect(result.age).toBe("30");
    });

    it("parses boolean strings", () => {
      const formData = new FormData();
      formData.append("isActive", "true");
      formData.append("isDeleted", "false");

      const result = parseFormData(formData);

      expect(result.isActive).toBe(true);
      expect(result.isDeleted).toBe(false);
    });

    it("parses array notation", () => {
      const formData = new FormData();
      formData.append("tags[0]", "vip");
      formData.append("tags[1]", "regular");

      const result = parseFormData(formData);

      expect(result.tags).toEqual(["vip", "regular"]);
    });

    it("parses nested notation", () => {
      const formData = new FormData();
      formData.append("address.city", "Miami");
      formData.append("address.state", "FL");

      const result = parseFormData(formData);

      expect(result.address).toEqual({ city: "Miami", state: "FL" });
    });

    it("parses JSON array strings", () => {
      const formData = new FormData();
      formData.append("ids", '["1", "2", "3"]');

      const result = parseFormData(formData);

      expect(result.ids).toEqual(["1", "2", "3"]);
    });

    it("skips empty and undefined values", () => {
      const formData = new FormData();
      formData.append("name", "John");
      formData.append("empty", "");
      formData.append("undef", "undefined");

      const result = parseFormData(formData);

      expect(result.name).toBe("John");
      expect(result.empty).toBeUndefined();
      expect(result.undef).toBeUndefined();
    });
  });

  describe("validateFormData", () => {
    it("returns success with valid data", () => {
      const formData = new FormData();
      formData.append("email", "test@example.com");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");

      const result = validateFormData(formData, customerSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
      }
    });

    it("returns errors with invalid data", () => {
      const formData = new FormData();
      formData.append("email", "not-an-email");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");

      const result = validateFormData(formData, customerSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });

    it("returns multiple errors", () => {
      const formData = new FormData();
      formData.append("email", "not-an-email");
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
