import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader } from "../../../../../app/routes/tenant/customers/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/customers/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should fetch customers list with pagination", async () => {
      const mockCustomers = [
        {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
          certificationLevel: "Advanced Open Water",
          emergencyContactName: "Jane Doe",
          emergencyContactPhone: "555-5678",
          createdAt: new Date("2024-01-15"),
        },
      ];

      const mockCount = [{ value: 1 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockCustomers),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as any;
        } else {
          return mockCountBuilder as any;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 100 },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/customers");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].firstName).toBe("John");
      expect(result.customers[0].lastName).toBe("Doe");
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.canAddCustomer).toBe(true);
    });

    it("should filter customers by search query", async () => {
      const mockCustomers: any[] = [];
      const mockCount = [{ value: 0 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockCustomers),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as any;
        } else {
          return mockCountBuilder as any;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 100 },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/customers?search=john");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("john");
      expect(result.customers).toHaveLength(0);
    });

    it("should handle pagination correctly", async () => {
      const mockCustomers: any[] = [];
      const mockCount = [{ value: 50 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockCustomers),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as any;
        } else {
          return mockCountBuilder as any;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 100 },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/customers?page=2");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3); // 50 total / 20 per page = 2.5 rounded up to 3
      expect(mockSelectBuilder.offset).toHaveBeenCalledWith(20); // Page 2 = offset 20
    });


    it("should handle freemium limits", async () => {
      const mockCustomers: any[] = [];
      const mockCount = [{ value: 0 }];
      const mockMonthlyCount = [{ value: 95 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockCustomers),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      const mockMonthlyCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockMonthlyCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as any;
        } else if (selectCallCount === 2) {
          return mockCountBuilder as any;
        } else {
          return mockMonthlyCountBuilder as any;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddCustomer: false,
        usage: { customers: 95 },
        limits: { customers: 100 },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/customers");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.canAddCustomer).toBe(false);
      expect(result.usage).toBe(95);
      expect(result.limit).toBe(100);
      expect(result.isPremium).toBe(false);
    });

    it("should handle date formatting edge cases", async () => {
      const mockCustomers = [
        {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
          certificationLevel: "Open Water",
          emergencyContactName: "Jane Doe",
          emergencyContactPhone: "555-5678",
          createdAt: "2024-01-15", // String date
        },
      ];

      const mockCount = [{ value: 1 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockCustomers),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as any;
        } else {
          return mockCountBuilder as any;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 100 },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/customers");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers[0].createdAt).toBe("2024-01-15");
    });
  });
});
