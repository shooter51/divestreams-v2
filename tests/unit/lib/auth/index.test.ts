/**
 * Auth Index Tests
 *
 * Tests for Better Auth configuration exports.
 * These tests verify the module exports correctly.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the database and schema modules to prevent actual DB connections
vi.mock("../../../../lib/db", () => ({
  db: {},
}));

vi.mock("../../../../lib/db/schema", () => ({
  user: {},
  session: {},
  account: {},
  verification: {},
  organization: {},
  member: {},
  invitation: {},
}));

// Mock better-auth
vi.mock("better-auth", () => ({
  betterAuth: vi.fn().mockReturnValue({
    $Infer: {
      Session: {
        user: {},
      },
    },
    api: {
      getSession: vi.fn(),
      signInEmail: vi.fn(),
    },
  }),
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn().mockReturnValue({}),
}));

vi.mock("better-auth/plugins/organization", () => ({
  organization: vi.fn().mockReturnValue({}),
}));

describe("Auth Index Module", () => {
  describe("Module exports", () => {
    it("exports auth instance", async () => {
      const authModule = await import("../../../../lib/auth/index");
      expect(authModule.auth).toBeDefined();
    });

    it("auth has $Infer property for types", async () => {
      const { auth } = await import("../../../../lib/auth/index");
      expect(auth.$Infer).toBeDefined();
    });

    it("auth has api property", async () => {
      const { auth } = await import("../../../../lib/auth/index");
      expect(auth.api).toBeDefined();
    });

    it("auth.api has getSession method", async () => {
      const { auth } = await import("../../../../lib/auth/index");
      expect(typeof auth.api.getSession).toBe("function");
    });

    it("auth.api has signInEmail method", async () => {
      const { auth } = await import("../../../../lib/auth/index");
      expect(typeof auth.api.signInEmail).toBe("function");
    });
  });

  describe("Type exports", () => {
    it("module can be imported without errors", async () => {
      const authModule = await import("../../../../lib/auth/index");
      expect(authModule).toBeDefined();
    });
  });
});
