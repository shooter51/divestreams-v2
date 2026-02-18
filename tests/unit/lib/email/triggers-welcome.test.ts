/**
 * Unit tests for KAN-592: Free trial signup email handling
 *
 * Tests that triggerWelcomeEmail warns when SMTP is not configured
 * and still attempts to send (best-effort).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../lib/jobs/index", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getTenantUrl: vi.fn(
    (subdomain: string, path: string) =>
      `https://${subdomain}.divestreams.com${path}`
  ),
  getAppUrl: vi.fn(() => "https://divestreams.com"),
}));

vi.mock("../../../../lib/email/index", () => ({
  isEmailConfigured: vi.fn(),
}));

import { triggerWelcomeEmail } from "../../../../lib/email/triggers";
import { sendEmail } from "../../../../lib/jobs/index";
import { isEmailConfigured } from "../../../../lib/email/index";

type MockFn = ReturnType<typeof vi.fn>;

const defaultParams = {
  userEmail: "test@example.com",
  userName: "Test User",
  shopName: "Demo Dive Shop",
  subdomain: "demo",
  tenantId: "tenant-1",
};

describe("triggerWelcomeEmail (KAN-592)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sendEmail as MockFn).mockResolvedValue(undefined);
  });

  it("sends welcome email when SMTP is configured", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(true);

    await triggerWelcomeEmail(defaultParams);

    expect(sendEmail).toHaveBeenCalledWith("welcome", {
      to: "test@example.com",
      tenantId: "tenant-1",
      userName: "Test User",
      shopName: "Demo Dive Shop",
      loginUrl: "https://demo.divestreams.com/login",
    });
  });

  it("warns but still sends when SMTP is not configured", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await triggerWelcomeEmail(defaultParams);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SMTP not configured")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("test@example.com")
    );
    // Still attempts to send (best-effort)
    expect(sendEmail).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("includes environment variable hints in warning", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await triggerWelcomeEmail(defaultParams);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SMTP_HOST")
    );

    warnSpy.mockRestore();
  });

  it("does not warn when SMTP is configured", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await triggerWelcomeEmail(defaultParams);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("propagates sendEmail errors (caller handles them)", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(true);
    (sendEmail as MockFn).mockRejectedValue(new Error("SMTP connection failed"));

    await expect(triggerWelcomeEmail(defaultParams)).rejects.toThrow(
      "SMTP connection failed"
    );
  });

  it("generates correct login URL from subdomain", async () => {
    (isEmailConfigured as MockFn).mockReturnValue(true);

    await triggerWelcomeEmail({
      ...defaultParams,
      subdomain: "ocean-divers",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      "welcome",
      expect.objectContaining({
        loginUrl: "https://ocean-divers.divestreams.com/login",
      })
    );
  });
});
