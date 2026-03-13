import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = process.env.TRANSLATION_MODEL_ID || "amazon.nova-micro-v1:0";

/**
 * Strip HTML tags from text. Bedrock sometimes wraps plain-text translations
 * in <p>, <br>, <span>, etc. tags that should not appear in entity names.
 */
export function stripHtmlTags(text: string): string {
  // Remove all HTML tags (opening, closing, self-closing)
  return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

/**
 * Remove the original source text if the model concatenated it with the
 * translation (e.g. "Descubre el Buceo Discovery Scuba Diving" when
 * translating "Discovery Scuba Diving" → "Descubre el Buceo").
 *
 * Detects cases where the original text appears as a suffix or prefix
 * of the translated output and removes it.
 */
export function removeSourceContamination(
  translated: string,
  original: string
): string {
  if (!original || !translated) return translated;

  const trimmedOriginal = original.trim();
  const trimmedTranslated = translated.trim();

  // If they're the same, assume no translation was needed
  if (trimmedTranslated === trimmedOriginal) return trimmedTranslated;

  // Check if original appears as a suffix (most common pattern)
  if (
    trimmedTranslated.length > trimmedOriginal.length &&
    trimmedTranslated.endsWith(trimmedOriginal)
  ) {
    return trimmedTranslated.slice(0, -trimmedOriginal.length).trim();
  }

  // Check if original appears as a prefix
  if (
    trimmedTranslated.length > trimmedOriginal.length &&
    trimmedTranslated.startsWith(trimmedOriginal)
  ) {
    return trimmedTranslated.slice(trimmedOriginal.length).trim();
  }

  return trimmedTranslated;
}

let cachedClient: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (cachedClient) return cachedClient;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.");
  }
  cachedClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/**
 * Translate text from one locale to another using AWS Bedrock.
 * Uses the Converse API for model-agnostic compatibility (works with Claude, Nova, etc.).
 * Implements exponential backoff for throttling errors (3 retries).
 */
export async function translateText(
  text: string,
  fromLocale: string,
  toLocale: string
): Promise<string> {
  const client = getClient();

  const MAX_RETRIES = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        system: [
          {
            text: "You are a professional translator. Translate the given text accurately and naturally. Preserve any HTML tags and formatting exactly as they appear. Return only the translated text with no additional commentary or explanation.",
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: `Translate the following text from ${fromLocale} to ${toLocale}:\n\n${text}`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 4096,
        },
      });

      const response = await client.send(command);
      const outputContent = response.output?.message?.content;
      if (!outputContent || outputContent.length === 0) {
        throw new Error("Empty response from Bedrock");
      }
      let result = outputContent[0].text as string;
      // Post-process: strip HTML tags that Bedrock may have added
      result = stripHtmlTags(result);
      // Post-process: remove source text contamination (concatenation)
      result = removeSourceContamination(result, text);
      return result;
    } catch (error) {
      const err = error as { name?: string; message?: string };
      const isThrottling =
        err.name === "ThrottlingException" ||
        err.message?.includes("throttl") ||
        err.message?.includes("Too Many Requests");

      if (isThrottling && attempt < MAX_RETRIES - 1) {
        lastError = error as Error;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Translation failed after retries");
}
