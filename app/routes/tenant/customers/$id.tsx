import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect, useRouteLoaderData } from "react-router";
import { useState } from "react";
import { CSRF_FIELD_NAME } from "../../../../lib/security/csrf-constants";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { getCustomerById, getCustomerBookings, deleteCustomer } from "../../../../lib/db/queries.server";
import { db } from "../../../../lib/db";
import { customerCommunications, transactions } from "../../../../lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendEmail } from "../../../../lib/email/index";
import { redirectWithNotification, useNotification } from "../../../../lib/use-notification";
import { StatusBadge, type BadgeStatus } from "../../../components/ui";
import { formatCurrency, formatDisplayDate } from "../../../lib/format";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Customer Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const customerId = params.id;

  if (!customerId) {
    throw new Response("Customer ID required", { status: 400 });
  }

  const [customer, bookings, communications, totalSpentResult] = await Promise.all([
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
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')` })
      .from(transactions)
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.customerId, customerId),
          eq(transactions.type, "payment")
        )
      ),
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

  // Compute actual totalSpent from payment transactions
  const actualTotalSpent = Number(totalSpentResult[0]?.total ?? 0);

  // Format customer with dates as strings
  const formattedCustomer = {
    ...customer,
    totalSpent: actualTotalSpent,
    dateOfBirth: formatDate(customer.dateOfBirth),
    createdAt: formatDate(customer.createdAt),
    updatedAt: formatDate(customer.updatedAt),
    lastDiveAt: formatDate(customer.lastDiveAt),
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
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const customerId = params.id;

  if (!customerId) {
    return { error: "Customer ID required" };
  }

  if (intent === "delete") {
    const customerData = await getCustomerById(organizationId, customerId);
    const customerName = customerData ? `${customerData.firstName} ${customerData.lastName}` : "Customer";
    await deleteCustomer(organizationId, customerId);
    return redirect(redirectWithNotification("/tenant/customers", `${customerName} has been successfully deleted`, "success"));
  }

  if (intent === "send-email") {
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;

    if (!subject || !body) {
      return { error: "Subject and body are required" };
    }

    // Fetch customer email from DB — never trust client-supplied email address
    const customerData = await getCustomerById(organizationId, customerId);
    if (!customerData?.email) {
      return { error: "Customer not found or has no email address" };
    }
    const customerEmail = customerData.email;

    // Actually send the email via SMTP [KAN-607 FIX]
    try {
      const emailSent = await sendEmail({
        to: customerEmail,
        subject: subject,
        html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        text: body,
      });

      // Log the communication with actual send status
      await db.insert(customerCommunications).values({
        organizationId,
        customerId,
        type: "email",
        subject,
        body,
        status: emailSent ? "sent" : "failed",
        sentAt: emailSent ? new Date() : null,
        emailTo: customerEmail,
      });

      if (!emailSent) {
        console.error("[Customer Email] Failed to send email to:", customerEmail);
        return {
          error: "Email could not be sent. Please check SMTP configuration or try again later.",
        };
      }

      return { success: true, message: "Email sent successfully!" };
    } catch (error) {
      console.error("Error sending customer email:", error);
      // Try to log the failed attempt
      try {
        await db.insert(customerCommunications).values({
          organizationId,
          customerId,
          type: "email",
          subject,
          body,
          status: "failed",
          sentAt: null,
          emailTo: customerEmail,
        });
      } catch {
        // Table might not exist yet, ignore
      }
      return { error: "Failed to send email" };
    }
  }

  return null;
}

