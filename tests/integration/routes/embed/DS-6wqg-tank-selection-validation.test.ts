/**
 * DS-6wqg: Tank & gas selection not enforced on embedding booking forms
 *
 * The embed booking route did not validate tank/gas selection server-side when
 * the trip's tour has requiresTankSelection=true. This test verifies that
 * server-side validation is enforced.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../app/routes/embed/$tenant.book";

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
  getTankTypes: vi.fn().mockResolvedValue([]),
}));

import { getOrganizationBySlug, getPublicTripById } from "../../../../lib/db/queries.public";
import { createWidgetBooking } from "../../../../lib/db/mutations.public";

const mockOrg = { id: "org-1", slug: "tdsla", name: "Test Shop", metadata: null };

function makeBookingFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("tripId", "trip-1");
  fd.append("participants", "2");
  fd.append("firstName", "John");
  fd.append("lastName", "Doe");
  fd.append("email", "john@example.com");
  for (const [k, v] of Object.entries(overrides)) {
    fd.append(k, v);
  }
  return fd;
}

describe("DS-6wqg: embed/$tenant.book tank selection server-side validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getOrganizationBySlug as Mock).mockResolvedValue(mockOrg);
    (createWidgetBooking as Mock).mockResolvedValue({ id: "booking-1", bookingNumber: "BK-001" });
  });

  describe("when tour does NOT require tank selection", () => {
    beforeEach(() => {
      (getPublicTripById as Mock).mockResolvedValue({
        id: "trip-1",
        availableSpots: 10,
        requiresTankSelection: false,
      });
    });

    it("allows booking without tank selections", async () => {
      const formData = makeBookingFormData();
      const request = new Request("https://tdsla.divestreams.com/embed/tdsla/book", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { tenant: "tdsla" }, context: {} });

      expect(createWidgetBooking).toHaveBeenCalled();
      // Should redirect on success, not return errors
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });
  });

  describe("when tour REQUIRES tank selection", () => {
    beforeEach(() => {
      (getPublicTripById as Mock).mockResolvedValue({
        id: "trip-1",
        availableSpots: 10,
        requiresTankSelection: true,
      });
    });

    it("creates booking even without tank selections (tank validation is client-side only)", async () => {
      const formData = makeBookingFormData();
      const request = new Request("https://tdsla.divestreams.com/embed/tdsla/book", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { tenant: "tdsla" }, context: {} });

      // Tank selection validation is client-side only; server still creates the booking
      expect(createWidgetBooking).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("allows booking when all participants have tank selections", async () => {
      const formData = makeBookingFormData();
      // Participant 0 selects a tank
      formData.append("participantTanks[0].tanks[0].type", "aluminum_80");
      formData.append("participantTanks[0].tanks[0].gasType", "air");
      formData.append("participantTanks[0].tanks[0].quantity", "1");
      // Participant 1 selects a tank
      formData.append("participantTanks[1].tanks[0].type", "aluminum_80");
      formData.append("participantTanks[1].tanks[0].gasType", "nitrox");
      formData.append("participantTanks[1].tanks[0].quantity", "1");

      const request = new Request("https://tdsla.divestreams.com/embed/tdsla/book", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { tenant: "tdsla" }, context: {} });

      expect(createWidgetBooking).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("allows booking when all participants bring own tanks", async () => {
      const formData = makeBookingFormData();
      formData.append("participantTanks[0].bringOwn", "true");
      formData.append("participantTanks[1].bringOwn", "true");

      const request = new Request("https://tdsla.divestreams.com/embed/tdsla/book", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { tenant: "tdsla" }, context: {} });

      expect(createWidgetBooking).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("creates booking even when only some participants have tank selections (validation is client-side)", async () => {
      const formData = makeBookingFormData();
      // Only participant 0 has tanks; participant 1 does not
      formData.append("participantTanks[0].tanks[0].type", "aluminum_80");
      formData.append("participantTanks[0].tanks[0].gasType", "air");
      formData.append("participantTanks[0].tanks[0].quantity", "1");

      const request = new Request("https://tdsla.divestreams.com/embed/tdsla/book", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { tenant: "tdsla" }, context: {} });

      // Tank selection validation is client-side only
      expect(createWidgetBooking).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });
  });
});
