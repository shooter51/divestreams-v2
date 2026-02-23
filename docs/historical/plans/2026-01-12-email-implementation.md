# Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get the 4 existing email templates actually sending via platform SMTP.

**Architecture:** Connect the stubbed worker to email templates, add trigger points for booking confirmation and welcome emails, configure SMTP.

**Tech Stack:** Nodemailer, BullMQ, Redis, platform SMTP

---

## Current State

| Component | Status | Location |
|-----------|--------|----------|
| Email templates | Complete | `lib/email/index.ts` |
| Queue helper | Complete | `lib/jobs/index.ts` |
| Worker processing | Stubbed (TODO) | `lib/jobs/worker.ts` |
| Booking confirmation trigger | Missing | - |
| Welcome email trigger | Missing | - |
| SMTP config | Not configured | `.env` |

---

## Task 1: Connect Worker to Email Templates

**Files:**
- Modify: `lib/jobs/worker.ts:38-57`
- Reference: `lib/email/index.ts`

**Step 1: Add email service import to worker**

Add at top of `lib/jobs/worker.ts`:
```typescript
import {
  sendEmail,
  bookingConfirmationEmail,
  bookingReminderEmail,
  welcomeEmail,
  passwordResetEmail,
} from "../email/index";
```

**Step 2: Implement booking-confirmation case**

Replace the stub in `processEmailJob`:
```typescript
case "booking-confirmation": {
  const data = job.data as {
    to: string;
    customerName: string;
    tripName: string;
    tripDate: string;
    tripTime: string;
    participants: number;
    total: string;
    bookingNumber: string;
    shopName: string;
  };
  const email = bookingConfirmationEmail(data);
  await sendEmail({ to: data.to, ...email });
  break;
}
```

**Step 3: Implement booking-reminder case**

```typescript
case "booking-reminder": {
  const data = job.data as {
    to: string;
    customerName: string;
    tripName: string;
    tripDate: string;
    tripTime: string;
    bookingNumber: string;
    shopName: string;
  };
  const email = bookingReminderEmail(data);
  await sendEmail({ to: data.to, ...email });
  break;
}
```

**Step 4: Implement password-reset case**

```typescript
case "password-reset": {
  const data = job.data as {
    to: string;
    userName: string;
    resetUrl: string;
  };
  const email = passwordResetEmail(data);
  await sendEmail({ to: data.to, ...email });
  break;
}
```

**Step 5: Implement welcome case**

```typescript
case "welcome": {
  const data = job.data as {
    to: string;
    userName: string;
    shopName: string;
    loginUrl: string;
  };
  const email = welcomeEmail(data);
  await sendEmail({ to: data.to, ...email });
  break;
}
```

**Step 6: Verify changes compile**

Run: `npm run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add lib/jobs/worker.ts
git commit -m "feat(email): connect worker to email templates

Wire up processEmailJob to call actual email template functions
for booking-confirmation, booking-reminder, password-reset, and welcome.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Booking Confirmation Email Trigger

**Files:**
- Create: `lib/email/triggers.ts`

**Step 1: Create triggers module**

Create `lib/email/triggers.ts`:
```typescript
/**
 * Email Trigger Functions
 *
 * Call these after key events to queue transactional emails.
 */

import { sendEmail as queueEmail } from "../jobs/index";

interface BookingConfirmationData {
  customerEmail: string;
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  participants: number;
  totalCents: number;
  bookingNumber: string;
  shopName: string;
  tenantId: string;
}

export async function triggerBookingConfirmation(data: BookingConfirmationData) {
  await queueEmail("booking-confirmation", {
    to: data.customerEmail,
    tenantId: data.tenantId,
    customerName: data.customerName,
    tripName: data.tripName,
    tripDate: data.tripDate,
    tripTime: data.tripTime,
    participants: data.participants,
    total: formatCurrency(data.totalCents),
    bookingNumber: data.bookingNumber,
    shopName: data.shopName,
  });
}

interface WelcomeEmailData {
  userEmail: string;
  userName: string;
  shopName: string;
  subdomain: string;
  tenantId: string;
}

export async function triggerWelcomeEmail(data: WelcomeEmailData) {
  const loginUrl = `https://${data.subdomain}.divestreams.com/login`;
  await queueEmail("welcome", {
    to: data.userEmail,
    tenantId: data.tenantId,
    userName: data.userName,
    shopName: data.shopName,
    loginUrl,
  });
}

interface PasswordResetData {
  userEmail: string;
  userName: string;
  resetToken: string;
  tenantId: string;
}

