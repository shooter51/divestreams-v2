/**
 * Marketing Features Route Tests
 *
 * Tests the features marketing page.
 */

import { describe, it, expect } from "vitest";
import { meta } from "../../../../app/routes/marketing/features";

describe("Route: marketing/features.tsx", () => {
  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "Features - DiveStreams" },
        { name: "description", content: "Explore all the features DiveStreams offers for dive shop management." },
      ]);
    });
  });
});
