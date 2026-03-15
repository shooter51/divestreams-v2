/**
 * Unit tests for lib/help/claude-client.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

// Mock @aws-sdk/client-bedrock-runtime
vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: class MockBedrockRuntimeClient {
    send = mockSend;
    constructor(_options: unknown) {}
  },
  ConverseCommand: class MockConverseCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { callClaude } from "../../../../lib/help/claude-client";

const originalEnv = { ...process.env };

describe("callClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      AWS_ACCESS_KEY_ID: "test-key",
      AWS_SECRET_ACCESS_KEY: "test-secret",
      AWS_REGION: "us-east-1",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when AWS credentials are not set", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await expect(
      callClaude({
        system: "You are a helper.",
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toThrow("AWS credentials not configured");
  });

  it("sends a ConverseCommand with the provided params", async () => {
    mockSend.mockResolvedValue({
      output: {
        message: {
          content: [{ text: "Hello!" }],
        },
      },
    });

    const params = {
      system: "You are a helper.",
      messages: [{ role: "user" as const, content: "hi" }],
    };

    await callClaude(params);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toMatchObject({
      modelId: "amazon.nova-micro-v1:0",
      system: [{ text: "You are a helper." }],
      messages: [{ role: "user", content: [{ text: "hi" }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
    });
  });

  it("returns normalized response from Bedrock Converse API", async () => {
    mockSend.mockResolvedValue({
      output: {
        message: {
          content: [{ text: "Here is your answer." }],
        },
      },
    });

    const result = await callClaude({
      system: "System prompt.",
      messages: [{ role: "user", content: "question" }],
    });

    expect(result).toEqual({
      content: [{ type: "text", text: "Here is your answer." }],
    });
  });

  it("propagates errors from the Bedrock API", async () => {
    mockSend.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(
      callClaude({
        system: "System.",
        messages: [{ role: "user", content: "help" }],
      })
    ).rejects.toThrow("Rate limit exceeded");
  });
});
