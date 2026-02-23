import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getTripWithFullDetails,
  getTripBookings,
  getTripRevenue,
  getTripBookedParticipants,
  updateTripStatus,
} from "../../../../lib/db/queries.server";
import { db } from "../../../../lib/db";
import { customerCommunications, trips } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getRecurringSeriesInstances,
  cancelRecurringSeries,
} from "../../../../lib/trips/recurring.server";
import { useNotification, redirectWithNotification } from "../../../../lib/use-notification";
import { redirect } from "react-router";
import { StatusBadge, type BadgeStatus } from "../../../components/ui";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Trip Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const tripId = params.id;

  if (!tripId) {
    throw new Response("Trip ID is required", { status: 400 });
  }

  // Fetch all trip data from database in parallel
  const [trip, bookings, revenue, bookedParticipants] = await Promise.all([
    getTripWithFullDetails(organizationId, tripId),
    getTripBookings(organizationId, tripId),
    getTripRevenue(organizationId, tripId),
    getTripBookedParticipants(organizationId, tripId),
  ]);

  if (!trip) {
    throw new Response("Trip not found", { status: 404 });
  }

  // Fetch recurring trip info if applicable
  let recurringInfo: {
    isRecurring: boolean;
    recurrencePattern: string | null;
    templateId: string | null;
    isTemplate: boolean;
    seriesInstances: Array<{ id: string; date: string; startTime: string; status: string }>;
  } | null = null;

  // Get recurring fields directly from DB
  const [tripRecurringData] = await db
    .select({
      isRecurring: trips.isRecurring,
      recurrencePattern: trips.recurrencePattern,
      recurringTemplateId: trips.recurringTemplateId,
      recurrenceEndDate: trips.recurrenceEndDate,
      recurrenceCount: trips.recurrenceCount,
    })
    .from(trips)
    .where(and(eq(trips.organizationId, organizationId), eq(trips.id, tripId)))
    .limit(1);

  if (tripRecurringData?.isRecurring) {
    const templateId = tripRecurringData.recurringTemplateId || tripId;
    const seriesInstances = await getRecurringSeriesInstances(organizationId, templateId, {
      futureOnly: true,
      limit: 10,
    });

    recurringInfo = {
      isRecurring: true,
      recurrencePattern: tripRecurringData.recurrencePattern,
      templateId,
      isTemplate: !tripRecurringData.recurringTemplateId,
      seriesInstances: seriesInstances.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        status: s.status,
      })),
    };
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Add bookedParticipants to trip object and format dates
  const tripWithBookedCount = {
    ...trip,
    bookedParticipants,
    createdAt: formatDate(trip.createdAt),
  };

  return { trip: tripWithBookedCount, bookings, revenue, recurringInfo };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const tripId = params.id!;

  if (intent === "cancel") {
    await updateTripStatus(organizationId, tripId, "cancelled");
    return redirect(redirectWithNotification(`/tenant/trips/${tripId}`, "Trip has been successfully cancelled", "success"));
  }

  if (intent === "cancel-series") {
    const templateId = formData.get("templateId") as string;
    if (templateId) {
      await cancelRecurringSeries(organizationId, templateId, { includeTemplate: true });
      return redirect(redirectWithNotification("/tenant/trips", "Trip series has been successfully cancelled", "success"));
    }
    return { error: "Template ID required to cancel series" };
  }

  if (intent === "complete") {
    await updateTripStatus(organizationId, tripId, "completed");
    return redirect(redirectWithNotification(`/tenant/trips/${tripId}`, "Trip has been successfully marked as complete", "success"));
  }

  if (intent === "send-bulk-email") {
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;
    const customerDataRaw = formData.get("customers") as string;

    if (!subject || !body) {
      return { error: "Subject and message are required" };
    }

    let customers: Array<{ id: string; email: string; firstName: string; lastName: string }> = [];
    try {
      customers = JSON.parse(customerDataRaw);
    } catch {
      return { error: "Invalid customer data" };
    }

    if (customers.length === 0) {
      return { error: "No passengers to email" };
    }

    // Log communications for each customer
    let sentCount = 0;
    for (const customer of customers) {
      try {
        await db.insert(customerCommunications).values({
          organizationId,
          customerId: customer.id,
          type: "email",
          subject,
          body,
          status: "sent",
          sentAt: new Date(),
          emailTo: customer.email,
          metadata: { tripId },
        });
        sentCount++;
      } catch {
        // Continue even if one fails (table might not exist)
      }
    }

    return {
      success: true,
      message: `Email sent to ${sentCount} passenger${sentCount !== 1 ? "s" : ""}. Note: Email delivery requires SMTP configuration.`,
    };
  }

  return null;
}

