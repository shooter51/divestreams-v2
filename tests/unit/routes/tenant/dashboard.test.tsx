/**
 * Tenant Dashboard Route Tests
 *
 * Tests the dashboard page loader with stats, upcoming trips, and recent bookings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/tenant/dashboard";

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

describe("Route: tenant/dashboard.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContext = {
    org: { id: "org-123", name: "Test Dive Shop" },
    subscription: { plan: "pro", status: "active" },
    limits: { bookingsPerMonth: 100, customers: 500 },
    usage: { bookingsThisMonth: 25, customers: 50 },
    isPremium: true,
  };

  const mockUpcomingTrips = [
    {
      id: "trip-1",
      date: "2024-03-15",
      startTime: "09:00",
      maxParticipants: 12,
      tourName: "Morning Dive",
    },
    {
      id: "trip-2",
      date: "2024-03-16",
      startTime: "14:00",
      maxParticipants: 8,
      tourName: "Afternoon Snorkel",
    },
  ];

  const mockBookingCounts = [
    { tripId: "trip-1", count: 8 },
    { tripId: "trip-2", count: 5 },
  ];

  const mockRecentBookings = [
    {
      id: "booking-1",
      total: "150.00",
      status: "confirmed",
      createdAt: new Date("2024-03-01T10:00:00Z"),
      customerFirstName: "John",
      customerLastName: "Doe",
      tourName: "Morning Dive",
      tripDate: "2024-03-15",
    },
    {
      id: "booking-2",
      total: "200.00",
      status: "pending",
      createdAt: new Date("2024-03-02T11:00:00Z"),
      customerFirstName: "Jane",
      customerLastName: "Smith",
      tourName: "Afternoon Snorkel",
      tripDate: "2024-03-16",
    },
  ];

  describe("loader", () => {
    it("should load dashboard with all data", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      // Mock stats queries (4 separate queries)
      (db.select as any)
        // Today's bookings count
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        })
        // Total customers count
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 150 }]),
          }),
        })
        // Active trips count
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        // Week revenue sum
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 1250.50 }]),
          }),
        })
        // Upcoming trips query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockUpcomingTrips),
                }),
              }),
            }),
          }),
        })
        // Booking counts for trips
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockBookingCounts),
            }),
          }),
        })
        // Recent bookings query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue(mockRecentBookings),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats.todayBookings).toBe(3);
      expect(result.stats.weekRevenue).toBe(1250.50);
      expect(result.stats.activeTrips).toBe(5);
      expect(result.stats.totalCustomers).toBe(150);

      expect(result.upcomingTrips).toHaveLength(2);
      expect(result.upcomingTrips[0].id).toBe("trip-1");
      expect(result.upcomingTrips[0].name).toBe("Morning Dive");
      expect(result.upcomingTrips[0].participants).toBe(8);
      expect(result.upcomingTrips[0].maxParticipants).toBe(12);

      expect(result.recentBookings).toHaveLength(2);
      expect(result.recentBookings[0].customer).toBe("John Doe");
      expect(result.recentBookings[0].trip).toBe("Morning Dive");
      expect(result.recentBookings[0].amount).toBe("150.00");
      expect(result.recentBookings[0].status).toBe("confirmed");

      expect(result.orgName).toBe("Test Dive Shop");
      expect(result.isPremium).toBe(true);
    });

    it("should handle zero stats values", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats.todayBookings).toBe(0);
      expect(result.stats.weekRevenue).toBe(0);
      expect(result.stats.activeTrips).toBe(0);
      expect(result.stats.totalCustomers).toBe(0);
      expect(result.upcomingTrips).toEqual([]);
      expect(result.recentBookings).toEqual([]);
    });

    it("should handle null/undefined count values with defaults", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: null }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{}]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: undefined }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: null }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats.todayBookings).toBe(0);
      expect(result.stats.totalCustomers).toBe(0);
      expect(result.stats.activeTrips).toBe(0);
      expect(result.stats.weekRevenue).toBe(0);
    });

    it("should handle trips with no bookings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 500 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockUpcomingTrips),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]), // No bookings
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue(mockRecentBookings),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.upcomingTrips[0].participants).toBe(0);
      expect(result.upcomingTrips[1].participants).toBe(0);
    });

    it("should handle null maxParticipants with default", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      const tripsWithNullMax = [
        {
          id: "trip-1",
          date: "2024-03-15",
          startTime: "09:00",
          maxParticipants: null,
          tourName: "Morning Dive",
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(tripsWithNullMax),
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
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.upcomingTrips[0].maxParticipants).toBe(0);
    });

    it("should format dates as strings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockUpcomingTrips),
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
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue(mockRecentBookings),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.upcomingTrips[0].date).toBe("2024-03-15");
      expect(result.recentBookings[0].date).toBe("2024-03-15");
    });

    it("should include subscription, limits, and usage from context", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.subscription).toEqual(mockContext.subscription);
      expect(result.limits).toEqual(mockContext.limits);
      expect(result.usage).toEqual(mockContext.usage);
      expect(result.isPremium).toBe(true);
    });

    it("should format booking amounts correctly", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue(mockContext);

      const bookingsWithVariousAmounts = [
        {
          id: "booking-1",
          total: "150.50",
          status: "confirmed",
          createdAt: new Date("2024-03-01T10:00:00Z"),
          customerFirstName: "John",
          customerLastName: "Doe",
          tourName: "Morning Dive",
          tripDate: "2024-03-15",
        },
        {
          id: "booking-2",
          total: null,
          status: "pending",
          createdAt: new Date("2024-03-02T11:00:00Z"),
          customerFirstName: "Jane",
          customerLastName: "Smith",
          tourName: "Afternoon Snorkel",
          tripDate: "2024-03-16",
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue(bookingsWithVariousAmounts),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.recentBookings[0].amount).toBe("150.50");
      expect(result.recentBookings[1].amount).toBe("0.00");
    });
  });
});
