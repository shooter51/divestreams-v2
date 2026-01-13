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

  if (migration === "add-discount-codes-table") {
    return await runDiscountCodesMigration();
  }

  if (migration === "add-sale-price-columns") {
    return await runSalePriceMigration();
  }

  if (migration === "delete-all-tenants") {
    const confirmCode = formData.get("confirmCode");
    if (confirmCode !== "DELETE-ALL-TENANTS") {
      return { error: "Invalid confirmation code" };
    }
    return await deleteAllTenants();
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

async function runDiscountCodesMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "DATABASE_URL not set" };
  }

  const client = postgres(connectionString);
  const results: string[] = [];

  try {
    const allTenants = await db.select().from(tenants);

    for (const tenant of allTenants) {
      const schemaName = tenant.schemaName;

      try {
        const tableExists = await client`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${schemaName} AND table_name = 'discount_codes'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          results.push(`${tenant.subdomain}: discount_codes table already exists`);
          continue;
        }

        await client.unsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".discount_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code TEXT NOT NULL UNIQUE,
            description TEXT,
            discount_type TEXT NOT NULL DEFAULT 'percentage',
            discount_value DECIMAL(10, 2) NOT NULL,
            min_booking_amount DECIMAL(10, 2),
            max_uses INTEGER,
            used_count INTEGER NOT NULL DEFAULT 0,
            valid_from TIMESTAMPTZ,
            valid_to TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            applicable_to TEXT NOT NULL DEFAULT 'all',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_discount_codes_code_idx" ON "${schemaName}".discount_codes(code)`);
        await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_discount_codes_active_idx" ON "${schemaName}".discount_codes(is_active)`);

        results.push(`${tenant.subdomain}: Created discount_codes table successfully`);
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

async function deleteAllTenants() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "DATABASE_URL not set" };
  }

  const client = postgres(connectionString);
  const results: string[] = [];

  try {
    const allTenants = await db.select().from(tenants);

    if (allTenants.length === 0) {
      return { success: true, results: ["No tenants to delete"] };
    }

    for (const tenant of allTenants) {
      try {
        // Drop the schema
        await client.unsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
        results.push(`${tenant.subdomain}: Schema dropped`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push(`${tenant.subdomain}: ERROR dropping schema - ${message}`);
      }
    }

    // Delete all tenant records
    await db.delete(tenants);
    results.push(`Deleted ${allTenants.length} tenant records from database`);

    return { success: true, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Delete all tenants failed: ${message}` };
  } finally {
    await client.end();
  }
}

async function runSalePriceMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "DATABASE_URL not set" };
  }

  const client = postgres(connectionString);
  const results: string[] = [];

  try {
    const allTenants = await db.select().from(tenants);

    for (const tenant of allTenants) {
      const schemaName = tenant.schemaName;

      try {
        // Check if sale_price column exists
        const columnExists = await client`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = ${schemaName}
            AND table_name = 'products'
            AND column_name = 'sale_price'
          ) as exists
        `;

        if (columnExists[0]?.exists) {
          results.push(`${tenant.subdomain}: Sale price columns already exist`);
          continue;
        }

        await client.unsafe(`
          ALTER TABLE "${schemaName}".products
          ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2),
          ADD COLUMN IF NOT EXISTS sale_start_date TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS sale_end_date TIMESTAMPTZ
        `);

        results.push(`${tenant.subdomain}: Added sale price columns successfully`);
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

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Discount Codes Table</h2>
        <p className="text-gray-600 mb-4">
          Creates the discount_codes table for all existing tenant schemas. Required for discount code functionality.
        </p>

        <Form method="post">
          <input type="hidden" name="migration" value="add-discount-codes-table" />
          <button
            type="submit"
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isRunning ? "Running Migration..." : "Run Migration"}
          </button>
        </Form>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Sale Price Columns</h2>
        <p className="text-gray-600 mb-4">
          Adds sale_price, sale_start_date, and sale_end_date columns to the products table. Required for sale pricing in POS.
        </p>

        <Form method="post">
          <input type="hidden" name="migration" value="add-sale-price-columns" />
          <button
            type="submit"
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isRunning ? "Running Migration..." : "Run Migration"}
          </button>
        </Form>
      </div>

      <div className="bg-red-50 border border-red-300 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-red-700">⚠️ Delete All Tenants</h2>
        <p className="text-red-600 mb-4">
          <strong>DANGER:</strong> This will permanently delete ALL tenants and their data. This action cannot be undone.
        </p>

        <Form method="post">
          <input type="hidden" name="migration" value="delete-all-tenants" />
          <div className="mb-4">
            <label className="block text-sm font-medium text-red-700 mb-1">
              Type DELETE-ALL-TENANTS to confirm:
            </label>
            <input
              type="text"
              name="confirmCode"
              placeholder="DELETE-ALL-TENANTS"
              className="w-full max-w-xs px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={isRunning}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400"
          >
            {isRunning ? "Deleting..." : "Delete All Tenants"}
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