export default function CustomerDetailPage() {
  const { customer, bookings, communications } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const layoutData = useRouteLoaderData("routes/tenant/layout") as { csrfToken?: string } | undefined;
  const t = useT();

  // Show notifications from URL params
  useNotification();

  const handleDelete = () => {
    if (confirm(t("tenant.customers.confirmDelete"))) {
      fetcher.submit({ intent: "delete", [CSRF_FIELD_NAME]: layoutData?.csrfToken ?? "" }, { method: "post" });
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
        <Link to="/tenant/customers" className="text-brand hover:underline text-sm">
          {t("tenant.customers.backToCustomers")}
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-foreground-muted">{customer.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            {t("tenant.customers.sendEmail")}
          </button>
          <Link
            to={`/tenant/customers/${customer.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.edit")}
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg mb-6 max-w-4xl break-words">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg mb-6 max-w-4xl break-words">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.totalDives}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.customers.totalDives")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.customers.totalSpent")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.lastDiveAt ? formatDisplayDate(customer.lastDiveAt) : t("tenant.customers.never")}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.customers.lastDive")}</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.contactInfo")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">{t("common.email")}</p>
                <p>{customer.email}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("common.phone")}</p>
                <p>{customer.phone || "—"}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("common.dateOfBirth")}</p>
                <p>{customer.dateOfBirth ? formatDisplayDate(customer.dateOfBirth) : "—"}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.customers.language")}</p>
                <p>{customer.preferredLanguage === "en" ? "English" : customer.preferredLanguage}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.addressSection")}</h2>
            <p className="text-sm">
              {customer.address && <>{customer.address}<br /></>}
              {customer.city && customer.state && (
                <>{customer.city}, {customer.state} {customer.postalCode}<br /></>
              )}
              {customer.country}
            </p>
          </div>

          {/* Booking History */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{t("tenant.customers.bookingHistory")}</h2>
              <Link
                to={`/tenant/bookings/new?customerId=${customer.id}`}
                className="text-brand text-sm hover:underline"
              >
                {t("tenant.customers.newBooking")}
              </Link>
            </div>
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex justify-between items-center p-3 bg-surface-inset rounded-lg"
                >
                  <div>
                    <Link
                      to={`/tenant/bookings/${booking.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {booking.tripName}
                    </Link>
                    <p className="text-sm text-foreground-muted">
                      {booking.bookingNumber} • {formatDisplayDate(booking.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(booking.total)}</p>
                    <StatusBadge status={booking.status as BadgeStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Certification */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.certificationSection")}</h2>
            {Array.isArray(customer.certifications) && customer.certifications.length > 0 ? (
              customer.certifications.map((cert: { agency: string; level: string; number?: string; date?: string | null }, i: number) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{cert.agency} {cert.level}</p>
                  {cert.number && <p className="text-foreground-muted">#{cert.number}</p>}
                  {cert.date && <p className="text-foreground-muted">{formatDisplayDate(cert.date)}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground-muted">{t("tenant.customers.noCertificationFile")}</p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.emergencyContact")}</h2>
            {customer.emergencyContactName ? (
              <div className="text-sm">
                <p className="font-medium">{customer.emergencyContactName}</p>
                <p className="text-foreground-muted">{customer.emergencyContactRelation}</p>
                <p>{customer.emergencyContactPhone}</p>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">{t("tenant.customers.noEmergencyContact")}</p>
            )}
          </div>

          {/* Medical */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.medicalInfo")}</h2>
            <div className="text-sm space-y-2">
              <div>
                <p className="text-foreground-muted">{t("tenant.customers.conditions")}</p>
                <p>{customer.medicalConditions || t("tenant.customers.noneReported")}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.customers.medications")}</p>
                <p>{customer.medications || t("tenant.customers.noneReported")}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("common.notes")}</h2>
            <p className="text-sm">{customer.notes || t("tenant.customers.noNotes")}</p>
            {Array.isArray(customer.tags) && customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(Array.isArray(customer.tags) ? customer.tags : []).map((tag: string) => (
                  <span key={tag} className="text-xs bg-surface-inset px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Communication History */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.customers.communicationHistory")}</h2>
            {communications && communications.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {communications.map((comm) => (
                  <div key={comm.id} className="text-sm border-l-2 border-brand pl-3">
                    <p className="font-medium">{comm.subject || "(No subject)"}</p>
                    <p className="text-foreground-muted text-xs">
                      {new Date(comm.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })} at{" "}
                      {new Date(comm.createdAt).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">{t("tenant.customers.noCommunications")}</p>
            )}
            <button
              onClick={() => setShowEmailModal(true)}
              className="mt-4 text-sm text-brand hover:underline"
            >
              {t("tenant.customers.sendNewEmail")}
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>{t("tenant.customers.customerSince")} {formatDisplayDate(customer.createdAt)}</p>
            <p>{t("tenant.customers.marketing")}: {customer.marketingOptIn ? t("tenant.customers.optedIn") : t("tenant.customers.optedOut")}</p>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">
              {t("tenant.customers.sendEmailTo", { name: `${customer.firstName} ${customer.lastName}` })}
            </h2>
            <p className="text-sm text-foreground-muted mb-4">
              {t("tenant.customers.toEmail")}: {customer.email}
            </p>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("tenant.customers.subject")} *</label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder={t("tenant.customers.subjectPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t("tenant.customers.message")} *</label>
                <textarea
                  name="body"
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder={t("tenant.customers.messagePlaceholder")}
                />
              </div>

              <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-3">
                <p className="text-sm text-warning">
                  {t("tenant.customers.smtpNote")}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {fetcher.state === "submitting" ? t("tenant.customers.sending") : t("tenant.customers.sendEmail")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
