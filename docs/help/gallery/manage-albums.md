---
title: "Manage Albums"
category: "Gallery"
tags: ["gallery", "album", "photos", "images", "public"]
order: 1
---

# Manage Albums

The **Gallery** organizes your dive photos into albums. Albums can be published to your public site so customers can browse them.

## View All Albums

Go to **Gallery** in the sidebar. Each album is shown as a card with its cover image, name, and photo count.

## Create an Album

1. Go to **Gallery** in the sidebar.
2. Click **New Album** in the top right.

### Album Information

| Field | Required | Notes |
|-------|----------|-------|
| Album Name | Yes | e.g. "Tulamben 2024", "PADI OWD — March" |
| URL Slug | No | Auto-generated from the name. Used in the public URL (`/gallery/tulamben-2024`). Must be unique. |
| Description | No | Shown on the public album page |
| Sort Order | No | Lower numbers appear first in the gallery list. Default 0. |

### Cover Image

Upload an optional cover image (JPEG, PNG, WebP, or GIF, max 10 MB). The cover is shown as the album thumbnail in the gallery grid. If no cover is uploaded, the album shows a placeholder.

### Visibility

- **Public** — checked by default. Public albums appear on your public site gallery page (if the Gallery page is enabled in **Settings** → **Public Site**).
- Uncheck **Public** to keep the album internal (staff only).

### Save

Click **Create Album**. You are taken to the album detail page where you can start uploading photos.

## Edit an Album

1. Go to **Gallery** and click the album.
2. On the album detail page, click **Edit Album**.
3. Update any field, including name, description, sort order, cover image, or visibility.
4. Click **Save**.

To change the cover image, upload a new file. To remove the current cover without replacing it, check **Remove Cover Image** and save.

## Delete an Album

On the album detail page, click **Delete Album**. This deletes the album and all its images permanently. This action cannot be undone.

## Album on the Public Site

For an album to appear on your public site:
1. The album must be marked **Public**.
2. The **Gallery** page must be enabled under **Settings** → **Public Site** → **General** → **Pages**.

Customers can then browse the gallery at `yourshop.divestreams.com/gallery`.
