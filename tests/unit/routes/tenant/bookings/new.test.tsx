/**
 * Tenant Booking Creation Route Tests
 *
 * Tests the new booking form loader with parallel data fetching and action with validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/bookings/new";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
  getTrips: vi.fn(),
  getEquipment: vi.fn(),
  getCustomerById: vi.fn(),
  getTripById: vi.fn(),
  createBooking: vi.fn(),
}));

// Mock validation
vi.mock("../../../../../lib/validation", () => ({
  bookingSchema: {},
  validateFormData: vi.fn(),
  getFormValues: vi.fn(),
}));

// Mock email triggers
vi.mock("../../../../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import {
  getCustomers,
  getTrips,
  getEquipment,
  getCustomerById,
  getTripById,
  createBooking,
} from "../../../../../lib/db/queries.server";
import { validateFormData, getFormValues } from "../../../../../lib/validation";
import { triggerBookingConfirmation } from "../../../../../lib/email/triggers";

describe("Route: tenant/bookings/new.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomers = [
    {
      id: "customer-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
    },
    {
      id: "customer-2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "+9876543210",
    },
  ];

  const mockTrips = [
    {
      id: "trip-1",
      tourName: "Morning Dive",
      date: new Date("2024-03-15T09:00:00Z"),
      startTime: "09:00",
      price: 75.00,
      maxParticipants: 10,
      bookedParticipants: 2,
      spotsAvailable: 8,
      available: true,
    },
    {
      id: "trip-2",
      tourName: "Sunset Dive",
      date: new Date("2024-03-20T17:00:00Z"),
      startTime: "17:00",
      price: 85.00,
      maxParticipants: 10,
      bookedParticipants: 4,
      spotsAvailable: 6,
      available: true,
    },
  ];

  const mockEquipment = [
    {
      id: "equip-1",
      name: "Full Gear Package",
      rentalPrice: 35.00,
    },
    {
      id: "equip-2",
      name: "BCD Only",
      rentalPrice: 15.00,
    },
  ];

  describe("loader", () => {
    it("should load customers, upcoming trips, and rental equipment", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/new");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (getCustomers as any).mockResolvedValue({ customers: mockCustomers });
      (getTrips as any).mockResolvedValue(mockTrips);
      (getEquipment as any).mockResolvedValue(mockEquipment);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomers).toHaveBeenCalledWith("org-123", { limit: 100 });
      expect(getTrips).toHaveBeenCalledWith("org-123", {
        fromDate: expect.any(String),
        status: "scheduled",
        limit: 50,
      });
      expect(getEquipment).toHaveBeenCalledWith("org-123", {
        isRentable: true,
        status: "available",
      });

      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].id).toBe("customer-1");
      expect(result.upcomingTrips).toHaveLength(2);
      expect(result.rentalEquipment).toHaveLength(2);
      expect(result.selectedCustomer).toBeNull();
      expect(result.selectedTrip).toBeNull();
    });

    it("should pre-select customer when customerId query param provided", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/new?customerId=customer-1");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (getCustomers as any).mockResolvedValue({ customers: mockCustomers });
      (getTrips as any).mockResolvedValue(mockTrips);
      (getEquipment as any).mockResolvedValue(mockEquipment);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.selectedCustomer).not.toBeNull();
      expect(result.selectedCustomer?.id).toBe("customer-1");
      expect(result.selectedCustomer?.firstName).toBe("John");
    });

    it("should pre-select trip when tripId query param provided", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/new?tripId=trip-2");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (getCustomers as any).mockResolvedValue({ customers: mockCustomers });
      (getTrips as any).mockResolvedValue(mockTrips);
      (getEquipment as any).mockResolvedValue(mockEquipment);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.selectedTrip).not.toBeNull();
      expect(result.selectedTrip?.id).toBe("trip-2");
      expect(result.selectedTrip?.tourName).toBe("Sunset Dive");
    });

    it("should handle both customerId and tripId query params", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/new?customerId=customer-2&tripId=trip-1");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (getCustomers as any).mockResolvedValue({ customers: mockCustomers });
      (getTrips as any).mockResolvedValue(mockTrips);
      (getEquipment as any).mockResolvedValue(mockEquipment);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.selectedCustomer?.id).toBe("customer-2");
      expect(result.selectedCustomer?.firstName).toBe("Jane");
      expect(result.selectedTrip?.id).toBe("trip-1");
      expect(result.selectedTrip?.tourName).toBe("Morning Dive");
    });
  });

  describe("action", () => {
    it("should return error when customerId is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: false,
        errors: { customerId: "Required" },
      });

      (getFormValues as any).mockReturnValue({
        customerId: null,
        tripId: "trip-1",
        participants: 2,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.customerId).toBe("Required");
    });

    it("should return error when tripId is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: false,
        errors: { tripId: "Required" },
      });

      (getFormValues as any).mockReturnValue({
        customerId: "customer-1",
        tripId: null,
        participants: 2,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.tripId).toBe("Required");
    });

    it("should return error when participants is missing or invalid", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-1");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: false,
        errors: { participants: "Required" },
      });

      (getFormValues as any).mockReturnValue({
        customerId: "customer-1",
        tripId: "trip-1",
        participants: null,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.participants).toBe("Required");
    });

    it("should return error when customer not found", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-999");
      formData.append("tripId", "trip-1");
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-999",
          tripId: "trip-1",
          participants: 2,
        },
      });

      (getCustomerById as any).mockResolvedValue(null);
      (getTripById as any).mockResolvedValue(null);

      (getFormValues as any).mockReturnValue({
        customerId: "customer-999",
        tripId: "trip-1",
        participants: 2,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.customerId).toBe("Customer not found");
    });

    it("should return error when trip not found", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-999");
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-1",
          tripId: "trip-999",
          participants: 2,
        },
      });

      (getCustomerById as any).mockResolvedValue(mockCustomers[0]);
      (getTripById as any).mockResolvedValue(null);

      (getFormValues as any).mockReturnValue({
        customerId: "customer-1",
        tripId: "trip-999",
        participants: 2,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.tripId).toBe("Trip not found");
    });

    it("should create booking with valid data and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-1");
      formData.append("participants", "3");
      formData.append("specialRequests", "Need vegetarian lunch");
      formData.append("source", "website");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-1",
          tripId: "trip-1",
          participants: 3,
          specialRequests: "Need vegetarian lunch",
          source: "website",
        },
      });

      (getCustomerById as any).mockResolvedValue(mockCustomers[0]);
      (getTripById as any).mockResolvedValue({
        ...mockTrips[0],
        price: 75.00,
      });

      (createBooking as any).mockResolvedValue({
        id: "booking-new-123",
        bookingNumber: "BK-2024-NEW-123",
      });

      (triggerBookingConfirmation as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBooking).toHaveBeenCalledWith("org-123", {
        tripId: "trip-1",
        customerId: "customer-1",
        participants: 3,
        subtotal: 225.00,
        total: 225.00, // 75 * 3
        currency: "USD",
        specialRequests: "Need vegetarian lunch",
        source: "website",
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/bookings");
    });

    it("should calculate total correctly with multiple participants", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-2");
      formData.append("participants", "5");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-1",
          tripId: "trip-2",
          participants: 5,
        },
      });

      (getCustomerById as any).mockResolvedValue(mockCustomers[0]);
      (getTripById as any).mockResolvedValue({
        ...mockTrips[1],
        price: 85.00,
      });

      (createBooking as any).mockResolvedValue({
        id: "booking-new-456",
        bookingNumber: "BK-2024-NEW-456",
      });

      (triggerBookingConfirmation as any).mockResolvedValue(undefined);

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBooking).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          participants: 5,
          subtotal: 425.00,
          total: 425.00, // 85 * 5
        })
      );
    });

    it("should handle optional fields as undefined when not provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-1");
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-1",
          tripId: "trip-1",
          participants: 2,
          // specialRequests undefined
          // source defaults to "direct" in action
        },
      });

      (getCustomerById as any).mockResolvedValue(mockCustomers[0]);
      (getTripById as any).mockResolvedValue({
        ...mockTrips[0],
        price: 75.00,
      });

      (createBooking as any).mockResolvedValue({
        id: "booking-new-789",
        bookingNumber: "BK-2024-NEW-789",
      });

      (triggerBookingConfirmation as any).mockResolvedValue(undefined);

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBooking).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          specialRequests: undefined,
          source: "direct", // Default value
        })
      );
    });

    it("should default source to 'direct' when not provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("customerId", "customer-1");
      formData.append("tripId", "trip-1");
      formData.append("participants", "1");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          customerId: "customer-1",
          tripId: "trip-1",
          participants: 1,
          // source not provided, will default in action
        },
      });

      (getCustomerById as any).mockResolvedValue(mockCustomers[0]);
      (getTripById as any).mockResolvedValue({
        ...mockTrips[0],
        price: 75.00,
      });

      (createBooking as any).mockResolvedValue({
        id: "booking-default",
        bookingNumber: "BK-2024-DEFAULT",
      });

      (triggerBookingConfirmation as any).mockResolvedValue(undefined);

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBooking).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          source: "direct",
        })
      );
    });

    it("should preserve form values on validation error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("participants", "2");
      formData.append("specialRequests", "Dietary restrictions");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        tenant: { id: "tenant-1", name: "Test Shop" },
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: false,
        errors: { customerId: "Required" },
      });

      (getFormValues as any).mockReturnValue({
        customerId: null,
        tripId: "trip-1",
        participants: 2,
        specialRequests: "Dietary restrictions",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.customerId).toBe("Required");
      expect(result.values).toEqual({
        customerId: null,
        tripId: "trip-1",
        participants: 2,
        specialRequests: "Dietary restrictions",
      });
    });
  });
});