export async function triggerPasswordReset(data: PasswordResetData) {
  const resetUrl = `https://divestreams.com/reset-password?token=${data.resetToken}`;
  await queueEmail("password-reset", {
    to: data.userEmail,
    tenantId: data.tenantId,
    userName: data.userName,
    resetUrl,
  });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
```

**Step 2: Verify changes compile**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/email/triggers.ts
git commit -m "feat(email): add email trigger functions

Create triggerBookingConfirmation, triggerWelcomeEmail, and
triggerPasswordReset helpers that queue emails with proper data formatting.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Wire Booking Confirmation to Booking Creation

**Files:**
- Modify: `lib/db/queries.server.ts` (find createBooking function)

**Step 1: Find booking creation code**

Search for where bookings are created. The trigger should be called after a booking is successfully inserted.

**Step 2: Add trigger import**

At top of file:
```typescript
import { triggerBookingConfirmation } from "../email/triggers";
```

**Step 3: Add trigger after booking insert**

After the booking is successfully created, add:
```typescript
// Queue confirmation email
try {
  await triggerBookingConfirmation({
    customerEmail: customer.email,
    customerName: customer.name,
    tripName: trip.tourName,
    tripDate: trip.date,
    tripTime: trip.startTime,
    participants: booking.participants,
    totalCents: booking.totalPrice,
    bookingNumber: booking.bookingNumber,
    shopName: tenant.name,
    tenantId: tenant.id,
  });
} catch (emailError) {
  // Log but don't fail the booking
  console.error("Failed to queue booking confirmation email:", emailError);
}
```

**Step 4: Verify changes compile**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/db/queries.server.ts
git commit -m "feat(email): trigger booking confirmation on booking creation

Queue confirmation email after successful booking insert.
Email failures are logged but don't fail the booking.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Wire Welcome Email to Tenant Registration

**Files:**
- Modify: `lib/db/tenant.server.ts`

**Step 1: Add trigger import**

At top of file:
```typescript
import { triggerWelcomeEmail } from "../email/triggers";
```

**Step 2: Add trigger after tenant creation**

After tenant is successfully created, add:
```typescript
// Queue welcome email
try {
  await triggerWelcomeEmail({
    userEmail: adminEmail,
    userName: adminName || "Admin",
    shopName: tenant.name,
    subdomain: tenant.subdomain,
    tenantId: tenant.id,
  });
} catch (emailError) {
  console.error("Failed to queue welcome email:", emailError);
}
```

**Step 3: Verify changes compile**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/db/tenant.server.ts
git commit -m "feat(email): trigger welcome email on tenant registration

Queue welcome email after successful tenant creation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Configure SMTP in Production

**Files:**
- Reference: `.env.example`
- Modify: Production `.env` on VPS

**Step 1: Add SMTP variables to .env.example**

```env
# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@divestreams.com
```

**Step 2: Configure production SMTP**

On VPS, edit `/docker/divestreams-v2/.env`:
```env
SMTP_HOST=<provider-host>
SMTP_PORT=587
SMTP_USER=<provider-user>
SMTP_PASS=<provider-password>
SMTP_FROM=noreply@divestreams.com
```

**Step 3: Restart worker to pick up config**

Use Hostinger MCP tool:
```
mcp__hostinger-mcp__VPS_restartProjectV1(
  virtualMachineId: 1239852,
  projectName: "divestreams-v2"
)
```

**Step 4: Test email sending**

Trigger a test email through the application.

**Step 5: Commit .env.example changes**

```bash
git add .env.example
git commit -m "docs: add SMTP configuration to .env.example

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Booking Reminder Job

**Files:**
- Modify: `lib/jobs/worker.ts` (processBookingJob function)

**Step 1: Add database queries for tomorrow's bookings**

In `processBookingJob`, for "send-reminders" case:
```typescript
case "send-reminders": {
  // Get all bookings for trips happening tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Query bookings with trip details - this needs tenant context
  // For now, log that reminders would be sent
  console.log(`Would send reminders for trips on ${tomorrowStr}`);
  // Full implementation requires iterating over all tenants
  break;
}
```

**Step 2: Commit**

```bash
git add lib/jobs/worker.ts
git commit -m "feat(email): implement booking reminder job scaffold

Add send-reminders job handler with date calculation.
Full multi-tenant implementation to follow.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verification

1. **Compile check**: `npm run typecheck` passes
2. **Unit tests**: `npm run test:unit` passes
3. **Local email test**: Create a booking and check console logs for email output
4. **Production test**: After SMTP config, verify emails are received

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Connect worker to templates | `lib/jobs/worker.ts` |
| 2 | Create trigger functions | `lib/email/triggers.ts` |
| 3 | Wire booking confirmation | `lib/db/queries.server.ts` |
| 4 | Wire welcome email | `lib/db/tenant.server.ts` |
| 5 | Configure production SMTP | `.env`, VPS `.env` |
| 6 | Implement reminder job | `lib/jobs/worker.ts` |
