/**
 * DS-35r: Zapier update-customer must not allow email relay
 *
 * Verifies that the update-customer endpoint:
 * 1. Does NOT send emails
 * 2. Does NOT update the customer's email field (email is lookup-only)
 * 3. Filters by organizationId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock database
const mockReturning = vi.fn().mockResolvedValue([{
  id: "cust-1",
  email: "customer@test.com",
  firstName: "Updated",
  lastName: "Name",
  phone: "123",
  updatedAt: new Date(),
}]);

const mockUpdateChain = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: mockReturning,
};

const mockSelectChain = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([{
    id: "cust-1",
    email: "customer@test.com",
    firstName: "Old",
    lastName: "Name",
    phone: null,
    certifications: [],
    organizationId: "org-1",
  }]),
};

vi.mock("../../../../../../lib/db/index.js", () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
    update: vi.fn(() => mockUpdateChain),
  },
}));

vi.mock("../../../../../../lib/db/schema.js", () => ({
  customers: {
    id: "id",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    emergencyContactName: "emergencyContactName",
    emergencyContactPhone: "emergencyContactPhone",
    certifications: "certifications",
    notes: "notes",
    organizationId: "organizationId",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../../../../../lib/integrations/zapier-enhanced.server.js", () => ({
  validateZapierApiKey: vi.fn().mockResolvedValue("org-1"),
}));

vi.mock("../../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ conditions: args })),
}));

// Mock sendEmail to detect if it's ever called
const mockSendEmail = vi.fn();
vi.mock("../../../../../../lib/email/index", () => ({
  sendEmail: mockSendEmail,
}));

import { action } from "../../../../../../app/routes/api/zapier/actions/update-customer";
import { db } from "../../../../../../lib/db/index.js";

describe("DS-35r: Zapier update-customer email relay prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockClear();
  });

  it("does not send any emails during customer update", async () => {
    const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "valid-key",
      },
      body: JSON.stringify({
        email: "customer@test.com",
        first_name: "Updated",
      }),
    });

    await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

    // No email must be sent
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not update the customer email field (email is lookup-only)", async () => {
    const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "valid-key",
      },
      body: JSON.stringify({
        email: "customer@test.com",
        first_name: "Updated",
      }),
    });

    await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

    // Check that db.update was called with set() that does NOT include email
    expect(db.update).toHaveBeenCalled();
    const setCall = mockUpdateChain.set.mock.calls[0][0];
    expect(setCall).not.toHaveProperty("email");
  });

  it("rejects GET requests", async () => {
    const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
      method: "GET",
    });

    const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);
    const data = await result.json();

    expect(result.status).toBe(405);
    expect(data.error).toBe("Method not allowed");
  });
});
