import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/customers/index";

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the queries module
vi.mock("../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getCustomers } from "../../../../lib/db/queries.server";

describe("tenant/customers route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches customers with default pagination", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getCustomers).toHaveBeenCalledWith("tenant_demo", {
        search: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it("filters by search when provided", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers?search=john");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getCustomers).toHaveBeenCalledWith("tenant_demo", {
        search: "john",
        limit: 20,
        offset: 0,
      });
    });

    it("paginates correctly", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/customers?page=3");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getCustomers).toHaveBeenCalledWith("tenant_demo", {
        search: undefined,
        limit: 20,
        offset: 40,
      });
    });

    it("returns customers with all fields", async () => {
      const mockCustomers = [
        {
          id: "customer-1",
          firstName: "John",
          lastName: "Smith",
          email: "john@example.com",
          phone: "+1-555-0101",
          certifications: [{ agency: "PADI", level: "Advanced Open Water" }],
          totalDives: 25,
          totalSpent: 1500,
          lastDiveAt: "2024-01-10",
        },
      ];

      (getCustomers as Mock).mockResolvedValue({ customers: mockCustomers, total: 1 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({
        id: "customer-1",
        firstName: "John",
        lastName: "Smith",
        email: "john@example.com",
        phone: "+1-555-0101",
        certifications: [{ agency: "PADI", level: "Advanced Open Water" }],
        totalDives: 25,
        totalSpent: 1500,
      });
    });

    it("returns empty array when no customers exist", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns pagination info", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/customers?page=2");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
      expect(result.totalPages).toBe(5);
    });

    it("calculates totalPages correctly", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 45 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.totalPages).toBe(3); // 45 / 20 = 2.25, rounds up to 3
    });

    it("returns search value", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers?search=smith");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("smith");
    });

    it("handles customers without certifications", async () => {
      const mockCustomers = [
        {
          id: "customer-1",
          firstName: "John",
          lastName: "Beginner",
          email: "john@example.com",
          phone: null,
          certifications: null,
          totalDives: 0,
          totalSpent: 0,
          lastDiveAt: null,
        },
      ];

      (getCustomers as Mock).mockResolvedValue({ customers: mockCustomers, total: 1 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers[0].certifications).toBeNull();
    });
  });
});
