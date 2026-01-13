/**
 * Admin Migrations Page
 * Run database migrations for existing tenants
 */

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Form } from "react-router";
import { isAdminAuthenticated, isAdminSubdomain } from "../../../lib/auth/admin-auth.server";
import { db } from "../../../lib/db/index";
import { tenants } from "../../../lib/db/schema";
import postgres from "postgres";

export const meta: MetaFunction = () => [{ title: "Migrations - Admin - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  if (!isAdminSubdomain(request)) {
    return redirect("https://divestreams.com");
  }
  if (!isAdminAuthenticated(request)) {
    return redirect("/login");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (!isAdminAuthenticated(request)) {
    return { error: "Not authenticated" };
  }

  const formData = await request.formData();
  const migration = formData.get("migration");

  if (migration === "add-rentals-table") {
    return await runRentalsMigration();
  }

  return { error: "Unknown migration" };
}

async function runRentalsMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "DATABASE_URL not set" };
  }

  const client = postgres(connectionString);
  const results: string[] = [];

  try {
    // Get all tenants
    const allTenants = await db.select().from(tenants);

    for (const tenant of allTenants) {
      const schemaName = tenant.schemaName;

      try {
        // Check if rentals table already exists
        const tableExists = await client`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${schemaName} AND table_name = 'rentals'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          results.push(`${tenant.subdomain}: Rentals table already exists`);
          continue;
        }

        // Create rentals table
        await client.unsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".rentals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID REFERENCES "${schemaName}".transactions(id),
            customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id),
            equipment_id UUID NOT NULL REFERENCES "${schemaName}".equipment(id),
            rented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            due_at TIMESTAMPTZ NOT NULL,
            returned_at TIMESTAMPTZ,
            daily_rate DECIMAL(10, 2) NOT NULL,
            total_charge DECIMAL(10, 2) NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            agreement_number TEXT NOT NULL,
            agreement_signed_at TIMESTAMPTZ,
            agreement_signed_by TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        // Create indexes
        await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_customer_idx" ON "${schemaName}".rentals(customer_id)`);
        await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_equipment_idx" ON "${schemaName}".rentals(equipment_id)`);
        await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_status_idx" ON "${schemaName}".rentals(status)`);

        results.push(`${tenant.subdomain}: Created rentals table successfully`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push(`${tenant.subdomain}: ERROR - ${message}`);
      }
    }

    return { success: true, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Migration failed: ${message}` };
  } finally {
    await client.end();
  }
}

export default function AdminMigrationsPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isRunning = navigation.state === "submitting";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Database Migrations</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Rentals Table</h2>
        <p className="text-gray-600 mb-4">
          Creates the rentals table for all existing tenant schemas. This is required for the POS rental functionality.
        </p>

        <Form method="post">
          <input type="hidden" name="migration" value="add-rentals-table" />
          <button
            type="submit"
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isRunning ? "Running Migration..." : "Run Migration"}
          </button>
        </Form>
      </div>

      {actionData?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
          {actionData.error}
        </div>
      )}

      {actionData?.success && actionData.results && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Migration Complete</h3>
          <ul className="text-sm text-green-700 space-y-1">
            {actionData.results.map((result, i) => (
              <li key={i} className={result.includes("ERROR") ? "text-red-600" : ""}>
                {result}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
