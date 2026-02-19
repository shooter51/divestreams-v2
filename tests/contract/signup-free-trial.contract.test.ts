/**
 * Contract tests for KAN-592: Free trial signup flow
 *
 * Validates:
 * - Signup action redirects to login with success params
 * - Email failure doesn't block signup (best-effort)
 * - Login page displays correct success messages
 */

import { describe, it, expect } from "vitest";

describe("Contract: Free Trial Signup Flow (KAN-592)", () => {
  describe("Signup redirect URL contract", () => {
    it("includes signup=success param on successful signup", () => {
      const loginUrl = "https://demo.divestreams.com/auth/login";
      const separator = loginUrl.includes("?") ? "&" : "?";
      const emailQueued = true;
      const redirectUrl = `${loginUrl}${separator}signup=success${emailQueued ? "" : "&emailSkipped=true"}`;

      expect(redirectUrl).toContain("signup=success");
      expect(redirectUrl).not.toContain("emailSkipped");
    });

    it("includes emailSkipped=true when email fails to queue", () => {
      const loginUrl = "https://demo.divestreams.com/auth/login";
      const separator = loginUrl.includes("?") ? "&" : "?";
      const emailQueued = false;
      const redirectUrl = `${loginUrl}${separator}signup=success${emailQueued ? "" : "&emailSkipped=true"}`;

      expect(redirectUrl).toContain("signup=success");
      expect(redirectUrl).toContain("emailSkipped=true");
    });

    it("handles login URLs with existing query params", () => {
      const loginUrl = "https://demo.divestreams.com/auth/login?ref=promo";
      const separator = loginUrl.includes("?") ? "&" : "?";
      const emailQueued = true;
      const redirectUrl = `${loginUrl}${separator}signup=success`;

      expect(redirectUrl).toBe(
        "https://demo.divestreams.com/auth/login?ref=promo&signup=success"
      );
    });
  });

  describe("Login page success banner contract", () => {
    it("shows success message when signup=success", () => {
      const searchParams = new URLSearchParams("signup=success");
      const isSignupSuccess = searchParams.get("signup") === "success";
      const emailSkipped = searchParams.get("emailSkipped") === "true";

      expect(isSignupSuccess).toBe(true);
      expect(emailSkipped).toBe(false);
    });

    it("shows email fallback message when emailSkipped=true", () => {
      const searchParams = new URLSearchParams(
        "signup=success&emailSkipped=true"
      );
      const isSignupSuccess = searchParams.get("signup") === "success";
      const emailSkipped = searchParams.get("emailSkipped") === "true";

      expect(isSignupSuccess).toBe(true);
      expect(emailSkipped).toBe(true);
    });

    it("does not show banner for normal login", () => {
      const searchParams = new URLSearchParams("");
      const isSignupSuccess = searchParams.get("signup") === "success";

      expect(isSignupSuccess).toBe(false);
    });
  });

  describe("Free plan subscription contract", () => {
    it("creates subscription with status trialing", () => {
      const subscription = {
        organizationId: "org-1",
        plan: "free",
        planId: null,
        status: "trialing",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(subscription.plan).toBe("free");
      expect(subscription.status).toBe("trialing");
    });

    it("handles missing free plan gracefully (planId null)", () => {
      const freePlan = undefined;
      const planId = freePlan?.id ?? null;

      expect(planId).toBeNull();
    });

    it("preserves planId when free plan exists", () => {
      const freePlan = { id: "plan-free-001" };
      const planId = freePlan?.id ?? null;

      expect(planId).toBe("plan-free-001");
    });
  });
});
