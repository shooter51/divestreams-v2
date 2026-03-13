/**
 * Unit tests for the site login action error message translation keys.
 *
 * These tests verify that the action returns i18n translation keys instead of
 * hardcoded English strings so that errors are rendered translated in the component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and auth modules so the action can run in unit tests
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "org-123" }]),
  },
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  loginCustomer: vi.fn(),
  getCustomerBySession: vi.fn(),
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../../../../../lib/security/csrf.server", () => ({
  generateAnonCsrfToken: vi.fn().mockReturnValue("test-csrf-token"),
  validateAnonCsrfToken: vi.fn().mockReturnValue(true),
  CSRF_FIELD_NAME: "_csrf",
}));

// Import the action after mocks are set up
import { action } from "../../../../../app/routes/site/login";
import { loginCustomer } from "../../../../../lib/auth/customer-auth.server";
import { checkRateLimit } from "../../../../../lib/utils/rate-limit";
import { validateAnonCsrfToken } from "../../../../../lib/security/csrf.server";

function makeRequest(formData: Record<string, string>): Request {
  const fd = new FormData();
  for (const [key, value] of Object.entries(formData)) {
    fd.append(key, value);
  }
  return new Request("http://demo.example.com/site/login", {
    method: "POST",
    body: fd,
  });
}

describe("site/login action — error translation keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, resetAt: 0, remaining: 9 });
    vi.mocked(validateAnonCsrfToken).mockReturnValue(true);
  });

  it("returns translation key for missing email", async () => {
    const request = makeRequest({ _csrf: "token", password: "password123" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { email?: string } };
    expect(data.errors.email).toBe("auth.login.emailRequired");
  });

  it("returns translation key for invalid email format", async () => {
    const request = makeRequest({ _csrf: "token", email: "not-an-email", password: "password123" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { email?: string } };
    expect(data.errors.email).toBe("auth.login.invalidEmail");
  });

  it("returns translation key for missing password", async () => {
    const request = makeRequest({ _csrf: "token", email: "user@example.com" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { password?: string } };
    expect(data.errors.password).toBe("auth.login.passwordRequired");
  });

  it("returns translation key for invalid credentials", async () => {
    vi.mocked(loginCustomer).mockRejectedValue(new Error("Invalid credentials"));
    const request = makeRequest({ _csrf: "token", email: "user@example.com", password: "wrongpass" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { form?: string } };
    expect(data.errors.form).toBe("auth.login.invalidCredentials");
  });

  it("returns translation key for too many attempts", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60000, remaining: 0 });
    const request = makeRequest({ _csrf: "token", email: "user@example.com", password: "password123" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { form?: string } };
    expect(data.errors.form).toBe("auth.login.tooManyAttempts");
  });

  it("returns translation key for invalid CSRF token", async () => {
    vi.mocked(validateAnonCsrfToken).mockReturnValue(false);
    const request = makeRequest({ _csrf: "bad-token", email: "user@example.com", password: "password123" });
    const result = await action({ request, params: {}, context: {} as never });

    expect(result).not.toBeInstanceOf(Response);
    const data = result as { errors: { form?: string } };
    expect(data.errors.form).toBe("auth.login.invalidFormSubmission");
  });
});
