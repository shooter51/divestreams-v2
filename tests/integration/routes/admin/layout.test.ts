import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/admin/layout";

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("http://localhost:5173"),
}));

import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";

describe("admin/layout loader", () => {
  it("redirects when not on admin subdomain", async () => {
    (isAdminSubdomain as Mock).mockReturnValue(false);

    await expect(
      loader({
        request: new Request("https://demo.divestreams.com/dashboard"),
        params: {},
        context: {},
      } as unknown)
    ).rejects.toEqual(expect.objectContaining({ status: 302 }));
  });

  it("returns user context on admin subdomain", async () => {
    (isAdminSubdomain as Mock).mockReturnValue(true);
    (requirePlatformContext as Mock).mockResolvedValue({
      user: { name: "Admin", email: "admin@test.com" },
      isOwner: true,
      isAdmin: true,
    });

    const result = await loader({
      request: new Request("https://admin.divestreams.com/dashboard"),
      params: {},
      context: {},
    } as unknown);

    expect(result.user).toEqual({ name: "Admin", email: "admin@test.com" });
    expect(result.isOwner).toBe(true);
    expect(result.isAdmin).toBe(true);
  });
});
