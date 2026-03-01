/**
 * Contract tests: POST /tenant/customers/new
 *
 * Validates response shapes for customer creation — specifically:
 *
 * 1. Required-field validation returns { errors: { field }, values }
 * 2. Invalid email format returns a field error
 * 3. Email already registered as a tenant user returns a specific,
 *    actionable error message (not a generic DB error)
 * 4. DB creation failure returns { errors: { form } } (not 500)
 * 5. Email send failure falls back to a warning redirect (not 500)
 * 6. Happy path redirects to /tenant/customers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/db/queries.server", () => ({
  createCustomer: vi.fn(),
}));

// Mock the db module used for the email-collision check
vi.mock("../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // default: no collision
  },
}));

// Mock the dynamic imports used for credential + email setup
vi.mock("../../lib/auth/customer-auth.server", () => ({
  createInitialCredentials: vi.fn().mockResolvedValue({ resetToken: "tok-abc" }),
}));

vi.mock("../../lib/email/triggers", () => ({
  triggerCustomerSetPassword: vi.fn().mockResolvedValue(undefined),
  triggerBookingConfirmation: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "../../app/routes/tenant/customers/new";
import { requireOrgContext } from "../../lib/auth/org-context.server";
import { createCustomer } from "../../lib/db/queries.server";
import { db } from "../../lib/db";
import { triggerCustomerSetPassword } from "../../lib/email/triggers";

const mockOrgContext = {
  user: { id: "user-1", name: "Owner", email: "owner@demo.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", slug: "demo", name: "Demo Dive Shop" },
  membership: { role: "owner" },
  subscription: null,
};

const mockCreatedCustomer = {
  id: "customer-uuid",
  firstName: "Bob",
  lastName: "Snorkel",
  email: "bob@example.com",
};

function makeRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/customers/new", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

function makeValidFormData(): FormData {
  const fd = new FormData();
  fd.append("firstName", "Bob");
  fd.append("lastName", "Snorkel");
  fd.append("email", "bob@example.com");
  return fd;
}

describe("Contract: POST /tenant/customers/new", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (createCustomer as Mock).mockResolvedValue(mockCreatedCustomer);
    // Default: no existing user with that email
    (db.limit as Mock).mockResolvedValue([]);
  });

  describe("Required field validation", () => {
    it("returns { errors: { firstName } } when firstName is missing", async () => {
      const fd = new FormData();
      fd.append("lastName", "Snorkel");
      fd.append("email", "bob@example.com");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).not.toBeInstanceOf(Response);
      expect((result as { errors: Record<string, string> }).errors).toHaveProperty("firstName");
      expect(result).toHaveProperty("values");
    });

    it("returns { errors: { lastName } } when lastName is missing", async () => {
      const fd = new FormData();
      fd.append("firstName", "Bob");
      fd.append("email", "bob@example.com");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).not.toBeInstanceOf(Response);
      expect((result as { errors: Record<string, string> }).errors).toHaveProperty("lastName");
    });

    it("returns { errors: { email } } when email is missing", async () => {
      const fd = new FormData();
      fd.append("firstName", "Bob");
      fd.append("lastName", "Snorkel");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).not.toBeInstanceOf(Response);
      expect((result as { errors: Record<string, string> }).errors).toHaveProperty("email");
    });

    it("returns { errors: { email } } for an email without @", async () => {
      const fd = new FormData();
      fd.append("firstName", "Bob");
      fd.append("lastName", "Snorkel");
      fd.append("email", "not-an-email");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).not.toBeInstanceOf(Response);
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors).toHaveProperty("email");
    });
  });

  describe("Email collision with tenant user", () => {
    it("returns a specific error message when email is already a tenant user", async () => {
      // Simulate the db.select() finding an existing user
      (db.limit as Mock).mockResolvedValue([{ id: "existing-user", email: "bob@example.com" }]);

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      expect(result).not.toBeInstanceOf(Response);
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors).toHaveProperty("email");
      // Contract: must say "already registered as a tenant user" — not a generic message
      expect(errors.email).toMatch(/already registered/i);
    });
  });

  describe("DB creation failure", () => {
    it("returns { errors: { form } } when createCustomer throws (not a 500)", async () => {
      (createCustomer as Mock).mockRejectedValue(new Error("constraint violation"));

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      // Contract: DB failure must surface as a user-facing form error, not an unhandled exception
      expect(result).not.toBeInstanceOf(Response);
      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors).toHaveProperty("form");
    });
  });

  describe("Email send failure resilience", () => {
    it("still redirects when password-setup email fails (warning redirect)", async () => {
      (triggerCustomerSetPassword as Mock).mockRejectedValue(new Error("SMTP down"));

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      // Contract: email failure must NOT fail the customer creation
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });
  });

  describe("Success", () => {
    it("redirects to /tenant/customers on success", async () => {
      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);

      const location = (result as Response).headers.get("Location") ?? "";
      expect(location).toContain("/tenant/customers");
    });
  });
});
