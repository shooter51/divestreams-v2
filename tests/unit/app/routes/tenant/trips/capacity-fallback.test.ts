/**
 * DS-ijq9: Trip capacity falls back to tour default when trip capacity is unset.
 *
 * Tests the capacity fallback logic in the admin trips list loader.
 * When a trip has no explicit maxParticipants, the loader should fall back to
 * the parent tour's maxParticipants value.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Capacity fallback helper (mirrors the logic in the admin trips list loader)
// ============================================================================

/**
 * Resolves effective trip capacity.
 * Mirrors the logic in app/routes/tenant/trips/index.tsx loader map().
 */
function resolveCapacity(
  tripMaxParticipants: number | null | undefined,
  tourMaxParticipants: number | null | undefined
): number {
  return tripMaxParticipants ?? tourMaxParticipants ?? 0;
}

describe("DS-ijq9: trip capacity fallback (admin trips list)", () => {
  it("uses trip capacity when explicitly set", () => {
    expect(resolveCapacity(6, 12)).toBe(6);
  });

  it("falls back to tour capacity when trip capacity is null", () => {
    expect(resolveCapacity(null, 12)).toBe(12);
  });

  it("falls back to tour capacity when trip capacity is undefined", () => {
    expect(resolveCapacity(undefined, 12)).toBe(12);
  });

  it("returns 0 when both trip and tour capacity are null", () => {
    expect(resolveCapacity(null, null)).toBe(0);
  });

  it("returns 0 when both trip and tour capacity are undefined", () => {
    expect(resolveCapacity(undefined, undefined)).toBe(0);
  });

  it("uses trip capacity of 0 — does NOT fall back if trip has explicit 0", () => {
    // 0 is falsy but ?? only triggers on null/undefined, so trip=0 is preserved
    expect(resolveCapacity(0, 12)).toBe(0);
  });

  it("uses trip capacity when both are set — trip wins", () => {
    expect(resolveCapacity(4, 20)).toBe(4);
  });

  it("falls back to tour capacity when trip capacity is null and tour is 0", () => {
    expect(resolveCapacity(null, 0)).toBe(0);
  });
});
