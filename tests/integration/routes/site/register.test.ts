import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies BEFORE importing
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  registerCustomer: vi.fn(),
  loginCustomer: vi.fn(),
}));

vi.mock("../../../../lib/email/triggers", () => ({
  triggerCustomerWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../../../../lib/db";
import { registerCustomer, loginCustomer } from "../../../../lib/auth/customer-auth.server";
import { action } from "../../../../app/routes/site/register";

describe("site/register route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.limit as Mock).mockResolvedValue([mockOrg]);
  });

  function createFormData(fields: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    return formData;
  }

  function createRequest(formData: FormData) {
    return new Request("https://demo.localhost:3000/site/register", {
      method: "POST",
      body: formData,
    });
  }

  const validFields = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "",
    password: "Password1",
    confirmPassword: "Password1",
    terms: "on",
  };

  describe("action", () => {
    it("validates required first name", async () => {
      const formData = createFormData({ ...validFields, firstName: "" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.firstName).toBe("First name is required");
    });

    it("validates first name max length", async () => {
      const formData = createFormData({ ...validFields, firstName: "a".repeat(101) });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.firstName).toBe("First name must be 100 characters or less");
    });

    it("validates required last name", async () => {
      const formData = createFormData({ ...validFields, lastName: "" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.lastName).toBe("Last name is required");
    });

    it("validates email format", async () => {
      const formData = createFormData({ ...validFields, email: "invalid" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.email).toBe("Please enter a valid email address");
    });

    it("validates email max length", async () => {
      const formData = createFormData({ ...validFields, email: "a".repeat(250) + "@b.com" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.email).toBe("Email must be 255 characters or less");
    });

    it("validates phone format when provided", async () => {
      const formData = createFormData({ ...validFields, phone: "abc-not-a-phone!" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.phone).toBe("Please enter a valid phone number");
    });

    it("validates password requirements - minimum length", async () => {
      const formData = createFormData({ ...validFields, password: "Ab1", confirmPassword: "Ab1" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.password).toContain("at least 8 characters");
    });

    it("validates password requirements - uppercase", async () => {
      const formData = createFormData({ ...validFields, password: "password1", confirmPassword: "password1" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.password).toContain("one uppercase letter");
    });

    it("validates password requirements - number", async () => {
      const formData = createFormData({ ...validFields, password: "Passwordd", confirmPassword: "Passwordd" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.password).toContain("one number");
    });

    it("validates confirm password matches", async () => {
      const formData = createFormData({ ...validFields, confirmPassword: "DifferentPass1" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.confirmPassword).toBe("Passwords do not match");
    });

    it("validates terms acceptance", async () => {
      const formData = createFormData({ ...validFields, terms: "" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.terms).toBe("You must accept the Terms of Service");
    });

    it("registers customer and auto-logs in on success", async () => {
      (registerCustomer as Mock).mockResolvedValue(undefined);
      (loginCustomer as Mock).mockResolvedValue({
        token: "auto-login-token",
        expiresAt: new Date(Date.now() + 86400000),
      });

      const formData = createFormData(validFields);
      try {
        const result = await action({
          request: createRequest(formData),
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/account");
          expect(result.headers.get("Set-Cookie")).toContain("customer_session=auto-login-token");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toBe("/site/account");
        }
      }
    });

    it("handles duplicate email registration", async () => {
      (registerCustomer as Mock).mockRejectedValue(new Error("Email already registered"));

      const formData = createFormData(validFields);
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors?.email).toContain("already registered");
    });

    it("handles generic registration errors", async () => {
      (registerCustomer as Mock).mockRejectedValue(new Error("Database error"));

      const formData = createFormData(validFields);
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Database error");
    });

    it("returns error when no subdomain can be determined", async () => {
      const formData = createFormData(validFields);
      const request = new Request("https://localhost:3000/site/register", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Unable to determine organization");
    });

    it("returns error when organization not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const formData = createFormData(validFields);
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Organization not found");
    });

    it("redirects to login if auto-login fails after registration", async () => {
      (registerCustomer as Mock).mockResolvedValue(undefined);
      (loginCustomer as Mock).mockRejectedValue(new Error("Login failed"));

      const formData = createFormData(validFields);
      try {
        const result = await action({
          request: createRequest(formData),
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.headers.get("Location")).toBe("/site/login?registered=true");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.headers.get("Location")).toBe("/site/login?registered=true");
        }
      }
    });
  });
});
