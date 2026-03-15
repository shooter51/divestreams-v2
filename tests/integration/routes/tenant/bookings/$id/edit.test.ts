import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/bookings/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");

describe("app/routes/tenant/bookings/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockBookingId = "booking-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as unknown);
  });

  describe("loader", () => {
    const mockBookingBase = {
      id: mockBookingId,
      bookingNumber: "BK-001",
      status: "confirmed",
      participants: 2,
      specialRequests: "Vegetarian meals",
      internalNotes: "VIP customer",
      participantDetails: [],
      equipmentRental: [],
      tripId: "trip-1",
      customer: {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
      },
      trip: {
        id: "trip-1",
        tourId: "tour-1",
        tourName: "Reef Dive",
      },
      pricing: {
        total: "200.00",
      },
    };

    beforeEach(() => {
      vi.mocked(queries.getEquipment).mockResolvedValue([]);
      vi.mocked(queries.getTripById).mockResolvedValue({ id: "trip-1", requiresTankSelection: false } as unknown);
      vi.mocked(queries.getTankTypes).mockResolvedValue([]);
    });

    it("should fetch booking details for editing", async () => {
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(mockBookingBase as unknown);

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.getBookingWithFullDetails).toHaveBeenCalledWith(mockOrganizationId, mockBookingId);
      expect(result.booking).toEqual({
        id: mockBookingId,
        bookingNumber: "BK-001",
        customerId: "cust-1",
        customerName: "John Doe",
        tripId: "trip-1",
        tripName: "Reef Dive",
        participants: 2,
        status: "confirmed",
        totalAmount: "200.00",
        specialRequests: "Vegetarian meals",
        internalNotes: "VIP customer",
      });
    });

    it("should return tankTypes and requiresTankSelection from the trip", async () => {
      const mockTankTypes = [{ name: "12L", gasTypes: ["air", "nitrox32"], rentalPrice: "15.00", availableCount: 5 }];
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(mockBookingBase as unknown);
      vi.mocked(queries.getTripById).mockResolvedValue({ id: "trip-1", requiresTankSelection: true } as unknown);
      vi.mocked(queries.getTankTypes).mockResolvedValue(mockTankTypes as unknown[]);

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(result.requiresTankSelection).toBe(true);
      expect(result.tankTypes).toEqual(mockTankTypes);
    });

    it("should include existing participantDetails from booking", async () => {
      const existingDetails = [
        { name: "Participant 1", bringOwnTanks: false, tanks: [{ type: "12L", gasType: "air", quantity: 1 }] },
      ];
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue({
        ...mockBookingBase,
        participantDetails: existingDetails,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(result.existingParticipantDetails).toEqual(existingDetails);
    });

    it("should throw 400 if booking ID is missing", async () => {
      const request = new Request("http://test.com/tenant/bookings//edit");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Booking ID required");
      }
    });

    it("should throw 404 if booking not found", async () => {
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(null);

      const request = new Request("http://test.com/tenant/bookings/nonexistent/edit");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Booking not found");
      }
    });

    it("should handle null special requests and internal notes", async () => {
      const mockBooking = {
        ...mockBookingBase,
        bookingNumber: "BK-002",
        status: "pending",
        participants: 1,
        specialRequests: null,
        internalNotes: null,
        customer: {
          id: "cust-1",
          firstName: "Jane",
          lastName: "Smith",
        },
        trip: {
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Night Dive",
        },
      };

      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(mockBooking as unknown);

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(result.booking.specialRequests).toBe("");
      expect(result.booking.internalNotes).toBe("");
    });
  });

  describe("action", () => {
    const mockDb = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    const mockSchema = {
      bookings: {
        organizationId: Symbol("organizationId"),
        id: Symbol("id"),
      },
    };

    beforeEach(() => {
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue({
        id: mockBookingId,
        tripId: "trip-1",
      } as unknown);
      vi.mocked(queries.getTripById).mockResolvedValue({ id: "trip-1", requiresTankSelection: false } as unknown);
      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as unknown);
      mockDb.update.mockClear();
      mockDb.set.mockClear();
      mockDb.where.mockClear();
    });

    it("should update booking and redirect", async () => {
      const formData = new FormData();
      formData.append("participants", "3");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "Gluten-free meals");
      formData.append("internalNotes", "Regular customer");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockDb.update).toHaveBeenCalledWith(mockSchema.bookings);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: 3,
          status: "confirmed",
          specialRequests: "Gluten-free meals",
          internalNotes: "Regular customer",
        })
      );

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/bookings/${mockBookingId}`);
    });

    it("should save participantDetails when tank selections are submitted", async () => {
      const formData = new FormData();
      formData.append("participants", "1");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");
      formData.append("participantTanks[0].bringOwn", "false");
      formData.append("participantTanks[0].tanks[0].type", "12L");
      formData.append("participantTanks[0].tanks[0].gasType", "air");
      formData.append("participantTanks[0].tanks[0].quantity", "1");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockBookingId }, context: {} });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          participantDetails: [{ name: "Participant 1", bringOwnTanks: false, tanks: [{ type: "12L", gasType: "air", quantity: 1 }] }],
        })
      );
    });

    it("should return validation error when requiresTankSelection and tanks are missing", async () => {
      vi.mocked(queries.getTripById).mockResolvedValue({ id: "trip-1", requiresTankSelection: true } as unknown);

      const formData = new FormData();
      formData.append("participants", "2");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(result).toEqual({
        errors: {
          tanks: "Tank and gas selection is required for each participant on this trip",
        },
      });
    });

    it("should allow submission when participant brings own tanks", async () => {
      vi.mocked(queries.getTripById).mockResolvedValue({ id: "trip-1", requiresTankSelection: true } as unknown);

      const formData = new FormData();
      formData.append("participants", "1");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");
      formData.append("participantTanks[0].bringOwn", "true");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("should throw 400 if booking ID is missing in action", async () => {
      const formData = new FormData();
      formData.append("participants", "2");
      formData.append("status", "pending");

      const request = new Request("http://test.com/tenant/bookings//edit", {
        method: "POST",
        body: formData,
      });

      try {
        await action({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Booking ID required");
      }
    });

    it("should handle invalid participants gracefully", async () => {
      const formData = new FormData();
      formData.append("participants", "invalid");
      formData.append("status", "pending");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockBookingId }, context: {} });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: 1, // Falls back to 1 due to NaN || 1
        })
      );
    });

    it("should update booking with empty special requests and notes", async () => {
      const formData = new FormData();
      formData.append("participants", "2");
      formData.append("status", "completed");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");

      const request = new Request("http://test.com/tenant/bookings/booking-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockBookingId }, context: {} });

      // FormData.get() may return null for empty strings in some environments
      const setCallArgs = mockDb.set.mock.calls[0][0];
      expect(setCallArgs.participants).toBe(2);
      expect(setCallArgs.status).toBe("completed");
      expect(setCallArgs.updatedAt).toBeInstanceOf(Date);
      // Accept either "" or null for empty form fields
      expect(["", null]).toContain(setCallArgs.specialRequests);
      expect(["", null]).toContain(setCallArgs.internalNotes);
    });
  });
});
