/**
 * Integration tests for app/routes/api/help.tsx
 *
 * Tests the full action handler flow with mocked external dependencies
 * (org context, help loader, Claude client, rate limiter).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/help/index", () => ({
  loadHelpArticles: vi.fn(),
  searchRelevantArticles: vi.fn(),
  helpLogger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("../../../../lib/help/claude-client", () => ({
  callClaude: vi.fn(),
}));

import { action } from "../../../../app/routes/api/help";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { loadHelpArticles, searchRelevantArticles } from "../../../../lib/help/index";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";
import { callClaude } from "../../../../lib/help/claude-client";

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockLoadHelpArticles = vi.mocked(loadHelpArticles);
const mockSearchRelevantArticles = vi.mocked(searchRelevantArticles);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCallClaude = vi.mocked(callClaude);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(userId = "integration-user") {
  return {
    user: { id: userId, email: "user@test.com", name: "Test" },
    org: { id: "org-int", slug: "testorg", name: "Test Org" },
    session: { id: "session-int" },
  };
}

function makeArticle(title: string, category: string, content: string) {
  return { title, category, tags: [], order: 0, content, path: `docs/help/${title.toLowerCase().replace(/ /g, "-")}.md` };
}

function post(body: unknown): Request {
  return new Request("http://testorg.localhost:3000/api/help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Help API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockRequireOrgContext.mockResolvedValue(makeContext() as never);
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: Date.now() + 3600000 });
  });

  describe("full happy-path flow", () => {
    it("returns answer and sources for a matched question", async () => {
      const articles = [
        makeArticle("Creating Bookings", "Bookings", "Go to Bookings > New Booking."),
        makeArticle("Managing Customers", "Customers", "Find customers in the Customers section."),
      ];
      mockLoadHelpArticles.mockReturnValue(articles);
      mockSearchRelevantArticles.mockReturnValue([articles[0]]);
      mockCallClaude.mockResolvedValue({
        content: [{ type: "text", text: "Go to the Bookings page and click New Booking." }],
        usage: { input_tokens: 150, output_tokens: 30 },
      } as never);

      const response = await action({ request: post({ question: "How do I create a booking?" }), params: {}, context: {} });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.answer).toBe("Go to the Bookings page and click New Booking.");
      expect(data.sources).toHaveLength(1);
      expect(data.sources[0].title).toBe("Creating Bookings");
    });

    it("passes all article context to Claude", async () => {
      const articles = [
        makeArticle("Tour Setup", "Tours", "Tours are configured in the Tours section."),
        makeArticle("Tour Pricing", "Tours", "Set tour prices under tour settings."),
      ];
      mockLoadHelpArticles.mockReturnValue(articles);
      mockSearchRelevantArticles.mockReturnValue(articles);
      mockCallClaude.mockResolvedValue({
        content: [{ type: "text", text: "Tours are managed from the Tours section." }],
        usage: { input_tokens: 200, output_tokens: 25 },
      } as never);

      await action({ request: post({ question: "tours help" }), params: {}, context: {} });

      const callArgs = mockCallClaude.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain("Tour Setup");
      expect(callArgs.messages[0].content).toContain("Tour Pricing");
      expect(callArgs.messages[0].content).toContain("tours help");
    });
  });

  describe("no articles matched", () => {
    it("returns canned response and does not call Claude", async () => {
      mockLoadHelpArticles.mockReturnValue([]);
      mockSearchRelevantArticles.mockReturnValue([]);

      const response = await action({ request: post({ question: "unrelated random query" }), params: {}, context: {} });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.answer).toContain("I can help with DiveStreams features");
      expect(data.sources).toHaveLength(0);
      expect(mockCallClaude).not.toHaveBeenCalled();
    });
  });

  describe("rate limiting integration", () => {
    it("blocks request and does not call Claude when rate limit hit", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

      const response = await action({ request: post({ question: "help" }), params: {}, context: {} });

      expect(response.status).toBe(429);
      expect(mockCallClaude).not.toHaveBeenCalled();
    });
  });

  describe("error scenarios", () => {
    it("returns 500 when Claude API fails unexpectedly", async () => {
      mockLoadHelpArticles.mockReturnValue([makeArticle("Bookings", "Bookings", "content")]);
      mockSearchRelevantArticles.mockReturnValue([makeArticle("Bookings", "Bookings", "content")]);
      mockCallClaude.mockRejectedValue(new Error("Upstream timeout"));

      const response = await action({ request: post({ question: "bookings" }), params: {}, context: {} });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("returns 503 when API key error is thrown", async () => {
      mockLoadHelpArticles.mockReturnValue([makeArticle("Bookings", "Bookings", "content")]);
      mockSearchRelevantArticles.mockReturnValue([makeArticle("Bookings", "Bookings", "content")]);
      mockCallClaude.mockRejectedValue(new Error("ANTHROPIC_API_KEY environment variable is not set"));

      const response = await action({ request: post({ question: "bookings" }), params: {}, context: {} });

      expect(response.status).toBe(503);
    });
  });
});
