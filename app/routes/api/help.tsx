/**
 * AI Help API Route
 *
 * POST /api/help
 *
 * Accepts a user question, finds relevant help articles, and uses the Claude
 * API to generate a concise answer grounded in DiveStreams documentation.
 *
 * Rate limited to 20 questions per user per hour.
 */

import type { ActionFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import {
  loadHelpArticles,
  searchRelevantArticles,
  helpLogger,
} from "../../../lib/help/index";
import { callClaude } from "../../../lib/help/claude-client";
import { checkRateLimit } from "../../../lib/utils/rate-limit";

/** Rate limit: 20 questions per user per hour */
const HELP_RATE_LIMIT = {
  maxAttempts: 20,
  windowMs: 60 * 60 * 1000,
};

const SYSTEM_PROMPT = `You are a help assistant for DiveStreams dive shop management software. \
You ONLY answer questions about how to use DiveStreams features. \
If the user asks anything unrelated to DiveStreams (general knowledge, other products, personal questions, coding, etc.), \
politely decline and redirect them to ask about DiveStreams features instead. \
Example: "I can only help with DiveStreams features. Try asking me about bookings, tours, equipment, or settings!"

Do not answer questions about the underlying technology, API, database, or infrastructure. \
Only answer questions about using the product as an end user.

Answer the user's question using the provided help articles. \
Be concise and reference specific UI elements (menu names, button labels, page names). \
If the provided articles do not contain enough information to answer the question, say so honestly \
and suggest the user contact support.`;

/** Canned response when no relevant articles are found */
const NO_ARTICLES_RESPONSE =
  "I can help with DiveStreams features like bookings, tours, equipment, and settings. What would you like to know?";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Require authenticated org context
  let context;
  try {
    context = await requireOrgContext(request);
  } catch (err) {
    // For API routes, return JSON 401 instead of redirecting
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit per user
  const rateLimitKey = `help:${context.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, HELP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    helpLogger.warn(
      { userId: context.user.id, resetAt: rateLimit.resetAt },
      "Help API rate limit exceeded"
    );
    return Response.json(
      {
        error: "Too many requests. Please wait before asking another question.",
        resetAt: rateLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // Parse request body
  let question: string;
  try {
    const body = await request.json();
    question = typeof body?.question === "string" ? body.question.trim() : "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  if (question.length > 1000) {
    return Response.json({ error: "question must be 1000 characters or fewer" }, { status: 400 });
  }

  // Load articles and find relevant ones
  const articles = loadHelpArticles();
  const relevantArticles = searchRelevantArticles(question, articles);

  // If no relevant articles found, return canned response without calling Claude
  if (relevantArticles.length === 0) {
    helpLogger.debug(
      { userId: context.user.id, question: question.slice(0, 100) },
      "No relevant help articles found for query"
    );
    return Response.json({
      answer: NO_ARTICLES_RESPONSE,
      sources: [],
    });
  }

  // Build context block from relevant articles
  const articleContext = relevantArticles
    .map(
      (a, i) =>
        `## Article ${i + 1}: ${a.title}\nCategory: ${a.category}\n\n${a.content}`
    )
    .join("\n\n---\n\n");

  const userMessage = `The following DiveStreams help articles may be relevant to the user's question:\n\n${articleContext}\n\n---\n\nUser question: ${question}`;

  // Call Claude API
  try {
    const message = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const answerBlock = message.content.find((b) => b.type === "text");
    const answer = answerBlock?.type === "text" && answerBlock.text ? answerBlock.text : NO_ARTICLES_RESPONSE;

    helpLogger.debug(
      {
        userId: context.user.id,
        articleCount: relevantArticles.length,
      },
      "Help API response generated"
    );

    return Response.json({
      answer,
      sources: relevantArticles.map((a) => ({ title: a.title, path: a.path })),
    });
  } catch (err) {
    helpLogger.error(
      { err, userId: context.user.id },
      "Failed to generate help response from Claude API"
    );

    // If the Anthropic API key is missing, return a clear server error
    if (err instanceof Error && err.message.includes("AWS credentials")) {
      return Response.json(
        { error: "Help service is not configured" },
        { status: 503 }
      );
    }

    return Response.json(
      { error: "Failed to generate a response. Please try again." },
      { status: 500 }
    );
  }
}
