/**
 * Help Article Loader
 *
 * Reads markdown help articles from docs/help/ recursively, parses frontmatter,
 * and provides keyword-based search for finding relevant articles.
 *
 * Articles are cached in memory after first load — they only change on deploy.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { logger } from "../logger";

export const helpLogger = logger.child({ module: "help" });

export interface HelpArticle {
  title: string;
  category: string;
  tags: string[];
  order: number;
  content: string;
  path: string;
}

/** In-memory cache — populated on first call, lives for the process lifetime */
let articleCache: HelpArticle[] | null = null;

/**
 * Parse YAML-style frontmatter from markdown content.
 *
 * Supports the subset of YAML used by help articles:
 *   title, category, tags (array or comma-separated), order (number)
 *
 * Returns the parsed fields and the body content after the closing `---`.
 */
function parseFrontmatter(raw: string): {
  title: string;
  category: string;
  tags: string[];
  order: number;
  body: string;
} {
  const defaults = { title: "", category: "General", tags: [] as string[], order: 0, body: raw };

  if (!raw.startsWith("---")) {
    return defaults;
  }

  const endIndex = raw.indexOf("\n---", 3);
  if (endIndex === -1) {
    return defaults;
  }

  const frontmatter = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 4).trimStart();

  let title = "";
  let category = "General";
  let tags: string[] = [];
  let order = 0;

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "title") {
      title = value.replace(/^["']|["']$/g, "");
    } else if (key === "category") {
      category = value.replace(/^["']|["']$/g, "") || "General";
    } else if (key === "tags") {
      // Support both inline array `[a, b]` and comma-separated `a, b`
      const cleaned = value.replace(/^\[|\]$/g, "");
      tags = cleaned
        .split(",")
        .map((t) => t.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (key === "order") {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) order = parsed;
    }
  }

  return { title, category, tags, order, body };
}

/**
 * Recursively collect all `.md` file paths under a directory.
 */
function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: "utf8" }) as string[];
  } catch {
    // Directory does not exist — return empty
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load all help articles from docs/help/ and cache them in memory.
 *
 * Safe to call multiple times — returns the cached result after the first load.
 * Handles a missing or empty docs/help/ directory gracefully.
 */
export function loadHelpArticles(): HelpArticle[] {
  if (articleCache !== null) {
    return articleCache;
  }

  const helpDir = join(process.cwd(), "docs", "help");
  const files = collectMarkdownFiles(helpDir);

  if (files.length === 0) {
    helpLogger.debug({ helpDir }, "No help articles found — docs/help/ is empty or missing");
    articleCache = [];
    return articleCache;
  }

  const articles: HelpArticle[] = [];

  for (const filePath of files) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const { title, category, tags, order, body } = parseFrontmatter(raw);

      // Use the filename as fallback title if frontmatter has none
      const resolvedTitle =
        title || filePath.split("/").pop()!.replace(/\.md$/, "").replace(/-/g, " ");

      articles.push({
        title: resolvedTitle,
        category,
        tags,
        order,
        content: body,
        path: relative(process.cwd(), filePath),
      });
    } catch (err) {
      helpLogger.warn({ err, filePath }, "Failed to parse help article");
    }
  }

  // Sort by category then order within category
  articles.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    return catCmp !== 0 ? catCmp : a.order - b.order;
  });

  helpLogger.debug({ count: articles.length }, "Help articles loaded");
  articleCache = articles;
  return articleCache;
}

/**
 * Reset the in-memory cache. Useful in tests.
 */
export function resetHelpArticleCache(): void {
  articleCache = null;
}

/**
 * Score an article against a query using simple keyword matching.
 *
 * Scoring rules (higher = more relevant):
 *   - Title match: +10 per matching word
 *   - Tag match: +8 per matching tag
 *   - Category match: +5 per matching word
 *   - Content match: +1 per occurrence (capped at 20)
 */
function scoreArticle(article: HelpArticle, queryTerms: string[]): number {
  let score = 0;
  const titleLower = article.title.toLowerCase();
  const categoryLower = article.category.toLowerCase();
  const tagsLower = article.tags.map((t) => t.toLowerCase());
  const contentLower = article.content.toLowerCase();

  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 10;

    for (const tag of tagsLower) {
      if (tag.includes(term) || term.includes(tag)) score += 8;
    }

    if (categoryLower.includes(term)) score += 5;

    // Count occurrences in content, capped to avoid large articles always winning
    let pos = 0;
    let occurrences = 0;
    while (occurrences < 20) {
      const idx = contentLower.indexOf(term, pos);
      if (idx === -1) break;
      occurrences++;
      pos = idx + 1;
    }
    score += occurrences;
  }

  return score;
}

/**
 * Find the most relevant help articles for a user's question.
 *
 * Returns 3–5 articles sorted by relevance score (highest first).
 * Returns an empty array if no articles score above zero.
 */
export function searchRelevantArticles(
  query: string,
  articles: HelpArticle[]
): HelpArticle[] {
  if (articles.length === 0) return [];

  // Tokenise query: lowercase, remove punctuation, split on whitespace, drop stop words
  const stopWords = new Set([
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "for", "of", "and",
    "or", "but", "i", "my", "me", "how", "do", "can", "what", "where", "when",
    "why", "which", "who", "that", "this", "with", "from", "by", "be", "are",
    "was", "were", "will", "would", "should", "could",
  ]);

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  if (queryTerms.length === 0) return [];

  const scored = articles
    .map((article) => ({ article, score: scoreArticle(article, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top 3–5 results
  return scored.slice(0, 5).map(({ article }) => article);
}
