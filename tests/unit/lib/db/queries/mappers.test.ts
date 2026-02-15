import { describe, it, expect } from "vitest";
import {
  mapCustomer,
  mapTour,
  mapTrip,
  mapBooking,
  mapEquipment,
  mapBoat,
  mapDiveSite,
  mapProduct,
} from "../../../../../lib/db/queries/mappers";

describe("mappers", () => {
  describe("mapCustomer", () => {
    it("should map customer with camelCase fields", () => {
      const row = {
        id: "cust-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+1234567890",
        dateOfBirth: "1990-01-01",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "+0987654321",
        emergencyContactRelation: "Spouse",
        medicalConditions: "None",
        medications: "None",
        certifications: ["PADI Open Water"],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        preferredLanguage: "en",
        tags: ["vip"],
        marketingOptIn: true,
        notes: "Test notes",
        totalDives: 50,
        totalSpent: "1500.00",
        lastDiveAt: new Date("2024-01-01"),
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      };

      const result = mapCustomer(row);

      expect(result.id).toBe("cust-123");
      expect(result.email).toBe("test@example.com");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.phone).toBe("+1234567890");
      expect(result.dateOfBirth).toBe("1990-01-01");
      expect(result.emergencyContactName).toBe("Jane Doe");
      expect(result.emergencyContactPhone).toBe("+0987654321");
      expect(result.emergencyContactRelation).toBe("Spouse");
      expect(result.medicalConditions).toBe("None");
      expect(result.certifications).toEqual(["PADI Open Water"]);
      expect(result.totalDives).toBe(50);
      expect(result.totalSpent).toBe(1500);
      expect(result.marketingOptIn).toBe(true);
    });

    it("should map customer with snake_case fields", () => {
      const row = {
        id: "cust-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: "+1234567890",
        date_of_birth: "1990-01-01",
        emergency_contact_name: "Jane Doe",
        emergency_contact_phone: "+0987654321",
        emergency_contact_relation: "Spouse",
        medical_conditions: "None",
        medications: "None",
        certifications: ["PADI Open Water"],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postal_code: "33101",
        country: "USA",
        preferred_language: "es",
        tags: ["vip"],
        marketing_opt_in: false,
        notes: "Test notes",
        total_dives: 25,
        total_spent: "750.00",
        last_dive_at: new Date("2024-01-01"),
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapCustomer(row);

      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.dateOfBirth).toBe("1990-01-01");
      expect(result.emergencyContactName).toBe("Jane Doe");
      expect(result.postalCode).toBe("33101");
      expect(result.preferredLanguage).toBe("es");
      expect(result.marketingOptIn).toBe(false);
      expect(result.totalDives).toBe(25);
      expect(result.totalSpent).toBe(750);
    });

    it("should handle missing optional fields", () => {
      const row = {
        id: "cust-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: null,
        dateOfBirth: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelation: null,
        medicalConditions: null,
        medications: null,
        certifications: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        preferredLanguage: null,
        tags: null,
        marketingOptIn: null,
        notes: null,
        totalDives: null,
        totalSpent: null,
        lastDiveAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapCustomer(row);

      // Fields that preserve null (direct assignment)
      expect(result.phone).toBeNull();
      expect(result.medications).toBeNull();
      expect(result.certifications).toBeNull();
      expect(result.address).toBeNull();
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.country).toBeNull();
      expect(result.notes).toBeNull();

      // Nullable fields preserve null with ?? operator
      expect(result.dateOfBirth).toBeNull();
      expect(result.emergencyContactName).toBeNull();
      expect(result.emergencyContactPhone).toBeNull();
      expect(result.emergencyContactRelation).toBeNull();
      expect(result.medicalConditions).toBeNull();
      expect(result.postalCode).toBeNull();
      expect(result.lastDiveAt).toBeNull();

      // Fields with default values
      expect(result.tags).toEqual([]);
      expect(result.marketingOptIn).toBe(false);
      expect(result.totalDives).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.preferredLanguage).toBe("en");
    });

    it("should convert totalSpent to number", () => {
      const row = {
        id: "cust-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        totalSpent: "2500.50",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapCustomer(row);
      expect(result.totalSpent).toBe(2500.50);
      expect(typeof result.totalSpent).toBe("number");
    });

    it("should handle zero totalSpent", () => {
      const row = {
        id: "cust-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        totalSpent: "0",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapCustomer(row);
      expect(result.totalSpent).toBe(0);
    });
  });

  describe("mapTour", () => {
    it("should map tour with camelCase fields", () => {
      const row = {
        id: "tour-123",
        name: "Reef Diving",
        description: "Explore the coral reef",
        type: "shore",
        duration: "2 hours",
        maxParticipants: 8,
        minParticipants: 2,
        price: "75.00",
        currency: "USD",
        includesEquipment: true,
        includesMeals: false,
        includesTransport: true,
        minCertLevel: "Open Water",
        minAge: 12,
        inclusions: ["Guide", "Tanks"],
        exclusions: ["Wetsuit"],
        requirements: ["Medical form"],
        isActive: true,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      } as any;

      const result = mapTour(row);

      expect(result.id).toBe("tour-123");
      expect(result.name).toBe("Reef Diving");
      expect(result.type).toBe("shore");
      expect(result.maxParticipants).toBe(8);
      expect(result.minParticipants).toBe(2);
      expect(result.price).toBe(75);
      expect(result.includesEquipment).toBe(true);
      expect(result.includesMeals).toBe(false);
      expect(result.includesTransport).toBe(true);
      expect(result.minCertLevel).toBe("Open Water");
      expect(result.minAge).toBe(12);
    });

    it("should map tour with snake_case fields", () => {
      const row = {
        id: "tour-123",
        name: "Wreck Diving",
        description: "Explore a sunken ship",
        type: "boat",
        duration: "3 hours",
        max_participants: 6,
        min_participants: 4,
        price: "125.00",
        currency: "USD",
        includes_equipment: false,
        includes_meals: true,
        includes_transport: false,
        min_cert_level: "Advanced",
        min_age: 18,
        inclusions: ["Meals"],
        exclusions: ["Equipment"],
        requirements: ["Advanced cert"],
        is_active: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapTour(row);

      expect(result.maxParticipants).toBe(6);
      expect(result.minParticipants).toBe(4);
      expect(result.includesEquipment).toBe(false);
      expect(result.includesMeals).toBe(true);
      expect(result.includesTransport).toBe(false);
      expect(result.minCertLevel).toBe("Advanced");
      expect(result.minAge).toBe(18);
      expect(result.isActive).toBe(true);
    });

    it("should convert price to number", () => {
      const row = {
        id: "tour-123",
        name: "Tour",
        price: "99.99",
        maxParticipants: 8,
        minParticipants: 2,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapTour(row);
      expect(result.price).toBe(99.99);
      expect(typeof result.price).toBe("number");
    });

    it("should handle missing optional fields", () => {
      const row = {
        id: "tour-123",
        name: "Tour",
        type: "shore",
        maxParticipants: 8,
        minParticipants: 2,
        price: "50.00",
        currency: "USD",
        description: null,
        duration: null,
        minCertLevel: null,
        minAge: null,
        inclusions: null,
        exclusions: null,
        requirements: null,
        includesEquipment: false,
        includesMeals: false,
        includesTransport: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapTour(row);

      // Nullable fields preserve null with ?? operator
      expect(result.minCertLevel).toBeNull();
      expect(result.minAge).toBeNull();
      // Arrays default to []
      expect(result.inclusions).toEqual([]);
      expect(result.exclusions).toEqual([]);
      expect(result.requirements).toEqual([]);
    });
  });

  describe("mapTrip", () => {
    it("should map trip with camelCase fields", () => {
      const row = {
        id: "trip-123",
        tourId: "tour-123",
        boatId: "boat-123",
        date: "2024-06-15",
        startTime: "09:00",
        endTime: "12:00",
        status: "scheduled",
        maxParticipants: 8,
        price: "75.00",
        notes: "Good weather expected",
        weatherNotes: "Sunny",
        isPublic: true,
        tourName: "Reef Diving",
        tourType: "boat",
        boatName: "Sea Explorer",
        bookedParticipants: 5,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      };

      const result = mapTrip(row);

      expect(result.id).toBe("trip-123");
      expect(result.tourId).toBe("tour-123");
      expect(result.boatId).toBe("boat-123");
      expect(result.date).toBe("2024-06-15");
      expect(result.startTime).toBe("09:00");
      expect(result.endTime).toBe("12:00");
      expect(result.status).toBe("scheduled");
      expect(result.maxParticipants).toBe(8);
      expect(result.price).toBe(75);
      expect(result.isPublic).toBe(true);
      expect(result.tourName).toBe("Reef Diving");
      expect(result.tourType).toBe("boat");
      expect(result.boatName).toBe("Sea Explorer");
      expect(result.bookedParticipants).toBe(5);
    });

    it("should map trip with snake_case fields", () => {
      const row = {
        id: "trip-123",
        tour_id: "tour-123",
        boat_id: "boat-123",
        date: "2024-06-15",
        start_time: "14:00",
        end_time: "17:00",
        status: "completed",
        max_participants: 6,
        price: "100.00",
        notes: "Great trip",
        weather_notes: "Cloudy",
        is_public: false,
        tour_name: "Wreck Diving",
        tour_type: "shore",
        boat_name: "Ocean Rider",
        booked_participants: 4,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapTrip(row);

      expect(result.tourId).toBe("tour-123");
      expect(result.boatId).toBe("boat-123");
      expect(result.startTime).toBe("14:00");
      expect(result.endTime).toBe("17:00");
      expect(result.maxParticipants).toBe(6);
      expect(result.weatherNotes).toBe("Cloudy");
      expect(result.isPublic).toBe(false);
      expect(result.tourName).toBe("Wreck Diving");
      expect(result.tourType).toBe("shore");
      expect(result.boatName).toBe("Ocean Rider");
      expect(result.bookedParticipants).toBe(4);
    });

    it("should convert price to number", () => {
      const row = {
        id: "trip-123",
        tourId: "tour-123",
        date: "2024-06-15",
        startTime: "09:00",
        status: "scheduled",
        price: "85.50",
        bookedParticipants: "3",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapTrip(row);
      expect(result.price).toBe(85.50);
      expect(result.bookedParticipants).toBe(3);
    });

    it("should handle null price and boatId", () => {
      const row = {
        id: "trip-123",
        tourId: "tour-123",
        boatId: null,
        date: "2024-06-15",
        startTime: "09:00",
        endTime: null,
        status: "scheduled",
        maxParticipants: null,
        price: null,
        notes: null,
        weatherNotes: null,
        isPublic: false,
        bookedParticipants: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapTrip(row);

      // Nullable fields preserve null with ?? operator
      expect(result.boatId).toBeNull();
      expect(result.endTime).toBeNull();
      expect(result.price).toBeNull();
      expect(result.maxParticipants).toBeNull();
      expect(result.weatherNotes).toBeNull();
      expect(result.bookedParticipants).toBe(0);
    });

    it("should default isPublic to false when missing", () => {
      const row = {
        id: "trip-123",
        tourId: "tour-123",
        date: "2024-06-15",
        startTime: "09:00",
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapTrip(row);
      expect(result.isPublic).toBe(false);
    });
  });

  describe("mapBooking", () => {
    it("should map booking with camelCase fields", () => {
      const row = {
        id: "booking-123",
        bookingNumber: "BK-123456",
        tripId: "trip-123",
        customerId: "cust-123",
        participants: 2,
        status: "confirmed",
        subtotal: "150.00",
        discount: "15.00",
        tax: "13.50",
        total: "148.50",
        currency: "USD",
        paymentStatus: "paid",
        paidAmount: "148.50",
        specialRequests: "Window seat",
        source: "website",
        firstName: "John",
        lastName: "Doe",
        customerEmail: "john@example.com",
        customerPhone: "+1234567890",
        tourName: "Reef Diving",
        tripDate: "2024-06-15",
        tripTime: "09:00",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      } as any;

      const result = mapBooking(row);

      expect(result.id).toBe("booking-123");
      expect(result.bookingNumber).toBe("BK-123456");
      expect(result.tripId).toBe("trip-123");
      expect(result.customerId).toBe("cust-123");
      expect(result.participants).toBe(2);
      expect(result.status).toBe("confirmed");
      expect(result.subtotal).toBe(150);
      expect(result.discount).toBe(15);
      expect(result.tax).toBe(13.50);
      expect(result.total).toBe(148.50);
      expect(result.paymentStatus).toBe("paid");
      expect(result.paidAmount).toBe(148.50);
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.customerName).toBe("John Doe");
      expect(result.customerEmail).toBe("john@example.com");
      expect(result.tourName).toBe("Reef Diving");
    });

    it("should map booking with snake_case fields", () => {
      const row = {
        id: "booking-123",
        booking_number: "BK-789012",
        trip_id: "trip-123",
        customer_id: "cust-123",
        participants: 3,
        status: "pending",
        subtotal: "225.00",
        discount: "0.00",
        tax: "22.50",
        total: "247.50",
        currency: "USD",
        payment_status: "pending",
        paid_amount: "0.00",
        special_requests: "Vegetarian meal",
        source: "phone",
        first_name: "Jane",
        last_name: "Smith",
        customer_email: "jane@example.com",
        customer_phone: "+0987654321",
        tour_name: "Wreck Diving",
        trip_date: "2024-07-20",
        trip_time: "14:00",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapBooking(row);

      expect(result.bookingNumber).toBe("BK-789012");
      expect(result.tripId).toBe("trip-123");
      expect(result.customerId).toBe("cust-123");
      expect(result.paymentStatus).toBe("pending");
      expect(result.paidAmount).toBe(0);
      expect(result.specialRequests).toBe("Vegetarian meal");
      expect(result.firstName).toBe("Jane");
      expect(result.lastName).toBe("Smith");
      expect(result.customerName).toBe("Jane Smith");
      expect(result.customerEmail).toBe("jane@example.com");
      expect(result.customerPhone).toBe("+0987654321");
      expect(result.tourName).toBe("Wreck Diving");
      expect(result.tripDate).toBe("2024-07-20");
      expect(result.tripTime).toBe("14:00");
    });

    it("should convert amounts to numbers", () => {
      const row = {
        id: "booking-123",
        bookingNumber: "BK-123",
        tripId: "trip-123",
        customerId: "cust-123",
        participants: 1,
        status: "confirmed",
        subtotal: "99.99",
        discount: "9.99",
        tax: "9.00",
        total: "99.00",
        currency: "USD",
        paymentStatus: "paid",
        paidAmount: "99.00",
        source: "website",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapBooking(row);

      expect(typeof result.subtotal).toBe("number");
      expect(typeof result.discount).toBe("number");
      expect(typeof result.tax).toBe("number");
      expect(typeof result.total).toBe("number");
      expect(typeof result.paidAmount).toBe("number");
    });

    it("should handle missing names gracefully", () => {
      const row = {
        id: "booking-123",
        bookingNumber: "BK-123",
        tripId: "trip-123",
        customerId: "cust-123",
        participants: 1,
        status: "confirmed",
        subtotal: "100.00",
        discount: "0.00",
        tax: "10.00",
        total: "110.00",
        currency: "USD",
        paymentStatus: "paid",
        paidAmount: "110.00",
        source: "website",
        customerName: "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapBooking(row);

      expect(result.firstName).toBe("");
      expect(result.lastName).toBe("");
      expect(result.customerName).toBe("Test User");
    });

    it("should handle zero amounts", () => {
      const row = {
        id: "booking-123",
        bookingNumber: "BK-123",
        tripId: "trip-123",
        customerId: "cust-123",
        participants: 1,
        status: "confirmed",
        subtotal: "0",
        discount: "0",
        tax: "0",
        total: "0",
        currency: "USD",
        paymentStatus: "pending",
        paidAmount: "0",
        source: "website",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapBooking(row);

      expect(result.subtotal).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(0);
      expect(result.paidAmount).toBe(0);
    });
  });

  describe("mapEquipment", () => {
    it("should map equipment with camelCase fields", () => {
      const row = {
        id: "eq-123",
        category: "bcd",
        name: "BCD Pro",
        brand: "Scubapro",
        model: "Hydros Pro",
        serialNumber: "SN123456",
        barcode: "BC123456789",
        size: "L",
        status: "available",
        condition: "excellent",
        rentalPrice: "25.00",
        isRentable: true,
        isPublic: true,
        lastServiceDate: new Date("2024-01-01"),
        nextServiceDate: new Date("2024-07-01"),
        serviceNotes: "All good",
        purchaseDate: new Date("2023-01-01"),
        purchasePrice: "800.00",
        notes: "Premium equipment",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      };

      const result = mapEquipment(row);

      expect(result.id).toBe("eq-123");
      expect(result.category).toBe("bcd");
      expect(result.name).toBe("BCD Pro");
      expect(result.brand).toBe("Scubapro");
      expect(result.serialNumber).toBe("SN123456");
      expect(result.rentalPrice).toBe(25);
      expect(result.isRentable).toBe(true);
      expect(result.isPublic).toBe(true);
      expect(result.purchasePrice).toBe(800);
    });

    it("should map equipment with snake_case fields", () => {
      const row = {
        id: "eq-123",
        category: "regulator",
        name: "Reg Set",
        brand: "Atomic",
        model: "T3",
        serial_number: "REG789",
        barcode: "REG987654321",
        size: "Standard",
        status: "maintenance",
        condition: "good",
        rental_price: "30.00",
        is_rentable: false,
        is_public: false,
        last_service_date: new Date("2024-02-01"),
        next_service_date: new Date("2024-08-01"),
        service_notes: "Needs tuning",
        purchase_date: new Date("2023-06-01"),
        purchase_price: "1200.00",
        notes: "High-end model",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapEquipment(row);

      expect(result.serialNumber).toBe("REG789");
      expect(result.rentalPrice).toBe(30);
      expect(result.isRentable).toBe(false);
      expect(result.isPublic).toBe(false);
      expect(result.lastServiceDate).toBeInstanceOf(Date);
      expect(result.nextServiceDate).toBeInstanceOf(Date);
      expect(result.serviceNotes).toBe("Needs tuning");
      expect(result.purchaseDate).toBeInstanceOf(Date);
      expect(result.purchasePrice).toBe(1200);
    });

    it("should handle null optional fields", () => {
      const row = {
        id: "eq-123",
        category: "fins",
        name: "Fins",
        brand: "Mares",
        model: "Avanti",
        serialNumber: null,
        barcode: null,
        size: "M",
        status: "available",
        condition: "good",
        rentalPrice: null,
        isRentable: false,
        isPublic: false,
        lastServiceDate: null,
        nextServiceDate: null,
        serviceNotes: null,
        purchaseDate: null,
        purchasePrice: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapEquipment(row);

      // Nullable fields preserve null with ?? operator
      expect(result.serialNumber).toBeNull();
      expect(result.rentalPrice).toBeNull();
      expect(result.purchasePrice).toBeNull();
      expect(result.lastServiceDate).toBeNull();
      expect(result.nextServiceDate).toBeNull();
      expect(result.serviceNotes).toBeNull();
    });

    it("should default isPublic to false when missing", () => {
      const row = {
        id: "eq-123",
        category: "mask",
        name: "Mask",
        brand: "Cressi",
        status: "available",
        condition: "good",
        isRentable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapEquipment(row);
      expect(result.isPublic).toBe(false);
    });
  });

  describe("mapBoat", () => {
    it("should map boat with camelCase fields", () => {
      const row = {
        id: "boat-123",
        name: "Sea Explorer",
        description: "Large dive boat",
        capacity: 20,
        type: "yacht",
        registrationNumber: "REG123456",
        amenities: ["bathroom", "kitchen", "sun deck"],
        isActive: true,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      };

      const result = mapBoat(row);

      expect(result.id).toBe("boat-123");
      expect(result.name).toBe("Sea Explorer");
      expect(result.description).toBe("Large dive boat");
      expect(result.capacity).toBe(20);
      expect(result.type).toBe("yacht");
      expect(result.registrationNumber).toBe("REG123456");
      expect(result.amenities).toEqual(["bathroom", "kitchen", "sun deck"]);
      expect(result.isActive).toBe(true);
    });

    it("should map boat with snake_case fields", () => {
      const row = {
        id: "boat-123",
        name: "Ocean Rider",
        description: "Fast speedboat",
        capacity: 12,
        type: "speedboat",
        registration_number: "REG789012",
        amenities: ["bathroom"],
        is_active: false,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapBoat(row);

      expect(result.name).toBe("Ocean Rider");
      expect(result.registrationNumber).toBe("REG789012");
      expect(result.isActive).toBe(false);
    });

    it("should handle null registrationNumber", () => {
      const row = {
        id: "boat-123",
        name: "Small Boat",
        description: null,
        capacity: 6,
        type: "dinghy",
        registrationNumber: null,
        amenities: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapBoat(row);
      expect(result.registrationNumber).toBeNull();
    });
  });

  describe("mapDiveSite", () => {
    it("should map dive site with camelCase fields", () => {
      const row = {
        id: "site-123",
        name: "Blue Hole",
        description: "Famous dive site",
        latitude: "17.3169",
        longitude: "-87.5369",
        maxDepth: 130,
        minDepth: 10,
        difficulty: "advanced",
        currentStrength: "moderate",
        visibility: "excellent",
        highlights: ["coral", "fish", "caves"],
        isActive: true,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-01"),
        organizationId: "org-123",
      };

      const result = mapDiveSite(row);

      expect(result.id).toBe("site-123");
      expect(result.name).toBe("Blue Hole");
      expect(result.latitude).toBe(17.3169);
      expect(result.longitude).toBe(-87.5369);
      expect(result.maxDepth).toBe(130);
      expect(result.minDepth).toBe(10);
      expect(result.difficulty).toBe("advanced");
      expect(result.currentStrength).toBe("moderate");
      expect(result.visibility).toBe("excellent");
      expect(result.highlights).toEqual(["coral", "fish", "caves"]);
      expect(result.isActive).toBe(true);
    });

    it("should map dive site with snake_case fields", () => {
      const row = {
        id: "site-123",
        name: "Coral Garden",
        description: "Beautiful coral formations",
        latitude: "18.0000",
        longitude: "-88.0000",
        max_depth: 60,
        min_depth: 15,
        difficulty: "beginner",
        current_strength: "light",
        visibility: "good",
        highlights: ["coral"],
        is_active: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2024-01-01"),
        organization_id: "org-123",
      } as any;

      const result = mapDiveSite(row);

      expect(result.maxDepth).toBe(60);
      expect(result.minDepth).toBe(15);
      expect(result.currentStrength).toBe("light");
      expect(result.isActive).toBe(true);
    });

    it("should convert latitude/longitude to numbers", () => {
      const row = {
        id: "site-123",
        name: "Test Site",
        latitude: "25.5678",
        longitude: "-80.1234",
        difficulty: "beginner",
        visibility: "good",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapDiveSite(row);

      expect(typeof result.latitude).toBe("number");
      expect(typeof result.longitude).toBe("number");
      expect(result.latitude).toBe(25.5678);
      expect(result.longitude).toBe(-80.1234);
    });

    it("should handle null coordinates and depths", () => {
      const row = {
        id: "site-123",
        name: "Unknown Site",
        description: null,
        latitude: null,
        longitude: null,
        maxDepth: null,
        minDepth: null,
        difficulty: "beginner",
        currentStrength: null,
        visibility: "unknown",
        highlights: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "org-123",
      } as any;

      const result = mapDiveSite(row);

      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
      expect(result.maxDepth).toBeNull();
      expect(result.minDepth).toBeNull();
      expect(result.currentStrength).toBeNull();
    });
  });

  describe("mapProduct", () => {
    it("should map product with camelCase fields", () => {
      const row = {
        id: "prod-123",
        name: "Dive Mask",
        sku: "MASK-001",
        category: "equipment",
        description: "High-quality dive mask",
        price: "89.99",
        costPrice: "45.00",
        currency: "USD",
        taxRate: "0.08",
        salePrice: "79.99",
        trackInventory: true,
        stockQuantity: 25,
        lowStockThreshold: 5,
        imageUrl: "https://example.com/mask.jpg",
        isActive: true,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = mapProduct(row);

      expect(result.id).toBe("prod-123");
      expect(result.name).toBe("Dive Mask");
      expect(result.sku).toBe("MASK-001");
      expect(result.category).toBe("equipment");
      expect(result.price).toBe(89.99);
      expect(result.costPrice).toBe(45);
      expect(result.taxRate).toBe(0.08);
      expect(result.salePrice).toBe(79.99);
      expect(result.trackInventory).toBe(true);
      expect(result.stockQuantity).toBe(25);
      expect(result.lowStockThreshold).toBe(5);
      expect(result.imageUrl).toBe("https://example.com/mask.jpg");
      expect(result.isActive).toBe(true);
    });

    it("should map product with snake_case fields", () => {
      const row = {
        id: "prod-123",
        name: "Snorkel",
        sku: "SNK-001",
        category: "equipment",
        description: "Premium snorkel",
        price: "29.99",
        cost_price: "15.00",
        currency: "USD",
        tax_rate: "0.06",
        sale_price: "24.99",
        track_inventory: true,
        stock_quantity: 50,
        low_stock_threshold: 10,
        image_url: "https://example.com/snorkel.jpg",
        is_active: true,
        organization_id: "org-123",
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      const result = mapProduct(row);

      expect(result.costPrice).toBe(15);
      expect(result.taxRate).toBe(0.06);
      expect(result.salePrice).toBe(24.99);
      expect(result.trackInventory).toBe(true);
      expect(result.stockQuantity).toBe(50);
      expect(result.lowStockThreshold).toBe(10);
      expect(result.imageUrl).toBe("https://example.com/snorkel.jpg");
      expect(result.isActive).toBe(true);
    });

    it("should convert prices to numbers", () => {
      const row = {
        id: "prod-123",
        name: "Product",
        category: "test",
        price: "99.99",
        costPrice: "50.00",
        currency: "USD",
        taxRate: "0.10",
        salePrice: "89.99",
        trackInventory: false,
        stockQuantity: 0,
        lowStockThreshold: 5,
        isActive: true,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = mapProduct(row);

      expect(typeof result.price).toBe("number");
      expect(typeof result.costPrice).toBe("number");
      expect(typeof result.taxRate).toBe("number");
      expect(typeof result.salePrice).toBe("number");
    });

    it("should handle null optional fields", () => {
      const row = {
        id: "prod-123",
        name: "Product",
        sku: null,
        category: "test",
        description: null,
        price: "50.00",
        costPrice: null,
        currency: "USD",
        taxRate: "0",
        salePrice: null,
        trackInventory: false,
        stockQuantity: 0,
        lowStockThreshold: 5,
        imageUrl: null,
        isActive: true,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = mapProduct(row);

      expect(result.sku).toBeNull();
      expect(result.description).toBeNull();
      expect(result.costPrice).toBeNull();
      expect(result.salePrice).toBeNull();
      expect(result.imageUrl).toBeNull();
    });

    it("should use default values for missing fields", () => {
      const row = {
        id: "prod-123",
        name: "Product",
        category: "test",
        price: "50.00",
        currency: "USD",
        isActive: true,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = mapProduct(row);

      expect(result.price).toBe(50);
      expect(result.taxRate).toBe(0);
      expect(result.stockQuantity).toBe(0);
      expect(result.lowStockThreshold).toBe(5);
    });

    it("should handle zero values correctly", () => {
      const row = {
        id: "prod-123",
        name: "Free Product",
        category: "test",
        price: "0",
        costPrice: "0",
        currency: "USD",
        taxRate: "0",
        salePrice: "0",
        trackInventory: true,
        stockQuantity: 0,
        lowStockThreshold: 0,
        isActive: true,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = mapProduct(row);

      expect(result.price).toBe(0);
      expect(result.costPrice).toBe(0);
      expect(result.taxRate).toBe(0);
      expect(result.salePrice).toBe(0);
      expect(result.stockQuantity).toBe(0);
      expect(result.lowStockThreshold).toBe(0);
    });
  });
});
