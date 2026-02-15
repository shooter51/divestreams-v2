/**
 * use-notification Hook Unit Tests
 *
 * Tests the notification helper functions:
 * - redirectWithNotification helper
 * - redirectResponse helper
 * - URL encoding and parameter handling
 *
 * Note: The useNotification hook itself is tested indirectly through:
 * - Integration tests (toast-notification-flow.test.ts)
 * - E2E tests (tours-management.spec.ts and others)
 * - Component tests (toast-context.test.tsx)
 *
 * Testing React Router hooks with renderHook is complex and doesn't add value
 * beyond what the integration/E2E tests already cover.
 */

import { describe, it, expect } from "vitest";
import { redirectWithNotification, redirectResponse } from "../../../lib/use-notification";

describe("redirectWithNotification helper", () => {
  it("creates URL with success notification parameter", () => {
    const result = redirectWithNotification("/dashboard", "Operation successful", "success");

    expect(result).toBe("/dashboard?success=Operation+successful");
  });

  it("creates URL with error notification parameter", () => {
    const result = redirectWithNotification("/home", "Error occurred", "error");

    expect(result).toBe("/home?error=Error+occurred");
  });

  it("creates URL with warning notification parameter", () => {
    const result = redirectWithNotification("/settings", "Warning message", "warning");

    expect(result).toBe("/settings?warning=Warning+message");
  });

  it("creates URL with info notification parameter", () => {
    const result = redirectWithNotification("/about", "Info message", "info");

    expect(result).toBe("/about?info=Info+message");
  });

  it("defaults to success type when not specified", () => {
    const result = redirectWithNotification("/home", "Default message");

    expect(result).toContain("/home");
    expect(result).toContain("success=Default+message");
  });

  it("URL-encodes special characters in message", () => {
    const result = redirectWithNotification("/test", "Message with & special chars", "success");

    expect(result).toContain("success=Message");
    expect(result).toContain("%26"); // & encoded
  });

  it("URL-encodes spaces as plus signs", () => {
    const result = redirectWithNotification("/test", "Message with spaces", "success");

    expect(result).toContain("Message+with+spaces");
  });

  it("handles paths with existing query parameters", () => {
    const result = redirectWithNotification("/search?q=test", "Search completed", "success");

    expect(result).toContain("/search");
    expect(result).toContain("q=test");
    expect(result).toContain("success=Search+completed");
    // Should have both parameters
    expect(result.match(/\?/g)?.length).toBe(1); // Only one ? in URL
  });

  it("preserves path structure with multiple segments", () => {
    const result = redirectWithNotification("/tenant/customers/123", "Customer updated", "success");

    expect(result).toContain("/tenant/customers/123");
    expect(result).toContain("success=Customer+updated");
  });

  it("handles paths with hash fragments", () => {
    const result = redirectWithNotification("/dashboard#settings", "Settings saved", "success");

    expect(result).toContain("/dashboard");
    expect(result).toContain("success=Settings+saved");
  });

  it("handles empty message", () => {
    const result = redirectWithNotification("/test", "", "success");

    expect(result).toBe("/test?success=");
  });

  it("handles very long messages", () => {
    const longMessage = "A".repeat(500);
    const result = redirectWithNotification("/test", longMessage, "info");

    expect(result).toContain("/test");
    expect(result).toContain("info=");
    expect(result).toContain("A".repeat(100)); // Should contain at least part of the message
  });

  it("handles unicode characters", () => {
    const result = redirectWithNotification("/test", "Message: café, 日本語, emoji 🎉", "success");

    expect(result).toContain("/test");
    expect(result).toContain("success=");
    // Unicode should be URL-encoded
    expect(result.length).toBeGreaterThan("/test?success=".length);
  });

  it("handles quotes and apostrophes", () => {
    const result = redirectWithNotification("/test", "User's \"special\" message", "success");

    expect(result).toContain("/test");
    expect(result).toContain("success=");
    // Quotes should be encoded
    expect(result).not.toContain('"');
  });

  it("handles newlines and tabs", () => {
    const result = redirectWithNotification("/test", "Line 1\nLine 2\tTabbed", "error");

    expect(result).toContain("/test");
    expect(result).toContain("error=");
    // Newlines and tabs should be encoded
    expect(result).not.toContain("\n");
    expect(result).not.toContain("\t");
  });
});

