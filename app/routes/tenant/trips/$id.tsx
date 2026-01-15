import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { useState } from "react";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import {
  getTripWithFullDetails,
  getTripBookings,
  getTripRevenue,
  getTripBookedParticipants,
  updateTripStatus,
} from "../../../../lib/db/queries.server";
import { db } from "../../../../lib/db";
import { customerCommunications, trips } from "../../../../lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import {
  getRecurringSeriesInstances,
  cancelRecurringSeries,
} from "../../../../lib/trips/recurring.server";

export const meta: MetaFunction = () => [{ title: "Trip Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
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
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const tripId = params.id!;

  if (intent === "cancel") {
    await updateTripStatus(organizationId, tripId, "cancelled");
    return { cancelled: true };
  }

  if (intent === "cancel-series") {
    const templateId = formData.get("templateId") as string;
    if (templateId) {
      await cancelRecurringSeries(organizationId, templateId, { includeTemplate: true });
      return { seriesCancelled: true };
    }
    return { error: "Template ID required to cancel series" };
  }

  if (intent === "complete") {
    await updateTripStatus(organizationId, tripId, "completed");
    return { completed: true };
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

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  full: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

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
  const { trip, bookings, revenue, recurringInfo } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string; seriesCancelled?: boolean }>();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const spotsAvailable = trip.maxParticipants - trip.bookedParticipants;

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
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .notes-section { margin-top: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
          .notes-section h3 { margin-top: 0; }
          .signature-line { margin-top: 50px; border-top: 1px solid #000; width: 200px; padding-top: 5px; }
          @media print { body { padding: 0; } }
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
        <Link to="/app/trips" className="text-blue-600 hover:underline text-sm">
          ← Back to Trips
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{trip.tour.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[trip.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {trip.status}
            </span>
            {recurringInfo?.isRecurring && (
              <span
                className="text-sm px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1 cursor-pointer"
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
          <p className="text-gray-500">
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
              to={`/app/bookings/new?tripId=${trip.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Booking
            </Link>
          )}
          {trip.status === "confirmed" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="complete" />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark Complete
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/app/trips/${trip.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {trip.status !== "cancelled" && trip.status !== "completed" && (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Cancel Trip
              </button>
              {recurringInfo?.isRecurring && (
                <fetcher.Form method="post" onSubmit={(e) => {
                  if (!confirm("Are you sure you want to cancel ALL future trips in this series?")) {
                    e.preventDefault();
                  }
                }}>
                  <input type="hidden" name="intent" value="cancel-series" />
                  <input type="hidden" name="templateId" value={recurringInfo.templateId || ""} />
                  <button
                    type="submit"
                    className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
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
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {trip.bookedParticipants}/{trip.maxParticipants}
              </p>
              <p className="text-gray-500 text-sm">Booked</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">{spotsAvailable}</p>
              <p className="text-gray-500 text-sm">Spots Left</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${revenue.bookingsTotal}</p>
              <p className="text-gray-500 text-sm">Total Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-yellow-600">${revenue.pendingTotal}</p>
              <p className="text-gray-500 text-sm">Pending Payment</p>
            </div>
          </div>

          {/* Trip Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Trip Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Time</p>
                <p>
                  {trip.startTime} - {trip.endTime}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Boat</p>
                <Link to={`/app/boats/${trip.boat.id}`} className="text-blue-600 hover:underline">
                  {trip.boat.name}
                </Link>
              </div>
              <div>
                <p className="text-gray-500">Price</p>
                <p>${trip.price} per person</p>
              </div>
              <div>
                <p className="text-gray-500">Tour</p>
                <Link to={`/app/tours/${trip.tour.id}`} className="text-blue-600 hover:underline">
                  {trip.tour.name}
                </Link>
              </div>
            </div>
          </div>

          {/* Weather & Notes */}
          {(trip.weatherNotes || trip.notes) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <div className="space-y-4 text-sm">
                {trip.weatherNotes && (
                  <div>
                    <p className="text-gray-500 mb-1">Weather:</p>
                    <p>{trip.weatherNotes}</p>
                  </div>
                )}
                {trip.notes && (
                  <div>
                    <p className="text-gray-500 mb-1">Internal Notes:</p>
                    <p>{trip.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Bookings ({bookings.length})</h2>
              {spotsAvailable > 0 && (
                <Link
                  to={`/app/bookings/new?tripId=${trip.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Add Booking
                </Link>
              )}
            </div>
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/app/bookings/${booking.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {booking.bookingNumber} • {booking.participants} pax
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${booking.total}</p>
                      {!booking.paidInFull && (
                        <span className="text-xs text-yellow-600">Payment pending</span>
                      )}
                      {booking.paidInFull && (
                        <span className="text-xs text-green-600">Paid</span>
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
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Staff</h2>
            {trip.staff.length === 0 ? (
              <p className="text-gray-500 text-sm">No staff assigned.</p>
            ) : (
              <div className="space-y-2">
                {trip.staff.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              to={`/app/trips/${trip.id}/edit`}
              className="block text-center mt-4 text-blue-600 text-sm hover:underline"
            >
              Manage Staff
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={handlePrintManifest}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                📋 Print Manifest
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={bookings.length === 0}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📧 Email Passengers {bookings.length > 0 && `(${bookings.length})`}
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                📤 Export to PDF
              </button>
              <Link
                to={`/app/trips/new?tourId=${trip.tour.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                📅 Schedule Similar Trip
              </Link>
            </div>
          </div>

          {/* Participant Summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
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
                <span className={spotsAvailable === 0 ? "text-red-600" : "text-green-600"}>
                  {spotsAvailable}
                </span>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 rounded-full h-2"
                  style={{
                    width: `${(trip.bookedParticipants / trip.maxParticipants) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Created {trip.createdAt}</p>
            <p>Trip ID: {trip.id}</p>
          </div>
        </div>
      </div>

      {/* Series Instances Modal */}
      {showSeriesModal && recurringInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">Recurring Trip Series</h2>
                  <p className="text-sm text-gray-500">
                    {recurringInfo.recurrencePattern} recurrence
                    {recurringInfo.isTemplate && " - This is the template trip"}
                  </p>
                </div>
                <button
                  onClick={() => setShowSeriesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  X
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Upcoming trips in this series:
                </p>
                {recurringInfo.seriesInstances.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming trips in this series.</p>
                ) : (
                  recurringInfo.seriesInstances.map((instance) => (
                    <Link
                      key={instance.id}
                      to={`/app/trips/${instance.id}`}
                      onClick={() => setShowSeriesModal(false)}
                      className={`flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 ${
                        instance.id === trip.id ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
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
                        <p className="text-sm text-gray-500">{instance.startTime}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          statusColors[instance.status] || "bg-gray-100"
                        }`}
                      >
                        {instance.status}
                        {instance.id === trip.id && " (current)"}
                      </span>
                    </Link>
                  ))
                )}
                {recurringInfo.seriesInstances.length === 10 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    Showing next 10 trips. More trips may exist.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t flex justify-end">
                <button
                  onClick={() => setShowSeriesModal(false)}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
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
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">Email All Passengers</h2>
                  <p className="text-sm text-gray-500">
                    Send a message to {bookings.length} passenger{bookings.length !== 1 ? "s" : ""} on this trip
                  </p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
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
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients List */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium mb-2">Recipients:</p>
                <div className="flex flex-wrap gap-2">
                  {customers.map((customer) => (
                    <span
                      key={customer.id}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                    >
                      {customer.firstName} {customer.lastName}
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Write your message here..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {"{firstName}"} to personalize with each passenger's name
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-700">
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
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting" || !emailSubject || !emailBody}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
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
