#!/usr/bin/env node
/**
 * Run Database Migrations
 *
 * Uses Drizzle ORM's official migrate() function with bootstrap logic
 * for existing databases that have never tracked migrations.
 *
 * Bootstrap behavior:
 * - If the `organization` table exists but `drizzle.__drizzle_migrations` is empty,
 *   this is an existing DB. Pre-seed all migration records so migrate() skips them.
 * - If `organization` does not exist, this is a fresh DB. migrate() applies everything.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '..', 'drizzle');

const MIGRATION_LOCK_ID = 123456789;

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  // postgres-js instance for raw queries (advisory lock, bootstrap)
  const sql = postgres(connectionString);
  // Separate connection for drizzle migrate() - must use max:1 for migrate
  const migrateSql = postgres(connectionString, { max: 1 });
  const db = drizzle(migrateSql);

  try {
    // Acquire advisory lock to prevent concurrent migration runs
    console.log('Acquiring migration advisory lock...');
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    console.log('Lock acquired.');

    try {
      // Bootstrap: detect existing DB that has never used drizzle migrations
      const hasOrgTable = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organization'
        ) AS exists
      `;

      if (hasOrgTable[0].exists) {
        // Existing DB - check if drizzle migrations table exists and has records
        await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
        await sql`
          CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
            id SERIAL PRIMARY KEY,
            hash TEXT NOT NULL,
            created_at BIGINT
          )
        `;

        const migrationCount = await sql`
          SELECT COUNT(*)::int AS count FROM drizzle."__drizzle_migrations"
        `;

        if (migrationCount[0].count === 0) {
          console.log('Existing DB detected with no migration records. Bootstrapping...');
          await bootstrapExistingDb(sql);
          console.log('Bootstrap complete. All existing migrations marked as applied.');
        } else {
          console.log(`Found ${migrationCount[0].count} existing migration records.`);
        }
      } else {
        console.log('Fresh database detected. Will apply all migrations.');
      }

      // Run drizzle migrate() - applies any unapplied migrations
      console.log('Running drizzle migrate()...');
      await migrate(db, { migrationsFolder });
      console.log('All migrations completed successfully!');

    } finally {
      // Release advisory lock
      await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
      console.log('Migration lock released.');
    }

  } finally {
    await migrateSql.end();
    await sql.end();
  }
}

/**
 * Pre-seed the __drizzle_migrations table with records for all existing migrations.
 * This tells migrate() that everything is already applied.
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
