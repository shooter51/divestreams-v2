/**
 * Email Service
 *
 * Sends transactional emails using Nodemailer with SMTP.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { escapeHtml } from "../security/sanitize";

// Lazy transporter initialization
let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn("[Email] SMTP not fully configured - missing required credentials");
      console.warn(`[Email] Configuration status: host=${!!host}, user=${!!user}, pass=${!!pass}`);
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || "noreply@divestreams.com";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return !!(host && user && pass);
}

/**
 * Verify SMTP connection on startup
 * Call this during app initialization to detect configuration issues early
 */
export async function verifyEmailConnection(): Promise<{ success: boolean; error?: string }> {
  const transport = getTransporter();

  if (!transport) {
    return {
      success: false,
      error: "SMTP not configured - missing credentials (check SMTP_HOST, SMTP_USER, SMTP_PASS)",
    };
  }

  try {
    await transport.verify();
    console.log("[Email] ✅ SMTP connection verified successfully");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Email] ❌ SMTP connection verification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    // SMTP not configured - log for development but return false in production
    const isDevelopment = process.env.NODE_ENV !== "production";

    console.error("[Email] Cannot send email - SMTP not configured");
    console.log("📧 Email (not sent):");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Body: ${options.text || options.html.substring(0, 100)}...`);

    // In development, pretend it worked for testing
    // In production, return false so calling code knows email failed
    return isDevelopment;
  }

  try {
    await transport.sendMail({
      from: FROM_ADDRESS,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log(`[Email] ✅ Sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error("[Email] ❌ Failed to send:", error);
    console.error(`[Email] Details: to=${options.to}, subject=${options.subject}`);
    return false;
  }
}

// Email templates

export function bookingConfirmationEmail(data: {
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  participants: number;
  total: string;
  bookingNumber: string;
  shopName: string;
}) {
  const subject = `Booking Confirmed - ${data.tripName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #666; }
        .value { font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmed! ✓</h1>
        </div>
        <div class="content">
          <p>Hi ${escapeHtml(data.customerName)},</p>
          <p>Your booking with <strong>${escapeHtml(data.shopName)}</strong> has been confirmed!</p>

          <div class="details">
            <div class="detail-row">
              <span class="label">Booking Number</span>
              <span class="value">${escapeHtml(data.bookingNumber)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Trip</span>
              <span class="value">${escapeHtml(data.tripName)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date</span>
              <span class="value">${escapeHtml(data.tripDate)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time</span>
              <span class="value">${escapeHtml(data.tripTime)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Participants</span>
              <span class="value">${escapeHtml(data.participants.toString())}</span>
            </div>
            <div class="detail-row">
              <span class="label">Total</span>
              <span class="value">${escapeHtml(data.total)}</span>
            </div>
          </div>

          <p>Please arrive 15 minutes before the scheduled departure time.</p>
          <p>If you have any questions, please contact us.</p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Booking Confirmed!

Hi ${data.customerName},

Your booking with ${data.shopName} has been confirmed!

Booking Number: ${data.bookingNumber}
Trip: ${data.tripName}
Date: ${data.tripDate}
Time: ${data.tripTime}
Participants: ${data.participants}
Total: ${data.total}

Please arrive 15 minutes before the scheduled departure time.

If you have any questions, please contact us.

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}

export function bookingReminderEmail(data: {
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  bookingNumber: string;
  shopName: string;
}) {
  const subject = `Reminder: ${data.tripName} Tomorrow`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>See You Tomorrow! 🤿</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>This is a friendly reminder about your upcoming dive trip:</p>

          <div class="highlight">
            <h2>${data.tripName}</h2>
            <p><strong>${data.tripDate}</strong> at <strong>${data.tripTime}</strong></p>
            <p>Booking: ${data.bookingNumber}</p>
          </div>

          <h3>What to bring:</h3>
          <ul>
            <li>Swimsuit and towel</li>
            <li>Sunscreen (reef-safe)</li>
            <li>Certification card (if applicable)</li>
            <li>Camera (optional)</li>
          </ul>

          <p>Please arrive 15 minutes before departure.</p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
See You Tomorrow!

Hi ${data.customerName},

This is a friendly reminder about your upcoming dive trip:

${data.tripName}
${data.tripDate} at ${data.tripTime}
Booking: ${data.bookingNumber}

What to bring:
- Swimsuit and towel
- Sunscreen (reef-safe)
- Certification card (if applicable)
- Camera (optional)

Please arrive 15 minutes before departure.

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}

export function welcomeEmail(data: {
  userName: string;
  shopName: string;
  loginUrl: string;
}) {
  const subject = `Welcome to ${data.shopName}!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Welcome to <strong>${data.shopName}</strong>! Your account has been created.</p>
          <p>Click below to access your dashboard:</p>
          <p style="text-align: center;">
            <a href="${data.loginUrl}" class="button">Go to Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to ${data.shopName}!

Hi ${data.userName},

Your account has been created. Access your dashboard at:
${data.loginUrl}

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}

