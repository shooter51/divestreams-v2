/**
 * DS-xk9d: Cancel booking returns 403 for staff users.
 *
 * The action in app/routes/tenant/bookings/$id.tsx called requireRole with
 * only ["owner", "admin"], excluding the "staff" role. Staff members received
 * a 403 Forbidden when attempting to cancel a booking.
 *
 * This test verifies that:
 * 1. Staff role can access the cancel action (no 403 thrown)
 * 2. Owner and admin roles still have access
 * 3. Customer role is still forbidden
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../../lib/db/queries.server", () => ({
  getBookingWithFullDetails: vi.fn(),
  getPaymentsByBookingId: vi.fn(),
  updateBookingStatus: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock("../../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path: string) => path),
}));

import { requireOrgContext, requireRole } from "../../../../../../lib/auth/org-context.server";
import { getBookingWithFullDetails, updateBookingStatus } from "../../../../../../lib/db/queries.server";
import { action } from "../../../../../../app/routes/tenant/bookings/$id";

function makeOrgContext(role: string) {
  return {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-1", slug: "demo", name: "Demo Dive Shop" },
    membership: { role },
    subscription: null,
    isPremium: true,
  };
}

function makeCancelRequest(bookingId: string): Request {
  const formData = new FormData();
  formData.set("intent", "cancel");
  return new Request(`https://demo.divestreams.com/tenant/bookings/${bookingId}`, {
    method: "POST",
    body: formData,
  });
}

const mockBooking = {
  id: "booking-1",
  bookingNumber: "BK-001",
  status: "confirmed",
  organizationId: "org-1",
};

describe("DS-xk9d: cancel booking role access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getBookingWithFullDetails as Mock).mockResolvedValue(mockBooking);
    (updateBookingStatus as Mock).mockResolvedValue(undefined);
  });

  describe("requireRole is called with staff included in allowed roles", () => {
    it("does NOT throw 403 when role is staff", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("staff"));
      // Simulate the real requireRole behaviour — staff is now allowed
      (requireRole as Mock).mockImplementation(() => {});

      const request = makeCancelRequest("booking-1");
      await expect(
        action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0])
      ).resolves.not.toThrow();
    });

    it("does NOT throw 403 when role is owner", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("owner"));
      (requireRole as Mock).mockImplementation(() => {});

      const request = makeCancelRequest("booking-1");
      await expect(
        action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0])
      ).resolves.not.toThrow();
    });

    it("does NOT throw 403 when role is admin", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("admin"));
      (requireRole as Mock).mockImplementation(() => {});

      const request = makeCancelRequest("booking-1");
      await expect(
        action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0])
      ).resolves.not.toThrow();
    });

    it("throws 403 when role is customer", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("customer"));
      (requireRole as Mock).mockImplementation(() => {
        throw new Response("Forbidden: Insufficient permissions", { status: 403 });
      });

      const request = makeCancelRequest("booking-1");
      await expect(
        action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0])
      ).rejects.toSatisfy((e: unknown) => e instanceof Response && e.status === 403);
    });
  });

  describe("requireRole is invoked with the correct allowed roles array", () => {
    it("calls requireRole with ['owner', 'admin', 'staff']", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("owner"));
      (requireRole as Mock).mockImplementation(() => {});

      const request = makeCancelRequest("booking-1");
      await action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0]);

      expect(requireRole).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(["owner", "admin", "staff"])
      );
    });

    it("requireRole allowed roles do NOT include customer", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOrgContext("owner"));
      (requireRole as Mock).mockImplementation(() => {});

      const request = makeCancelRequest("booking-1");
      await action({ request, params: { id: "booking-1" }, context: {} } as Parameters<typeof action>[0]);

      const [, allowedRoles] = (requireRole as Mock).mock.calls[0] as [unknown, string[]];
      expect(allowedRoles).not.toContain("customer");
    });
  });
});
