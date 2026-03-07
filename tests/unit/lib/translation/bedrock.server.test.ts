import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  class MockBedrockRuntimeClient {
    send = mockSend;
  }
  class MockInvokeModelCommand {
    constructor(public input: unknown) {}
  }
  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    InvokeModelCommand: MockInvokeModelCommand,
  };
});

describe("translateText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns translated text from Bedrock response", async () => {
    const responseText = "Hola mundo";
    const encodedBody = new TextEncoder().encode(
      JSON.stringify({ content: [{ text: responseText }] })
    );
    mockSend.mockResolvedValueOnce({ body: encodedBody });

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText("Hello world", "en", "es");

    expect(result).toBe(responseText);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("retries on throttling error and succeeds on second attempt", async () => {
    const responseText = "Traducción exitosa";
    const encodedBody = new TextEncoder().encode(
      JSON.stringify({ content: [{ text: responseText }] })
    );

    const throttleError = Object.assign(new Error("Too Many Requests"), {
      name: "ThrottlingException",
    });

    mockSend
      .mockRejectedValueOnce(throttleError)
      .mockResolvedValueOnce({ body: encodedBody });

    // Speed up backoff in tests
    vi.spyOn(global, "setTimeout").mockImplementation((fn) => {
      (fn as () => void)();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText("Success text", "en", "es");

    expect(result).toBe(responseText);
    expect(mockSend).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("throws after exhausting retries on persistent throttling", async () => {
    const throttleError = Object.assign(new Error("ThrottlingException"), {
      name: "ThrottlingException",
    });

    mockSend.mockRejectedValue(throttleError);

    vi.spyOn(global, "setTimeout").mockImplementation((fn) => {
      (fn as () => void)();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );

    await expect(translateText("text", "en", "es")).rejects.toThrow();
    // 3 attempts total
    expect(mockSend).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
  });

  it("throws immediately on non-throttling errors without retrying", async () => {
    const otherError = new Error("Model not found");
    mockSend.mockRejectedValueOnce(otherError);

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );

    await expect(translateText("text", "en", "es")).rejects.toThrow(
      "Model not found"
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
