import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres client
// For query purposes (regular operations)
const queryClient = postgres(connectionString);

// Create drizzle instance for public schema
export const db = drizzle(queryClient, { schema });

// For migrations and admin operations, we need a separate client
// that can handle transactions and schema operations
const migrationClient = postgres(connectionString, { max: 1 });
export const migrationDb = drizzle(migrationClient);

// Export types
export type Database = typeof db;
