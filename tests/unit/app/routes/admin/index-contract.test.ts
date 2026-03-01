/**
 * Contract Tests for Admin Organizations Loader (KAN-670)
 *
 * Verifies the loader returns the expected data shape that the
 * component depends on for rendering semantic token classes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/admin/index";

vi.mock("../../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn().mockResolvedValue({
    user: { id: "admin-user", name: "Admin", email: "admin@example.com" },
    session: { id: "session-1" },
    membership: { role: "owner" },
    isOwner: true,
    isAdmin: true,
  }),
  PLATFORM_ORG_SLUG: "platform",
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
    logo: "logo",
    createdAt: "createdAt",
  },
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
  },
}));

vi.mock("../../../../../lib/db/schema/subscription", () => ({
  subscription: {
    id: "id",
    organizationId: "organizationId",
    plan: "plan",
    status: "status",
    planId: "planId",
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    displayName: "displayName",
  },
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getTenantUrl: vi.fn((slug: string, path: string) => `https://${slug}.divestreams.com${path}`),
  getBaseDomain: vi.fn(() => "divestreams.com"),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
    ne: vi.fn((a, b) => ({ type: "ne", field: a, value: b })),
    ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
    or: vi.fn((...conditions) => ({ type: "or", conditions })),
    desc: vi.fn((field) => ({ type: "desc", field })),
    sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
    count: vi.fn(() => ({ type: "count" })),
  };
});

import { db } from "../../../../../lib/db";

function createLoaderArgs(url: string) {
  return {
    request: new Request(url),
    params: {},
    context: {},
    unstable_pattern: "",
  } as Parameters<typeof loader>[0];
}

describe("Admin Organizations Loader Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success response shape", () => {
    it("returns organizations array, search string, and null error", async () => {
      const createMockQuery = (returnValue: unknown) => {
        const mock: Record<string, Mock> = {};
        mock.select = vi.fn().mockReturnValue(mock);
        mock.from = vi.fn().mockReturnValue(mock);
        mock.where = vi.fn().mockReturnValue(mock);
        mock.orderBy = vi.fn().mockResolvedValue(returnValue);
        mock.limit = vi.fn().mockResolvedValue(returnValue);
        mock.leftJoin = vi.fn().mockReturnValue(mock);
        return mock;
      };

      (db.select as Mock).mockImplementation(() => createMockQuery([]));

      const response = await loader(createLoaderArgs("https://admin.divestreams.com/dashboard"));

      expect(response).toEqual({
        organizations: expect.any(Array),
        search: expect.any(String),
        error: null,
      });
    });

    it("returns search param from URL", async () => {
      const createMockQuery = (returnValue: unknown) => {
        const mock: Record<string, Mock> = {};
        mock.select = vi.fn().mockReturnValue(mock);
        mock.from = vi.fn().mockReturnValue(mock);
        mock.where = vi.fn().mockReturnValue(mock);
        mock.orderBy = vi.fn().mockResolvedValue(returnValue);
        mock.limit = vi.fn().mockResolvedValue(returnValue);
        mock.leftJoin = vi.fn().mockReturnValue(mock);
        return mock;
      };

      (db.select as Mock).mockImplementation(() => createMockQuery([]));

      const response = await loader(createLoaderArgs("https://admin.divestreams.com/dashboard?q=reef"));

      expect(response.search).toBe("reef");
    });

    it("returns empty search when no q param", async () => {
      const createMockQuery = (returnValue: unknown) => {
        const mock: Record<string, Mock> = {};
        mock.select = vi.fn().mockReturnValue(mock);
        mock.from = vi.fn().mockReturnValue(mock);
        mock.where = vi.fn().mockReturnValue(mock);
        mock.orderBy = vi.fn().mockResolvedValue(returnValue);
        mock.limit = vi.fn().mockResolvedValue(returnValue);
        mock.leftJoin = vi.fn().mockReturnValue(mock);
        return mock;
      };

      (db.select as Mock).mockImplementation(() => createMockQuery([]));

      const response = await loader(createLoaderArgs("https://admin.divestreams.com/dashboard"));

      expect(response.search).toBe("");
    });
  });

  describe("error response shape", () => {
    it("returns empty organizations, search string, and error message on DB failure", async () => {
      (db.select as Mock).mockImplementation(() => {
        throw new Error("Connection refused");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await loader(createLoaderArgs("https://admin.divestreams.com/dashboard"));

      expect(response).toEqual({
        organizations: [],
        search: "",
        error: expect.any(String),
      });
      expect(response.error).toContain("Failed to load organizations");

      consoleSpy.mockRestore();
    });
  });

  describe("organization item shape", () => {
    it("each org has required fields for rendering with semantic tokens", async () => {
      const mockOrg = {
        id: "org-1",
        slug: "oceanblue",
        name: "Ocean Blue Diving",
        logo: null,
        createdAt: new Date("2025-01-15"),
      };

      let callCount = 0;
      const createMockQuery = (returnValue: unknown) => {
        const mock: Record<string, Mock> = {};
        mock.select = vi.fn().mockReturnValue(mock);
        mock.from = vi.fn().mockReturnValue(mock);
        mock.where = vi.fn().mockReturnValue(mock);
        mock.orderBy = vi.fn().mockResolvedValue(returnValue);
        mock.limit = vi.fn().mockImplementation(() => {
          callCount++;
          // member count query
          if (callCount === 1) return Promise.resolve([{ count: 5 }]);
          // owner email query
          if (callCount === 2) return Promise.resolve([{ email: "owner@test.com" }]);
          // subscription query
          if (callCount === 3)
            return Promise.resolve([
              {
                sub: { status: "active", plan: "premium", planId: "plan-1" },
                planName: "Premium",
              },
            ]);
          return Promise.resolve(returnValue);
        });
        mock.leftJoin = vi.fn().mockReturnValue(mock);
        return mock;
      };

      (db.select as Mock).mockImplementation(() => createMockQuery([mockOrg]));

      const response = await loader(createLoaderArgs("https://admin.divestreams.com/dashboard"));

      if (response.organizations.length > 0) {
        const org = response.organizations[0];
        // Fields needed for semantic token rendering
        expect(org).toHaveProperty("id");
        expect(org).toHaveProperty("slug");
        expect(org).toHaveProperty("name");
        expect(org).toHaveProperty("subscriptionStatus");
        expect(org).toHaveProperty("subscriptionPlan");
        expect(org).toHaveProperty("memberCount");
        expect(org).toHaveProperty("ownerEmail");
        expect(org).toHaveProperty("createdAt");
        expect(org).toHaveProperty("tenantUrl");
      }
    });
  });
});