// Map trip status strings to BadgeStatus types
function mapTripStatusToBadgeStatus(status: string): BadgeStatus {
  const statusMap: Record<string, BadgeStatus> = {
    open: "pending",
    confirmed: "confirmed",
    full: "confirmed",
    completed: "completed",
    cancelled: "cancelled",
  };
  return statusMap[status] || "pending";
}

// Quick message templates for common scenarios
const messageTemplates = [
  {
    name: "Weather Delay",
    subject: "Important: Trip Time Update",
    body: "Dear {firstName},\n\nDue to weather conditions, your trip scheduled for {tripDate} has been pushed back by 1 hour. Please arrive at {newTime} instead.\n\nWe apologize for any inconvenience and thank you for your understanding.\n\nBest regards,\n{shopName}",
  },
  {
    name: "Trip Cancelled",
    subject: "Trip Cancellation Notice",
    body: "Dear {firstName},\n\nUnfortunately, due to unforeseen circumstances, we have had to cancel the trip scheduled for {tripDate}.\n\nOur team will contact you shortly to arrange a full refund or reschedule your booking.\n\nWe sincerely apologize for any inconvenience caused.\n\nBest regards,\n{shopName}",
  },
  {
    name: "Reminder",
    subject: "Reminder: Your Trip Tomorrow!",
    body: "Dear {firstName},\n\nThis is a friendly reminder about your trip tomorrow, {tripDate}, departing at {tripTime}.\n\nPlease remember to bring:\n- Valid ID\n- Sunscreen\n- Towel\n- Camera\n\nWe look forward to seeing you!\n\nBest regards,\n{shopName}",
  },
  {
    name: "Location Change",
    subject: "Important: Meeting Point Change",
    body: "Dear {firstName},\n\nPlease note that the meeting point for your trip on {tripDate} has changed.\n\n[New meeting point details here]\n\nPlease arrive at least 15 minutes before the scheduled departure at {tripTime}.\n\nSee you soon!\n\nBest regards,\n{shopName}",
  },
];

