/**
 * DS-a0gj: No way to edit a recurring trip
 *
 * The edit route action uses a raw db.update() on the single trip row
 * regardless of whether the trip is part of a recurring series.
 * For recurring trips, mapTrip() doesn't expose isRecurring/recurringTemplateId,
 * so the edit page has no way to know it's dealing with a recurring trip.
 *
 * This test verifies that mapTrip() preserves recurring trip metadata
 * so the edit UI can detect and handle recurring trips appropriately.
 */

import { describe, it, expect } from "vitest";
import { mapTrip } from "../../../../lib/db/queries/mappers";

describe("DS-a0gj: Recurring trip metadata preserved in mapTrip", () => {
  const baseRow = {
    id: "trip-template-1",
    organizationId: "org-1",
    tourId: "tour-1",
    boatId: null,
    date: "2026-06-01",
    startTime: "09:00",
    endTime: "12:00",
    status: "open",
    maxParticipants: 10,
    price: "75.00",
    notes: null,
    weatherNotes: null,
    isPublic: false,
    conditions: null,
    staffIds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("preserves isRecurring=true for recurring trips", () => {
    const row = {
      ...baseRow,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurringTemplateId: null,
      recurrenceIndex: 0,
      recurrenceDays: [1, 3, 5],
      recurrenceEndDate: "2026-12-31",
      recurrenceCount: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.isRecurring).toBe(true);
  });

  it("preserves recurringTemplateId for recurring instances", () => {
    const row = {
      ...baseRow,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurringTemplateId: "trip-template-1",
      recurrenceIndex: 1,
      recurrenceDays: [1, 3, 5],
      recurrenceEndDate: null,
      recurrenceCount: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.recurringTemplateId).toBe("trip-template-1");
  });

  it("preserves recurrencePattern for recurring trips", () => {
    const row = {
      ...baseRow,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurringTemplateId: null,
      recurrenceIndex: 0,
      recurrenceDays: null,
      recurrenceEndDate: null,
      recurrenceCount: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.recurrencePattern).toBe("weekly");
  });

  it("isRecurring=false for non-recurring trips", () => {
    const row = {
      ...baseRow,
      isRecurring: false,
      recurrencePattern: null,
      recurringTemplateId: null,
      recurrenceIndex: null,
      recurrenceDays: null,
      recurrenceEndDate: null,
      recurrenceCount: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.isRecurring).toBe(false);
    expect(result.recurringTemplateId).toBeNull();
  });
});
