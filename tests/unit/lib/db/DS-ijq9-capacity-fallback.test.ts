/**
 * DS-ijq9: Trip capacity does not fall back to tour default when trip capacity is unset
 *
 * When a trip has no maxParticipants set (null), mapTrip() should use
 * the tour's maxParticipants as the effective capacity.
 *
 * Currently mapTrip() ignores tour_max_participants and returns null,
 * making trips appear to have unlimited capacity.
 */

import { describe, it, expect } from "vitest";
import { mapTrip } from "../../../../lib/db/queries/mappers";

describe("DS-ijq9: Trip capacity fallback to tour default", () => {
  const baseRow = {
    id: "trip-1",
    organizationId: "org-1",
    tourId: "tour-1",
    boatId: null,
    date: "2026-06-01",
    startTime: "09:00",
    endTime: "12:00",
    status: "open",
    price: "75.00",
    notes: null,
    weatherNotes: null,
    isPublic: false,
    isRecurring: false,
    recurrencePattern: null,
    recurringTemplateId: null,
    recurrenceIndex: null,
    recurrenceDays: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    conditions: null,
    staffIds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("returns tour maxParticipants when trip maxParticipants is null", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tour_max_participants: 10,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(10);
  });

  it("returns trip maxParticipants when both are set (trip overrides tour)", () => {
    const row = {
      ...baseRow,
      maxParticipants: 6,
      tour_max_participants: 10,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(6);
  });

  it("returns null when both trip and tour maxParticipants are null", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tour_max_participants: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBeNull();
  });

  it("also handles camelCase tourMaxParticipants from Drizzle ORM", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tourMaxParticipants: 8,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(8);
  });
});
