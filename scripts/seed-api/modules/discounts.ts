import type { SeedClient } from "../client";

interface DiscountSpec {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minBookingAmount?: number;
  maxUses?: number;
  validFrom?: string;
  validTo?: string;
  applicableTo: "all" | "tours" | "courses";
}

const DISCOUNTS: DiscountSpec[] = [
  {
    code: "WELCOME10",
    description: "Welcome discount for new customers",
    discountType: "percentage",
    discountValue: 10,
    applicableTo: "all",
  },
  {
    code: "SUMMER20",
    description: "Summer 2026 seasonal promotion",
    discountType: "percentage",
    discountValue: 20,
    validTo: "2026-12-31T23:59",
    applicableTo: "all",
  },
  {
    code: "GROUPDIVE",
    description: "$50 off group dive bookings of 4 or more",
    discountType: "fixed",
    discountValue: 50,
    minBookingAmount: 200,
    applicableTo: "tours",
  },
  {
    code: "EARLYBIRD",
    description: "15% off when booking 30+ days in advance",
    discountType: "percentage",
    discountValue: 15,
    applicableTo: "all",
  },
];

export async function seedDiscounts(client: SeedClient): Promise<void> {
  console.log("Seeding discount codes...");
  let created = 0;

  for (const spec of DISCOUNTS) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("intent", "create");
    formData.set("code", spec.code);
    formData.set("description", spec.description);
    formData.set("discountType", spec.discountType);
    formData.set("discountValue", String(spec.discountValue));
    if (spec.minBookingAmount !== undefined) {
      formData.set("minBookingAmount", String(spec.minBookingAmount));
    }
    if (spec.maxUses !== undefined) {
      formData.set("maxUses", String(spec.maxUses));
    }
    if (spec.validFrom) {
      formData.set("validFrom", spec.validFrom);
    }
    if (spec.validTo) {
      formData.set("validTo", spec.validTo);
    }
    formData.set("applicableTo", spec.applicableTo);

    const result = await client.post("/tenant/discounts", formData);

    if (result.ok || result.status === 302) {
      created++;
      console.log(`  Created discount: "${spec.code}"`);
    } else {
      console.warn(`  Warning: discount "${spec.code}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`Discount codes seeded: ${created}/${DISCOUNTS.length}`);
}
