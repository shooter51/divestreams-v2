import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/marketing/home";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  getPlatformContext: vi.fn(),
}));

import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";
import { getPlatformContext } from "../../../../lib/auth/platform-context.server";

describe("marketing/home route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns null when not on admin subdomain", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(false);

      const request = new Request("https://divestreams.com/");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toBeNull();
    });

    it("redirects to /dashboard when on admin subdomain and authenticated", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (getPlatformContext as Mock).mockResolvedValue({ user: { id: "user-1" } });

      const request = new Request("https://admin.divestreams.com/");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("redirects to /login when on admin subdomain and not authenticated", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (getPlatformContext as Mock).mockResolvedValue(null);

      const request = new Request("https://admin.divestreams.com/");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });
  });
});
