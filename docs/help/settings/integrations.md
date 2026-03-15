---
title: "Integrations"
category: "Settings"
tags: ["integrations", "stripe", "google calendar", "mailchimp", "quickbooks", "zapier", "xero"]
order: 3
---

# Integrations

The **Integrations** page lets you connect DiveStreams to external services for payments, calendar sync, marketing, accounting, and automation.

> **Requirement:** Integrations require a paid plan. Go to **Settings** → **Billing** to check or upgrade your plan.

## Available Integrations

| Integration | Category | Plan Required | What it Does |
|-------------|----------|--------------|-------------|
| Stripe | Payments | Starter | Online card payments, POS card checkout, automatic refunds |
| Google Calendar | Calendar | Starter | Two-way sync of trips to your Google Calendar; automatic updates |
| Mailchimp | Marketing | Professional | Sync customers to an audience; automated booking follow-ups |
| QuickBooks | Accounting | Professional | Invoice sync, expense tracking, financial reports |
| Zapier | Automation | Professional | Connect DiveStreams to 5,000+ apps with custom triggers |
| Xero | Accounting | Enterprise | Invoice sync, bank reconciliation, multi-currency |

## Stripe

Stripe is required to accept card payments in the POS and to send online payment links.

1. On the Integrations page, click **Connect Stripe**.
2. You are redirected to Stripe Connect. Sign in or create a Stripe account.
3. Authorize DiveStreams to access your account.
4. You are redirected back. A green "Connected" badge appears.

Once connected, card payments in the **POS** → **Checkout** become available, and the **Manage Subscription** billing portal works.

To disconnect: click **Disconnect** on the Stripe card.

## Google Calendar

1. Click **Connect Google Calendar**.
2. Sign in with your Google account and grant calendar access.
3. Select which calendar to sync trips to.

Once connected, when you create or cancel a trip, DiveStreams updates the corresponding Google Calendar event automatically.

## Mailchimp

1. Click **Connect Mailchimp**.
2. Sign in to your Mailchimp account and authorize access.
3. Select the **Audience** to sync your customers to.

Customers added to DiveStreams are synced to the selected Mailchimp audience. You can then use Mailchimp to send booking confirmation sequences or promotions.

## QuickBooks

1. Click **Connect QuickBooks**.
2. Sign in to QuickBooks Online and authorize.
3. Invoices created in DiveStreams sync to QuickBooks automatically.

## Zapier

1. Click **Connect Zapier**.
2. Enter your Zapier webhook URL.
3. Select which events should trigger the webhook.

Available Zapier triggers include new bookings, confirmed bookings, and new customers. Each trigger sends a JSON payload to your Zapier webhook, which you can use to build multi-step automations connecting DiveStreams to thousands of other apps.

To regenerate the Zapier secret, click **Regenerate Secret** in the Zapier settings panel.

## Xero

1. Click **Connect Xero**.
2. Authorize DiveStreams in Xero.
3. Invoices and sales records sync to Xero.

## Disconnecting an Integration

Each connected integration card has a **Disconnect** button. Disconnecting removes the OAuth token and stops all syncing. Your existing data (invoices, calendar events) in the external service is not deleted.
