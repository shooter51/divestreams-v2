---
title: "Manage Content"
category: "Public Site"
tags: ["public site", "content", "about", "contact", "logo", "hero", "pages"]
order: 2
---

# Manage Content

The **Content** tab in Public Site Settings controls your shop's branding assets, the About page text, and the Contact page details.

## Open Content Settings

1. Go to **Settings** in the sidebar.
2. Click **Public Site**.
3. Click the **Content** tab.

## Branding

| Field | Description |
|-------|-------------|
| Logo URL | URL to your logo image. Shown in the site header and footer. Recommended: PNG or SVG with a transparent background. |
| Hero Image URL | URL to the background image for the home page hero section. |
| Hero Video URL | URL to a video for the hero section. If set, the video takes precedence over the hero image. |

Paste a publicly accessible URL for each. DiveStreams does not upload images in Content settings — host them externally (e.g. on your CDN or in your gallery) and paste the URL.

## About Page Content

The **About Content** field controls the text on your `/about` page. Write your shop story, dive team bio, or certifications here.

Supported formatting:
- `**bold**` → **bold**
- `*italic*` → *italic*
- `## Heading` → section heading
- `- item` → bullet list
- `[Link text](https://example.com)` → hyperlink

Leave blank to hide the text section on the About page.

## Contact Information

Fill in the fields shown on your `/contact` page:

| Field | Example |
|-------|---------|
| Address | 12 Reef Road, Tulamben, Bali, Indonesia |
| Phone | +62 812 3456 7890 |
| Email | hello@bluewavesdiving.com |
| Business Hours | Mon–Sat 7 am – 6 pm |
| Map Embed | Paste the `<iframe>` code from Google Maps |

### Getting the Map Embed Code

1. Open Google Maps and find your location.
2. Click **Share** → **Embed a map**.
3. Copy the `<iframe>` code.
4. Paste it into the **Map Embed** field.

DiveStreams sanitizes the embed code to remove any scripts that are not part of a standard Google Maps iframe.

## Save

Click **Save Content Settings**. Changes take effect immediately on your public site.

## Enabling and Disabling Pages

To control which pages are visible on your public site, go to the **General** tab and toggle the page switches. See [Public Site Settings](../settings/public-site.md) for details.
