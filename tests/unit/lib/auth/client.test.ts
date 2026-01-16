/**
 * Auth Client Tests
 *
 * Tests for Better Auth client-side exports.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock the window object for client-side tests
const mockWindow = {
  location: {
    origin: "http://localhost:3000",
  },
};

// Mock better-auth/react
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn().mockReturnValue({
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    useSession: vi.fn(),
    organization: vi.fn(),
  }),
}));

// Mock better-auth/client/plugins
vi.mock("better-auth/client/plugins", () => ({
  organizationClient: vi.fn().mockReturnValue({}),
}));

describe("Auth Client Module", () => {
  beforeAll(() => {
    // Set up window mock
    (global as any).window = mockWindow;
  });

  describe("Module exports", () => {
    it("exports authClient", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.authClient).toBeDefined();
    });

    it("exports signIn function", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.signIn).toBeDefined();
    });

    it("exports signUp function", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.signUp).toBeDefined();
    });

    it("exports signOut function", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.signOut).toBeDefined();
    });

    it("exports useSession hook", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.useSession).toBeDefined();
    });

    it("exports organization", async () => {
      const authModule = await import("../../../../lib/auth/client");
      expect(authModule.organization).toBeDefined();
    });
  });

  describe("Auth client type checks", () => {
    it("authClient is an object", async () => {
      const { authClient } = await import("../../../../lib/auth/client");
      expect(typeof authClient).toBe("object");
    });

    it("signIn is callable", async () => {
      const { signIn } = await import("../../../../lib/auth/client");
      expect(typeof signIn).toBe("function");
    });

    it("signUp is callable", async () => {
      const { signUp } = await import("../../../../lib/auth/client");
      expect(typeof signUp).toBe("function");
    });

    it("signOut is callable", async () => {
      const { signOut } = await import("../../../../lib/auth/client");
      expect(typeof signOut).toBe("function");
    });

    it("useSession is callable", async () => {
      const { useSession } = await import("../../../../lib/auth/client");
      expect(typeof useSession).toBe("function");
    });
  });
});
