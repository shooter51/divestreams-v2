import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Check if we're on the server (DATABASE_URL available)
const isServer = typeof process !== "undefined" && process.env?.DATABASE_URL;

// Lazy initialization for server-side only
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _migrationDb: ReturnType<typeof drizzle> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return connectionString;
}

// No-op proxy for client-side - does nothing but doesn't throw
const clientSafeProxy = new Proxy({} as any, {
  get() {
    // Return a function that returns a proxy (for chained calls like db.select().from())
    return () => clientSafeProxy;
  },
});

// Create drizzle instance for public schema (lazy, client-safe)
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    // On client side, return no-op proxy
    if (!isServer) {
      return clientSafeProxy[prop];
    }
    // On server side, lazily initialize real database connection
    if (!_db) {
      const connectionString = getConnectionString();
      const queryClient = postgres(connectionString, {
        max: 20,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      _db = drizzle(queryClient, { schema });
    }
    return (_db as any)[prop];
  },
});

// For migrations and admin operations (lazy, client-safe)
export const migrationDb = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    // On client side, return no-op proxy
    if (!isServer) {
      return clientSafeProxy[prop];
    }
    // On server side, lazily initialize real database connection
    if (!_migrationDb) {
      const connectionString = getConnectionString();
      const migrationClient = postgres(connectionString, { max: 1 });
      _migrationDb = drizzle(migrationClient);
    }
    return (_migrationDb as any)[prop];
  },
});

// Export types
export type Database = ReturnType<typeof drizzle<typeof schema>>;
