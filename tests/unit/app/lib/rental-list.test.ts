import { describe, it, expect } from "vitest";
import {
  aggregateEquipmentRentals,
  type BookingRentalData,
} from "../../../../app/lib/rental-list";

describe("aggregateEquipmentRentals", () => {
  it("returns empty results for no bookings", () => {
    const result = aggregateEquipmentRentals([]);
    expect(result.summary).toEqual([]);
    expect(result.details).toEqual([]);
    expect(result.totalItems).toBe(0);
    expect(result.tankSummary).toEqual([]);
  });

  it("returns empty results when bookings have no equipment rentals", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "John",
        lastName: "Doe",
        equipmentRental: null,
      },
      {
        bookingNumber: "BK-002",
        firstName: "Jane",
        lastName: "Smith",
        equipmentRental: [],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);
    expect(result.summary).toEqual([]);
    expect(result.details).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  it("aggregates a single booking with one tank", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "John",
        lastName: "Doe",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", quantity: 1, price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    expect(result.totalItems).toBe(1);
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0]).toEqual({
      item: "Tank",
      size: "80cf",
      gasType: "air",
      count: 1,
    });
    expect(result.tankSummary).toEqual([{ gasType: "air", count: 1 }]);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].customerName).toBe("John Doe");
  });

  it("aggregates multiple bookings with mixed equipment", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "John",
        lastName: "Doe",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", quantity: 1, price: 10 },
          { item: "BCD", size: "M", quantity: 1, price: 15 },
          { item: "Regulator", quantity: 1, price: 15 },
        ],
      },
      {
        bookingNumber: "BK-002",
        firstName: "Jane",
        lastName: "Smith",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "nitrox32", quantity: 1, price: 15 },
          { item: "Tank", size: "100cf", gasType: "air", quantity: 1, price: 10 },
          { item: "BCD", size: "S", quantity: 1, price: 15 },
        ],
      },
    ];

    const result = aggregateEquipmentRentals(bookings);

    expect(result.totalItems).toBe(6);
    expect(result.details).toHaveLength(2);

    // Tank summary should show 2 air, 1 nitrox32
    const airTanks = result.tankSummary.find((t) => t.gasType === "air");
    const nitroxTanks = result.tankSummary.find((t) => t.gasType === "nitrox32");
    expect(airTanks?.count).toBe(2);
    expect(nitroxTanks?.count).toBe(1);

    // Summary should have tanks first
    expect(result.summary[0].item).toBe("Tank");
  });

  it("handles missing gasType by defaulting to empty string in summary", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "Alice",
        lastName: "Johnson",
        equipmentRental: [
          { item: "Tank", size: "80cf", quantity: 1, price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    // Tank without gasType in rental item should still be tracked
    expect(result.tankSummary).toHaveLength(1);
    // Default gas for tanks is "air" when not specified in gasType field
    // But since gasType is missing from the rental item, it becomes empty string in summary
    // and tankGasMap defaults to "air"
    expect(result.tankSummary[0].gasType).toBe("air");
  });

  it("handles quantity > 1", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "Bob",
        lastName: "Wilson",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", quantity: 3, price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    expect(result.totalItems).toBe(3);
    expect(result.summary[0].count).toBe(3);
    expect(result.tankSummary[0].count).toBe(3);
  });

  it("aggregates same item+size+gasType across bookings", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "John",
        lastName: "Doe",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", quantity: 1, price: 10 },
        ],
      },
      {
        bookingNumber: "BK-002",
        firstName: "Jane",
        lastName: "Smith",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", quantity: 2, price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    // Should aggregate into single summary entry
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].count).toBe(3);

    // But keep separate detail entries per customer
    expect(result.details).toHaveLength(2);
  });

  it("treats 'cylinder' as a tank for tank summary", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "Test",
        lastName: "User",
        equipmentRental: [
          { item: "Cylinder 80cf", gasType: "nitrox32", quantity: 1, price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    expect(result.tankSummary).toHaveLength(1);
    expect(result.tankSummary[0].gasType).toBe("nitrox32");
  });

  it("sorts summary with tanks first, then alphabetically", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "Test",
        lastName: "User",
        equipmentRental: [
          { item: "Wetsuit", size: "M", quantity: 1, price: 20 },
          { item: "BCD", size: "M", quantity: 1, price: 15 },
          { item: "Tank", size: "80cf", gasType: "air", quantity: 1, price: 10 },
          { item: "Regulator", quantity: 1, price: 15 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    expect(result.summary[0].item).toBe("Tank"); // tanks first
    expect(result.summary[1].item).toBe("BCD"); // then alphabetical
    expect(result.summary[2].item).toBe("Regulator");
    expect(result.summary[3].item).toBe("Wetsuit");
  });

  it("defaults quantity to 1 when not specified", () => {
    const bookings: BookingRentalData[] = [
      {
        bookingNumber: "BK-001",
        firstName: "Test",
        lastName: "User",
        equipmentRental: [
          { item: "Tank", size: "80cf", gasType: "air", price: 10 },
        ],
      },
    ];
    const result = aggregateEquipmentRentals(bookings);

    expect(result.totalItems).toBe(1);
    expect(result.summary[0].count).toBe(1);
  });
});
