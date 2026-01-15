#!/usr/bin/env node
/**
 * Run Database Migrations
 *
 * Executes SQL migration files in order against the database.
 * Used by the Docker entrypoint to initialize the database schema.
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const sql = postgres(connectionString);

  try {
    // Get migration files from the drizzle directory
    const migrationsDir = path.join(__dirname, '..', 'drizzle');

    if (!fs.existsSync(migrationsDir)) {
      console.log('No drizzle migrations directory found, skipping...');
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // Split by statement breakpoint marker used by Drizzle
      const statements = sqlContent.split('--> statement-breakpoint')
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
            console.log(`  Skipping (already exists): ${statement.slice(0, 50)}...`);
          } else {
            throw err;
          }
        }
      }

      console.log(`  Completed: ${file}`);
    }

    console.log('All migrations completed successfully!');

  } finally {
    await sql.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
