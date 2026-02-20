/**
 * Role Validation Tests
 *
 * Comprehensive tests for requireRole and requirePremium functions.
 * Tests authorization logic, error handling, and edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  requireRole,
  requirePremium,
  type OrgContext,
  type OrgRole,
  type PremiumFeature,
  FREE_TIER_LIMITS,
} from "../../../../lib/auth/org-context.server";

describe("requireRole", () => {
  // Helper to create mock context
  function createMockContext(role: OrgRole): OrgContext {
    return {
      user: { id: "user-1", name: "Test", email: "test@example.com" } as Record<string, unknown>,
      session: { id: "session-1" } as Record<string, unknown>,
      org: { id: "org-1", name: "Test Org", slug: "test" } as Record<string, unknown>,
      membership: { role: role } as Record<string, unknown>,
      subscription: null,
      limits: FREE_TIER_LIMITS,
      usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
      canAddCustomer: true,
      canAddTour: true,
      canAddBooking: true,
      isPremium: false,
    };
  }

  // ============================================================================
  // Owner Role
  // ============================================================================

  describe("Owner role", () => {
    it("should allow owner when owner is required", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["owner"])).not.toThrow();
    });

    it("should deny owner when only admin is required", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["admin"])).toThrow(Response);
    });

    it("should deny owner when only staff is required", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["staff"])).toThrow(Response);
    });

    it("should deny owner when only customer is required", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["customer"])).toThrow(Response);
    });

    it("should allow owner when multiple roles include owner", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["owner", "admin"])).not.toThrow();
    });

    it("should allow owner when owner is in allowed list", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["owner", "admin", "staff"])).not.toThrow();
    });
  });

  // ============================================================================
  // Admin Role
  // ============================================================================

  describe("Admin role", () => {
    it("should deny admin when only owner is required", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["owner"])).toThrow(Response);

      // Verify error message contains Forbidden
      try {
        requireRole(context, ["owner"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.statusText).toBe("Forbidden");
      }
    });

    it("should allow admin when admin is required", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["admin"])).not.toThrow();
    });

    it("should deny admin when only staff is required", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["staff"])).toThrow(Response);
    });

    it("should deny admin when only customer is required", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["customer"])).toThrow(Response);
    });

    it("should allow admin when admin is in allowed list", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["admin", "staff"])).not.toThrow();
    });

    it("should allow admin when owner or admin allowed", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["owner", "admin"])).not.toThrow();
    });
  });

  // ============================================================================
  // Staff Role
  // ============================================================================

  describe("Staff role", () => {
    it("should deny staff when only owner is required", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["owner"])).toThrow(Response);
    });

    it("should deny staff when only admin is required", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["admin"])).toThrow(Response);
    });

    it("should allow staff when staff is required", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["staff"])).not.toThrow();
    });

    it("should deny staff when only customer is required", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["customer"])).toThrow(Response);
    });

    it("should allow staff when staff is in allowed list", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["staff", "customer"])).not.toThrow();
    });

    it("should deny staff when only owner or admin allowed", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["owner", "admin"])).toThrow(Response);
    });
  });

  // ============================================================================
  // Customer Role
  // ============================================================================

  describe("Customer role", () => {
    it("should deny customer when owner is required", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["owner"])).toThrow(Response);
    });

    it("should deny customer when admin is required", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["admin"])).toThrow(Response);
    });

    it("should deny customer when staff is required", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["staff"])).toThrow(Response);
    });

    it("should allow customer when customer is required", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["customer"])).not.toThrow();
    });

    it("should deny customer when only elevated roles allowed", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["owner", "admin", "staff"])).toThrow(Response);
    });
  });

  // ============================================================================
  // Multiple Allowed Roles
  // ============================================================================

  describe("Multiple allowed roles", () => {
    it("should allow owner when owner or admin allowed", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["owner", "admin"])).not.toThrow();
    });

    it("should allow admin when owner or admin allowed", () => {
      const context = createMockContext("admin");
      expect(() => requireRole(context, ["owner", "admin"])).not.toThrow();
    });

    it("should allow staff when staff or customer allowed", () => {
      const context = createMockContext("staff");
      expect(() => requireRole(context, ["staff", "customer"])).not.toThrow();
    });

    it("should allow customer when staff or customer allowed", () => {
      const context = createMockContext("customer");
      expect(() => requireRole(context, ["staff", "customer"])).not.toThrow();
    });

    it("should allow all roles when all roles allowed", () => {
      const roles: OrgRole[] = ["owner", "admin", "staff", "customer"];

      roles.forEach(role => {
        const context = createMockContext(role);
        expect(() => requireRole(context, roles)).not.toThrow();
      });
    });
  });

  // ============================================================================
  // Error Response
  // ============================================================================

  describe("Error response", () => {
    it("should throw Response object", () => {
      const context = createMockContext("customer");

      try {
        requireRole(context, ["owner"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
      }
    });

    it("should have 403 status code", () => {
      const context = createMockContext("customer");

      try {
        requireRole(context, ["owner"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(403);
      }
    });

    it("should have Forbidden status text", () => {
      const context = createMockContext("customer");

      try {
        requireRole(context, ["owner"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).statusText).toBe("Forbidden");
      }
    });

    it("should have error message in body", async () => {
      const context = createMockContext("customer");

      try {
        requireRole(context, ["owner"]);
        expect.fail("Should have thrown");
      } catch (error) {
        const text = await (error as Response).text();
        expect(text).toContain("Forbidden");
        expect(text).toContain("Insufficient permissions");
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty allowed roles array", () => {
      const context = createMockContext("owner");
      // Empty array means no roles are allowed
      expect(() => requireRole(context, [])).toThrow(Response);
    });

    it("should handle single role in array", () => {
      const context = createMockContext("owner");
      expect(() => requireRole(context, ["owner"])).not.toThrow();
    });

    it("should be case-sensitive for role matching", () => {
      const context = {
        ...createMockContext("owner"),
        membership: { role: "OWNER" as OrgRole } as Record<string, unknown>,
      };

      // Role should match exactly
      expect(() => requireRole(context, ["owner"])).toThrow(Response);
    });
  });
});

// ============================================================================
// requirePremium Tests
// ============================================================================

describe("requirePremium", () => {
  // Helper to create mock context
  function createMockContext(isPremium: boolean): OrgContext {
    return {
      user: { id: "user-1", name: "Test", email: "test@example.com" } as Record<string, unknown>,
      session: { id: "session-1" } as Record<string, unknown>,
      org: { id: "org-1", name: "Test Org", slug: "test" } as Record<string, unknown>,
      membership: { role: "owner" } as Record<string, unknown>,
      subscription: null,
      limits: FREE_TIER_LIMITS,
      usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
      canAddCustomer: true,
      canAddTour: true,
      canAddBooking: true,
      isPremium,
    };
  }

  // ============================================================================
  // Premium Access
  // ============================================================================

  describe("Premium access", () => {
    it("should allow premium users to access POS feature", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "pos")).not.toThrow();
    });

    it("should allow premium users to access equipment rentals", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "equipment_rentals")).not.toThrow();
    });

    it("should allow premium users to access advanced reports", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "advanced_reports")).not.toThrow();
    });

    it("should allow premium users to access email notifications", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "email_notifications")).not.toThrow();
    });

    it("should allow premium users unlimited customers", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "unlimited_customers")).not.toThrow();
    });

    it("should allow premium users unlimited tours", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "unlimited_tours")).not.toThrow();
    });

    it("should allow premium users unlimited bookings", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "unlimited_bookings")).not.toThrow();
    });

    it("should allow premium users unlimited team", () => {
      const context = createMockContext(true);
      expect(() => requirePremium(context, "unlimited_team")).not.toThrow();
    });
  });

  // ============================================================================
  // Free Tier Restrictions
  // ============================================================================

  describe("Free tier restrictions", () => {
    it("should deny free users access to POS feature", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "pos")).toThrow(Response);
    });

    it("should deny free users access to equipment rentals", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "equipment_rentals")).toThrow(Response);
    });

    it("should deny free users access to advanced reports", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "advanced_reports")).toThrow(Response);
    });

    it("should deny free users access to email notifications", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "email_notifications")).toThrow(Response);
    });

    it("should deny free users unlimited customers", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "unlimited_customers")).toThrow(Response);
    });

    it("should deny free users unlimited tours", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "unlimited_tours")).toThrow(Response);
    });

    it("should deny free users unlimited bookings", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "unlimited_bookings")).toThrow(Response);
    });

    it("should deny free users unlimited team", () => {
      const context = createMockContext(false);
      expect(() => requirePremium(context, "unlimited_team")).toThrow(Response);
    });
  });

  // ============================================================================
  // Error Response
  // ============================================================================

  describe("Error response", () => {
    it("should throw Response object", () => {
      const context = createMockContext(false);

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
      }
    });

    it("should have 403 status code", () => {
      const context = createMockContext(false);

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(403);
      }
    });

    it("should have Premium Required status text", () => {
      const context = createMockContext(false);

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).statusText).toBe("Premium Required");
      }
    });

    it("should include feature name in error message", async () => {
      const context = createMockContext(false);

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        const text = await (error as Response).text();
        expect(text).toContain("Point of Sale");
      }
    });

    it("should include upgrade message in error", async () => {
      const context = createMockContext(false);

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        const text = await (error as Response).text();
        expect(text).toContain("upgrade");
      }
    });
  });

  // ============================================================================
  // Feature Name Mapping
  // ============================================================================

  describe("Feature name mapping", () => {
    const features: Array<{ key: PremiumFeature; name: string }> = [
      { key: "pos", name: "Point of Sale" },
      { key: "equipment_rentals", name: "Equipment Rentals" },
      { key: "advanced_reports", name: "Advanced Reports" },
      { key: "email_notifications", name: "Email Notifications" },
      { key: "unlimited_customers", name: "Unlimited Customers" },
      { key: "unlimited_tours", name: "Unlimited Tours" },
      { key: "unlimited_bookings", name: "Unlimited Monthly Bookings" },
      { key: "unlimited_team", name: "Unlimited Team Members" },
    ];

    features.forEach(({ key, name }) => {
      it(`should include "${name}" in error for ${key} feature`, async () => {
        const context = createMockContext(false);

        try {
          requirePremium(context, key);
          expect.fail("Should have thrown");
        } catch (error) {
          const text = await (error as Response).text();
          expect(text).toContain(name);
        }
      });
    });
  });

  // ============================================================================
  // Consistency
  // ============================================================================

  describe("Consistency", () => {
    it("should be consistent for same context", () => {
      const context = createMockContext(false);

      const error1 = () => requirePremium(context, "pos");
      const error2 = () => requirePremium(context, "pos");

      expect(error1).toThrow();
      expect(error2).toThrow();
    });

    it("should not throw for premium regardless of other context properties", () => {
      const context = createMockContext(true);
      const features: PremiumFeature[] = [
        "pos",
        "equipment_rentals",
        "advanced_reports",
        "email_notifications",
        "unlimited_customers",
        "unlimited_tours",
        "unlimited_bookings",
        "unlimited_team",
      ];

      features.forEach(feature => {
        expect(() => requirePremium(context, feature)).not.toThrow();
      });
    });

    it("should always throw for free tier regardless of role", () => {
      const roles: OrgRole[] = ["owner", "admin", "staff", "customer"];

      roles.forEach(role => {
        const context = {
          ...createMockContext(false),
          membership: { role } as Record<string, unknown>,
        };

        expect(() => requirePremium(context, "pos")).toThrow(Response);
      });
    });
  });
});
