import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_migrationDb as any)[prop];
  },
});

// ============================================================================
// ROW-LEVEL SECURITY (RLS) ORG CONTEXT HELPER
// ============================================================================

/**
 * Transaction type from Drizzle's db.transaction() callback.
 * This is the `tx` parameter that gets passed to transaction callbacks.
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute a callback within a transaction that has the RLS org context set.
 *
 * This sets `app.current_org_id` via SET LOCAL, which scopes the setting to
 * the current transaction only. PostgreSQL RLS policies on tenant tables will
 * then filter rows to only those matching the organization_id.
 *
 * Usage:
 * ```ts
 * const results = await withOrgContext(orgId, async (tx) => {
 *   return tx.select().from(customers);
 *   // RLS automatically filters to only this org's customers
 * });
 * ```
 *
 * @param organizationId - The organization ID to set as the RLS context
 * @param callback - A function receiving the transaction object (tx)
 * @returns The return value of the callback
 */
export async function withOrgContext<T>(
  organizationId: string,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL scopes the setting to this transaction only.
    // When the transaction completes (commit or rollback), the setting is gone.
    // This prevents org context from leaking to other connections in the pool.
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`
    );
    return callback(tx);
  });
}

/**
 * Set the org context on a raw postgres-js SQL connection for use outside
 * of Drizzle transactions (e.g., in raw SQL queries).
 *
 * IMPORTANT: This must be called inside a postgres-js transaction (sql.begin)
 * for the SET LOCAL to be properly scoped. Outside a transaction, the setting
 * persists for the session and could leak to other requests sharing the
 * connection from the pool.
 *
 * For most use cases, prefer `withOrgContext()` which handles this automatically.
 */
export function setOrgContextSQL(organizationId: string) {
  return sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
}

// Export types
export type Database = ReturnType<typeof drizzle<typeof schema>>;
