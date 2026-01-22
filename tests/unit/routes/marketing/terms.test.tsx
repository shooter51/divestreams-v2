/**
 * Marketing Terms of Service Route Tests
 *
 * Tests the terms of service marketing page.
 */

import { describe, it, expect } from "vitest";
import { meta } from "../../../../app/routes/marketing/terms";

describe("Route: marketing/terms.tsx", () => {
  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "Terms of Service - DiveStreams" },
        { name: "description", content: "Terms of Service for DiveStreams dive shop management software." },
      ]);
    });
  });
});
