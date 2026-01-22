/**
 * Admin Organization Details Route Tests
 *
 * Tests the organization details page loader and actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/admin/tenants.$id";

// Mock modules
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
    logo: "logo",
    metadata: "metadata",
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
  },
}));

vi.mock("../../../../lib/db/schema/subscription", () => ({
  subscription: {
    id: "id",
    organizationId: "organizationId",
    plan: "plan",
    status: "status",
    stripeCustomerId: "stripeCustomerId",
    stripeSubscriptionId: "stripeSubscriptionId",
    currentPeriodStart: "currentPeriodStart",
    currentPeriodEnd: "currentPeriodEnd",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  customers: {
    id: "id",
    organizationId: "organizationId",
  },
  tours: {
    id: "id",
    organizationId: "organizationId",
  },
  bookings: {
    id: "id",
    organizationId: "organizationId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  count: vi.fn(() => "count"),
  sql: vi.fn((strings, ...values) => ({ sql: strings })),
}));

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getBaseDomain: vi.fn(() => "divestreams.com"),
  getTenantUrl: vi.fn((slug, path) => `https://${slug}.divestreams.com${path}`),
}));

// Import mocked modules
import { db } from "../../../../lib/db";
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";

describe("Route: admin/tenants.$id.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset requirePlatformContext to resolve successfully by default
    (requirePlatformContext as any).mockResolvedValue(undefined);
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import(
        "../../../../app/routes/admin/tenants.$id"
      );
      const result = meta({} as any);
      expect(result).toEqual([
        { title: "Organization Details - DiveStreams Admin" },
      ]);
    });
  });

  describe("loader", () => {
    const mockOrg = {
      id: "org-123",
      slug: "dive-shop-one",
      name: "Dive Shop One",
      logo: "https://example.com/logo.png",
      metadata: JSON.stringify({ settings: { theme: "blue" } }),
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    };

    const mockMembers = [
      {
        id: "member-1",
        userId: "user-1",
        role: "owner",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        userEmail: "owner@diveshop.com",
        userName: "John Doe",
      },
      {
        id: "member-2",
        userId: "user-2",
        role: "admin",
        createdAt: new Date("2024-01-16T10:00:00Z"),
        userEmail: "admin@diveshop.com",
        userName: "Jane Smith",
      },
    ];

    const mockSubscription = {
      id: "sub-123",
      organizationId: "org-123",
      plan: "premium" as const,
      status: "active" as const,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      currentPeriodStart: new Date("2024-01-01T00:00:00Z"),
      currentPeriodEnd: new Date("2024-02-01T00:00:00Z"),
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    };

    it("should require platform context authentication", async () => {
      // Arrange
      const request = new Request(
        "http://admin.divestreams.com/tenants/dive-shop-one"
      );
      const params = { id: "dive-shop-one" };

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // Organization lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrg]),
              }),
            }),
          };
        } else if (callCount === 2) {
          // Members lookup
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockMembers),
              }),
            }),
          };
        } else if (callCount === 3) {
          // Subscription lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSubscription]),
              }),
            }),
          };
        } else {
          // Usage counts (customers, tours, bookings)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });

      // Act
      await loader({ request, params, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should throw 404 when slug is missing", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/tenants/");
      const params = { id: undefined };

      // Act & Assert
      try {
        await loader({ request, params, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = new Request(
        "http://admin.divestreams.com/tenants/nonexistent"
      );
      const params = { id: "nonexistent" };

      // Act & Assert
      try {
        await loader({ request, params, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load organization with all related data", async () => {
      // Arrange
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // Organization lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrg]),
              }),
            }),
          };
        } else if (callCount === 2) {
          // Members lookup
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockMembers),
              }),
            }),
          };
        } else if (callCount === 3) {
          // Subscription lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSubscription]),
              }),
            }),
          };
        } else if (callCount === 4) {
          // Customer count
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 50 }]),
            }),
          };
        } else if (callCount === 5) {
          // Tour count
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 10 }]),
            }),
          };
        } else if (callCount === 6) {
          // Booking count
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 75 }]),
            }),
          };
        }
      });

      const request = new Request(
        "http://admin.divestreams.com/tenants/dive-shop-one"
      );
      const params = { id: "dive-shop-one" };

      // Act
      const result = await loader({ request, params, context: {} });

      // Assert
      expect(result.organization.slug).toBe("dive-shop-one");
      expect(result.organization.name).toBe("Dive Shop One");
      expect(result.organization.createdAt).toBe("2024-01-15"); // Date formatted
      expect(result.organization.metadata).toEqual({ settings: { theme: "blue" } }); // JSON parsed
      expect(result.members).toHaveLength(2);
      expect(result.members[0].createdAt).toBe("2024-01-15"); // Date formatted
      expect(result.subscription).toBeDefined();
      expect(result.subscription!.plan).toBe("premium");
      expect(result.subscription!.createdAt).toBe("2024-01-01"); // Date formatted
      expect(result.usage.customers).toBe(50);
      expect(result.usage.tours).toBe(10);
      expect(result.usage.bookings).toBe(75);
      expect(result.usage.members).toBe(2);
    });

    it("should handle organization without subscription", async () => {
      // Arrange
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrg]),
              }),
            }),
          };
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        } else if (callCount === 3) {
          // No subscription
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        } else {
          // Usage counts
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });

      const request = new Request(
        "http://admin.divestreams.com/tenants/dive-shop-one"
      );
      const params = { id: "dive-shop-one" };

      // Act
      const result = await loader({ request, params, context: {} });

      // Assert
      expect(result.subscription).toBeNull();
    });

    it("should handle organization with no metadata", async () => {
      // Arrange
      const orgWithoutMetadata = {
        ...mockOrg,
        metadata: null,
      };

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([orgWithoutMetadata]),
              }),
            }),
          };
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        } else if (callCount === 3) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });

      const request = new Request(
        "http://admin.divestreams.com/tenants/dive-shop-one"
      );
      const params = { id: "dive-shop-one" };

      // Act
      const result = await loader({ request, params, context: {} });

      // Assert
      expect(result.organization.metadata).toBeNull();
    });
  });

  describe("action", () => {
    const mockOrg = {
      id: "org-123",
      slug: "dive-shop-one",
      name: "Dive Shop One",
    };

    beforeEach(() => {
      // Mock organization lookup for all actions
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrg]),
          }),
        }),
      });
    });

    it("should require platform context authentication", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("intent", "updateName");
      formData.set("name", "New Name");

      const request = new Request(
        "http://admin.divestreams.com/tenants/dive-shop-one",
        {
          method: "POST",
          body: formData,
        }
      );

      const params = { id: "dive-shop-one" };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Act
      await action({ request, params, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should throw 404 when slug is missing", async () => {
      // Arrange
      const formData = new FormData();
      const request = new Request("http://admin.divestreams.com/tenants/", {
        method: "POST",
        body: formData,
      });
      const params = { id: undefined };

      // Act & Assert
      try {
        await action({ request, params, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const formData = new FormData();
      formData.set("intent", "updateName");
      formData.set("name", "New Name");

      const request = new Request(
        "http://admin.divestreams.com/tenants/nonexistent",
        {
          method: "POST",
          body: formData,
        }
      );
      const params = { id: "nonexistent" };

      // Act & Assert
      try {
        await action({ request, params, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    describe("Delete Organization", () => {
      it("should delete organization and redirect", async () => {
        // Arrange
        (db.delete as any).mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("intent", "delete");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.delete).toHaveBeenCalled();
        expect(result).toHaveProperty("status", 302);
        expect((result as any).headers.get("Location")).toBe("/dashboard");
      });
    });

    describe("Update Name", () => {
      beforeEach(() => {
        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });
      });

      it("should update organization name", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "updateName");
        formData.set("name", "New Organization Name");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith({
          name: "New Organization Name",
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });

      it("should validate name is required", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "updateName");
        // name missing

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(result).toEqual({ errors: { name: "Name is required" } });
      });
    });

    describe("Update Subscription", () => {
      it("should update existing subscription", async () => {
        // Arrange
        let selectCallCount = 0;
        (db.select as any).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Organization lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockOrg]),
                }),
              }),
            };
          } else {
            // Existing subscription lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { id: "sub-123", organizationId: "org-123" },
                  ]),
                }),
              }),
            };
          }
        });

        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const formData = new FormData();
        formData.set("intent", "updateSubscription");
        formData.set("plan", "premium");
        formData.set("status", "active");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith({
          plan: "premium",
          status: "active",
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });

      it("should create new subscription if none exists", async () => {
        // Arrange
        let selectCallCount = 0;
        (db.select as any).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Organization lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockOrg]),
                }),
              }),
            };
          } else {
            // No existing subscription
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          }
        });

        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("intent", "updateSubscription");
        formData.set("plan", "free");
        formData.set("status", "trialing");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.insert).toHaveBeenCalled();
        const insertCall = (db.insert as any).mock.results[0].value;
        expect(insertCall.values).toHaveBeenCalledWith({
          id: expect.any(String),
          organizationId: "org-123",
          plan: "free",
          status: "trialing",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });
    });

    describe("Remove Member", () => {
      it("should remove member with valid memberId", async () => {
        // Arrange
        (db.delete as any).mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("intent", "removeMember");
        formData.set("memberId", "member-123");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.delete).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
      });

      it("should not remove member when memberId is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "removeMember");
        // memberId missing

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.delete).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("Update Role", () => {
      it("should update member role", async () => {
        // Arrange
        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const formData = new FormData();
        formData.set("intent", "updateRole");
        formData.set("memberId", "member-123");
        formData.set("role", "admin");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith({
          role: "admin",
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });

      it("should not update role when memberId is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "updateRole");
        formData.set("role", "admin");
        // memberId missing

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it("should not update role when role is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "updateRole");
        formData.set("memberId", "member-123");
        // role missing

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("Unknown Intent", () => {
      it("should return null for unknown intent", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "unknown");

        const request = new Request(
          "http://admin.divestreams.com/tenants/dive-shop-one",
          {
            method: "POST",
            body: formData,
          }
        );
        const params = { id: "dive-shop-one" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toBeNull();
      });
    });
  });
});
