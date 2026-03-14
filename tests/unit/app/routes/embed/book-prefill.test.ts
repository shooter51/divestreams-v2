/**
 * Unit tests for DS-4nfd: Booking form pre-fill for logged-in customers
 *
 * Verifies that the loader in embed/$tenant.book.tsx reads the
 * customer_session cookie and returns prefill data when the session
 * is valid and belongs to the correct organization.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock all DB/server dependencies before importing the loader
vi.mock("../../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTripById: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries/equipment.server", () => ({
  getTankTypes: vi.fn(),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

vi.mock("../../../../../lib/db/mutations.public", () => ({
  createWidgetBooking: vi.fn(),
}));

vi.mock("../../../../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
  getNotificationSettings: vi.fn(() => ({ emailBookingConfirmation: false })),
}));

vi.mock("../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock the React component (TankGasSelector) — not needed for loader tests
vi.mock("../../../../app/components/tank-gas-selector", () => ({
  TankGasSelector: () => null,
}));

import { loader } from "../../../../../app/routes/embed/$tenant.book";
import { getOrganizationBySlug, getPublicTripById } from "../../../../../lib/db/queries.public";
import { getTankTypes } from "../../../../../lib/db/queries/equipment.server";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";

// ── Test fixtures ──────────────────────────────────────────────────────────

const ORG_ID = "org-123";

const mockOrg = {
  id: ORG_ID,
  name: "Deep Blue Dive Shop",
  slug: "deepblue",
  metadata: {},
};

const mockTrip = {
  id: "trip-abc",
  tourId: "tour-xyz",
  tourName: "Reef Dive",
  date: "2026-04-01",
  startTime: "09:00",
  endTime: "12:00",
  price: "99.00",
  currency: "USD",
  availableSpots: 5,
  requiresTankSelection: false,
  primaryImage: null,
  includesEquipment: false,
  includesMeals: false,
  includesTransport: false,
};

const mockCustomer = {
  id: "cust-1",
  organizationId: ORG_ID,
  firstName: "Jane",
  lastName: "Diver",
  email: "jane@example.com",
  phone: "+1-555-0100",
};

function makeRequest(tripId: string, cookies = "") {
  const url = `https://deepblue.divestreams.com/embed/deepblue/book?tripId=${tripId}`;
  return new Request(url, {
    headers: cookies ? { Cookie: cookies } : {},
  });
}

function loaderArgs(request: Request) {
  return { request, params: { tenant: "deepblue" }, context: {} } as Parameters<typeof loader>[0];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("embed/$tenant.book loader — prefill for logged-in customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getOrganizationBySlug as Mock).mockResolvedValue(mockOrg);
    (getPublicTripById as Mock).mockResolvedValue(mockTrip);
    (getTankTypes as Mock).mockResolvedValue([]);
    (getCustomerBySession as Mock).mockResolvedValue(null);
  });

  describe("unauthenticated visitor", () => {
    it("returns prefill: null when no cookie is present", async () => {
      const result = await loader(loaderArgs(makeRequest("trip-abc")));
      expect(result.prefill).toBeNull();
    });

    it("does not call getCustomerBySession when no cookie is set", async () => {
      await loader(loaderArgs(makeRequest("trip-abc")));
      expect(getCustomerBySession).not.toHaveBeenCalled();
    });

    it("still returns trip and tankTypes", async () => {
      const result = await loader(loaderArgs(makeRequest("trip-abc")));
      expect(result.trip).toBeDefined();
      expect(result.tankTypes).toBeDefined();
    });
  });

  describe("authenticated customer — valid session for correct org", () => {
    it("returns prefill with customer contact details", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
      const result = await loader(
        loaderArgs(makeRequest("trip-abc", "customer_session=valid-token-abc"))
      );
      expect(result.prefill).toEqual({
        firstName: "Jane",
        lastName: "Diver",
        email: "jane@example.com",
        phone: "+1-555-0100",
      });
    });

    it("passes the session token to getCustomerBySession", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
      await loader(
        loaderArgs(makeRequest("trip-abc", "customer_session=valid-token-abc"))
      );
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token-abc");
    });
  });

  describe("authenticated customer — session for different org", () => {
    it("returns prefill: null when customer belongs to a different organization", async () => {
      const foreignCustomer = { ...mockCustomer, organizationId: "org-other" };
      (getCustomerBySession as Mock).mockResolvedValue(foreignCustomer);
      const result = await loader(
        loaderArgs(makeRequest("trip-abc", "customer_session=token-for-other-org"))
      );
      expect(result.prefill).toBeNull();
    });
  });

  describe("authenticated customer — expired/invalid session", () => {
    it("returns prefill: null when session is invalid (getCustomerBySession returns null)", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);
      const result = await loader(
        loaderArgs(makeRequest("trip-abc", "customer_session=expired-token"))
      );
      expect(result.prefill).toBeNull();
    });
  });

  describe("authenticated customer — null profile fields", () => {
    it("returns empty strings for null customer fields", async () => {
      const sparseCustomer = {
        ...mockCustomer,
        firstName: null,
        lastName: null,
        phone: null,
      };
      (getCustomerBySession as Mock).mockResolvedValue(sparseCustomer);
      const result = await loader(
        loaderArgs(makeRequest("trip-abc", "customer_session=valid-token"))
      );
      expect(result.prefill).toEqual({
        firstName: "",
        lastName: "",
        email: "jane@example.com",
        phone: "",
      });
    });
  });

  describe("cookie parsing edge cases", () => {
    it("correctly parses session token when multiple cookies are present", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
      const cookies = "other_cookie=foo; customer_session=my-token; another=bar";
      const result = await loader(loaderArgs(makeRequest("trip-abc", cookies)));
      expect(getCustomerBySession).toHaveBeenCalledWith("my-token");
      expect(result.prefill).not.toBeNull();
    });

    it("returns prefill: null when customer_session cookie is missing among other cookies", async () => {
      const cookies = "some_other=value; another=thing";
      const result = await loader(loaderArgs(makeRequest("trip-abc", cookies)));
      expect(getCustomerBySession).not.toHaveBeenCalled();
      expect(result.prefill).toBeNull();
    });
  });
});
