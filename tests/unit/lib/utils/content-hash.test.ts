import { describe, it, expect } from "vitest";
import { generateContentHash } from "../../../../lib/utils/content-hash.server";

describe("generateContentHash", () => {
  it("should generate consistent hash for same content", () => {
    const template = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: ["img1.jpg"],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: "None",
      minAge: 10,
      medicalRequirements: "Medical form required",
      requiredItems: ["mask", "fins"],
      materialsIncluded: true,
    };

    const hash1 = generateContentHash(template);
    const hash2 = generateContentHash(template);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  it("should generate different hash when content changes", () => {
    const template1 = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: [],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: null,
      minAge: 10,
      medicalRequirements: null,
      requiredItems: [],
      materialsIncluded: true,
    };

    const template2 = {
      ...template1,
      description: "Learn to scuba dive", // Changed
    };

    const hash1 = generateContentHash(template1);
    const hash2 = generateContentHash(template2);

    expect(hash1).not.toBe(hash2);
  });

  it("should ignore field order (sorted keys)", () => {
    const fields = {
      name: "Test",
      code: "TST",
      description: "Desc",
      durationDays: 1,
    };

    // Reverse order
    const reversed = {
      durationDays: 1,
      description: "Desc",
      code: "TST",
      name: "Test",
    };

    const hash1 = generateContentHash(fields as unknown);
    const hash2 = generateContentHash(reversed as unknown);

    expect(hash1).toBe(hash2);
  });
});
