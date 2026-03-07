import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

let cachedClient: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (cachedClient) return cachedClient;
  cachedClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

/**
 * Translate text from one locale to another using AWS Bedrock Claude Haiku.
 * Implements exponential backoff for throttling errors (3 retries).
 */
export async function translateText(
  text: string,
  fromLocale: string,
  toLocale: string
): Promise<string> {
  const client = getClient();

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    system:
      "You are a professional translator. Translate the given text accurately and naturally. Preserve any HTML tags and formatting exactly as they appear. Return only the translated text with no additional commentary or explanation.",
    messages: [
      {
        role: "user",
        content: `Translate the following text from ${fromLocale} to ${toLocale}:\n\n${text}`,
      },
    ],
  });

  const MAX_RETRIES = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body,
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text as string;
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
