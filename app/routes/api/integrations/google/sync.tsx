/**
 * Manual Google Calendar Sync Endpoint
 *
 * Allows users to manually trigger a bulk sync of all trips to Google Calendar.
 * This is useful for initial sync or recovering from sync errors.
 *
 * Route: /api/integrations/google/sync
 */

import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { syncAllTrips } from "../../../../../lib/integrations/google-calendar.server";
import { getOrganizationById } from "../../../../../lib/db/queries.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { organizationId } = await requireOrgContext(request);

    // Get organization timezone for proper date handling
    const org = await getOrganizationById(organizationId);
    const timezone = org?.timezone || "UTC";

    // Parse request body for date range (optional)
    const body = await request.json();
    const startDate = body.startDate || new Date().toISOString().split("T")[0];
    const endDate =
      body.endDate ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]; // Next 90 days

    // Trigger bulk sync
    const result = await syncAllTrips(
      organizationId,
      startDate,
      endDate,
      timezone
    );

    if (result.failed > 0 && result.synced === 0) {
      return json(
        {
          error: `Failed to sync trips: ${result.errors.join(", ")}`,
        },
        { status: 500 }
      );
    }

    return json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
      message:
        result.failed > 0
          ? `Synced ${result.synced} trips with ${result.failed} failures`
          : `Successfully synced ${result.synced} trips`,
    });
  } catch (error) {
    console.error("Google Calendar sync error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Google Calendar",
      },
      { status: 500 }
    );
  }
}
