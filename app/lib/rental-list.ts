/**
 * Aggregates equipment rental data from trip bookings into a printable summary.
 */

export interface RentalItem {
  item: string;
  size?: string;
  gasType?: string;
  quantity?: number;
  price: number;
}

export interface BookingRentalData {
  bookingNumber: string;
  firstName: string;
  lastName: string;
  equipmentRental: RentalItem[] | null;
}

export interface RentalSummaryEntry {
  item: string;
  size: string;
  gasType: string;
  count: number;
}

export interface CustomerRentalDetail {
  customerName: string;
  bookingNumber: string;
  items: Array<{
    item: string;
    size: string;
    gasType: string;
    quantity: number;
  }>;
}

export interface AggregatedRentals {
  summary: RentalSummaryEntry[];
  details: CustomerRentalDetail[];
  totalItems: number;
  tankSummary: { gasType: string; count: number }[];
}

/**
 * Aggregates equipment rentals from all bookings for a trip.
 * Groups by item type, size, and gas type for the summary.
 * Returns per-customer detail for the crew list.
 */
export function aggregateEquipmentRentals(
  bookings: BookingRentalData[]
): AggregatedRentals {
  const summaryMap = new Map<string, RentalSummaryEntry>();
  const details: CustomerRentalDetail[] = [];
  let totalItems = 0;
  const tankGasMap = new Map<string, number>();

  for (const booking of bookings) {
    if (!booking.equipmentRental || booking.equipmentRental.length === 0) {
      continue;
    }

    const customerItems: CustomerRentalDetail["items"] = [];

    for (const rental of booking.equipmentRental) {
      const qty = rental.quantity || 1;
      const size = rental.size || "";
      const gasType = rental.gasType || "";
      const key = `${rental.item}|${size}|${gasType}`;

      const existing = summaryMap.get(key);
      if (existing) {
        existing.count += qty;
      } else {
        summaryMap.set(key, {
          item: rental.item,
          size,
          gasType,
          count: qty,
        });
      }

      totalItems += qty;

      // Track tank gas types separately
      const itemLower = rental.item.toLowerCase();
      if (itemLower.includes("tank") || itemLower.includes("cylinder")) {
        const gas = gasType || "air";
        tankGasMap.set(gas, (tankGasMap.get(gas) || 0) + qty);
      }

      customerItems.push({
        item: rental.item,
        size,
        gasType,
        quantity: qty,
      });
    }

    if (customerItems.length > 0) {
      details.push({
        customerName: `${booking.firstName} ${booking.lastName}`.trim(),
        bookingNumber: booking.bookingNumber,
        items: customerItems,
      });
    }
  }

  // Sort summary: tanks first, then alphabetical
  const summary = Array.from(summaryMap.values()).sort((a, b) => {
    const aIsTank = a.item.toLowerCase().includes("tank") || a.item.toLowerCase().includes("cylinder");
    const bIsTank = b.item.toLowerCase().includes("tank") || b.item.toLowerCase().includes("cylinder");
    if (aIsTank && !bIsTank) return -1;
    if (!aIsTank && bIsTank) return 1;
    return a.item.localeCompare(b.item);
  });

  const tankSummary = Array.from(tankGasMap.entries())
    .map(([gasType, count]) => ({ gasType, count }))
    .sort((a, b) => b.count - a.count);

  return { summary, details, totalItems, tankSummary };
}
