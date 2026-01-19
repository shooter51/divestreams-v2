/**
 * Google Calendar Booking Sync
 *
 * Handles syncing booking attendees to Google Calendar events.
 * When a booking is created, the customer is added as an attendee to the trip's calendar event.
 * When a booking is cancelled, the customer is removed from the attendees.
 */

import { syncTripToCalendar } from "./google-calendar.server";

/**
 * Sync booking to calendar by updating trip attendees
 *
 * This function updates the calendar event for the trip to include
 * the newly booked customer as an attendee.
 *
 * @param orgId - Organization ID
 * @param tripId - Trip ID that was booked
 * @param timezone - Organization timezone
 */
export async function syncBookingToCalendar(
  orgId: string,
  tripId: string,
  timezone = "UTC"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Sync the entire trip to calendar, which will include all current bookings as attendees
    const result = await syncTripToCalendar(orgId, tripId, timezone);
    return result;
  } catch (error) {
    console.error("Failed to sync booking to calendar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync booking cancellation to calendar
 *
 * This function updates the calendar event for the trip to remove
 * the cancelled booking's customer from attendees.
 *
 * @param orgId - Organization ID
 * @param tripId - Trip ID
 * @param timezone - Organization timezone
 */
export async function syncBookingCancellationToCalendar(
  orgId: string,
  tripId: string,
  timezone = "UTC"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Re-sync the entire trip to calendar to update attendee list
    const result = await syncTripToCalendar(orgId, tripId, timezone);
    return result;
  } catch (error) {
    console.error("Failed to sync booking cancellation to calendar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
