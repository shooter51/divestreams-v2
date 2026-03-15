---
title: "Embed the Booking Widget"
category: "Public Site"
tags: ["booking widget", "embed", "iframe", "website", "online booking", "wordpress", "squarespace"]
order: 3
---

# Embed the Booking Widget

The **Booking Widget** lets customers browse your upcoming trips and book from your own website — not just from your DiveStreams public site. You embed it as a standard `<iframe>` in any page.

## Get the Embed Code

1. Go to **Settings** → **Booking Widget**.
2. Configure the widget appearance (colors, button text, layout, and how many trips to show). See [Booking Widget](../settings/booking-widget.md) for configuration details.
3. In the **Embed Code** section, click **Copy Code**.

The code looks like this:

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

## Add the Widget to Your Website

### WordPress

1. Open the WordPress editor for the page where you want the widget.
2. Add a **Custom HTML** block.
3. Paste the `<iframe>` code into the block.
4. Publish or update the page.

### Squarespace

1. Edit the page in Squarespace.
2. Add a **Code Block**.
3. Paste the `<iframe>` code.
4. Save.

### Wix

1. Open the Wix Editor.
2. Click **Add** → **Embed** → **Embed Code**.
3. Paste the `<iframe>` code.
4. Resize and position the element.

### Plain HTML

Paste the `<iframe>` code directly into your page's HTML where you want the widget to appear.

## Adjusting the Height

The default height is 600 px. If you show more trips (9 or 12), increase the height to 800–900 px to avoid internal scrollbars:

```html
<iframe src="..." width="100%" height="900" ...></iframe>
```

## What Customers See

The widget shows your upcoming public trips as cards. Each card displays:
- Trip name and date
- Price (if **Show Prices** is enabled)
- Available spots (if **Show Availability** is enabled)
- Description excerpt (if **Show Description** is enabled)
- A **Book Now** button

When a customer clicks **Book Now**, they are taken to the booking flow on your DiveStreams site. They can create an account or log in, select participants, and pay.

## Bookings from the Widget

Bookings made through the widget appear in your **Bookings** list exactly like bookings made anywhere else. The booking source is recorded as `website`.

## Keeping the Widget Up to Date

The widget always shows your current upcoming public trips. When you add new trips or update existing ones, the widget updates automatically — no need to regenerate or re-embed the code.
