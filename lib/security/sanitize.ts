/**
 * Security Utilities - XSS Protection and Input Sanitization
 *
 * Provides functions to sanitize user-generated HTML content
 * and validate URLs to prevent XSS attacks.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content for safe rendering
 * Used for CMS content blocks that accept rich text/HTML
 */
export function sanitizeHtml(html: string, allowedTags?: string[]): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags || [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize and validate iframe embeds (e.g., Google Maps)
 * Only allows iframes from trusted domains
 * Works in both browser and server environments
 */
export function sanitizeIframeEmbed(html: string): string {
  // Whitelist of allowed iframe domains and paths
  const allowedDomains = [
    "google.com/maps",
    "maps.google.com",
    "openstreetmap.org",
    "youtube.com/embed",
    "youtube-nocookie.com/embed",
    "vimeo.com/video",
  ];

  // First pass: sanitize with DOMPurify (allows only iframes)
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["iframe"],
    ALLOWED_ATTR: ["src", "width", "height", "frameborder", "allowfullscreen", "style", "loading"],
  });

  // Extract src attribute using regex (works in both server and browser)
  const srcMatch = sanitized.match(/src=["']([^"']+)["']/);

  if (!srcMatch) {
    return ""; // No src attribute found
  }

  const src = srcMatch[1];

  // Only allow HTTPS for embeds
  if (!src.startsWith("https://")) {
    return ""; // Must use HTTPS
  }

  // Validate src is from an allowed domain
  const isAllowed = allowedDomains.some((domain) => src.includes(domain));

  if (!isAllowed) {
    return ""; // Domain not in whitelist
  }

  // Count iframes (must be exactly one)
  const iframeCount = (sanitized.match(/<iframe/g) || []).length;

  if (iframeCount !== 1) {
    return ""; // Must have exactly one iframe
  }

  return sanitized;
}

/**
 * Validate and sanitize URLs to prevent javascript: protocol and other dangerous URLs
 * Allows http:, https:, mailto:, tel:, and relative URLs by default
 * Returns "about:blank" for dangerous/invalid URLs
 */
export function sanitizeUrl(url: string, allowDataUrls = false): string {
  if (!url || typeof url !== "string") {
    return "about:blank";
  }

  // Normalize and trim
  const trimmed = url.trim();

  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return "about:blank";
  }

  try {
    // Decode URL encoding and normalize for dangerous protocol detection
    let normalized = trimmed.toLowerCase().replace(/\s/g, '');

    // Decode common URL encodings that might be used to obfuscate protocols
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // If decoding fails, continue with the original
    }

    // Remove any remaining whitespace after decoding
    normalized = normalized.replace(/\s/g, '');

    const dangerousProtocols = ['javascript:', 'vbscript:', 'file:'];
    if (!allowDataUrls) {
      dangerousProtocols.push('data:');
    }

    for (const protocol of dangerousProtocols) {
      if (normalized.startsWith(protocol) || normalized.includes(protocol)) {
        return "about:blank";
      }
    }

    // Try to parse as URL
    const parsed = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "https://divestreams.com");

    // Allow safe protocols
    const safeProtocols = ["http:", "https:", "mailto:", "tel:", ""];
    if (allowDataUrls) {
      safeProtocols.push("data:");
    }

    if (!safeProtocols.includes(parsed.protocol)) {
      return "about:blank";
    }

    return trimmed;
  } catch {
    // Invalid URL format
    return "about:blank";
  }
}

/**
 * Escape HTML special characters for email templates
 * Prevents XSS in HTML emails
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Redact sensitive data for logging
 * Prevents PII/credentials from appearing in logs
 */
export function redactSensitiveData(data: string): string {
  return data
    .replace(/sk_[a-z]+_[a-zA-Z0-9]+/g, "sk_***") // Stripe secret keys
    .replace(/pk_[a-z]+_[a-zA-Z0-9]+/g, "pk_***") // Stripe publishable keys
    .replace(/whsec_[a-zA-Z0-9]+/g, "whsec_***") // Webhook secrets
    .replace(/cus_[a-zA-Z0-9]+/g, "cus_***") // Customer IDs
    .replace(/pi_[a-zA-Z0-9]+/g, "pi_***") // Payment intent IDs
    .replace(/sub_[a-zA-Z0-9]+/g, "sub_***") // Subscription IDs
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***"); // Email addresses
}
