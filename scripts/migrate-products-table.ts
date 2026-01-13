#!/usr/bin/env tsx
/**
 * Migration: Add products table to all tenant schemas for POS functionality
 *
 * Run with: npx tsx scripts/migrate-products-table.ts
 */

import postgres from "postgres";

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // Get all tenant schemas
    const schemas = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
    `;

    console.log(`Found ${schemas.length} tenant schemas`);

    for (const { schema_name } of schemas) {
      console.log(`\nMigrating schema: ${schema_name}`);

      // Check if products table already exists
      const exists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = ${schema_name}
          AND table_name = 'products'
        )
      `;

      if (exists[0].exists) {
        console.log(`  - products table already exists, skipping`);
        continue;
      }

      // Create products table
      await sql.unsafe(`
        CREATE TABLE "${schema_name}"."products" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" text NOT NULL,
          "sku" text,
          "category" text NOT NULL,
          "description" text,
          "price" decimal(10, 2) NOT NULL,
          "cost_price" decimal(10, 2),
          "currency" text NOT NULL DEFAULT 'USD',
          "tax_rate" decimal(5, 2) DEFAULT 0,
          "track_inventory" boolean NOT NULL DEFAULT true,
          "stock_quantity" integer NOT NULL DEFAULT 0,
          "low_stock_threshold" integer DEFAULT 5,
          "image_url" text,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);

      // Create indexes
      await sql.unsafe(`
        CREATE INDEX "${schema_name}_products_category_idx"
        ON "${schema_name}"."products" ("category")
      `);

      await sql.unsafe(`
        CREATE INDEX "${schema_name}_products_sku_idx"
        ON "${schema_name}"."products" ("sku")
      `);

      console.log(`  - Created products table and indexes`);
    }

    console.log("\nMigration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