export default function TripDetailPage() {
  useNotification();

  const { trip, bookings, revenue, recurringInfo } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string; seriesCancelled?: boolean }>();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const spotsAvailable = (trip.maxParticipants ?? 0) - trip.bookedParticipants;

  // Get unique customers from bookings
  const customers = bookings.map((b) => ({
    id: b.customer.id,
    email: b.customer.email,
    firstName: b.customer.firstName,
    lastName: b.customer.lastName,
  }));

  // Format trip details for templates
  const tripDate = new Date(trip.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const applyTemplate = (template: typeof messageTemplates[0]) => {
    // Replace placeholders with actual values
    const subject = template.subject;
    const body = template.body
      .replace(/{tripDate}/g, tripDate)
      .replace(/{tripTime}/g, trip.startTime)
      .replace(/{shopName}/g, trip.tour.name.split(" - ")[0] || "Our Team");

    setEmailSubject(subject);
    setEmailBody(body);
  };

  const handleSendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("intent", "send-bulk-email");
    formData.append("subject", emailSubject);
    formData.append("body", emailBody);
    formData.append("customers", JSON.stringify(customers));
    fetcher.submit(formData, { method: "post" });
    setShowEmailModal(false);
    setEmailSubject("");
    setEmailBody("");
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this trip? All bookings will be affected.")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
    }
  };

  const handlePrintManifest = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const manifestHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip Manifest - ${trip.tour.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .info-item label { font-size: 12px; color: #666; display: block; }
          .info-item span { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .status-paid {
            background: var(--success-muted, #d1fae5);
            color: var(--success, #065f46);
          }
          .status-pending {
            background: var(--warning-muted, #fef3c7);
            color: var(--warning, #92400e);
          }
          .notes-section { margin-top: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
          .notes-section h3 { margin-top: 0; }
          .signature-line { margin-top: 50px; border-top: 1px solid #000; width: 200px; padding-top: 5px; }
          @media print {
            body { padding: 0; }
            /* Force light mode colors for print */
            .status-paid { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fef3c7; color: #92400e; }
          }
        </style>
      </head>
      <body>
        <h1>${trip.tour.name}</h1>
        <p class="subtitle">Trip Manifest</p>

        <div class="info-grid">
          <div class="info-item">
            <label>Date</label>
            <span>${tripDate}</span>
          </div>
          <div class="info-item">
            <label>Time</label>
            <span>${trip.startTime} - ${trip.endTime}</span>
          </div>
          <div class="info-item">
            <label>Boat</label>
            <span>${trip.boat?.name || "Not assigned"}</span>
          </div>
          <div class="info-item">
            <label>Capacity</label>
            <span>${trip.bookedParticipants} / ${trip.maxParticipants} passengers</span>
          </div>
        </div>

        <h2>Passengers (${bookings.length} bookings)</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Booking #</th>
              <th>Pax</th>
              <th>Payment</th>
              <th>Check-in</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${b.customer.firstName} ${b.customer.lastName}</td>
                <td>${b.bookingNumber}</td>
                <td>${b.participants}</td>
                <td><span class="status ${b.paidInFull ? "status-paid" : "status-pending"}">${b.paidInFull ? "Paid" : "Pending"}</span></td>
                <td style="width: 80px;"></td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="notes-section">
          <h3>Notes</h3>
          <p>${trip.notes || "No notes"}</p>
        </div>

        <div class="signature-line">
          Captain / Guide Signature
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(manifestHtml);
    printWindow.document.close();
  };

  const handleExportPDF = () => {
    // Use the same manifest but prompt to save as PDF
    handlePrintManifest();
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/trips" className="text-brand hover:underline text-sm">
          ← Back to Trips
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{trip.tour.name}</h1>
            <StatusBadge status={mapTripStatusToBadgeStatus(trip.status)} size="md" />
            {recurringInfo?.isRecurring && (
              <span
                className="text-sm px-3 py-1 rounded-full bg-info-muted text-info flex items-center gap-1 cursor-pointer"
                onClick={() => setShowSeriesModal(true)}
                title="Click to view series"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {recurringInfo.recurrencePattern}
                {recurringInfo.isTemplate && " (template)"}
              </span>
            )}
          </div>
          <p className="text-foreground-muted">
            {new Date(trip.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            at {trip.startTime}
          </p>
        </div>
        <div className="flex gap-2">
          {trip.status !== "cancelled" && trip.status !== "completed" && spotsAvailable > 0 && (
            <Link
              to={`/tenant/bookings/new?tripId=${trip.id}`}
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
            >
              Add Booking
            </Link>
          )}
          {trip.status === "confirmed" && (
            <fetcher.Form method="post">
              <CsrfInput />
              <input type="hidden" name="intent" value="complete" />
              <button
                type="submit"
                className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover"
              >
                Mark Complete
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/tenant/trips/${trip.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Edit
          </Link>
          {trip.status !== "cancelled" && trip.status !== "completed" && (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
              >
                Cancel Trip
              </button>
              {recurringInfo?.isRecurring && (
                <fetcher.Form method="post" onSubmit={(e) =>
                  {
                  if (!confirm("Are you sure you want to cancel ALL future trips in this series?")) {
                    e.preventDefault();
                  }
                }}>
                  <CsrfInput />
                  <input type="hidden" name="intent" value="cancel-series" />
                  <input type="hidden" name="templateId" value={recurringInfo.templateId || ""} />
                  <button
                    type="submit"
                    className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
                  >
                    Cancel Series
                  </button>
                </fetcher.Form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {trip.bookedParticipants}/{trip.maxParticipants}
              </p>
              <p className="text-foreground-muted text-sm">Booked</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-success">{spotsAvailable}</p>
              <p className="text-foreground-muted text-sm">Spots Left</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${revenue.bookingsTotal}</p>
              <p className="text-foreground-muted text-sm">Total Revenue</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-warning">${revenue.pendingTotal}</p>
              <p className="text-foreground-muted text-sm">Pending Payment</p>
            </div>
          </div>

          {/* Trip Details */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Trip Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">Time</p>
                <p>
                  {trip.startTime} - {trip.endTime}
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Boat</p>
                <Link to={`/tenant/boats/${trip.boat.id}`} className="text-brand hover:underline">
                  {trip.boat.name}
                </Link>
              </div>
              <div>
                <p className="text-foreground-muted">Price</p>
                <p>${trip.price} per person</p>
              </div>
              <div>
                <p className="text-foreground-muted">Tour</p>
                <Link to={`/tenant/tours/${trip.tour.id}`} className="text-brand hover:underline">
                  {trip.tour.name}
                </Link>
              </div>
            </div>
            {trip.diveSites && trip.diveSites.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-foreground-muted text-sm mb-2">Dive Sites</p>
                <div className="space-y-1">
                  {trip.diveSites.map((site) => (
                    <Link
                      key={site.id}
                      to={`/tenant/dive-sites/${site.id}`}
                      className="block text-sm text-brand hover:underline"
                    >
                      {site.name}
                      {site.maxDepth && ` (${site.maxDepth}m)`}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Weather & Notes */}
          {(trip.weatherNotes || trip.notes) && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <div className="space-y-4 text-sm">
                {trip.weatherNotes && (
                  <div>
                    <p className="text-foreground-muted mb-1">Weather:</p>
                    <p>{trip.weatherNotes}</p>
                  </div>
                )}
                {trip.notes && (
                  <div>
                    <p className="text-foreground-muted mb-1">Internal Notes:</p>
                    <p>{trip.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Bookings ({bookings.length})</h2>
              {spotsAvailable > 0 && (
                <Link
                  to={`/tenant/bookings/new?tripId=${trip.id}`}
                  className="text-brand text-sm hover:underline"
                >
                  + Add Booking
                </Link>
              )}
            </div>
            {bookings.length === 0 ? (
              <p className="text-foreground-muted text-sm">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/tenant/bookings/${booking.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">
                        {String(booking.customer.firstName)} {String(booking.customer.lastName)}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {booking.bookingNumber} • {booking.participants} pax
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${booking.total}</p>
                      {!booking.paidInFull && (
                        <span className="text-xs text-warning">Payment pending</span>
                      )}
                      {booking.paidInFull && (
                        <span className="text-xs text-success">Paid</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Staff</h2>
            {trip.staff.length === 0 ? (
              <p className="text-foreground-muted text-sm">No staff assigned.</p>
            ) : (
              <div className="space-y-2">
                {trip.staff.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-overlay rounded-full flex items-center justify-center text-sm">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-foreground-muted">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              to={`/tenant/trips/${trip.id}/edit`}
              className="block text-center mt-4 text-brand text-sm hover:underline"
            >
              Manage Staff
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={handlePrintManifest}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                📋 Print Manifest
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={bookings.length === 0}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📧 Email Passengers {bookings.length > 0 && `(${bookings.length})`}
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                📤 Export to PDF
              </button>
              <Link
                to={`/tenant/trips/new?tourId=${trip.tour.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                📅 Schedule Similar Trip
              </Link>
            </div>
          </div>

          {/* Participant Summary */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Capacity</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Max Capacity</span>
                <span>{trip.maxParticipants}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Booked</span>
                <span>{trip.bookedParticipants}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Available</span>
                <span className={spotsAvailable === 0 ? "text-danger" : "text-success"}>
                  {spotsAvailable}
                </span>
              </div>
              <div className="mt-2 bg-surface-overlay rounded-full h-2">
                <div
                  className="bg-brand rounded-full h-2"
                  style={{
                    width: `${(trip.bookedParticipants / (trip.maxParticipants ?? 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>Created {trip.createdAt}</p>
            <p>Trip ID: {trip.id}</p>
          </div>
        </div>
      </div>

      {/* Series Instances Modal */}
      {showSeriesModal && recurringInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">Recurring Trip Series</h2>
                  <p className="text-sm text-foreground-muted">
                    {recurringInfo.recurrencePattern} recurrence
                    {recurringInfo.isTemplate && " - This is the template trip"}
                  </p>
                </div>
                <button
                  onClick={() => setShowSeriesModal(false)}
                  className="text-foreground-subtle hover:text-foreground-muted"
                >
                  X
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground mb-3">
                  Upcoming trips in this series:
                </p>
                {recurringInfo.seriesInstances.length === 0 ? (
                  <p className="text-sm text-foreground-muted">No upcoming trips in this series.</p>
                ) : (
                  recurringInfo.seriesInstances.map((instance) => (
                    <Link
                      key={instance.id}
                      to={`/tenant/trips/${instance.id}`}
                      onClick={() => setShowSeriesModal(false)}
                      className={`flex justify-between items-center p-3 rounded-lg hover:bg-surface-overlay ${
                        instance.id === trip.id ? "bg-brand-muted border border-brand" : "bg-surface-inset"
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(instance.date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-foreground-muted">{instance.startTime}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={mapTripStatusToBadgeStatus(instance.status)} />
                        {instance.id === trip.id && (
                          <span className="text-xs text-foreground-muted">(current)</span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
                {recurringInfo.seriesInstances.length === 10 && (
                  <p className="text-xs text-foreground-muted text-center pt-2">
                    Showing next 10 trips. More trips may exist.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t flex justify-end">
                <button
                  onClick={() => setShowSeriesModal(false)}
                  className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Passengers Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">Email All Passengers</h2>
                  <p className="text-sm text-foreground-muted">
                    Send a message to {bookings.length} passenger{bookings.length !== 1 ? "s" : ""} on this trip
                  </p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-foreground-subtle hover:text-foreground-muted"
                >
                  X
                </button>
              </div>

              {/* Quick Templates */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Quick Templates:</p>
                <div className="flex flex-wrap gap-2">
                  {messageTemplates.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="px-3 py-1 text-sm bg-surface-inset hover:bg-surface-overlay rounded-full"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients List */}
              <div className="mb-4 p-3 bg-surface-inset rounded-lg">
                <p className="text-sm font-medium mb-2">Recipients:</p>
                <div className="flex flex-wrap gap-2">
                  {customers.map((customer) => (
                    <span
                      key={customer.id}
                      className="text-xs bg-brand-muted text-brand px-2 py-1 rounded"
                    >
                      {String(customer.firstName)} {String(customer.lastName)}
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Subject *</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    placeholder="e.g., Important: Trip Update"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Message *</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    required
                    rows={8}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
                    placeholder="Write your message here..."
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Use {"{firstName}"} to personalize with each passenger's name
                  </p>
                </div>

                <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-3">
                  <p className="text-sm text-warning">
                    Note: Email delivery requires SMTP configuration in settings.
                    Messages will be logged to each customer's communication history.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailSubject("");
                      setEmailBody("");
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting" || !emailSubject || !emailBody}
                    className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                  >
                    {fetcher.state === "submitting" ? "Sending..." : `Send to ${bookings.length} Passenger${bookings.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
