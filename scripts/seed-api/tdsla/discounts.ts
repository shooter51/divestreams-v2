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
    code: "WELCOME15",
    description: "15% off your first dive with The Dive Shop LA",
    discountType: "percentage",
    discountValue: 15,
    applicableTo: "all",
  },
  {
    code: "CATALINA50",
    description: "$50 off any Catalina trip for groups of 4+",
    discountType: "fixed",
    discountValue: 50,
    minBookingAmount: 400,
    applicableTo: "tours",
  },
  {
    code: "REEFGUARDIAN",
    description: "10% off for Reef Guardian program volunteers",
    discountType: "percentage",
    discountValue: 10,
    applicableTo: "all",
  },
  {
    code: "EARLYBIRD",
    description: "20% off when booking 30+ days in advance",
    discountType: "percentage",
    discountValue: 20,
    applicableTo: "tours",
  },
  {
    code: "CERTBUNDLE",
    description: "$100 off when bundling OWD + AOW courses",
    discountType: "fixed",
    discountValue: 100,
    minBookingAmount: 500,
    applicableTo: "courses",
  },
];

export async function seedTdslaDiscounts(client: SeedClient): Promise<void> {
  console.log("Seeding TDSLA discounts...");
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
    if (spec.minBookingAmount !== undefined) formData.set("minBookingAmount", String(spec.minBookingAmount));
    if (spec.maxUses !== undefined) formData.set("maxUses", String(spec.maxUses));
    if (spec.validFrom) formData.set("validFrom", spec.validFrom);
    if (spec.validTo) formData.set("validTo", spec.validTo);
    formData.set("applicableTo", spec.applicableTo);

    const result = await client.post("/tenant/discounts", formData);
    if (result.ok || result.status === 302) {
      created++;
      console.log(`  Discount: ${spec.code}`);
    } else {
      console.warn(`  Warning: discount "${spec.code}" returned ${result.status}`);
    }
    await client.sleep(50);
  }

  console.log(`  TDSLA discounts seeded: ${created}/${DISCOUNTS.length}`);
}
