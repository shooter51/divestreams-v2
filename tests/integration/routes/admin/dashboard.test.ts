import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/index";

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  tenants: {
    id: "id",
    subdomain: "subdomain",
    name: "name",
    email: "email",
    subscriptionStatus: "subscriptionStatus",
    isActive: "isActive",
    createdAt: "createdAt",
    trialEndsAt: "trialEndsAt",
    planId: "planId",
  },
  subscriptionPlans: {
    id: "id",
    displayName: "displayName",
  },
}));

vi.mock("../../../../lib/db/tenant.server", () => ({
  deleteTenant: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  desc: vi.fn((field) => ({ type: "desc", field })),
}));

import { db } from "../../../../lib/db";
import { deleteTenant } from "../../../../lib/db/tenant.server";

const mockTenants = [
  {
    id: "tenant-1",
    subdomain: "oceanblue",
    name: "Ocean Blue Diving",
    email: "contact@oceanblue.com",
    subscriptionStatus: "active",
    isActive: true,
    createdAt: new Date("2025-01-01"),
    trialEndsAt: new Date("2025-01-15"),
    planId: "plan-1",
    planName: "Professional",
  },
  {
    id: "tenant-2",
    subdomain: "deepdive",
    name: "Deep Dive Center",
    email: "info@deepdive.com",
    subscriptionStatus: "trialing",
    isActive: true,
    createdAt: new Date("2025-01-10"),
    trialEndsAt: new Date("2025-01-24"),
    planId: "plan-2",
    planName: "Enterprise",
  },
  {
    id: "tenant-3",
    subdomain: "coralreef",
    name: "Coral Reef Adventures",
    email: "hello@coralreef.com",
    subscriptionStatus: "canceled",
    isActive: false,
    createdAt: new Date("2024-12-01"),
    trialEndsAt: null,
    planId: null,
    planName: null,
  },
];

describe("admin/dashboard (index) route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns all tenants when no search query is provided", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTenants),
        where: vi.fn().mockReturnThis(),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/dashboard");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response.tenants).toHaveLength(3);
      expect(response.search).toBe("");
      expect(response.tenants[0].subdomain).toBe("oceanblue");
    });

    it("filters tenants by search query", async () => {
      const filteredTenants = [mockTenants[0]];
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(filteredTenants),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/dashboard?q=ocean");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response.search).toBe("ocean");
      expect(response.tenants).toHaveLength(1);
    });

    it("formats dates as ISO date strings", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockTenants[0]]),
        where: vi.fn().mockReturnThis(),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/dashboard");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response.tenants[0].createdAt).toBe("2025-01-01");
      expect(response.tenants[0].trialEndsAt).toBe("2025-01-15");
    });

    it("handles null trialEndsAt date", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockTenants[2]]),
        where: vi.fn().mockReturnThis(),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/dashboard");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response.tenants[0].trialEndsAt).toBeNull();
    });

    it("returns empty array when no tenants exist", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnThis(),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/dashboard");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response.tenants).toHaveLength(0);
    });
  });

  describe("action", () => {
    describe("delete intent", () => {
      it("deletes tenant when intent is delete", async () => {
        (deleteTenant as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "delete");
        formData.append("tenantId", "tenant-1");

        const request = new Request("https://admin.divestreams.com/dashboard", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(deleteTenant).toHaveBeenCalledWith("tenant-1");
        expect(response).toEqual({ success: true });
      });

      it("does not delete when tenantId is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "delete");

        const request = new Request("https://admin.divestreams.com/dashboard", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(deleteTenant).not.toHaveBeenCalled();
        expect(response).toBeNull();
      });
    });

    describe("toggleActive intent", () => {
      it("toggles tenant active status from true to false", async () => {
        const mockQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ id: "tenant-1" }]),
        };

        (db.update as Mock).mockReturnValue(mockQuery);

        const formData = new FormData();
        formData.append("intent", "toggleActive");
        formData.append("tenantId", "tenant-1");
        formData.append("isActive", "true");

        const request = new Request("https://admin.divestreams.com/dashboard", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).toHaveBeenCalled();
        expect(response).toEqual({ success: true });
      });

      it("toggles tenant active status from false to true", async () => {
        const mockQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ id: "tenant-1" }]),
        };

        (db.update as Mock).mockReturnValue(mockQuery);

        const formData = new FormData();
        formData.append("intent", "toggleActive");
        formData.append("tenantId", "tenant-1");
        formData.append("isActive", "false");

        const request = new Request("https://admin.divestreams.com/dashboard", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).toHaveBeenCalled();
        expect(response).toEqual({ success: true });
      });

      it("does not toggle when tenantId is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "toggleActive");
        formData.append("isActive", "true");

        const request = new Request("https://admin.divestreams.com/dashboard", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).not.toHaveBeenCalled();
        expect(response).toBeNull();
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");
      formData.append("tenantId", "tenant-1");

      const request = new Request("https://admin.divestreams.com/dashboard", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeNull();
    });

    it("returns null when no intent provided", async () => {
      const formData = new FormData();
      formData.append("tenantId", "tenant-1");

      const request = new Request("https://admin.divestreams.com/dashboard", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeNull();
    });
  });
});
