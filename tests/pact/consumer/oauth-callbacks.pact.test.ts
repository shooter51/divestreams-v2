/**
 * Pact Consumer Contract Tests - OAuth Callbacks
 *
 * Tests the contract between OAuth providers (Google, QuickBooks, Xero, Mailchimp)
 * and DiveStreams API for OAuth callback handling.
 */

import { describe, it, expect } from "vitest";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "path";

const { like } = MatchersV3;

const provider = new PactV3({
  consumer: "OAuthProvider",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

describe("OAuth Callback Contract", () => {
  describe("GET /api/integrations/google/callback", () => {
    it("handles successful OAuth callback", () => {
      return provider
        .given("valid OAuth state and code")
        .uponReceiving("a Google OAuth callback")
        .withRequest({
          method: "GET",
          path: "/api/integrations/google/callback",
          query: {
            code: like("4/0AY0e-g7xyz"),
            state: like("state123"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?success=Google+connected+successfully"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/google/callback?code=4/0AY0e-g7xyz&state=state123`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("success=");
        });
    });

    it("handles OAuth error", () => {
      return provider
        .given("OAuth error occurred")
        .uponReceiving("a Google OAuth callback with error")
        .withRequest({
          method: "GET",
          path: "/api/integrations/google/callback",
          query: {
            error: like("access_denied"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?error=declined"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/google/callback?error=access_denied`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("error=");
        });
    });

    it("handles missing code parameter", () => {
      return provider
        .given("code parameter is missing")
        .uponReceiving("a Google OAuth callback without code")
        .withRequest({
          method: "GET",
          path: "/api/integrations/google/callback",
          query: {
            state: like("state123"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?error="),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/google/callback?state=state123`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("error=");
        });
    });
  });

  describe("GET /api/integrations/quickbooks/callback", () => {
    it("handles successful QuickBooks OAuth callback", () => {
      return provider
        .given("valid QuickBooks OAuth parameters")
        .uponReceiving("a QuickBooks OAuth callback")
        .withRequest({
          method: "GET",
          path: "/api/integrations/quickbooks/callback",
          query: {
            code: like("auth-code"),
            state: like("state456"),
            realmId: like("realm123"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?success=QuickBooks"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/quickbooks/callback?code=auth-code&state=state456&realmId=realm123`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("success=");
        });
    });

    it("handles missing realmId parameter", () => {
      return provider
        .given("realmId parameter is missing")
        .uponReceiving("a QuickBooks OAuth callback without realmId")
        .withRequest({
          method: "GET",
          path: "/api/integrations/quickbooks/callback",
          query: {
            code: like("auth-code"),
            state: like("state456"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?error="),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/quickbooks/callback?code=auth-code&state=state456`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("error=");
        });
    });
  });

  describe("GET /api/integrations/xero/callback", () => {
    it("handles successful Xero OAuth callback", () => {
      return provider
        .given("valid Xero OAuth parameters")
        .uponReceiving("a Xero OAuth callback")
        .withRequest({
          method: "GET",
          path: "/api/integrations/xero/callback",
          query: {
            code: like("xero-code-xyz"),
            state: like("state789"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?success=Xero"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/xero/callback?code=xero-code-xyz&state=state789`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("success=");
        });
    });

    it("handles Xero OAuth error", () => {
      return provider
        .given("Xero OAuth error occurred")
        .uponReceiving("a Xero OAuth callback with error")
        .withRequest({
          method: "GET",
          path: "/api/integrations/xero/callback",
          query: {
            error: like("access_denied"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?error=declined"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/xero/callback?error=access_denied`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("error=");
        });
    });
  });

  describe("GET /api/integrations/mailchimp/callback", () => {
    it("handles successful Mailchimp OAuth callback", () => {
      return provider
        .given("valid Mailchimp OAuth parameters")
        .uponReceiving("a Mailchimp OAuth callback")
        .withRequest({
          method: "GET",
          path: "/api/integrations/mailchimp/callback",
          query: {
            code: like("mc-code-abc"),
            state: like("state111"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?success=Mailchimp"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/mailchimp/callback?code=mc-code-abc&state=state111`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("success=");
        });
    });

    it("handles missing state parameter", () => {
      return provider
        .given("state parameter is missing")
        .uponReceiving("a Mailchimp OAuth callback without state")
        .withRequest({
          method: "GET",
          path: "/api/integrations/mailchimp/callback",
          query: {
            code: like("mc-code-abc"),
          },
        })
        .willRespondWith({
          status: 302,
          headers: {
            Location: like("/integrations?error="),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/integrations/mailchimp/callback?code=mc-code-abc`,
            { redirect: "manual" }
          );

          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("error=");
        });
    });
  });
});
