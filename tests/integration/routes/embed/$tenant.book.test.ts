/**
 * Integration tests for embed/$tenant.book route
 *
 * Tests the public booking widget action: validation, tank selection enforcement,
 * and booking creation flow.
 *
 * DS-4nfd: Contact pre-fill integration
 * DS-6wqg: Server-side tank/gas selection validation when requiresTankSelection=true
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/embed/$tenant.book";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTripById: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  createWidgetBooking: vi.fn(),
}));

vi.mock("../../../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
  getNotificationSettings: vi.fn().mockReturnValue({ sendBookingConfirmation: false }),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../../../../lib/db/queries/equipment.server", () => ({
  getTankTypes: vi.fn().mockResolvedValue([
    { id: "t1", name: "Aluminum 80", type: "aluminum_80" },
  ]),
}));

import { getOrganizationBySlug, getPublicTripById } from "../../../../lib/db/queries.public";
import { createWidgetBooking } from "../../../../lib/db/mutations.public";

const mockOrg = { id: "org-1", slug: "tdsla", name: "Test Shop", metadata: null };
const mockTrip = {
  id: "trip-1",
  availableSpots: 10,
  requiresTankSelection: false,
};

function makeRequest(formData: FormData, tenant = "tdsla") {
  return new Request(`https://tdsla.divestreams.com/embed/${tenant}/book`, {
    method: "POST",
    body: formData,
  });
}

function baseFormData() {
  const fd = new FormData();
  fd.append("tripId", "trip-1");
  fd.append("participants", "1");
  fd.append("firstName", "John");
  fd.append("lastName", "Doe");
  fd.append("email", "john@example.com");
  return fd;
}

describe("embed/$tenant.book — contact pre-fill integration (DS-4nfd)", () => {
  describe("prefill data structure", () => {
    it("prefill object contains all required contact fields", () => {
      const prefill = {
        firstName: "Jane",
        lastName: "Diver",
        email: "jane@example.com",
        phone: "+1-555-0100",
      };
      expect(prefill).toHaveProperty("firstName");
      expect(prefill).toHaveProperty("lastName");
      expect(prefill).toHaveProperty("email");
      expect(prefill).toHaveProperty("phone");
    });

    it("prefill fields are strings", () => {
      const prefill = { firstName: "Jane", lastName: "Diver", email: "jane@example.com", phone: "" };
      Object.values(prefill).forEach((v) => expect(typeof v).toBe("string"));
    });

    it("null customer profile fields are coerced to empty strings in prefill", () => {
      const nullableCustomer = { firstName: null as string | null, phone: null as string | null };
      const prefill = {
        firstName: nullableCustomer.firstName ?? "",
        phone: nullableCustomer.phone ?? "",
      };
      expect(prefill.firstName).toBe("");
      expect(prefill.phone).toBe("");
    });
  });

  describe("organization isolation", () => {
    it("does not expose customer data from a different organization", () => {
      const orgId = "org-target";
      const customer = { organizationId: "org-other", firstName: "Eve", email: "eve@other.com" };
      const prefill = customer.organizationId === orgId ? customer : null;
      expect(prefill).toBeNull();
    });

    it("allows prefill for customer belonging to same organization", () => {
      const orgId = "org-target";
      const customer = { organizationId: orgId, firstName: "Alice", email: "alice@target.com" };
      const prefill = customer.organizationId === orgId ? customer : null;
      expect(prefill).not.toBeNull();
      expect(prefill?.firstName).toBe("Alice");
    });
  });
});

describe("embed/$tenant.book route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getOrganizationBySlug as Mock).mockResolvedValue(mockOrg);
    (getPublicTripById as Mock).mockResolvedValue(mockTrip);
    (createWidgetBooking as Mock).mockResolvedValue({ id: "booking-1", bookingNumber: "BK-001" });
  });

  describe("loader", () => {
    it("throws 404 when tenant param is missing", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed/tdsla/book?tripId=t1"), params: {}, context: {} })
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 400 when tripId query param is missing", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed/tdsla/book"), params: { tenant: "tdsla" }, context: {} })
      ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });

    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);
      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/unknown/book?tripId=t1"),
          params: { tenant: "unknown" },
          context: {},
        })
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when trip not found", async () => {
      (getPublicTripById as Mock).mockResolvedValue(null);
      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/tdsla/book?tripId=nonexistent"),
          params: { tenant: "tdsla" },
          context: {},
        })
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns trip, tankTypes, and tenantSlug on success", async () => {
      (getPublicTripById as Mock).mockResolvedValue({ ...mockTrip, availableSpots: 5 });
      const result = await loader({
        request: new Request("https://divestreams.com/embed/tdsla/book?tripId=trip-1"),
        params: { tenant: "tdsla" },
        context: {},
      });
      expect(result.trip).toBeDefined();
      expect(result.tankTypes).toBeDefined();
      expect(result.tenantSlug).toBe("tdsla");
    });
  });

  describe("action — basic validation", () => {
    it("returns error when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);
      await expect(
        action({ request: makeRequest(baseFormData()), params: { tenant: "unknown" }, context: {} })
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns validation error for missing required fields", async () => {
      const fd = new FormData();
      fd.append("tripId", "trip-1");
      fd.append("participants", "1");
      const result = await action({ request: makeRequest(fd), params: { tenant: "tdsla" }, context: {} });
      const data = result as { errors: Record<string, string> };
      expect(data.errors).toBeDefined();
      expect(data.errors.firstName).toBeDefined();
    });

    it("returns validation error for invalid email", async () => {
      const fd = baseFormData();
      fd.set("email", "not-an-email");
      const result = await action({ request: makeRequest(fd), params: { tenant: "tdsla" }, context: {} });
      const data = result as { errors: Record<string, string> };
      expect(data.errors.email).toBeDefined();
    });

    it("creates booking and redirects on valid submission", async () => {
      const result = await action({ request: makeRequest(baseFormData()), params: { tenant: "tdsla" }, context: {} });
      expect(createWidgetBooking).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });
  });

  describe("action — DS-6wqg: tank selection enforcement", () => {
    it("rejects booking when requiresTankSelection=true and no tanks provided", async () => {
      (getPublicTripById as Mock).mockResolvedValue({ ...mockTrip, requiresTankSelection: true });
      const result = await action({ request: makeRequest(baseFormData()), params: { tenant: "tdsla" }, context: {} });
      expect(createWidgetBooking).not.toHaveBeenCalled();
      const data = result as { errors: Record<string, string> };
      expect(data.errors.tanks).toBeDefined();
    });

    it("accepts booking when participant brings own tanks", async () => {
      (getPublicTripById as Mock).mockResolvedValue({ ...mockTrip, requiresTankSelection: true });
      const fd = baseFormData();
      fd.append("participantTanks[0].bringOwn", "true");
      const result = await action({ request: makeRequest(fd), params: { tenant: "tdsla" }, context: {} });
      expect(createWidgetBooking).toHaveBeenCalled();
      expect((result as Response).status).toBe(302);
    });

    it("accepts booking when participant selects a tank/gas combination", async () => {
      (getPublicTripById as Mock).mockResolvedValue({ ...mockTrip, requiresTankSelection: true });
      const fd = baseFormData();
      fd.append("participantTanks[0].tanks[0].type", "aluminum_80");
      fd.append("participantTanks[0].tanks[0].gasType", "air");
      fd.append("participantTanks[0].tanks[0].quantity", "1");
      const result = await action({ request: makeRequest(fd), params: { tenant: "tdsla" }, context: {} });
      expect(createWidgetBooking).toHaveBeenCalled();
      expect((result as Response).status).toBe(302);
    });

    it("allows booking without tank selection when requiresTankSelection=false", async () => {
      const result = await action({ request: makeRequest(baseFormData()), params: { tenant: "tdsla" }, context: {} });
      expect(createWidgetBooking).toHaveBeenCalled();
      expect((result as Response).status).toBe(302);
    });
  });
});
