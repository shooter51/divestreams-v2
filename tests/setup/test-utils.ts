import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Mock environment variables (use existing values from CI or .env, fallback to defaults)
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://divestreams:divestreams_dev@localhost:5432/divestreams";
process.env.APP_URL = process.env.APP_URL || "http://localhost:5173";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TestAdmin123";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.SMTP_HOST = process.env.SMTP_HOST || "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT || "1025";

// Note: crypto module is NOT mocked - it's used directly
// Some tests rely on real crypto functions (api-keys, webhooks)

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Export test utilities
export { vi };
