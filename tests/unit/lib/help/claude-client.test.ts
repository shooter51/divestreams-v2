/**
 * Unit tests for lib/help/claude-client.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock @anthropic-ai/sdk using a class so `new Anthropic()` works
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_options: unknown) {}
  },
}));

import { callClaude } from "../../../../lib/help/claude-client";

const originalEnv = { ...process.env };

describe("callClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      callClaude({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        system: "You are a helper.",
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toThrow("ANTHROPIC_API_KEY environment variable is not set");
  });

  it("calls messages.create with the provided params", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello!" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const params = {
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: "You are a helper.",
      messages: [{ role: "user" as const, content: "hi" }],
    };

    await callClaude(params);

    expect(mockCreate).toHaveBeenCalledWith(params);
  });

  it("returns the response from messages.create", async () => {
    const expectedResponse = {
      content: [{ type: "text", text: "Here is your answer." }],
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    mockCreate.mockResolvedValue(expectedResponse);

    const result = await callClaude({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: "System prompt.",
      messages: [{ role: "user", content: "question" }],
    });

    expect(result).toEqual(expectedResponse);
  });

  it("propagates errors from the Anthropic API", async () => {
    mockCreate.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(
      callClaude({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        system: "System.",
        messages: [{ role: "user", content: "help" }],
      })
    ).rejects.toThrow("Rate limit exceeded");
  });
});
