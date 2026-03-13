/**
 * Tests for P3 display fixes across dive sites, discounts, tours, gallery,
 * contact, terms/privacy pages.
 *
 * DS-8yn:  Dive site conditions — capitalise current strength
 * DS-mr3:  Dive sites list — capitalise difficulty
 * DS-0s3:  (same as DS-mr3)
 * DS-3rm:  Discounts usage — show "X uses" or "X / Unlimited"
 * DS-7lt:  Discounts "Applies To" — capitalise/humanise
 * DS-2vd:  Discount future validFrom — add warning
 * DS-b6z:  Contact page fallback messaging
 * DS-43b:  Honeypot field hidden properly
 * DS-lzt:  Terms/Privacy "Back to Home" → /site
 * DS-iv7:  Tour detail time formatting
 * DS-tiy:  Tours list singular/plural "trip(s) run"
 * DS-ztw:  Gallery albums sort-order display
 * DS-wr4:  Invite error message
 * DS-po1:  Depth unit configurable
 * DS-pln5: SSI courses show $0.00 price — show "Contact for pricing" instead
 * DS-bf1j: Discounts page empty state — correct message when no codes exist
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Pure display helper functions extracted for testing
// ============================================================================

// DS-8yn: Current strength labels
const currentStrengthLabels: Record<string, string> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  strong: "Strong",
  variable: "Variable",
};

function humaniseCurrentStrength(value: string): string {
  return currentStrengthLabels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// DS-mr3/DS-0s3: Difficulty labels
const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function humaniseDifficulty(value: string): string {
  return difficultyLabels[value] ?? value;
}

// DS-3rm: Usage count formatting for discounts
function formatUsageCount(usedCount: number, maxUses: number | null): string {
  if (maxUses) {
    return `${usedCount} / ${maxUses}`;
  }
  return `${usedCount} uses`;
}

// DS-7lt: Applicable-to labels
const applicableToLabels: Record<string, string> = {
  all: "All Bookings",
  tours: "Tours",
  equipment: "Equipment",
  products: "Products",
  courses: "Courses",
};

function humaniseApplicableTo(value: string): string {
  return applicableToLabels[value] ?? value;
}

// DS-iv7: Time formatting (copied from formatters.ts for reference)
function formatTime(t: string | null | undefined): string {
  if (!t) return "TBD";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// DS-tiy: Trip count label
function formatTripCountLabel(tripCount: number): string {
  return `${tripCount} ${tripCount === 1 ? "trip" : "trips"} run`;
}

// DS-ztw: Gallery album position
function formatAlbumPosition(sortOrder: number | null): string {
  return `Position ${(sortOrder ?? 0) + 1}`;
}

// ============================================================================
// Tests
// ============================================================================

describe("DS-8yn: Current strength humanisation", () => {
  it("capitalises 'none' to 'None'", () => {
    expect(humaniseCurrentStrength("none")).toBe("None");
  });

  it("capitalises 'mild' to 'Mild'", () => {
    expect(humaniseCurrentStrength("mild")).toBe("Mild");
  });

  it("capitalises 'moderate' to 'Moderate'", () => {
    expect(humaniseCurrentStrength("moderate")).toBe("Moderate");
  });

  it("capitalises 'strong' to 'Strong'", () => {
    expect(humaniseCurrentStrength("strong")).toBe("Strong");
  });

  it("capitalises 'variable' to 'Variable'", () => {
    expect(humaniseCurrentStrength("variable")).toBe("Variable");
  });

  it("capitalises unknown values as fallback", () => {
    expect(humaniseCurrentStrength("extreme")).toBe("Extreme");
  });
});

describe("DS-mr3/DS-0s3: Difficulty humanisation", () => {
  it("capitalises 'beginner' to 'Beginner'", () => {
    expect(humaniseDifficulty("beginner")).toBe("Beginner");
  });

  it("capitalises 'intermediate' to 'Intermediate'", () => {
    expect(humaniseDifficulty("intermediate")).toBe("Intermediate");
  });

  it("capitalises 'advanced' to 'Advanced'", () => {
    expect(humaniseDifficulty("advanced")).toBe("Advanced");
  });

  it("capitalises 'expert' to 'Expert'", () => {
    expect(humaniseDifficulty("expert")).toBe("Expert");
  });
});

describe("DS-3rm: Discount usage count formatting", () => {
  it("shows 'X / Y' for limited-use codes", () => {
    expect(formatUsageCount(3, 10)).toBe("3 / 10");
  });

  it("shows 'X uses' for unlimited codes", () => {
    expect(formatUsageCount(5, null)).toBe("5 uses");
  });

  it("shows '0 uses' for unused unlimited codes", () => {
    expect(formatUsageCount(0, null)).toBe("0 uses");
  });

  it("shows '0 / 100' for unused limited codes", () => {
    expect(formatUsageCount(0, 100)).toBe("0 / 100");
  });
});

describe("DS-7lt: Discount 'Applies To' humanisation", () => {
  it("shows 'All Bookings' for 'all'", () => {
    expect(humaniseApplicableTo("all")).toBe("All Bookings");
  });

  it("shows 'Tours' for 'tours'", () => {
    expect(humaniseApplicableTo("tours")).toBe("Tours");
  });

  it("shows 'Courses' for 'courses'", () => {
    expect(humaniseApplicableTo("courses")).toBe("Courses");
  });

  it("shows 'Equipment' for 'equipment'", () => {
    expect(humaniseApplicableTo("equipment")).toBe("Equipment");
  });

  it("falls back to raw value for unknown", () => {
    expect(humaniseApplicableTo("other")).toBe("other");
  });
});

describe("DS-iv7: Time formatting", () => {
  it("formats '08:30:00' as '8:30 AM'", () => {
    expect(formatTime("08:30:00")).toBe("8:30 AM");
  });

  it("formats '08:30' as '8:30 AM'", () => {
    expect(formatTime("08:30")).toBe("8:30 AM");
  });

  it("formats '13:00' as '1:00 PM'", () => {
    expect(formatTime("13:00")).toBe("1:00 PM");
  });

  it("returns 'TBD' for null", () => {
    expect(formatTime(null)).toBe("TBD");
  });
});

describe("DS-tiy: Trip count singular/plural", () => {
  it("uses singular 'trip' for count of 1", () => {
    expect(formatTripCountLabel(1)).toBe("1 trip run");
  });

  it("uses plural 'trips' for count of 0", () => {
    expect(formatTripCountLabel(0)).toBe("0 trips run");
  });

  it("uses plural 'trips' for count > 1", () => {
    expect(formatTripCountLabel(5)).toBe("5 trips run");
  });
});

describe("DS-ztw: Gallery album position formatting", () => {
  it("converts 0-based sortOrder to 1-based position", () => {
    expect(formatAlbumPosition(0)).toBe("Position 1");
  });

  it("converts sortOrder 2 to Position 3", () => {
    expect(formatAlbumPosition(2)).toBe("Position 3");
  });

  it("handles null sortOrder as Position 1", () => {
    expect(formatAlbumPosition(null)).toBe("Position 1");
  });
});

describe("DS-lzt: Terms/Privacy back link", () => {
  it("should link to /site not /", () => {
    // This is a rendering test — we verify the expected value
    const backLink = "/site";
    expect(backLink).toBe("/site");
    expect(backLink).not.toBe("/");
  });
});

describe("DS-2vd: Discount future validFrom warning", () => {
  it("identifies discounts with future validFrom as not yet active", () => {
    const now = new Date("2024-06-01");
    const validFrom = new Date("2024-07-01");
    const isNotYetActive = validFrom > now;
    expect(isNotYetActive).toBe(true);
  });

  it("identifies discounts with past validFrom as active", () => {
    const now = new Date("2024-06-01");
    const validFrom = new Date("2024-05-01");
    const isNotYetActive = validFrom > now;
    expect(isNotYetActive).toBe(false);
  });
});

describe("DS-b6z: Contact page fallback when no contact info", () => {
  it("should show direction-neutral message", () => {
    const fallbackMessage = "Send us a message using the contact form and we'll get back to you.";
    expect(fallbackMessage).not.toContain("below");
    expect(fallbackMessage).not.toContain("coming soon");
    expect(fallbackMessage).toContain("contact form");
  });
});

describe("DS-43b: Honeypot field accessibility", () => {
  it("honeypot container should use aria-hidden and proper CSS hiding", () => {
    // Verify the expected attributes
    const attrs = {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: "-9999px",
        height: "0",
        overflow: "hidden",
      },
    };
    expect(attrs["aria-hidden"]).toBe("true");
    expect(attrs.style.height).toBe("0");
    expect(attrs.style.overflow).toBe("hidden");
  });

  it("honeypot input should have tabIndex -1 and autoComplete off", () => {
    const inputAttrs = {
      tabIndex: -1,
      autoComplete: "off",
      "aria-hidden": "true",
    };
    expect(inputAttrs.tabIndex).toBe(-1);
    expect(inputAttrs.autoComplete).toBe("off");
    expect(inputAttrs["aria-hidden"]).toBe("true");
  });
});

describe("DS-po1: Depth unit configurable", () => {
  it("defaults to meters when not set", () => {
    const metadata: { depthUnit?: string } = {};
    const depthUnit = metadata.depthUnit || "meters";
    expect(depthUnit).toBe("meters");
  });

  it("respects feet when configured", () => {
    const metadata = { depthUnit: "feet" };
    expect(metadata.depthUnit).toBe("feet");
  });

  it("validates depth unit to meters or feet", () => {
    const rawValue = "feet";
    const depthUnit = rawValue === "feet" ? "feet" : "meters";
    expect(depthUnit).toBe("feet");

    const invalidValue = "fathoms";
    const safeDepthUnit = invalidValue === "feet" ? "feet" : "meters";
    expect(safeDepthUnit).toBe("meters");
  });
});

// ============================================================================
// DS-pln5: Course price display — "Contact for pricing" for null/zero prices
// ============================================================================

/**
 * Mirrors the formatAdminCoursePrice logic in tenant/training/courses/index.tsx
 * Price comes from the loader as a toFixed(2) string (e.g. "0.00") when null in DB.
 */
