/**
 * Anthropic Claude client for the help system.
 *
 * Isolated in its own module so tests can mock it cleanly.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeMessage {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callClaude(params: ClaudeMessage): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });
  return client.messages.create(params) as Promise<ClaudeResponse>;
}
