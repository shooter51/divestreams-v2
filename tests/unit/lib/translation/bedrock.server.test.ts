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
  class MockConverseCommand {
    constructor(public input: unknown) {}
  }
  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    ConverseCommand: MockConverseCommand,
  };
});

function makeConverseResponse(text: string) {
  return {
    output: {
      message: {
        content: [{ text }],
      },
    },
  };
}

// ============================================================================
// stripHtmlTags
// ============================================================================

describe("stripHtmlTags", () => {
  it("strips <p> tags from text", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("<p>Snorkel Safari</p>")).toBe("Snorkel Safari");
  });

  it("strips nested and multiple HTML tags", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("<div><p>Hello <strong>World</strong></p></div>")).toBe(
      "Hello World"
    );
  });

  it("strips self-closing tags like <br/>", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("Line one<br/>Line two")).toBe("Line oneLine two");
  });

  it("strips <br> tags without closing slash", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("Line one<br>Line two")).toBe("Line oneLine two");
  });

  it("strips tags with attributes", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      stripHtmlTags('<span class="bold">Texto</span>')
    ).toBe("Texto");
  });

  it("passes plain text through unchanged", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("Just plain text")).toBe("Just plain text");
  });

  it("handles empty string", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("")).toBe("");
  });

  it("handles malformed/unclosed HTML", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("<p>Unclosed paragraph")).toBe("Unclosed paragraph");
  });

  it("trims whitespace after stripping tags", async () => {
    const { stripHtmlTags } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(stripHtmlTags("  <p> Safari </p>  ")).toBe("Safari");
  });
});

// ============================================================================
// removeSourceContamination
// ============================================================================

describe("removeSourceContamination", () => {
  it("removes original text appended as suffix", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination(
        "Descubre el Buceo Discovery Scuba Diving",
        "Discovery Scuba Diving"
      )
    ).toBe("Descubre el Buceo");
  });

  it("removes original text prepended as prefix", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination(
        "Discovery Scuba Diving Descubre el Buceo",
        "Discovery Scuba Diving"
      )
    ).toBe("Descubre el Buceo");
  });

  it("returns translated text unchanged when no contamination", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination("Descubre el Buceo", "Discovery Scuba Diving")
    ).toBe("Descubre el Buceo");
  });

  it("returns translated text unchanged when same as original", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination("PADI", "PADI")
    ).toBe("PADI");
  });

  it("handles empty original text", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination("Translated text", "")
    ).toBe("Translated text");
  });

  it("handles empty translated text", async () => {
    const { removeSourceContamination } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    expect(
      removeSourceContamination("", "Original text")
    ).toBe("");
  });
});

// ============================================================================
// translateText
// ============================================================================

describe("translateText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns translated text from Bedrock response", async () => {
    mockSend.mockResolvedValueOnce(makeConverseResponse("Hola mundo"));

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText("Hello world", "en", "es");

    expect(result).toBe("Hola mundo");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("strips HTML tags from Bedrock response", async () => {
    mockSend.mockResolvedValueOnce(
      makeConverseResponse("<p>Snorkel Safari</p>")
    );

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText("Snorkel Safari", "en", "es");

    expect(result).toBe("Snorkel Safari");
  });

  it("strips HTML and removes source contamination together", async () => {
    mockSend.mockResolvedValueOnce(
      makeConverseResponse(
        "<p>Descubre el Buceo Discovery Scuba Diving</p>"
      )
    );

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText(
      "Discovery Scuba Diving",
      "en",
      "es"
    );

    expect(result).toBe("Descubre el Buceo");
  });

  it("removes source text concatenated as suffix", async () => {
    mockSend.mockResolvedValueOnce(
      makeConverseResponse(
        "Descubre el Buceo Discovery Scuba Diving"
      )
    );

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText(
      "Discovery Scuba Diving",
      "en",
      "es"
    );

    expect(result).toBe("Descubre el Buceo");
  });

  it("retries on throttling error and succeeds on second attempt", async () => {
    const throttleError = Object.assign(new Error("Too Many Requests"), {
      name: "ThrottlingException",
    });

    mockSend
      .mockRejectedValueOnce(throttleError)
      .mockResolvedValueOnce(makeConverseResponse("Traduccion exitosa"));

    // Speed up backoff in tests
    vi.spyOn(global, "setTimeout").mockImplementation((fn) => {
      (fn as () => void)();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const { translateText } = await import(
      "../../../../lib/translation/bedrock.server"
    );
    const result = await translateText("Success text", "en", "es");

    expect(result).toBe("Traduccion exitosa");
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
