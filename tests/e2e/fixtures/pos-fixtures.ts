/**
 * POS Test Fixtures
 *
 * Test data and utilities for POS cart e2e tests.
 */

/**
 * Mock product data for testing
 * These should match products seeded in the demo tenant
 */
export const testProducts = {
  retail: {
    mask: {
      name: "Dive Mask Pro",
      expectedPrice: 79.99,
      barcode: "DM001",
    },
    fins: {
      name: "Split Fins",
      expectedPrice: 129.99,
      barcode: "SF001",
    },
    wetsuit: {
      name: "3mm Wetsuit",
      expectedPrice: 199.99,
      barcode: "WS001",
    },
    snorkel: {
      name: "Snorkel",
      expectedPrice: 29.99,
      barcode: "SN001",
    },
  },
  rentals: {
    bcd: {
      name: "BCD Rental",
      dailyRate: 35.0,
      size: "Medium",
    },
    regulator: {
      name: "Regulator Set",
      dailyRate: 25.0,
    },
    tank: {
      name: "Aluminum Tank",
      dailyRate: 15.0,
    },
    wetsuit: {
      name: "Wetsuit Rental",
      dailyRate: 20.0,
      size: "Large",
    },
  },
  trips: {
    morningDive: {
      tourName: "Morning Reef Dive",
      pricePerPerson: 89.0,
      maxParticipants: 10,
    },
    afternoonDive: {
      tourName: "Afternoon Drift Dive",
      pricePerPerson: 99.0,
      maxParticipants: 8,
    },
    nightDive: {
      tourName: "Night Dive Adventure",
      pricePerPerson: 129.0,
      maxParticipants: 6,
    },
  },
};

/**
 * Mock customer data for testing
 */
export const testCustomers = {
  john: {
    firstName: "John",
    lastName: "Diver",
    email: "john.diver@example.com",
    fullName: "John Diver",
  },
  jane: {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    fullName: "Jane Smith",
  },
};

/**
 * Calculate expected cart total
 */
export function calculateCartTotal(
  items: Array<{
    type: "product" | "rental" | "booking";
    price: number;
    quantity?: number;
    days?: number;
    participants?: number;
  }>,
  taxRate: number = 0
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    if (item.type === "product") {
      return sum + item.price * (item.quantity || 1);
    } else if (item.type === "rental") {
      return sum + item.price * (item.days || 1);
    } else {
      return sum + item.price * (item.participants || 1);
    }
  }, 0);

  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Format price for comparison
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Parse price string to number
 */
export function parsePrice(priceString: string): number {
  return parseFloat(priceString.replace(/[^0-9.]/g, "")) || 0;
}

/**
 * Test scenarios for cart operations
 */
export const cartScenarios = {
  // Single retail product
  singleProduct: {
    description: "Add single retail product to cart",
    items: [{ type: "product" as const, name: "Dive Mask Pro", price: 79.99, quantity: 1 }],
  },

  // Multiple products
  multipleProducts: {
    description: "Add multiple products to cart",
    items: [
      { type: "product" as const, name: "Dive Mask Pro", price: 79.99, quantity: 2 },
      { type: "product" as const, name: "Split Fins", price: 129.99, quantity: 1 },
    ],
  },

  // Single rental
  singleRental: {
    description: "Add single rental to cart",
    items: [{ type: "rental" as const, name: "BCD Rental", price: 35.0, days: 3 }],
  },

  // Single booking
  singleBooking: {
    description: "Add single trip booking to cart",
    items: [{ type: "booking" as const, name: "Morning Reef Dive", price: 89.0, participants: 2 }],
  },

  // Mixed cart
  mixedCart: {
    description: "Add products, rentals, and bookings to cart",
    items: [
      { type: "product" as const, name: "Dive Mask Pro", price: 79.99, quantity: 1 },
      { type: "rental" as const, name: "BCD Rental", price: 35.0, days: 2 },
      { type: "booking" as const, name: "Morning Reef Dive", price: 89.0, participants: 2 },
    ],
  },
};

/**
 * Invalid barcode for testing error handling
 */
export const invalidBarcode = "INVALID123456";

/**
 * Valid barcode that should match a product
 */
export const validBarcode = "DM001"; // Dive Mask Pro
