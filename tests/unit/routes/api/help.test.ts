/**
 * Unit tests for app/routes/api/help.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/help/index", () => ({
  loadHelpArticles: vi.fn(),
  searchRelevantArticles: vi.fn(),
  helpLogger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("../../../../lib/help/claude-client", () => ({
  callClaude: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { action } from "../../../../app/routes/api/help";
import type { HelpArticle } from "../../../../lib/help/index";
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

function makeOrgContext(userId = "user-1") {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com" },
    org: { id: "org-1", name: "Test Org", slug: "test" },
    session: { id: "session-1" },
  };
}

function makeArticle(overrides: Partial<HelpArticle> = {}): HelpArticle {
  return {
    title: "Managing Bookings",
    category: "Bookings",
    tags: ["bookings"],
    order: 1,
    content: "To create a booking, go to the Bookings page.",
    path: "docs/help/bookings.md",
    ...overrides,
  };
}

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("http://demo.localhost:3000/api/help", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClaudeResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Help API — action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockRequireOrgContext.mockResolvedValue(makeOrgContext() as never);
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: Date.now() + 3600000 });
    mockLoadHelpArticles.mockReturnValue([makeArticle()]);
    mockSearchRelevantArticles.mockReturnValue([makeArticle()]);
    mockCallClaude.mockResolvedValue(makeClaudeResponse("You can create bookings from the Bookings page.") as never);
  });

  describe("method validation", () => {
    it("returns 405 for GET requests", async () => {
      const request = new Request("http://demo.localhost:3000/api/help", { method: "GET" });
      const response = await action({ request, params: {}, context: {} });
      expect(response.status).toBe(405);
    });

    it("returns 405 for PUT requests", async () => {
      const request = new Request("http://demo.localhost:3000/api/help", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "test" }),
      });
      const response = await action({ request, params: {}, context: {} });
      expect(response.status).toBe(405);
    });
  });

  describe("authentication", () => {
    it("re-throws redirect from requireOrgContext", async () => {
      const redirectResponse = new Response(null, { status: 302, headers: { Location: "/auth/login" } });
      mockRequireOrgContext.mockRejectedValue(redirectResponse);

      await expect(
        action({ request: makeRequest({ question: "help" }), params: {}, context: {} })
      ).rejects.toBe(redirectResponse);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      const resetAt = Date.now() + 3600000;
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt });

      const response = await action({ request: makeRequest({ question: "help me" }), params: {}, context: {} });
      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain("Too many requests");
      expect(data.resetAt).toBe(resetAt);
    });

    it("uses user ID as rate limit key", async () => {
      await action({ request: makeRequest({ question: "help" }), params: {}, context: {} });
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "help:user-1",
        { maxAttempts: 20, windowMs: 3600000 }
      );
    });
  });

  describe("input validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const request = new Request("http://demo.localhost:3000/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const response = await action({ request, params: {}, context: {} });
      expect(response.status).toBe(400);
    });

    it("returns 400 when question is missing", async () => {
      const response = await action({ request: makeRequest({}), params: {}, context: {} });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("question is required");
    });

    it("returns 400 when question is empty string", async () => {
      const response = await action({ request: makeRequest({ question: "  " }), params: {}, context: {} });
      expect(response.status).toBe(400);
    });

    it("returns 400 when question exceeds 1000 characters", async () => {
      const response = await action({
        request: makeRequest({ question: "a".repeat(1001) }),
        params: {},
        context: {},
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("1000 characters");
    });

    it("accepts a valid question at exactly 1000 characters", async () => {
      const response = await action({
        request: makeRequest({ question: "a".repeat(1000) }),
        params: {},
        context: {},
      });
      expect(response.status).not.toBe(400);
    });
  });

  describe("no relevant articles found", () => {
    it("returns canned response without calling Claude", async () => {
      mockSearchRelevantArticles.mockReturnValue([]);

      const response = await action({ request: makeRequest({ question: "what is the weather?" }), params: {}, context: {} });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.answer).toContain("I can help with DiveStreams features");
      expect(data.sources).toEqual([]);
      expect(mockCallClaude).not.toHaveBeenCalled();
    });
  });

  describe("successful response", () => {
    it("returns answer and sources when articles are found", async () => {
      const articles = [
        makeArticle({ title: "Managing Bookings", path: "docs/help/bookings.md" }),
        makeArticle({ title: "Tour Setup", path: "docs/help/tours.md", category: "Tours" }),
      ];
      mockSearchRelevantArticles.mockReturnValue(articles);
      mockCallClaude.mockResolvedValue(makeClaudeResponse("Go to Bookings page to create a booking.") as never);

      const response = await action({ request: makeRequest({ question: "how do I add a booking?" }), params: {}, context: {} });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.answer).toBe("Go to Bookings page to create a booking.");
      expect(data.sources).toHaveLength(2);
      expect(data.sources[0]).toEqual({ title: "Managing Bookings", path: "docs/help/bookings.md" });
    });

    it("calls Claude with haiku model", async () => {
      await action({ request: makeRequest({ question: "how do I add a booking?" }), params: {}, context: {} });
      expect(mockCallClaude).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-haiku-4-5" })
      );
    });

    it("includes relevant article content in Claude user message", async () => {
      const article = makeArticle({ title: "Booking Guide", content: "Detailed booking instructions." });
      mockSearchRelevantArticles.mockReturnValue([article]);

      await action({ request: makeRequest({ question: "bookings help" }), params: {}, context: {} });

      const callArgs = mockCallClaude.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain("Booking Guide");
      expect(userMessage).toContain("Detailed booking instructions.");
    });

    it("includes DiveStreams-only guardrails in system prompt", async () => {
      await action({ request: makeRequest({ question: "bookings" }), params: {}, context: {} });

      const callArgs = mockCallClaude.mock.calls[0][0];
      expect(callArgs.system).toContain("DiveStreams");
      expect(callArgs.system).toContain("ONLY answer questions");
    });
  });

  describe("Claude API error handling", () => {
    it("returns 503 when ANTHROPIC_API_KEY is not configured", async () => {
      mockCallClaude.mockRejectedValue(new Error("ANTHROPIC_API_KEY environment variable is not set"));

      const response = await action({ request: makeRequest({ question: "help" }), params: {}, context: {} });
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain("not configured");
    });

    it("returns 500 when Claude API call fails", async () => {
      mockCallClaude.mockRejectedValue(new Error("Network error"));

      const response = await action({ request: makeRequest({ question: "help" }), params: {}, context: {} });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Failed to generate");
    });
  });
});
