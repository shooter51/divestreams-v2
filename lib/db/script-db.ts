/**
 * Script-friendly database connection
 * Use this for CLI scripts that need a direct database connection
 * without the proxy pattern used by the main app (for SSR compatibility)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "dotenv";

// Load .env file for scripts
config();

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set. Make sure .env file exists.");
  }
  return connectionString;
}

// Direct connection for scripts - no proxy
const connectionString = getConnectionString();
const queryClient = postgres(connectionString);

export const scriptDb = drizzle(queryClient, { schema });

// Export end function for cleanup
export async function closeConnection() {
  await queryClient.end();
}

// Re-export schema for convenience
export { schema };