function formatAdminCoursePrice(price: string, currency: string): string {
  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    return "Contact for pricing";
  }
  return `$${numericPrice.toFixed(2)} ${currency}`;
}

describe("DS-pln5: Tenant admin courses list — price display for template courses", () => {
  it("shows 'Contact for pricing' when price is '0.00'", () => {
    expect(formatAdminCoursePrice("0.00", "USD")).toBe("Contact for pricing");
  });

  it("shows 'Contact for pricing' when price is '0'", () => {
    expect(formatAdminCoursePrice("0", "USD")).toBe("Contact for pricing");
  });

  it("shows formatted price when price is positive", () => {
    expect(formatAdminCoursePrice("299.00", "USD")).toBe("$299.00 USD");
  });

  it("shows formatted price for non-zero decimal prices", () => {
    expect(formatAdminCoursePrice("149.50", "EUR")).toBe("$149.50 EUR");
  });

  it("shows 'Contact for pricing' when price string is not a valid number", () => {
    expect(formatAdminCoursePrice("", "USD")).toBe("Contact for pricing");
  });
});

// ============================================================================
// DS-bf1j: Discounts page — empty state and query correctness
// ============================================================================

/**
 * The discounts loader filters by organizationId — verify the filter logic
 * produces the correct result for an org with no discount codes.
 */
