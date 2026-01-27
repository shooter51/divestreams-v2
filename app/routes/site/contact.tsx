/**
 * Public Site Contact Page
 *
 * Two-column layout with contact form and business information.
 * Displays map embed, business hours, and contact details.
 */

import { useRouteLoaderData, Form, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import type { SiteLoaderData } from "./_layout";
import { db } from "../../../lib/db";
import { contactMessages } from "../../../lib/db/schema/public-site";
import { organization } from "../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { sendEmail, contactFormNotificationEmail, contactFormAutoReplyEmail } from "../../../lib/email";
import { checkRateLimit, getClientIp } from "../../../lib/utils/rate-limit";

/**
 * Extract subdomain from request host
 */
function getSubdomainFromHost(host: string): string | null {
  // Handle localhost development: subdomain.localhost:5173
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  // Handle production: subdomain.divestreams.com
  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    // Ignore www and admin as they're not tenant subdomains
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// ICONS
// ============================================================================

function MapPinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function PhoneIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function EnvelopeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function ClockIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExclamationCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface ActionData {
  success?: boolean;
  error?: string;
  errors?: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request }: ActionFunctionArgs): Promise<ActionData> {
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const message = formData.get("message") as string;
  const honeypot = formData.get("website") as string; // Honeypot field

  // Honeypot spam check - if filled, it's a bot
  if (honeypot) {
    console.log("Contact form spam detected (honeypot triggered)");
    return { success: true }; // Return success to not reveal detection
  }

  // Rate limiting - 5 submissions per 15 minutes per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`contact-form:${clientIp}`, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.allowed) {
    const minutesUntilReset = Math.ceil((rateLimitResult.resetAt - Date.now()) / 60000);
    return {
      success: false,
      error: `Too many submissions. Please try again in ${minutesUntilReset} minute${minutesUntilReset > 1 ? "s" : ""}.`,
    };
  }

  // Validation
  const errors: ActionData["errors"] = {};

  if (!name || name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!email || !email.includes("@") || !email.includes(".")) {
    errors.email = "Please enter a valid email address";
  }

  if (!message || message.trim().length < 10) {
    errors.message = "Message must be at least 10 characters";
  }

  if (message && message.length > 5000) {
    errors.message = "Message must be less than 5000 characters";
  }

  // Phone is optional but validate format if provided
  if (phone && phone.trim()) {
    const phoneRegex = /^[\d\s().+-]+$/;
    if (!phoneRegex.test(phone)) {
      errors.phone = "Please enter a valid phone number";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // Look up organization from subdomain
  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  if (!subdomain) {
    return {
      success: false,
      error: "Unable to process your request. Please try again later.",
    };
  }

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return {
      success: false,
      error: "Unable to process your request. Please try again later.",
    };
  }

  // Get contact info from org settings
  const contactInfo = org.publicSiteSettings?.contactInfo;

  try {
    // Store message in database
    const referrer = request.headers.get("referer") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    await db.insert(contactMessages).values({
      organizationId: org.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      subject: null, // Could add subject field to form if needed
      message: message.trim(),
      referrerPage: referrer,
      userAgent: userAgent,
      ipAddress: clientIp,
      status: "new",
    });

    // Send notification email to organization
    const now = new Date();
    const formattedDate = now.toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });

    let emailSent = false;

    if (contactInfo?.email) {
      const notificationEmail = contactFormNotificationEmail({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim(),
        message: message.trim(),
        shopName: org.name,
        referrerPage: referrer,
        submittedAt: formattedDate,
      });

      const notificationResult = await sendEmail({
        to: contactInfo.email,
        subject: notificationEmail.subject,
        html: notificationEmail.html,
        text: notificationEmail.text,
      });

      emailSent = emailSent || notificationResult;
    }

    // Send auto-reply confirmation to customer
    const autoReplyEmail = contactFormAutoReplyEmail({
      name: name.trim(),
      shopName: org.name,
      contactEmail: contactInfo?.email || "info@example.com",
      contactPhone: contactInfo?.phone ?? undefined,
    });

    const autoReplyResult = await sendEmail({
      to: email.trim(),
      subject: autoReplyEmail.subject,
      html: autoReplyEmail.html,
      text: autoReplyEmail.text,
    });

    emailSent = emailSent || autoReplyResult;

    // Message is saved in database regardless of email delivery
    // But warn user if emails failed to send
    if (!emailSent) {
      console.error("[Contact Form] WARNING: Message saved but emails failed to send");
      console.error(`[Contact Form] Organization: ${org.name}, Customer: ${email.trim()}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error processing contact form:", error);
    return {
      success: false,
      error: "Failed to send your message. Please try again later.",
    };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SiteContactPage() {
  // Get data from parent layout loader
  const loaderData = useRouteLoaderData<SiteLoaderData>("routes/site/_layout");

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Loading state
  if (!loaderData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold">Contact Us</h1>
        <p className="mt-4 text-lg opacity-75">Loading...</p>
      </div>
    );
  }

  const { contactInfo, organization } = loaderData;

  // Parse business hours into array for display
  const parseHours = (hoursString: string | null | undefined): string[] => {
    if (!hoursString) return [];
    // Split by newline or semicolon for flexibility
    return hoursString
      .split(/[;\n]/)
      .map((h) => h.trim())
      .filter(Boolean);
  };

  const businessHours = parseHours(contactInfo?.hours);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-lg opacity-75 max-w-2xl mx-auto">
          Have a question about our dive trips, courses, or services?
          We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Form */}
        <div
          className="rounded-2xl p-8 shadow-sm border"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
          }}
        >
          <h2 className="text-2xl font-semibold mb-6" style={{ color: "var(--text-color)" }}>
            Send us a message
          </h2>

          {actionData?.success ? (
            <div
              className="rounded-lg p-6 text-center"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <CheckCircleIcon
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: "var(--primary-color)" } as React.CSSProperties}
              />
              <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
              <p className="opacity-75">
                Thank you for reaching out. We'll get back to you as soon as possible.
              </p>
            </div>
          ) : (
            <Form method="post" className="space-y-6">
              {/* Honeypot field - hidden from users, bots will fill it */}
              <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Name Field */}
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contact-name"
                  name="name"
                  required
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.name
                      ? "#ef4444"
                      : "var(--accent-color)",
                    // @ts-ignore
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.name ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.name ? "name-error" : undefined
                  }
                />
                {actionData?.errors?.name && (
                  <p
                    id="name-error"
                    className="mt-1 text-sm text-red-500 flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {actionData.errors.name}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="contact-email"
                  name="email"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.email
                      ? "#ef4444"
                      : "var(--accent-color)",
                    // @ts-ignore
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.email ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.email ? "email-error" : undefined
                  }
                />
                {actionData?.errors?.email && (
                  <p
                    id="email-error"
                    className="mt-1 text-sm text-red-500 flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {actionData.errors.email}
                  </p>
                )}
              </div>

              {/* Phone Field (Optional) */}
              <div>
                <label
                  htmlFor="contact-phone"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  Phone <span className="text-sm opacity-50">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="contact-phone"
                  name="phone"
                  autoComplete="tel"
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.phone
                      ? "#ef4444"
                      : "var(--accent-color)",
                    // @ts-ignore
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.phone ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.phone ? "phone-error" : undefined
                  }
                />
                {actionData?.errors?.phone && (
                  <p
                    id="phone-error"
                    className="mt-1 text-sm text-red-500 flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {actionData.errors.phone}
                  </p>
                )}
              </div>

              {/* Message Field */}
              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 resize-y"
                  style={{
                    borderColor: actionData?.errors?.message
                      ? "#ef4444"
                      : "var(--accent-color)",
                    // @ts-ignore
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.message ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.message ? "message-error" : undefined
                  }
                />
                {actionData?.errors?.message && (
                  <p
                    id="message-error"
                    className="mt-1 text-sm text-red-500 flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {actionData.errors.message}
                  </p>
                )}
              </div>

              {/* General Error */}
              {actionData?.error && (
                <div className="p-4 rounded-lg flex items-center gap-2" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
                  <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                  <p>{actionData.error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-6 rounded-lg font-medium text-white transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: "var(--primary-color)",
                }}
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </Form>
          )}
        </div>

        {/* Contact Information */}
        <div className="space-y-8">
          {/* Contact Details Card */}
          <div
            className="rounded-2xl p-8 shadow-sm border"
            style={{
              backgroundColor: "var(--color-card-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <h2 className="text-2xl font-semibold mb-6" style={{ color: "var(--text-color)" }}>
              Get in touch
            </h2>

            <div className="space-y-6">
              {/* Address */}
              {contactInfo?.address && (
                <div className="flex gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <MapPinIcon
                      className="w-6 h-6"
                      style={{ color: "var(--primary-color)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Address</h3>
                    <p className="opacity-75 whitespace-pre-line">
                      {contactInfo.address}
                    </p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {contactInfo?.phone && (
                <div className="flex gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <PhoneIcon
                      className="w-6 h-6"
                      style={{ color: "var(--primary-color)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Phone</h3>
                    <a
                      href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                      className="opacity-75 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {contactInfo.phone}
                    </a>
                  </div>
                </div>
              )}

              {/* Email */}
              {contactInfo?.email && (
                <div className="flex gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <EnvelopeIcon
                      className="w-6 h-6"
                      style={{ color: "var(--primary-color)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Email</h3>
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="opacity-75 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {contactInfo.email}
                    </a>
                  </div>
                </div>
              )}

              {/* Business Hours */}
              {businessHours.length > 0 && (
                <div className="flex gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <ClockIcon
                      className="w-6 h-6"
                      style={{ color: "var(--primary-color)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Business Hours</h3>
                    <ul className="opacity-75 space-y-1">
                      {businessHours.map((hours, index) => (
                        <li key={index}>{hours}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Fallback when no contact info */}
              {!contactInfo?.address &&
                !contactInfo?.phone &&
                !contactInfo?.email &&
                !contactInfo?.hours && (
                  <p className="opacity-75">
                    Contact information coming soon. Please check back later.
                  </p>
                )}
            </div>
          </div>

          {/* Map Embed */}
          {contactInfo?.mapEmbed && (
            <div
              className="rounded-2xl overflow-hidden shadow-sm border"
              style={{
                borderColor: "var(--accent-color)",
              }}
            >
              <div
                className="aspect-video w-full [&>iframe]:w-full [&>iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: contactInfo.mapEmbed }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
