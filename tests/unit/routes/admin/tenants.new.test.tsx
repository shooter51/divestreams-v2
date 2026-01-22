/**
 * Admin Create Organization Route Tests
 *
 * Tests the organization creation page for platform admins.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/admin/tenants.new";

// Mock modules
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  user: {
    id: "id",
    email: "email",
    name: "name",
    emailVerified: "emailVerified",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  account: {
    id: "id",
    userId: "userId",
    accountId: "accountId",
    providerId: "providerId",
    password: "password",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../../../lib/db/schema/subscription", () => ({
  subscription: {
    id: "id",
    organizationId: "organizationId",
    plan: "plan",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../../../lib/db/seed-demo-data.server", () => ({
  seedDemoData: vi.fn(),
}));

vi.mock("../../../../lib/auth/password.server", () => ({
  hashPassword: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Import mocked modules
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { db } from "../../../../lib/db";
import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";
import { hashPassword } from "../../../../lib/auth/password.server";

// Mock crypto.randomUUID
const mockUUIDs = ["org-uuid-1", "user-uuid-1", "account-uuid-1", "member-uuid-1"];
let uuidIndex = 0;

describe("Route: admin/tenants.new.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidIndex = 0;

    // Mock crypto.randomUUID
    vi.stubGlobal("crypto", {
      ...crypto,
      randomUUID: vi.fn(() => mockUUIDs[uuidIndex++] || `uuid-${uuidIndex}`),
    });
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/admin/tenants.new");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Create Organization - DiveStreams Admin" }]);
    });
  });

  describe("loader", () => {
    it("should require platform context authentication", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/tenants/new");
      (requirePlatformContext as any).mockResolvedValue(undefined);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
      expect(result).toEqual({});
    });
  });

  describe("action", () => {
    it("should require platform context authentication", async () => {
      // Arrange
      const formData = new FormData();
      const request = new Request("http://admin.divestreams.com/tenants/new", {
        method: "POST",
        body: formData,
      });
      (requirePlatformContext as any).mockResolvedValue(undefined);

      // Act
      try {
        await action({ request, params: {}, context: {} });
      } catch (e) {
        // May throw validation errors, that's ok
      }

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    describe("Validation", () => {
      it("should require slug", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "Test Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { slug: "Slug is required" },
        });
      });

      it("should accept uppercase slug by lowercasing it", async () => {
        // Arrange - uppercase gets lowercased automatically
        const formData = new FormData();
        formData.set("slug", "TestOrg"); // Will become "testorg"
        formData.set("name", "Test Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No existing org
            }),
          }),
        });

        // Mock inserts
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert - should succeed with lowercased slug
        expect(result).toHaveProperty("status", 302); // Redirect
      });

      it("should validate slug format - reject special characters", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test_org!");
        formData.set("name", "Test Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: {
            slug: "Invalid slug format (lowercase letters, numbers, and hyphens only)",
          },
        });
      });

      it("should accept valid slug format", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test-org-123");
        formData.set("name", "Test Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No existing org
            }),
          }),
        });

        // Mock inserts
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert - should not have slug format error
        expect(result).not.toHaveProperty("errors.slug");
      });

      it("should require name", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test-org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { name: "Organization name is required" },
        });
      });

      it("should require owner email when createOwnerAccount is checked", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test-org");
        formData.set("name", "Test Org");
        formData.set("createOwnerAccount", "on");
        formData.set("ownerPassword", "password123");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { ownerEmail: "Owner email is required" },
        });
      });

      it("should require owner password with minimum length when createOwnerAccount is checked", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test-org");
        formData.set("name", "Test Org");
        formData.set("createOwnerAccount", "on");
        formData.set("ownerEmail", "owner@test.com");
        formData.set("ownerPassword", "short");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { ownerPassword: "Password must be at least 8 characters" },
        });
      });

      it("should not require owner details when createOwnerAccount is not checked", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "test-org");
        formData.set("name", "Test Org");
        // createOwnerAccount not set
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock inserts
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert - should not have owner validation errors
        if (result && "errors" in result) {
          expect(result.errors).not.toHaveProperty("ownerEmail");
          expect(result.errors).not.toHaveProperty("ownerPassword");
        }
      });
    });

    describe("Slug Availability", () => {
      it("should reject duplicate slug", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "existing-org");
        formData.set("name", "Test Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Mock existing organization
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "existing-id", slug: "existing-org", name: "Existing Org" },
              ]),
            }),
          }),
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { slug: "This slug is already taken" },
        });
      });
    });

    describe("Organization Creation", () => {
      beforeEach(() => {
        (requirePlatformContext as any).mockResolvedValue(undefined);
      });

      it("should create organization with minimal data", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "  new-org  "); // Test trim and lowercase
        formData.set("name", "New Organization");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock inserts
        const insertCalls: any[] = [];
        (db.insert as any).mockImplementation((table: any) => {
          const call = { table, values: vi.fn().mockResolvedValue(undefined) };
          insertCalls.push(call);
          return call;
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toHaveProperty("status", 302); // Redirect response
        expect(insertCalls).toHaveLength(2); // Organization + subscription

        // Check organization insert
        expect(insertCalls[0].values).toHaveBeenCalledWith({
          id: "org-uuid-1",
          slug: "new-org", // trimmed and lowercased
          name: "New Organization",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });

        // Check subscription insert
        expect(insertCalls[1].values).toHaveBeenCalledWith({
          organizationId: "org-uuid-1",
          plan: "free",
          status: "active",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it("should create organization with custom plan", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "premium-org");
        formData.set("name", "Premium Organization");
        formData.set("plan", "premium");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock inserts
        const insertCalls: any[] = [];
        (db.insert as any).mockImplementation((table: any) => {
          const call = { table, values: vi.fn().mockResolvedValue(undefined) };
          insertCalls.push(call);
          return call;
        });

        // Act
        await action({ request, params: {}, context: {} });

        // Assert - subscription should have premium plan
        expect(insertCalls[1].values).toHaveBeenCalledWith(
          expect.objectContaining({ plan: "premium" })
        );
      });

      it("should create organization with new owner account", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "org-with-owner");
        formData.set("name", "Org With Owner");
        formData.set("createOwnerAccount", "on");
        formData.set("ownerEmail", "owner@test.com");
        formData.set("ownerName", "Test Owner");
        formData.set("ownerPassword", "password123");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No existing org or user
            }),
          }),
        });

        // Mock password hashing
        (hashPassword as any).mockResolvedValue("hashed-password");

        // Mock inserts
        const insertCalls: any[] = [];
        (db.insert as any).mockImplementation((table: any) => {
          const call = { table, values: vi.fn().mockResolvedValue(undefined) };
          insertCalls.push(call);
          return call;
        });

        // Act
        await action({ request, params: {}, context: {} });

        // Assert
        expect(insertCalls).toHaveLength(5); // org + subscription + user + account + member

        // Check user insert
        expect(insertCalls[2].values).toHaveBeenCalledWith({
          id: "user-uuid-1",
          email: "owner@test.com",
          name: "Test Owner",
          emailVerified: true,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });

        // Check account insert
        expect(insertCalls[3].values).toHaveBeenCalledWith({
          id: "account-uuid-1",
          userId: "user-uuid-1",
          accountId: "user-uuid-1",
          providerId: "credential",
          password: "hashed-password",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });

        // Check member insert
        expect(insertCalls[4].values).toHaveBeenCalledWith({
          id: "member-uuid-1",
          userId: "user-uuid-1",
          organizationId: "org-uuid-1",
          role: "owner",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it("should create organization with existing user as owner", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "org-existing-owner");
        formData.set("name", "Org Existing Owner");
        formData.set("createOwnerAccount", "on");
        formData.set("ownerEmail", "existing@test.com");
        formData.set("ownerPassword", "password123");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        let selectCallCount = 0;
        (db.select as any).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Slug availability check - no existing org
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            // User existence check - existing user
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { id: "existing-user-id", email: "existing@test.com" },
                  ]),
                }),
              }),
            };
          }
        });

        // Mock inserts
        const insertCalls: any[] = [];
        (db.insert as any).mockImplementation((table: any) => {
          const call = { table, values: vi.fn().mockResolvedValue(undefined) };
          insertCalls.push(call);
          return call;
        });

        // Act
        await action({ request, params: {}, context: {} });

        // Assert - should only insert org, subscription, and member (not user or account)
        expect(insertCalls).toHaveLength(3);

        // Check member uses existing user ID
        expect(insertCalls[2].values).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "existing-user-id",
            role: "owner",
          })
        );
      });

      it("should default owner name to email prefix when not provided", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "org-default-name");
        formData.set("name", "Org Default Name");
        formData.set("createOwnerAccount", "on");
        formData.set("ownerEmail", "testuser@example.com");
        formData.set("ownerPassword", "password123");
        // ownerName not set
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        (hashPassword as any).mockResolvedValue("hashed-password");

        // Mock inserts
        const insertCalls: any[] = [];
        (db.insert as any).mockImplementation((table: any) => {
          const call = { table, values: vi.fn().mockResolvedValue(undefined) };
          insertCalls.push(call);
          return call;
        });

        // Act
        await action({ request, params: {}, context: {} });

        // Assert - user name should be email prefix
        expect(insertCalls[2].values).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "testuser", // extracted from email
          })
        );
      });

      it("should seed demo data when requested", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "demo-org");
        formData.set("name", "Demo Org");
        formData.set("seedDemoData", "on");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock inserts
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        (seedDemoData as any).mockResolvedValue(undefined);

        // Act
        await action({ request, params: {}, context: {} });

        // Assert
        expect(seedDemoData).toHaveBeenCalledWith("org-uuid-1");
      });

      it("should not fail organization creation if demo seeding fails", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "demo-fail-org");
        formData.set("name", "Demo Fail Org");
        formData.set("seedDemoData", "on");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock inserts
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        (seedDemoData as any).mockRejectedValue(new Error("Seeding failed"));

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert - should still redirect successfully
        expect(result).toHaveProperty("status", 302);
        expect(seedDemoData).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should handle database errors during organization creation", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("slug", "error-org");
        formData.set("name", "Error Org");
        const request = new Request("http://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });
        (requirePlatformContext as any).mockResolvedValue(undefined);

        // Mock slug availability check
        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        // Mock insert to throw error
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { form: "Failed to create organization: Database connection failed" },
        });
      });
    });
  });
});
