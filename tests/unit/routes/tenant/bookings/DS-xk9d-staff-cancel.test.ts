/**
 * DS-xk9d: Cancel booking returns 403 for staff users
 *
 * The action in app/routes/tenant/bookings/$id.tsx used requireRole(ctx, ['owner', 'admin'])
 * which excluded staff. This test verifies that 'staff' is included in the allowed roles.
 */
import { describe, it, expect } from "vitest";
import { requireRole } from "../../../../../lib/auth/org-context.server";
import type { OrgContext } from "../../../../../lib/auth/org-context.server";

function makeContext(role: string): OrgContext {
  return {
    org: { id: "org-1", name: "Test Org", slug: "test" },
    membership: { role },
    user: { id: "user-1", email: "test@example.com" },
    session: {},
    isPremium: false,
    subscription: null,
    limits: {},
    usage: {},
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
  } as unknown as OrgContext;
}

describe("DS-xk9d: booking cancel action role permissions", () => {
  it("allows owner to cancel bookings", () => {
    expect(() =>
      requireRole(makeContext("owner"), ["owner", "admin", "staff"])
    ).not.toThrow();
  });

  it("allows admin to cancel bookings", () => {
    expect(() =>
      requireRole(makeContext("admin"), ["owner", "admin", "staff"])
    ).not.toThrow();
  });

  it("allows staff to cancel bookings when staff is included in allowed roles", () => {
    expect(() =>
      requireRole(makeContext("staff"), ["owner", "admin", "staff"])
    ).not.toThrow();
  });

  it("blocks staff when staff is NOT in allowed roles (the original bug)", () => {
    let thrownError: unknown;
    try {
      requireRole(makeContext("staff"), ["owner", "admin"]);
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(Response);
    expect((thrownError as Response).status).toBe(403);
  });

  it("blocks customer role from cancelling bookings", () => {
    let thrownError: unknown;
    try {
      requireRole(makeContext("customer"), ["owner", "admin", "staff"]);
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(Response);
    expect((thrownError as Response).status).toBe(403);
  });
});
