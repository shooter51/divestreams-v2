import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/tenants.new";

type ActionErrorResponse = { errors: Record<string, string> };

// Mock the requirePlatformContext function
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn().mockResolvedValue({
    user: { id: "admin-user", name: "Admin", email: "admin@example.com" },
    session: { id: "session-1" },
    membership: { role: "owner" },
    isOwner: true,
    isAdmin: true,
  }),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([
      { id: "plan-1", name: "free", displayName: "Free", monthlyPrice: 0, isActive: true },
      { id: "plan-2", name: "pro", displayName: "Professional", monthlyPrice: 4900, isActive: true },
    ]),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
  },
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
  },
  user: {
    id: "id",
    email: "email",
    name: "name",
  },
  account: {
    id: "id",
    userId: "userId",
    accountId: "accountId",
    providerId: "providerId",
    password: "password",
  },
}));

vi.mock("../../../../lib/db/schema/subscription", () => ({
  subscription: {
    id: "id",
    organizationId: "organizationId",
    plan: "plan",
    planId: "planId",
    status: "status",
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    name: "name",
    displayName: "displayName",
    monthlyPrice: "monthlyPrice",
    isActive: "isActive",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
    asc: vi.fn((a) => ({ type: "asc", field: a })),
  };
});

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
    },
  },
}));

import { db } from "../../../../lib/db";

describe("admin/tenants.new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns plans from database", async () => {
      const request = new Request("https://admin.divestreams.com/tenants/new");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toHaveProperty("plans");
      expect(response.plans).toHaveLength(2);
      expect(response.plans[0]).toHaveProperty("name", "free");
      expect(response.plans[1]).toHaveProperty("name", "pro");
    });
  });

  describe("action", () => {
    describe("validation", () => {
      it("returns error when slug is missing", async () => {
        const formData = new FormData();
        formData.append("slug", "");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.slug).toBe("Slug is required");
      });

      it("returns error when slug format is invalid (starts with hyphen)", async () => {
        const formData = new FormData();
        formData.append("slug", "-invalid");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.slug).toBe("Invalid slug format (lowercase letters, numbers, and hyphens only)");
      });

      it("returns error when slug has invalid characters", async () => {
        const formData = new FormData();
        formData.append("slug", "test_shop!");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.slug).toBe("Invalid slug format (lowercase letters, numbers, and hyphens only)");
      });

      it("returns error when name is missing", async () => {
        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.name).toBe("Organization name is required");
      });

      it("returns multiple errors when multiple fields are invalid", async () => {
        const formData = new FormData();
        formData.append("slug", "");
        formData.append("name", "");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.slug).toBe("Slug is required");
        expect((response as ActionErrorResponse).errors.name).toBe("Organization name is required");
      });

      it("accepts valid single-character slug", async () => {
        // Mock slug availability check (no existing org)
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        // Mock insert operations
        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "a");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toBeInstanceOf(Response);
      });

      it("accepts valid slug with hyphens", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "my-dive-shop");
        formData.append("name", "My Dive Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toBeInstanceOf(Response);
      });
    });

    describe("slug availability", () => {
      it("returns error when slug is already taken", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: "existing-org", slug: "existingshop" }]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);

        const formData = new FormData();
        formData.append("slug", "existingshop");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.slug).toBe("This slug is already taken");
      });

      it("converts slug to lowercase before checking availability", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "MyShop");
        formData.append("name", "My Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // The slug should be converted to lowercase
        expect(db.select).toHaveBeenCalled();
      });
    });

    describe("organization creation", () => {
      it("creates organization with required fields only", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "Test Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.insert).toHaveBeenCalled();
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe("/dashboard");
      });

      it("creates organization with premium plan", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "premiumshop");
        formData.append("name", "Premium Shop");
        formData.append("plan", "premium");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.insert).toHaveBeenCalled();
        expect(response).toBeInstanceOf(Response);
      });
    });

    describe("owner account creation", () => {
      it("validates owner email when create owner checkbox is checked", async () => {
        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "Test Shop");
        formData.append("createOwnerAccount", "on");
        formData.append("ownerEmail", "");
        formData.append("ownerPassword", "password123");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.ownerEmail).toBe("Owner email is required");
      });

      it("validates owner password length when create owner checkbox is checked", async () => {
        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "Test Shop");
        formData.append("createOwnerAccount", "on");
        formData.append("ownerEmail", "owner@example.com");
        formData.append("ownerPassword", "short");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.ownerPassword).toBe("Password must be at least 8 characters");
      });

      it("creates owner account when valid credentials provided", async () => {
        // Mock for slug check - no existing org
        const mockSlugCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        // Mock for name check - no existing org with same name
        const mockNameCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        // Mock for user check - no existing user
        const mockUserCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockSlugCheckQuery;
          if (selectCallCount === 2) return mockNameCheckQuery;
          return mockUserCheckQuery;
        });
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "Test Shop");
        formData.append("createOwnerAccount", "on");
        formData.append("ownerEmail", "owner@example.com");
        formData.append("ownerName", "Shop Owner");
        formData.append("ownerPassword", "securepassword123");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // Should call insert for: organization, subscription, user, account, member
        expect(db.insert).toHaveBeenCalled();
        expect(response).toBeInstanceOf(Response);
      });

      it("adds existing user as owner if email already exists", async () => {
        // Mock for slug check - no existing org
        const mockSlugCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        // Mock for user check - existing user found
        // Mock for name check - no existing org with same name
        const mockNameCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        const mockUserCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: "existing-user-id", email: "existing@example.com" }]),
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockSlugCheckQuery;
          if (selectCallCount === 2) return mockNameCheckQuery;
          return mockUserCheckQuery;
        });
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("slug", "testshop");
        formData.append("name", "Test Shop");
        formData.append("createOwnerAccount", "on");
        formData.append("ownerEmail", "existing@example.com");
        formData.append("ownerPassword", "securepassword123");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // Should still succeed - existing user added as member
        expect(response).toBeInstanceOf(Response);
      });
    });

    describe("error handling", () => {
      it("returns form error when organization creation fails", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);
        (db.insert as Mock).mockImplementation(() => {
          throw new Error("Database error");
        });

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const formData = new FormData();
        formData.append("slug", "errorshop");
        formData.append("name", "Error Shop");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toHaveProperty("errors");
        expect((response as ActionErrorResponse).errors.form).toBe("Failed to create organization: Database error");
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });
});
