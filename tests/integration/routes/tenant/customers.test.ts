import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/customers/index";

// Mock the org-context module FIRST
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module - must mock the entire module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  customers: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    certifications: "certifications",
    totalDives: "totalDives",
    totalSpent: "totalSpent",
    lastDiveAt: "lastDiveAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  count: vi.fn(() => ({ type: "count" })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/customers route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 5, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  // Helper to setup db mocks for two queries (list + count)
  const setupDbMocks = (customerList: unknown[] = [], total: number = 0) => {
    const mockCustomersQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(customerList),
    };

    const mockCountQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ value: total }]),
    };

    let selectCallCount = 0;
    (db.select as Mock).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return mockCustomersQuery;
      return mockCountQuery;
    });

    return { mockCustomersQuery, mockCountQuery };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      setupDbMocks([], 0);

      const request = new Request("https://demo.divestreams.com/app/customers");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches customers with organization filter", async () => {
      setupDbMocks([], 0);

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.customers).toBeDefined();
    });

    it("filters by search when provided", async () => {
      setupDbMocks([], 0);

      const request = new Request("https://demo.divestreams.com/app/customers?search=john");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("john");
    });

    it("paginates correctly", async () => {
      const { mockCustomersQuery } = setupDbMocks([], 100);

      const request = new Request("https://demo.divestreams.com/app/customers?page=3");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(3);
      expect(mockCustomersQuery.offset).toHaveBeenCalled();
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

      setupDbMocks(mockCustomers, 1);

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
      setupDbMocks([], 0);

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns pagination info", async () => {
      setupDbMocks([], 100);

      const request = new Request("https://demo.divestreams.com/app/customers?page=2");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
      expect(result.totalPages).toBe(5);
    });

    it("calculates totalPages correctly", async () => {
      setupDbMocks([], 45);

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.totalPages).toBe(3); // 45 / 20 = 2.25, rounds up to 3
    });

    it("returns search value", async () => {
      setupDbMocks([], 0);

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

      setupDbMocks(mockCustomers, 1);

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers[0].certifications).toBeNull();
    });

    it("returns freemium data", async () => {
      setupDbMocks([], 0);

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.canAddCustomer).toBe(true);
      expect(result.usage).toBe(5);
      expect(result.limit).toBe(50);
      expect(result.isPremium).toBe(false);
    });
  });
});
