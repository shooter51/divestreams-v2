/**
 * Security Sanitization Tests
 *
 * Tests for XSS prevention and input sanitization functions.
 * These tests verify that all sanitization functions properly escape
 * or remove malicious content.
 */

import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  sanitizeUrl,
  sanitizeIframeEmbed,
} from "../../../../lib/security/sanitize";

describe("Security Sanitization", () => {
  describe("escapeHtml", () => {
    it("should escape basic HTML tags", () => {
      expect(escapeHtml("<script>alert('XSS')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should escape img tags with onerror", () => {
      expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
        "&lt;img src=x onerror=alert(1)&gt;"
      );
    });

    it("should escape HTML entities", () => {
      expect(escapeHtml(`& < > " ' /`)).toBe(
        "&amp; &lt; &gt; &quot; &#x27; &#x2F;"
      );
    });

    it("should handle empty strings", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle strings with no special characters", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });

    it("should escape multiple script tags", () => {
      expect(
        escapeHtml("<script>alert(1)</script><script>alert(2)</script>")
      ).toBe(
        "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;&lt;script&gt;alert(2)&lt;&#x2F;script&gt;"
      );
    });

    it("should escape nested HTML", () => {
      expect(escapeHtml("<div><span>text</span></div>")).toBe(
        "&lt;div&gt;&lt;span&gt;text&lt;&#x2F;span&gt;&lt;&#x2F;div&gt;"
      );
    });

    it("should escape event handlers", () => {
      expect(escapeHtml('onload="malicious()"')).toBe(
        "onload=&quot;malicious()&quot;"
      );
    });
  });

  describe("sanitizeUrl", () => {
    describe("safe URLs", () => {
      it("should allow HTTP URLs", () => {
        expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
      });

      it("should allow HTTPS URLs", () => {
        expect(sanitizeUrl("https://example.com")).toBe(
          "https://example.com"
        );
      });

      it("should allow relative URLs", () => {
        expect(sanitizeUrl("/path/to/page")).toBe("/path/to/page");
      });

      it("should allow mailto URLs", () => {
        expect(sanitizeUrl("mailto:test@example.com")).toBe(
          "mailto:test@example.com"
        );
      });

      it("should allow tel URLs", () => {
        expect(sanitizeUrl("tel:+1234567890")).toBe("tel:+1234567890");
      });

      it("should allow anchor links", () => {
        expect(sanitizeUrl("#section")).toBe("#section");
      });

      it("should preserve URL query parameters", () => {
        expect(sanitizeUrl("https://example.com?foo=bar&baz=qux")).toBe(
          "https://example.com?foo=bar&baz=qux"
        );
      });
    });

    describe("dangerous URLs", () => {
      it("should block javascript: protocol", () => {
        expect(sanitizeUrl("javascript:alert('XSS')")).toBe("about:blank");
      });

      it("should block data: protocol (default)", () => {
        expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe(
          "about:blank"
        );
      });

      it("should allow data: protocol when explicitly enabled", () => {
        expect(
          sanitizeUrl(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            true
          )
        ).toContain("data:image/png");
      });

      it("should block vbscript: protocol", () => {
        expect(sanitizeUrl("vbscript:alert(1)")).toBe("about:blank");
      });

      it("should block file: protocol", () => {
        expect(sanitizeUrl("file:///etc/passwd")).toBe("about:blank");
      });

      it("should handle case-insensitive javascript:", () => {
        expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("about:blank");
        expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBe("about:blank");
      });

      it("should handle URL-encoded javascript:", () => {
        expect(sanitizeUrl("java%73cript:alert(1)")).toBe("about:blank");
      });

      it("should block javascript: with whitespace", () => {
        expect(sanitizeUrl("java\\nscript:alert(1)")).toBe("about:blank");
        expect(sanitizeUrl("java\\tscript:alert(1)")).toBe("about:blank");
      });
    });

    describe("edge cases", () => {
      it("should handle empty string", () => {
        expect(sanitizeUrl("")).toBe("about:blank");
      });

      it("should handle null-like values", () => {
        expect(sanitizeUrl("null")).toBe("about:blank");
        expect(sanitizeUrl("undefined")).toBe("about:blank");
      });

      it("should handle URLs with fragments", () => {
        expect(sanitizeUrl("https://example.com#section")).toBe(
          "https://example.com#section"
        );
      });

      it("should handle international URLs", () => {
        expect(sanitizeUrl("https://例え.jp/パス")).toBe(
          "https://例え.jp/パス"
        );
      });
    });
  });

  describe("sanitizeIframeEmbed", () => {
    describe("Google Maps iframes", () => {
      it("should allow valid Google Maps embed", () => {
        const embed =
          '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).toContain("<iframe");
        expect(result).toContain("maps/embed");
      });

      it("should strip non-iframe tags", () => {
        const embed =
          '<script>alert(1)</script><iframe src="https://www.google.com/maps/embed?pb=test" width="600" height="450"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).not.toContain("<script");
        expect(result).toContain("<iframe");
      });

      it("should only allow HTTPS google.com domains", () => {
        const embedHttp =
          '<iframe src="http://www.google.com/maps/embed?pb=test"></iframe>';
        expect(sanitizeIframeEmbed(embedHttp)).toBe("");

        const embedHttps =
          '<iframe src="https://www.google.com/maps/embed?pb=test"></iframe>';
        expect(sanitizeIframeEmbed(embedHttps)).toContain("https://");
      });

      it("should reject non-google.com domains", () => {
        const embed =
          '<iframe src="https://evil.com/maps/embed?pb=test"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });

      it("should reject non-/maps/embed paths", () => {
        const embed = '<iframe src="https://www.google.com/search"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });
    });

    describe("YouTube iframes", () => {
      it("should allow valid YouTube embed", () => {
        const embed =
          '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).toContain("<iframe");
        expect(result).toContain("youtube.com/embed");
      });

      it("should allow youtube-nocookie.com domain", () => {
        const embed =
          '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).toContain("youtube-nocookie.com");
      });

      it("should reject non-/embed/ paths", () => {
        const embed =
          '<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });
    });

    describe("Vimeo iframes", () => {
      it("should allow valid Vimeo embed", () => {
        const embed =
          '<iframe src="https://player.vimeo.com/video/123456789" width="640" height="360" frameborder="0" allowfullscreen></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).toContain("<iframe");
        expect(result).toContain("player.vimeo.com/video");
      });

      it("should require player.vimeo.com domain", () => {
        const embed =
          '<iframe src="https://vimeo.com/123456789"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });
    });

    describe("XSS prevention", () => {
      it("should strip javascript: URLs in src", () => {
        const embed = '<iframe src="javascript:alert(1)"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });

      it("should strip data: URLs", () => {
        const embed =
          '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
        expect(sanitizeIframeEmbed(embed)).toBe("");
      });

      it("should remove onclick handlers", () => {
        const embed =
          '<iframe src="https://www.google.com/maps/embed?pb=test" onclick="alert(1)"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).not.toContain("onclick");
      });

      it("should remove onerror handlers", () => {
        const embed =
          '<iframe src="https://www.google.com/maps/embed?pb=test" onerror="alert(1)"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        expect(result).not.toContain("onerror");
      });
    });

    describe("edge cases", () => {
      it("should handle empty string", () => {
        expect(sanitizeIframeEmbed("")).toBe("");
      });

      it("should handle string without iframe", () => {
        expect(sanitizeIframeEmbed("<div>Hello</div>")).toBe("");
      });

      it("should handle malformed HTML", () => {
        expect(sanitizeIframeEmbed("<iframe src=")).toBe("");
      });

      it("should handle multiple iframes (only first one)", () => {
        const embed =
          '<iframe src="https://www.google.com/maps/embed?pb=1"></iframe><iframe src="https://www.google.com/maps/embed?pb=2"></iframe>';
        const result = sanitizeIframeEmbed(embed);
        // Should only contain one iframe
        const iframeCount = (result.match(/<iframe/g) || []).length;
        expect(iframeCount).toBeLessThanOrEqual(1);
      });
    });
  });
});