export function passwordResetEmail(data: {
  userName: string;
  resetUrl: string;
}) {
  const subject = "Reset Your Password";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </p>
          <p><small>This link will expire in 1 hour. If you didn't request this, you can ignore this email.</small></p>
        </div>
        <div class="footer">
          <p>DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset

Hi ${data.userName},

We received a request to reset your password. Visit the link below to create a new password:

${data.resetUrl}

This link will expire in 1 hour. If you didn't request this, you can ignore this email.

DiveStreams
  `;

  return { subject, html, text };
}

export function customerWelcomeEmail(data: {
  customerName: string;
  shopName: string;
  loginUrl: string;
}) {
  const subject = `Welcome to ${data.shopName}!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for creating an account with <strong>${data.shopName}</strong>!</p>
          <p>You can now:</p>
          <ul>
            <li>Book dive trips and training courses</li>
            <li>View and manage your reservations</li>
            <li>Access your diving history</li>
            <li>Update your profile and certifications</li>
          </ul>
          <p style="text-align: center;">
            <a href="${data.loginUrl}" class="button">Sign In to Your Account</a>
          </p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to ${data.shopName}!

Hi ${data.customerName},

Thank you for creating an account with ${data.shopName}!

You can now:
- Book dive trips and training courses
- View and manage your reservations
- Access your diving history
- Update your profile and certifications

Sign in to your account at:
${data.loginUrl}

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}

export function contactFormNotificationEmail(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  shopName: string;
  referrerPage?: string;
  submittedAt: string;
}) {
  const subject = `New Contact Form Submission${data.subject ? ` - ${data.subject}` : ""}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #666; font-weight: 600; }
        .message-box { background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Contact Form Submission</h1>
        </div>
        <div class="content">
          <p>You have received a new message through your website contact form.</p>

          <div class="details">
            <div class="detail-row">
              <span class="label">From:</span> ${escapeHtml(data.name)} (${escapeHtml(data.email)})
            </div>
            ${data.phone ? `<div class="detail-row"><span class="label">Phone:</span> ${escapeHtml(data.phone)}</div>` : ""}
            ${data.subject ? `<div class="detail-row"><span class="label">Subject:</span> ${escapeHtml(data.subject)}</div>` : ""}
            <div class="detail-row">
              <span class="label">Submitted:</span> ${escapeHtml(data.submittedAt)}
            </div>
            ${data.referrerPage ? `<div class="detail-row"><span class="label">Page:</span> ${escapeHtml(data.referrerPage)}</div>` : ""}
          </div>

          <div class="message-box">
            <div class="label">Message:</div>
            <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
          </div>

          <p><strong>Reply to:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Contact Form Submission

From: ${data.name} (${data.email})
${data.phone ? `Phone: ${data.phone}` : ""}
${data.subject ? `Subject: ${data.subject}` : ""}
Submitted: ${data.submittedAt}
${data.referrerPage ? `Page: ${data.referrerPage}` : ""}

Message:
${data.message}

Reply to: ${data.email}

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}

export function contactFormAutoReplyEmail(data: {
  name: string;
  shopName: string;
  contactEmail: string;
  contactPhone?: string;
}) {
  const subject = `Thank you for contacting ${data.shopName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Message Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Thank you for reaching out to <strong>${data.shopName}</strong>. We've received your message and will get back to you as soon as possible.</p>

          <div class="highlight">
            <p><strong>We typically respond within 24 hours.</strong></p>
          </div>

          <p>In the meantime, if you need immediate assistance, please feel free to contact us directly:</p>
          <ul>
            <li>Email: <a href="mailto:${data.contactEmail}">${data.contactEmail}</a></li>
            ${data.contactPhone ? `<li>Phone: <a href="tel:${data.contactPhone}">${data.contactPhone}</a></li>` : ""}
          </ul>

          <p>Best regards,<br>${data.shopName} Team</p>
        </div>
        <div class="footer">
          <p>${escapeHtml(data.shopName)} • Powered by DiveStreams</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Thank you for contacting ${data.shopName}

Hi ${data.name},

Thank you for reaching out to ${data.shopName}. We've received your message and will get back to you as soon as possible.

We typically respond within 24 hours.

In the meantime, if you need immediate assistance, please feel free to contact us directly:

Email: ${data.contactEmail}
${data.contactPhone ? `Phone: ${data.contactPhone}` : ""}

Best regards,
${data.shopName} Team

${data.shopName} • Powered by DiveStreams
  `;

  return { subject, html, text };
}
