#!/usr/bin/env node
/**
 * Run Database Migrations
 *
 * Applies migrations using the Drizzle journal for ordering and tracks them
 * in `drizzle.__drizzle_migrations` (compatible with Drizzle's migrate()).
 *
 * Handles "already exists" errors for idempotency — needed because some
 * migrations have overlapping DDL (Drizzle snapshots + custom migrations).
 *
 * Bootstrap behavior for existing databases:
 * - If `organization` table exists but `drizzle.__drizzle_migrations` is empty,
 *   pre-seeds all migration records so they're skipped.
 * - If `organization` does not exist, applies everything from scratch.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '..', 'drizzle');

const MIGRATION_LOCK_ID = 123456789;

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const sql = postgres(connectionString);

  try {
    // Acquire advisory lock to prevent concurrent migration runs
    console.log('Acquiring migration advisory lock...');
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    console.log('Lock acquired.');

    try {
      // Ensure drizzle schema and migrations table exist
      await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
      await sql`
        CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT
        )
      `;

      // Check if this is an existing DB that needs bootstrapping
      const hasOrgTable = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organization'
        ) AS exists
      `;

      const migrationCount = await sql`
        SELECT COUNT(*)::int AS count FROM drizzle."__drizzle_migrations"
      `;

      if (hasOrgTable[0].exists && migrationCount[0].count === 0) {
        console.log('Existing DB detected with no migration records. Bootstrapping...');
        await bootstrapExistingDb(sql);
        console.log('Bootstrap complete. All existing migrations marked as applied.');
      } else if (migrationCount[0].count > 0) {
        console.log(`Found ${migrationCount[0].count} existing migration records.`);
      } else {
        console.log('Fresh database detected. Will apply all migrations.');
      }

      // Read journal and apply unapplied migrations
      const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

      // Get the latest applied migration timestamp
      const lastApplied = await sql`
        SELECT created_at FROM drizzle."__drizzle_migrations"
        ORDER BY created_at DESC LIMIT 1
      `;
      const lastTimestamp = lastApplied.length > 0 ? Number(lastApplied[0].created_at) : -1;

      let applied = 0;
      let skipped = 0;

      for (const entry of journal.entries) {
        if (entry.when <= lastTimestamp) {
          skipped++;
          continue;
        }

        const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
        const content = fs.readFileSync(migrationPath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        console.log(`Applying migration: ${entry.tag}`);

        // Split by statement breakpoint marker
        const statements = content.split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          try {
            await sql.unsafe(statement);
          } catch (err) {
            // Ignore "already exists" errors for idempotency
            if (err.code === '42P07' || // duplicate_table
                err.code === '42710' || // duplicate_object
                err.code === '42P16' || // invalid_table_definition (constraint already exists)
                err.code === '42701') { // duplicate_column
              console.log(`  Skipping (already exists): ${statement.slice(0, 60)}...`);
            } else {
              throw err;
            }
          }
        }

        // Record the migration as applied
        await sql`
          INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
          VALUES (${hash}, ${entry.when})
        `;

        applied++;
        console.log(`  Completed: ${entry.tag}`);
      }

      console.log(`\nMigration summary: ${applied} applied, ${skipped} skipped (already applied).`);
      console.log('All migrations completed successfully!');

    } finally {
      await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
      console.log('Migration lock released.');
    }

  } finally {
    await sql.end();
  }
}

/**
 * Pre-seed the __drizzle_migrations table with records for all existing migrations.
 * This tells the runner that everything is already applied.
 */
async function bootstrapExistingDb(sql) {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  for (const entry of journal.entries) {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;

    console.log(`  Bootstrapped: ${entry.tag}`);
  }
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
