import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/dive-sites/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/dive-sites/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as any);
  });

  describe("loader", () => {
    it("should fetch all dive sites", async () => {
      const mockSites = [
        {
          id: "site-1",
          name: "Blue Corner",
          maxDepth: "30",
          difficulty: "intermediate",
          description: "Famous drift dive",
          latitude: "7.165",
          longitude: "134.271",
          currentStrength: "moderate",
          highlights: ["Sharks", "Coral Wall"],
          isActive: true,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.diveSites).toHaveLength(1);
      expect(result.diveSites[0].name).toBe("Blue Corner");
      expect(result.diveSites[0].maxDepth).toBe("30");
      expect(result.diveSites[0].difficulty).toBe("intermediate");
      expect(result.total).toBe(1);
    });

    it("should filter dive sites by search query", async () => {
      const mockSites: any[] = [];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/app/dive-sites?q=reef");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("reef");
      expect(result.diveSites).toHaveLength(0);
    });

    it("should filter dive sites by difficulty", async () => {
      const mockSites = [
        {
          id: "site-1",
          name: "Easy Reef",
          maxDepth: "12",
          difficulty: "beginner",
          description: "Perfect for beginners",
          latitude: null,
          longitude: null,
          currentStrength: "none",
          highlights: [],
          isActive: true,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/app/dive-sites?difficulty=beginner");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.difficulty).toBe("beginner");
      expect(result.diveSites[0].difficulty).toBe("beginner");
    });

    it("should transform raw sites to UI format", async () => {
      const mockSites = [
        {
          id: "site-1",
          name: "Test Site",
          maxDepth: null,
          difficulty: null,
          description: null,
          latitude: "7.165",
          longitude: "134.271",
          currentStrength: "strong",
          highlights: ["Sharks", "Turtles"],
          isActive: null,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.diveSites[0].maxDepth).toBe(0);
      expect(result.diveSites[0].difficulty).toBe("intermediate");
      expect(result.diveSites[0].description).toBe("");
      expect(result.diveSites[0].coordinates).toEqual({
        lat: 7.165,
        lng: 134.271,
      });
      expect(result.diveSites[0].isActive).toBe(true);
    });

    it("should handle sites without coordinates", async () => {
      const mockSites = [
        {
          id: "site-1",
          name: "Test Site",
          maxDepth: "20",
          difficulty: "advanced",
          description: "Deep dive",
          latitude: null,
          longitude: null,
          currentStrength: "mild",
          highlights: [],
          isActive: true,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.diveSites[0].coordinates).toBeNull();
    });

    it("should return isPremium flag", async () => {
      const mockSites: any[] = [];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSites),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Premium Org", subdomain: "premium" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 1000 },
        isPremium: true,
      } as any);

      const request = new Request("http://test.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(true);
    });
  });
});
