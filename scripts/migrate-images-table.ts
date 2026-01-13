#!/usr/bin/env tsx
/**
 * Migration: Add images table to all tenant schemas
 *
 * Run with: npx tsx scripts/migrate-images-table.ts
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

      // Check if images table already exists
      const exists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = ${schema_name}
          AND table_name = 'images'
        )
      `;

      if (exists[0].exists) {
        console.log(`  - images table already exists, skipping`);
        continue;
      }

      // Create images table
      await sql.unsafe(`
        CREATE TABLE "${schema_name}"."images" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "entity_type" text NOT NULL,
          "entity_id" uuid NOT NULL,
          "url" text NOT NULL,
          "thumbnail_url" text,
          "filename" text NOT NULL,
          "width" integer,
          "height" integer,
          "alt" text,
          "sort_order" integer NOT NULL DEFAULT 0,
          "is_primary" boolean NOT NULL DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now()
        )
      `);

      // Create index
      await sql.unsafe(`
        CREATE INDEX "images_entity_idx"
        ON "${schema_name}"."images" ("entity_type", "entity_id")
      `);

      console.log(`  - Created images table and index`);
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