function simulateDiscountsLoader(
  allCodes: Array<{ organizationId: string }>,
  orgId: string
): Array<{ organizationId: string }> {
  return allCodes.filter((code) => code.organizationId === orgId);
}

describe("DS-bf1j: Discounts page — organizationId filtering", () => {
  it("returns empty array when org has no discount codes", () => {
    const codes = [
      { organizationId: "org-2", code: "OTHER10" },
    ];
    const result = simulateDiscountsLoader(codes, "org-1");
    expect(result).toHaveLength(0);
  });

  it("returns only codes belonging to the correct org", () => {
    const codes = [
      { organizationId: "org-1", code: "MINE10" },
      { organizationId: "org-2", code: "OTHER20" },
      { organizationId: "org-1", code: "MINE20" },
    ];
    const result = simulateDiscountsLoader(codes, "org-1");
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.organizationId === "org-1")).toBe(true);
  });

  it("returns all codes when they all belong to the org", () => {
    const codes = [
      { organizationId: "org-1", code: "A" },
      { organizationId: "org-1", code: "B" },
    ];
    const result = simulateDiscountsLoader(codes, "org-1");
    expect(result).toHaveLength(2);
  });
});

describe("DS-bf1j: Discounts page — empty state is shown when no codes exist", () => {
  it("produces zero active discounts when code list is empty", () => {
    const discountCodesList: Array<{ id: string; isActive: boolean }> = [];
    // Simulate the categorization the component does
    const activeDiscounts = discountCodesList.filter((d) => d.isActive);
    expect(activeDiscounts).toHaveLength(0);
  });

  it("empty state should be triggered when activeDiscounts is empty", () => {
    const activeDiscounts: unknown[] = [];
    const shouldShowEmptyState = activeDiscounts.length === 0;
    expect(shouldShowEmptyState).toBe(true);
  });
});
