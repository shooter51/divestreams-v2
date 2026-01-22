/**
 * Marketing Privacy Policy Route Tests
 *
 * Tests the privacy policy marketing page.
 */

import { describe, it, expect } from "vitest";
import { meta } from "../../../../app/routes/marketing/privacy";

describe("Route: marketing/privacy.tsx", () => {
  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "Privacy Policy - DiveStreams" },
        { name: "description", content: "Privacy Policy for DiveStreams dive shop management software." },
      ]);
    });
  });
});
