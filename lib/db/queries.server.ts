/**
 * Tenant Database Query Helpers
 *
 * This file has been refactored into domain-specific modules under lib/db/queries/.
 * It re-exports everything from the barrel file for backward compatibility.
 *
 * New code should import from specific modules:
 *   import { getCustomers } from "~/lib/db/queries/customers.server";
 *   import { getTours } from "~/lib/db/queries/tours.server";
 *
 * Or from the barrel:
 *   import { getCustomers, getTours } from "~/lib/db/queries/index.server";
 */

export * from "./queries/index.server";
