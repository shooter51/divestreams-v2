#!/usr/bin/env tsx
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  console.log("Creating Enterprise plan in Stripe...\n");

  // Create product
  const product = await stripe.products.create({
    name: "DiveStreams Enterprise",
    description: "For large operations and multiple locations",
    metadata: { plan_name: "enterprise" },
  });

  console.log("✓ Product:", product.id);

  // Create monthly price ($199)
  const monthly = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 19900,
    recurring: { interval: "month" },
    metadata: { plan_name: "enterprise", billing_period: "monthly" },
  });

  console.log("✓ Monthly price:", monthly.id, "($199/month)");

  // Create yearly price ($1,910)
  const yearly = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 191000,
    recurring: { interval: "year" },
    metadata: { plan_name: "enterprise", billing_period: "yearly" },
  });

  console.log("✓ Yearly price:", yearly.id, "($1,910/year)");

  console.log("\nUpdate database with:");
  console.log(`UPDATE subscription_plans SET monthly_price_id = '${monthly.id}', yearly_price_id = '${yearly.id}' WHERE name = 'enterprise';`);
}

main().catch(console.error);
