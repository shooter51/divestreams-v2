import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/customers/index";

// Mock the tenant-auth module
vi.mock("../../../../lib/auth/tenant-auth.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock the queries module
vi.mock("../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
}));

import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getCustomers } from "../../../../lib/db/queries.server";

describe("tenant/customers route", () => {
  const mockTenant = {
    id: "tenant-uuid",
    subdomain: "demo",
    name: "Demo Dive Shop",
    schemaName: "tenant_demo",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireTenant as Mock).mockResolvedValue({ tenant: mockTenant });
  });

  describe("loader", () => {
    it("requires tenant authentication", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      await loader({ request, params: {}, context: {} });

      expect(requireTenant).toHaveBeenCalledWith(request);
    });

    it("fetches customers with default pagination", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      await loader({ request, params: {}, context: {} });

      expect(getCustomers).toHaveBeenCalledWith("tenant_demo", {
        search: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it("filters by search when provided", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers?search=john");
      await loader({ request, params: {}, context: {} });

      expect(getCustomers).toHaveBeenCalledWith("tenant_demo", {
        search: "john",
        limit: 20,
        offset: 0,
      });
    });

    it("paginates correctly", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/customers?page=3");
      await loader({ request, params: {}, context: {} });

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
      const result = await loader({ request, params: {}, context: {} });

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
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns pagination info", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/customers?page=2");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
      expect(result.totalPages).toBe(5);
    });

    it("calculates totalPages correctly", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 45 });

      const request = new Request("https://demo.divestreams.com/app/customers");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.totalPages).toBe(3); // 45 / 20 = 2.25, rounds up to 3
    });

    it("returns search value", async () => {
      (getCustomers as Mock).mockResolvedValue({ customers: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/customers?search=smith");
      const result = await loader({ request, params: {}, context: {} });

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
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers[0].certifications).toBeNull();
    });
  });
});
