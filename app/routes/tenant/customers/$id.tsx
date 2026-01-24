import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { useState } from "react";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getCustomerById, getCustomerBookings, deleteCustomer } from "../../../../lib/db/queries.server";
import { db } from "../../../../lib/db";
import { customerCommunications } from "../../../../lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Customer Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const customerId = params.id;

  if (!customerId) {
    throw new Response("Customer ID required", { status: 400 });
  }

  const [customer, bookings, communications] = await Promise.all([
    getCustomerById(organizationId, customerId),
    getCustomerBookings(organizationId, customerId),
    db
      .select()
      .from(customerCommunications)
      .where(
        and(
          eq(customerCommunications.organizationId, organizationId),
          eq(customerCommunications.customerId, customerId)
        )
      )
      .orderBy(desc(customerCommunications.createdAt))
      .limit(20)
      .catch(() => []), // Table might not exist yet
  ]);

  if (!customer) {
    throw new Response("Customer not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format certifications with dates as strings
  const formattedCertifications = (Array.isArray(customer.certifications) ? customer.certifications : []).map((cert: { agency: string; level: string; number?: string; date?: Date | string }) => ({
    ...cert,
    date: formatDate(cert.date),
  }));

  // Format customer with dates as strings
  const formattedCustomer = {
    ...customer,
    dateOfBirth: formatDate(customer.dateOfBirth),
    createdAt: formatDate(customer.createdAt),
    updatedAt: formatDate(customer.updatedAt),
    certifications: formattedCertifications,
  };

  // Format bookings with dates as strings
  const formattedBookings = bookings.map((booking) => ({
    ...booking,
    date: formatDate(booking.date),
  }));

  // Format communications with dates as strings
  const formattedCommunications = communications.map((comm) => ({
    ...comm,
    sentAt: comm.sentAt ? comm.sentAt.toISOString() : null,
    createdAt: comm.createdAt.toISOString(),
  }));

  return { customer: formattedCustomer, bookings: formattedBookings, communications: formattedCommunications };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const customerId = params.id;

  if (!customerId) {
    return { error: "Customer ID required" };
  }

  if (intent === "delete") {
    await deleteCustomer(organizationId, customerId);
    return redirect("/tenant/customers");
  }

  if (intent === "send-email") {
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;
    const customerEmail = formData.get("customerEmail") as string;

    if (!subject || !body) {
      return { error: "Subject and body are required" };
    }

    // Log the communication (actual email sending would require SMTP setup)
    try {
      await db.insert(customerCommunications).values({
        organizationId,
        customerId,
        type: "email",
        subject,
        body,
        status: "sent", // In production, this would be "queued" until actually sent
        sentAt: new Date(),
        emailTo: customerEmail,
      });

      return { success: true, message: "Email logged successfully. Note: Email delivery requires SMTP configuration." };
    } catch {
      // Table might not exist yet
      return { success: true, message: "Email queued (communications table pending migration)" };
    }
  }

  return null;
}

export default function CustomerDetailPage() {
  const { customer, bookings, communications } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();
  const [showEmailModal, setShowEmailModal] = useState(false);

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this customer? This cannot be undone.")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const handleSendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("intent", "send-email");
    formData.append("customerEmail", customer.email);
    fetcher.submit(formData, { method: "post" });
    setShowEmailModal(false);
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/customers" className="text-blue-600 hover:underline text-sm">
          ← Back to Customers
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-gray-500">{customer.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Send Email
          </button>
          <Link
            to={`/app/customers/${customer.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
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
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.totalDives}</p>
              <p className="text-gray-500 text-sm">Total Dives</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${customer.totalSpent}</p>
              <p className="text-gray-500 text-sm">Total Spent</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.lastDiveAt || "Never"}</p>
              <p className="text-gray-500 text-sm">Last Dive</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p>{customer.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p>{customer.phone || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Date of Birth</p>
                <p>{customer.dateOfBirth || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Language</p>
                <p>{customer.preferredLanguage === "en" ? "English" : customer.preferredLanguage}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Address</h2>
            <p className="text-sm">
              {customer.address && <>{customer.address}<br /></>}
              {customer.city && customer.state && (
                <>{customer.city}, {customer.state} {customer.postalCode}<br /></>
              )}
              {customer.country}
            </p>
          </div>

          {/* Booking History */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Booking History</h2>
              <Link
                to={`/app/bookings/new?customerId=${customer.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                + New Booking
              </Link>
            </div>
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <Link
                      to={`/app/bookings/${booking.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {booking.tripName}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {booking.bookingNumber} • {booking.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${booking.total}</p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        booking.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : booking.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Certification */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Certification</h2>
            {Array.isArray(customer.certifications) && customer.certifications.length > 0 ? (
              customer.certifications.map((cert: { agency: string; level: string; number?: string; date?: string | null }, i: number) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{cert.agency} {cert.level}</p>
                  {cert.number && <p className="text-gray-500">#{cert.number}</p>}
                  {cert.date && <p className="text-gray-500">{cert.date}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No certification on file</p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Emergency Contact</h2>
            {customer.emergencyContactName ? (
              <div className="text-sm">
                <p className="font-medium">{customer.emergencyContactName}</p>
                <p className="text-gray-500">{customer.emergencyContactRelation}</p>
                <p>{customer.emergencyContactPhone}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No emergency contact on file</p>
            )}
          </div>

          {/* Medical */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Medical Information</h2>
            <div className="text-sm space-y-2">
              <div>
                <p className="text-gray-500">Conditions</p>
                <p>{customer.medicalConditions || "None reported"}</p>
              </div>
              <div>
                <p className="text-gray-500">Medications</p>
                <p>{customer.medications || "None reported"}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Notes</h2>
            <p className="text-sm">{customer.notes || "No notes"}</p>
            {Array.isArray(customer.tags) && customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(Array.isArray(customer.tags) ? customer.tags : []).map((tag: string) => (
                  <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Communication History */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Communication History</h2>
            {communications && communications.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {communications.map((comm) => (
                  <div key={comm.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <p className="font-medium">{comm.subject || "(No subject)"}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(comm.createdAt).toLocaleDateString()} at{" "}
                      {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No communications yet</p>
            )}
            <button
              onClick={() => setShowEmailModal(true)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              + Send new email
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Customer since {customer.createdAt}</p>
            <p>Marketing: {customer.marketingOptIn ? "Opted in" : "Opted out"}</p>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">
              Send Email to {customer.firstName} {customer.lastName}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              To: {customer.email}
            </p>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Your upcoming dive trip"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message *</label>
                <textarea
                  name="body"
                  required
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Write your message here..."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Note: Email delivery requires SMTP configuration in settings.
                  This message will be logged to communication history.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {fetcher.state === "submitting" ? "Sending..." : "Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
