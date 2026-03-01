import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
    publicSiteSettings: "publicSiteSettings",
  },
}));

vi.mock("../../../../lib/db/schema/public-site", () => ({
  contactMessages: { organizationId: "organizationId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../../../../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  contactFormNotificationEmail: vi.fn().mockReturnValue({
    subject: "New Contact",
    html: "<p>Test</p>",
    text: "Test",
  }),
  contactFormAutoReplyEmail: vi.fn().mockReturnValue({
    subject: "Thank you",
    html: "<p>Thanks</p>",
    text: "Thanks",
  }),
}));

vi.mock("../../../../lib/security/sanitize", () => ({
  sanitizeIframeEmbed: vi.fn((html: string) => html),
}));

import { db } from "../../../../lib/db";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";
import { action } from "../../../../app/routes/site/contact";

describe("site/contact route", () => {
  const mockOrg = {
    id: "org-1",
    name: "Demo Dive Shop",
    slug: "demo",
    publicSiteSettings: {
      contactInfo: { email: "info@demo.com", phone: "555-1234" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true });
  });

  describe("action", () => {
    function createFormData(fields: Record<string, string>) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      return formData;
    }

    function createRequest(formData: FormData) {
      return new Request("https://demo.divestreams.com/site/contact", {
        method: "POST",
        body: formData,
      });
    }

    it("validates required name field", async () => {
      const formData = createFormData({ name: "", email: "t@t.com", message: "Hello world test" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("validates required email field", async () => {
      const formData = createFormData({ name: "John", email: "invalid", message: "Hello world test" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.errors?.email).toBe("Please enter a valid email address");
    });

    it("validates message minimum length", async () => {
      const formData = createFormData({ name: "John", email: "t@t.com", message: "Hi" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.errors?.message).toBe("Message must be at least 10 characters");
    });

    it("validates message maximum length", async () => {
      const formData = createFormData({ name: "John", email: "t@t.com", message: "a".repeat(5001) });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.errors?.message).toBe("Message must be less than 5000 characters");
    });

    it("silently accepts honeypot submissions (spam protection)", async () => {
      const formData = createFormData({
        name: "Bot",
        email: "bot@spam.com",
        message: "Buy something now!",
        website: "http://spam.com",
      });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.success).toBe(true);
      // Should not actually insert into db
    });

    it("returns rate limit error when too many submissions", async () => {
      (checkRateLimit as Mock).mockResolvedValue({
        allowed: false,
        resetAt: Date.now() + 5 * 60 * 1000,
      });

      const formData = createFormData({ name: "John", email: "t@t.com", message: "Hello world test" });
      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.error).toContain("Too many submissions");
    });

    it("stores message and returns success on valid submission", async () => {
      const formData = createFormData({
        name: "John Doe",
        email: "john@example.com",
        phone: "+1-555-1234",
        message: "I want to learn about your diving trips please.",
      });

      const result = await action({
        request: createRequest(formData),
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.success).toBe(true);
    });

    it("returns error when no subdomain can be determined", async () => {
      (getSubdomainFromHost as Mock).mockReturnValue(null);

      const formData = createFormData({
        name: "John Doe",
        email: "john@example.com",
        message: "Hello world test message",
      });

      const request = new Request("https://localhost:3000/site/contact", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result.error).toContain("Unable to process");
    });
  });
});
