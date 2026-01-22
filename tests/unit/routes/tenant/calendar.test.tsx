/**
 * Tenant Calendar Route Tests
 *
 * Tests the calendar page loader with date filtering and booking counts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/tenant/calendar";

// Mock auth
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked modules
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("Route: tenant/calendar.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTrips = [
    {
      id: "trip-1",
      date: "2024-03-15",
      startTime: "09:00",
      endTime: "12:00",
      maxParticipants: 12,
      status: "scheduled",
      tourId: "tour-1",
      tourName: "Morning Dive",
      tourType: "single_dive",
      boatName: "Ocean Explorer",
    },
    {
      id: "trip-2",
      date: "2024-03-20",
      startTime: "14:00",
      endTime: null,
      maxParticipants: 8,
      status: "scheduled",
      tourId: "tour-2",
      tourName: "Afternoon Snorkel",
      tourType: "snorkel",
      boatName: null,
    },
  ];

  const mockBookingCounts = [
    { tripId: "trip-1", count: 8 },
    { tripId: "trip-2", count: 4 },
  ];

  describe("loader", () => {
    it("should load trips with default date range (current month)", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const mockSelectTrips = vi.fn();
      const mockSelectBookings = vi.fn();

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockTrips),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockBookingCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips).toHaveLength(2);
      expect(result.isPremium).toBe(true);

      // Verify trip data with booking counts
      expect(result.trips[0].id).toBe("trip-1");
      expect(result.trips[0].tourName).toBe("Morning Dive");
      expect(result.trips[0].bookedParticipants).toBe(8);
      expect(result.trips[0].maxParticipants).toBe(12);

      expect(result.trips[1].id).toBe("trip-2");
      expect(result.trips[1].bookedParticipants).toBe(4);
    });

    it("should filter trips by date range from URL params", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar?from=2024-03-01&to=2024-03-31");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockTrips),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockBookingCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips).toHaveLength(2);
      expect(result.isPremium).toBe(false);
    });

    it("should handle null tour and boat data with defaults", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const tripsWithNulls = [
        {
          id: "trip-1",
          date: "2024-03-15",
          startTime: "09:00",
          endTime: null,
          maxParticipants: null,
          status: "scheduled",
          tourId: "tour-1",
          tourName: null,
          tourType: null,
          boatName: null,
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(tripsWithNulls),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips[0].tourName).toBe("Unknown Tour");
      expect(result.trips[0].tourType).toBe("other");
      expect(result.trips[0].maxParticipants).toBe(0);
      expect(result.trips[0].boatName).toBeNull();
      expect(result.trips[0].bookedParticipants).toBe(0);
    });

    it("should handle empty trips list", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      // Only mock trips query - bookings query won't run when tripIds.length === 0
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips).toEqual([]);
    });

    it("should handle trips with no bookings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const mockFromTrips = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockTrips),
            }),
          }),
        }),
      });

      const mockFromBookings = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromTrips })
        .mockReturnValueOnce({ from: mockFromBookings });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips[0].bookedParticipants).toBe(0);
      expect(result.trips[1].bookedParticipants).toBe(0);
    });

    it("should map booking counts to correct trips", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const partialBookingCounts = [
        { tripId: "trip-1", count: 10 },
        // trip-2 has no bookings
      ];

      const mockFromTrips = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockTrips),
            }),
          }),
        }),
      });

      const mockFromBookings = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue(partialBookingCounts),
        }),
      });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromTrips })
        .mockReturnValueOnce({ from: mockFromBookings });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips[0].id).toBe("trip-1");
      expect(result.trips[0].bookedParticipants).toBe(10);
      expect(result.trips[1].id).toBe("trip-2");
      expect(result.trips[1].bookedParticipants).toBe(0);
    });

    it("should handle null endTime", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockTrips),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockBookingCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.trips[0].endTime).toBe("12:00");
      expect(result.trips[1].endTime).toBeNull();
    });

    it("should preserve all trip data fields", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/calendar");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockTrips),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockBookingCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      const trip = result.trips[0];
      expect(trip.id).toBe("trip-1");
      expect(trip.tourId).toBe("tour-1");
      expect(trip.tourName).toBe("Morning Dive");
      expect(trip.tourType).toBe("single_dive");
      expect(trip.date).toBe("2024-03-15");
      expect(trip.startTime).toBe("09:00");
      expect(trip.endTime).toBe("12:00");
      expect(trip.boatName).toBe("Ocean Explorer");
      expect(trip.maxParticipants).toBe(12);
      expect(trip.bookedParticipants).toBe(8);
      expect(trip.status).toBe("scheduled");
    });
  });
});
