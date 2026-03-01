import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/api/auth.$";

/**
 * Integration tests for api/auth.$ route
 * Tests auth handler passthrough for Better Auth
 */

vi.mock("../../../../lib/auth", () => ({
  auth: {
    handler: vi.fn(),
  },
}));

import { auth } from "../../../../lib/auth";

describe("api/auth.$ route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("calls auth.handler with request", async () => {
      const mockResponse = new Response("OK");
      (auth.handler as Mock).mockResolvedValue(mockResponse);

      const request = new Request("https://divestreams.com/api/auth/session");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(auth.handler).toHaveBeenCalledWith(request);
      expect(response).toBe(mockResponse);
    });
  });

  describe("action", () => {
    it("calls auth.handler with request", async () => {
      const mockResponse = new Response("OK");
      (auth.handler as Mock).mockResolvedValue(mockResponse);

      const request = new Request("https://divestreams.com/api/auth/sign-in", {
        method: "POST",
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(auth.handler).toHaveBeenCalledWith(request);
      expect(response).toBe(mockResponse);
    });
  });
});
