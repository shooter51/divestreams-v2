/**
 * AWS Bedrock client for the help system.
 *
 * Uses the same Bedrock Converse API as the translation system.
 * Isolated in its own module so tests can mock it cleanly.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const HELP_MODEL_ID = process.env.HELP_MODEL_ID || "amazon.nova-micro-v1:0";

export interface ClaudeMessage {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
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

export async function callClaude(params: ClaudeMessage): Promise<ClaudeResponse> {
  const client = getClient();

  const command = new ConverseCommand({
    modelId: HELP_MODEL_ID,
    system: [{ text: params.system }],
    messages: params.messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.3,
    },
  });

  const response = await client.send(command);

  const text = response.output?.message?.content?.[0]?.text || "";

  return {
    content: [{ type: "text", text }],
  };
}