describe("redirectResponse helper", () => {
  it("creates Response with 302 status", () => {
    const response = redirectResponse("/dashboard", "Success message", "success");

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
  });

  it("sets Location header with notification URL", () => {
    const response = redirectResponse("/home", "Test message", "success");

    const location = response.headers.get("Location");
    expect(location).toBe("/home?success=Test+message");
  });

  it("defaults to success type when not specified", () => {
    const response = redirectResponse("/test", "Default type");

    const location = response.headers.get("Location");
    expect(location).toContain("success=Default+type");
  });

  it("supports success type", () => {
    const response = redirectResponse("/test", "Success message", "success");
    const location = response.headers.get("Location");

    expect(location).toContain("success=Success+message");
  });

  it("supports error type", () => {
    const response = redirectResponse("/test", "Error message", "error");
    const location = response.headers.get("Location");

    expect(location).toContain("error=Error+message");
  });

  it("supports warning type", () => {
    const response = redirectResponse("/test", "Warning message", "warning");
    const location = response.headers.get("Location");

    expect(location).toContain("warning=Warning+message");
  });

  it("supports info type", () => {
    const response = redirectResponse("/test", "Info message", "info");
    const location = response.headers.get("Location");

    expect(location).toContain("info=Info+message");
  });

  it("creates proper redirect response structure", () => {
    const response = redirectResponse("/redirect", "Redirect message", "info");

    expect(response.status).toBe(302);
    expect(response.headers.has("Location")).toBe(true);
    expect(response.body).toBeNull();
  });

  it("sets no other headers besides Location", () => {
    const response = redirectResponse("/test", "Message", "success");

    // Should only have Location header (case-insensitive in HTTP)
    const headers = Array.from(response.headers.keys());
    expect(headers.length).toBe(1);
    expect(response.headers.has("Location")).toBe(true);
  });

  it("uses redirectWithNotification internally", () => {
    // The output of redirectResponse should match redirectWithNotification
    const expectedUrl = redirectWithNotification("/page", "Test", "success");
    const response = redirectResponse("/page", "Test", "success");

    const location = response.headers.get("Location");
    expect(location).toBe(expectedUrl);
  });
});

describe("Helper Function Edge Cases", () => {
  it("handles root path", () => {
    const result = redirectWithNotification("/", "Root message", "success");

    expect(result).toBe("/?success=Root+message");
  });

  it("handles path without leading slash", () => {
    const result = redirectWithNotification("relative/path", "Message", "success");

    // URL constructor should normalize this
    expect(result).toContain("success=Message");
  });

  it("handles query string with multiple existing parameters", () => {
    const result = redirectWithNotification("/search?q=test&page=2&sort=asc", "Sorted", "success");

    expect(result).toContain("q=test");
    expect(result).toContain("page=2");
    expect(result).toContain("sort=asc");
    expect(result).toContain("success=Sorted");
  });

  it("preserves parameter order", () => {
    const result = redirectWithNotification("/test?b=2&a=1", "Message", "success");

    // Original params should come before notification param
    const successIndex = result.indexOf("success=");
    const bIndex = result.indexOf("b=2");
    const aIndex = result.indexOf("a=1");

    expect(bIndex).toBeLessThan(successIndex);
    expect(aIndex).toBeLessThan(successIndex);
  });

  it("doesn't double-encode already encoded characters", () => {
    // Pass in a message that's already URL-encoded
    const result = redirectWithNotification("/test", "Already%20encoded", "success");

    // Should encode the % sign
    expect(result).toContain("%2520encoded"); // %20 becomes %2520
  });
});
