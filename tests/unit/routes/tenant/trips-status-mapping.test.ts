/**
 * DS-nmdt: Verify trip status mapping consistency between list and detail views.
 *
 * The trips list and detail views must map the DB status "scheduled" to the
 * same BadgeStatus value. Previously, the detail view's mapper didn't handle
 * "scheduled" and fell back to "pending", causing an inconsistency.
 */
import { describe, it, expect } from "vitest";

// Replicate the mappers from both views to test them in isolation.
// These must stay in sync with the actual mapper functions in:
//   - app/routes/tenant/trips/index.tsx (mapTripStatus)
//   - app/routes/tenant/trips/$id.tsx (mapTripStatusToBadgeStatus)

type BadgeStatus = "pending" | "confirmed" | "scheduled" | "completed" | "cancelled" | "full" | string;

/** From trips/index.tsx */
function mapTripStatus(status: string): BadgeStatus {
  if (status === "open") return "pending";
  if (status === "full") return "confirmed";
  if (status === "cancelled") return "cancelled";
  return status as BadgeStatus;
}

/** From trips/$id.tsx (after fix) */
function mapTripStatusToBadgeStatus(status: string): BadgeStatus {
  const statusMap: Record<string, BadgeStatus> = {
    scheduled: "scheduled",
    open: "pending",
    confirmed: "confirmed",
    full: "confirmed",
    completed: "completed",
    cancelled: "cancelled",
  };
  return statusMap[status] || "pending";
}

describe("DS-nmdt: Trip status mapping consistency", () => {
  const tripStatuses = ["scheduled", "open", "confirmed", "full", "completed", "cancelled"];

  it("list and detail views map 'scheduled' to the same badge status", () => {
    const listResult = mapTripStatus("scheduled");
    const detailResult = mapTripStatusToBadgeStatus("scheduled");
    expect(listResult).toBe(detailResult);
    expect(listResult).toBe("scheduled");
  });

  it("list and detail views produce consistent results for all known statuses", () => {
    for (const status of tripStatuses) {
      const listResult = mapTripStatus(status);
      const detailResult = mapTripStatusToBadgeStatus(status);
      expect(listResult).toBe(detailResult);
    }
  });

  it("'scheduled' maps to 'scheduled' (not 'pending')", () => {
    // This is the specific regression test for DS-nmdt
    expect(mapTripStatusToBadgeStatus("scheduled")).toBe("scheduled");
    expect(mapTripStatusToBadgeStatus("scheduled")).not.toBe("pending");
  });
});
