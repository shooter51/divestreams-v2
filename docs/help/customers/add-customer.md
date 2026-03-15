---
title: "Add a Customer"
category: "Customers"
tags: ["customer", "add", "create", "profile", "email"]
order: 1
---

# Add a Customer

Adding a customer creates a profile in your database. Customers can also self-register on your public site — this article covers adding them manually from the admin dashboard.

## Steps

1. Go to **Customers** in the sidebar.
2. Click **New Customer** in the top right.

### Basic Info

| Field | Required | Notes |
|-------|----------|-------|
| First Name | Yes | |
| Last Name | Yes | |
| Email | Yes | Must be a valid email; must not already be used by a staff account |
| Phone | No | Any format |
| Date of Birth | No | Used to verify age requirements |

### Certification

If the customer has a diving certification, fill in:
- **Agency** — PADI, SSI, NAUI, SDI, BSAC, or Other
- **Level** — Open Water, Advanced Open Water, Rescue Diver, Divemaster, or Instructor
- **Certification Number** — their card number (optional)

### Emergency Contact

- **Name** — the contact's full name
- **Phone** — their phone number
- **Relationship** — e.g. "Spouse", "Parent", "Friend"

### Medical Information

- **Medical Conditions** — any conditions relevant to diving safety
- **Current Medications** — especially relevant for dive fitness

> **Note:** Medical information is visible only to staff and is never shared publicly.

### Address

- Street Address, City, State, Postal Code, Country

### Notes & Preferences

- **Internal Notes** — staff-only notes about the customer (e.g. "Prefers afternoon dives", "Has own wetsuit")
- **Marketing Opt-in** — check if the customer consents to receive marketing communications

## Password Setup Email

When you save a new customer, DiveStreams:
1. Creates the customer profile.
2. Creates login credentials for the customer on your public site.
3. Sends an email to the customer's email address with a link to set their password.

The customer can then log in to `yourshop.divestreams.com/login` to view their bookings and update their profile.

If the email fails to send, the customer is still created and you see a warning message. You can ask the customer to use the "Forgot Password" link on your public site to set their password later.

## Plan Limits

Depending on your plan there may be a limit on total customers. A warning banner appears when you are close to the limit. Upgrade from **Settings** → **Billing & Subscription**.
