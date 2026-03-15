---
title: "Public Site Settings"
category: "Settings"
tags: ["public site", "website", "pages", "custom domain", "appearance", "content"]
order: 5
---

# Public Site Settings

The **Public Site** is a customer-facing website DiveStreams hosts for you at `yourshop.divestreams.com`. Customers can browse your trips, courses, equipment, and gallery, and book directly.

Go to **Settings** → **Public Site** to configure it. The settings are split into three tabs: **General**, **Content**, and **Appearance**.

## General Tab

### Enable / Disable

Toggle **Enable Public Site** to turn your public site on or off. When disabled, visitors see a "coming soon" page.

### Pages

Choose which pages are visible on your public site:

| Page | Default |
|------|---------|
| Home | On |
| About | On |
| Trips | On |
| Courses | On |
| Equipment | Off |
| Contact | On |
| Gallery | Off |

Toggle each page on or off. Disabled pages are not linked in the navigation and return a 404 if visited directly.

### Custom Domain

To use your own domain (e.g. `www.bluewavesdiving.com`) instead of the DiveStreams subdomain:

1. Enter your domain in the **Custom Domain** field (e.g. `www.bluewavesdiving.com`).
2. Click **Save**.
3. At your domain registrar, add a CNAME record pointing your domain to `yourshop.divestreams.com`.

DiveStreams automatically provisions an SSL certificate for your custom domain via Caddy's on-demand TLS. DNS propagation can take up to 48 hours.

> **Note:** Each custom domain must be unique. If the domain is already in use by another account, you'll see an error.

## Content Tab

### Branding

| Field | Description |
|-------|-------------|
| Logo URL | URL to your shop logo. Shown in the site header. |
| Hero Image URL | Background image for the home page hero section. |
| Hero Video URL | Video URL for the hero section (takes precedence over the hero image if set). |

### Contact Information

Fill in the details shown on your **Contact** page:

| Field | Description |
|-------|-------------|
| Address | Your shop's street address |
| Phone | Contact phone number |
| Email | Contact email address |
| Business Hours | Opening hours (free text) |
| Map Embed | Google Maps embed code (`<iframe>` — paste the full embed code from Google Maps) |

### About Page Content

Enter the text for your **About** page in the **About Content** field. Markdown formatting is supported for headings, bold, lists, and links.

## Appearance Tab

### Theme

Choose from five preset themes:

| Theme | Style |
|-------|-------|
| Ocean | Bright blue — default dive shop look |
| Tropical | Teal — warm tropical feel |
| Minimal | Grey — clean, neutral |
| Dark | Dark charcoal — dramatic, night-dive vibes |
| Classic | Navy and gold — traditional dive shop |

Selecting a theme pre-fills the primary and secondary colors for that palette.

### Colors

Override the theme colors manually:
- **Primary Color** — buttons, links, highlights. Enter a hex code (e.g. `#0ea5e9`).
- **Secondary Color** — secondary accents. Enter a hex code.

### Font Family

Choose the typeface for your public site:
- **Inter** — modern, highly legible (default)
- **Poppins** — friendly, rounded
- **Roboto** — clean, geometric
- **Open Sans** — versatile, widely used

### Hero Image URL

You can also set the hero image here (same as the Content tab — both fields update the same setting).

## Viewing Your Public Site

After saving any changes, click the link at the top of the Public Site settings page to open your site in a new tab and review the result.
