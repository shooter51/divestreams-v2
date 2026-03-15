/**
 * Security test: No [AUTH DEBUG] console.log calls that leak password data
 *
 * These tests ensure that auth debug logging (which may expose partial
 * password content or hash prefixes) has been completely removed.
 *
 * TDD: Write the test first, then remove the debug logs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Auth Debug Log Security Tests", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env = {
      ...originalEnv,
      AUTH_SECRET: "test-secret-key-1234567890-abcdefgh",
      AUTH_URL: "http://localhost:3000",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("lib/auth/index.ts — verifyPassword wrapper", () => {
    it("does NOT call console.log with [AUTH DEBUG] when verifying password", async () => {
      // Import the module fresh each test so env vars are picked up
      const { auth } = await import("../../../../lib/auth/index");

      // Verify the emailAndPassword.password.verify function exists
      // and does not log when invoked via the module source code
      const authConfig = auth as unknown as {
        options?: {
          emailAndPassword?: {
            password?: {
              verify?: (args: { hash: string; password: string }) => Promise<boolean>;
            };
          };
        };
      };

      // Check that no [AUTH DEBUG] log was emitted during module import
      const importLogs = consoleSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("[AUTH DEBUG]"))
      );
      expect(importLogs).toHaveLength(0);

      // Verify the password verify function (if it exists) doesn't log [AUTH DEBUG]
      if (authConfig?.options?.emailAndPassword?.password?.verify) {
        consoleSpy.mockClear();
        try {
          await authConfig.options.emailAndPassword.password.verify({
            hash: "$2b$10$fakehashfortest",
            password: "testpassword",
          });
        } catch {
          // May throw due to invalid hash — that's fine
        }
        const debugLogs = consoleSpy.mock.calls.filter((call) =>
          call.some((arg) => typeof arg === "string" && arg.includes("[AUTH DEBUG]"))
        );
        expect(debugLogs).toHaveLength(0);
      }
    });
  });

  describe("app/routes/auth/login.tsx — action function", () => {
    it("does NOT log [AUTH DEBUG] messages containing password data", async () => {
      // We verify at the source level that the string "[AUTH DEBUG]" does not appear
      // in the login route module. This is a static check that fails if the debug
      // logs are still present and would be caught by the import side-effects test.

      // Read the source to detect debug logs statically
      const fs = await import("fs");
      const path = await import("path");

      const loginPath = path.resolve(
        process.cwd(),
        "app/routes/auth/login.tsx"
      );
      const source = fs.readFileSync(loginPath, "utf-8");

      // Should NOT contain [AUTH DEBUG] logs
      expect(source).not.toContain("[AUTH DEBUG]");
    });
  });

  describe("lib/auth/index.ts — source check", () => {
    it("does NOT contain [AUTH DEBUG] log statements", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const authIndexPath = path.resolve(process.cwd(), "lib/auth/index.ts");
      const source = fs.readFileSync(authIndexPath, "utf-8");

      // Should NOT contain [AUTH DEBUG] logs
      expect(source).not.toContain("[AUTH DEBUG]");
    });

    it("does NOT contain TEMP DEBUG comment", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const authIndexPath = path.resolve(process.cwd(), "lib/auth/index.ts");
      const source = fs.readFileSync(authIndexPath, "utf-8");

      expect(source).not.toContain("TEMP DEBUG");
    });
  });

  describe("app/components/ui/ImageManager.tsx — source check", () => {
    it("does NOT contain debug console.log for upload response", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const imageMgrPath = path.resolve(
        process.cwd(),
        "app/components/ui/ImageManager.tsx"
      );
      const source = fs.readFileSync(imageMgrPath, "utf-8");

      // The specific debug log: console.log("Upload response:", result)
      expect(source).not.toContain('console.log("Upload response:"');
    });
  });
});
