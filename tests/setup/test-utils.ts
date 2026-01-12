import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Mock environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.APP_URL = "http://localhost:5173";
process.env.ADMIN_PASSWORD = "TestAdmin123";
process.env.SESSION_SECRET = "test-session-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";

// Mock crypto for session tokens
vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from("mockedrandomstring123456")),
    randomUUID: vi.fn(() => "00000000-0000-0000-0000-000000000000"),
  };
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Export test utilities
export { vi };
