import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  customers: { id: "id", firstName: "firstName", lastName: "lastName", phone: "phone", updatedAt: "updatedAt" },
  customerCredentials: {
    id: "id",
    customerId: "customerId",
    organizationId: "organizationId",
    passwordHash: "passwordHash",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
  logoutCustomer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
  },
}));

import { db } from "../../../../../lib/db";
import { getCustomerBySession, logoutCustomer } from "../../../../../lib/auth/customer-auth.server";
import bcrypt from "bcryptjs";
import { loader, action } from "../../../../../app/routes/site/account/profile";

describe("site/account/profile route", () => {
  const mockCustomer = {
    id: "cust-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    phone: "+1-555-1234",
    organizationId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
  });

  describe("loader", () => {
    it("returns customer profile data", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/profile");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.customer).toMatchObject({
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
      });
    });

    it("throws 401 when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/profile");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(401);
      }
    });
  });

  describe("action", () => {
    it("updates profile successfully", async () => {
      (db.where as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("intent", "update-profile");
      formData.set("firstName", "Jane");
      formData.set("lastName", "Smith");
      formData.set("phone", "+1-555-9999");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).success).toBe(true);
      expect((result as any).type).toBe("profile");
    });

    it("validates required first name for profile update", async () => {
      const formData = new FormData();
      formData.set("intent", "update-profile");
      formData.set("firstName", "");
      formData.set("lastName", "Smith");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("First name is required");
      expect((result as any).field).toBe("firstName");
    });

    it("validates required last name for profile update", async () => {
      const formData = new FormData();
      formData.set("intent", "update-profile");
      formData.set("firstName", "Jane");
      formData.set("lastName", "");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Last name is required");
    });

    it("validates password change - requires current password", async () => {
      const formData = new FormData();
      formData.set("intent", "change-password");
      formData.set("currentPassword", "");
      formData.set("newPassword", "NewPass123");
      formData.set("confirmPassword", "NewPass123");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Current password is required");
    });

    it("validates password change - minimum length", async () => {
      const formData = new FormData();
      formData.set("intent", "change-password");
      formData.set("currentPassword", "OldPass123");
      formData.set("newPassword", "short");
      formData.set("confirmPassword", "short");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Password must be at least 8 characters");
    });

    it("validates password change - passwords must match", async () => {
      const formData = new FormData();
      formData.set("intent", "change-password");
      formData.set("currentPassword", "OldPass123");
      formData.set("newPassword", "NewPass123");
      formData.set("confirmPassword", "Different123");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Passwords do not match");
    });

    it("handles logout intent", async () => {
      const formData = new FormData();
      formData.set("intent", "logout");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/login");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
        }
      }

      expect(logoutCustomer).toHaveBeenCalledWith("valid-token");
    });

    it("returns error when not authenticated", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const formData = new FormData();
      formData.set("intent", "update-profile");
      formData.set("firstName", "Jane");
      formData.set("lastName", "Smith");

      const request = new Request("https://demo.divestreams.com/site/account/profile", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=invalid");

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Not authenticated");
    });
  });
});
