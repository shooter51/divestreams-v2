---
title: "Booking Widget"
category: "Settings"
tags: ["booking widget", "embed", "iframe", "website", "online booking"]
order: 4
---

# Booking Widget

The **Booking Widget** lets customers browse your upcoming trips and book directly from your own website. You embed it as an `<iframe>` in any page — WordPress, Squarespace, Wix, or plain HTML.

## Configure the Widget

1. Go to **Settings** in the sidebar.
2. Click **Booking Widget**.

### Appearance

| Setting | Description |
|---------|-------------|
| Primary Color | Accent color for buttons and highlights. Click the color picker or type a hex value. |
| Button Text | Text shown on the booking button. Default: "Book Now" |
| Layout | **Grid** (card grid) or **List** (vertical list) |
| Max Trips Shown | How many upcoming trips to display: 3, 6, 9, or 12 |

### Display Options

Toggle which information appears on each trip card:
- **Show Prices** — displays the trip price
- **Show Availability** — shows remaining spots
- **Show Description** — shows the tour description excerpt

### Saving Settings

Click **Save Settings**. The widget at your embed URL updates immediately.

## Embed the Widget

Below the settings form, the **Embed Code** section shows the `<iframe>` snippet pre-filled with your shop's URL:

```html
<iframe
  src="https://yourshop.divestreams.com/embed/yourshop"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="Your Shop Booking Widget"
></iframe>
```

Click **Copy Code** to copy it to your clipboard, then paste it into your website.

### Tips for Embedding

- Set the `height` to match how many trips you show (taller for more trips).
- Use `width="100%"` to make the widget responsive.
- The widget respects your primary color setting for branding.

## Widget URL

The embed URL is shown on the page. You can also share this URL directly with customers — it opens a standalone booking page branded with your shop name.

## What Customers See

When a customer clicks **Book Now** on a trip card:
1. They are taken to the booking form on your DiveStreams public site.
2. They can sign up or log in to their customer account.
3. They complete the booking with payment.

All bookings made via the widget appear in your **Bookings** list just like any other booking.
