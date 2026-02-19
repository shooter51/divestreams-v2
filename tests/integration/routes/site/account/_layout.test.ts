import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { loader } from "../../../../../app/routes/site/account/_layout";

describe("site/account/_layout route", () => {
  const mockCustomer = {
    id: "cust-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    organizationId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns customer data when session is valid", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);

      const request = new Request("https://demo.divestreams.com/site/account");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.customer).toEqual(mockCustomer);
    });

    it("redirects to login when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site/account");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown redirect");
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toContain("/site/login");
        }
      }
    });

    it("redirects to login when session is invalid", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/site/account");
      request.headers.append("Cookie", "customer_session=invalid-token");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown redirect");
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toContain("/site/login");
        }
      }
    });

    it("includes redirect param in login redirect", async () => {
      const request = new Request("https://demo.divestreams.com/site/account");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
      } catch (error) {
        if (error instanceof Response) {
          expect(error.headers.get("Location")).toBe("/site/login?redirect=/site/account");
        }
      }
    });
  });
});
