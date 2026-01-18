/**
 * Manual Google Calendar Sync Endpoint
 *
 * Allows users to manually trigger a bulk sync of all trips to Google Calendar.
 * This is useful for initial sync or recovering from sync errors.
 *
 * Route: /api/integrations/google/sync
 */

import type { ActionFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { syncAllTrips } from "../../../../../lib/integrations/google-calendar.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { org } = await requireOrgContext(request);

    // Get organization timezone for proper date handling
    // Note: Organization doesn't have timezone field yet, defaulting to UTC
    const timezone = "UTC";

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
      org.id,
      startDate,
      endDate,
      timezone
    );

    if (result.failed > 0 && result.synced === 0) {
      return Response.json(
        {
          error: `Failed to sync trips: ${result.errors.join(", ")}`,
        },
        { status: 500 }
      );
    }

    return Response.json({
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
    return Response.json(
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
