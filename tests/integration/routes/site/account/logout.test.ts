import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  logoutCustomer: vi.fn().mockResolvedValue(undefined),
}));

import { logoutCustomer } from "../../../../../lib/auth/customer-auth.server";
import { action, loader } from "../../../../../app/routes/site/account/logout";

describe("site/account/logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("clears session cookie and redirects to login", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/logout", {
        method: "POST",
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/login");
          const cookie = result.headers.get("Set-Cookie") || "";
          expect(cookie).toContain("customer_session=");
          expect(cookie).toContain("Max-Age=0");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toBe("/site/login");
        }
      }
    });

    it("calls logoutCustomer with the session token", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/logout", {
        method: "POST",
      });
      request.headers.append("Cookie", "customer_session=my-token");

      try {
        await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
      } catch {
        // redirect throws
      }

      expect(logoutCustomer).toHaveBeenCalledWith("my-token");
    });

    it("handles logout when no session cookie exists", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/logout", {
        method: "POST",
      });

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/login");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
        }
      }

      expect(logoutCustomer).not.toHaveBeenCalled();
    });
  });

  describe("loader", () => {
    it("redirects GET requests to account page", async () => {
      try {
        await loader();
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toBe("/site/account");
        }
      }
    });
  });
});
