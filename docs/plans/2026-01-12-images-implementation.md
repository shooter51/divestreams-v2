# Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add image upload and management for tours, dive sites, boats, equipment, and staff using Backblaze B2 + Cloudflare CDN.

**Architecture:** Polymorphic images table, S3-compatible upload to B2, Cloudflare CDN for delivery, thumbnail generation on upload.

**Tech Stack:** AWS SDK v3 (S3-compatible), Backblaze B2, Cloudflare CDN, Sharp for thumbnails

---

## Current State

| Entity | Has Images Field | Location |
|--------|------------------|----------|
| Tours | Yes (`jsonb`) | `lib/db/schema.ts:258` |
| Dive Sites | Yes (`jsonb`) | `lib/db/schema.ts:228` |
| Boats | Yes (`jsonb`) | `lib/db/schema.ts:208` |
| Equipment | No | `lib/db/schema.ts:370` |
| Staff | No | TBD |

Existing fields are simple `jsonb` arrays of URLs. We'll create a dedicated images table for better management.

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install AWS SDK and Sharp**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp
npm install -D @types/sharp
```

**Step 2: Verify installation**

```bash
npm ls @aws-sdk/client-s3 sharp
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add AWS SDK and Sharp for image uploads

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Images Table to Schema

**Files:**
- Modify: `lib/db/schema.ts`

**Step 1: Add images table to tenant schema**

Inside `createTenantSchema()` function, after the equipment table, add:

```typescript
// Images (polymorphic - can belong to any entity)
const images = schema.table("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(), // 'tour', 'dive_site', 'boat', 'equipment', 'staff'
  entityId: uuid("entity_id").notNull(),

  url: text("url").notNull(), // Full CDN URL
  thumbnailUrl: text("thumbnail_url"), // 200x200 thumbnail

  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),

  alt: text("alt"), // Accessibility text
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("images_entity_idx").on(table.entityType, table.entityId),
]);
```

**Step 2: Add images to the return object**

In the return statement of `createTenantSchema()`, add `images` to the returned tables.

**Step 3: Run typecheck**

```bash
npm run typecheck
```

**Step 4: Generate migration**

```bash
npm run db:generate
```

**Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(images): add images table to tenant schema

Polymorphic images table supporting tours, dive sites, boats,
equipment, and staff with thumbnail support and sort order.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create B2 Storage Service

**Files:**
- Create: `lib/storage/b2.ts`
- Create: `lib/storage/index.ts`

**Step 1: Create B2 client configuration**

Create `lib/storage/b2.ts`:

```typescript
/**
 * Backblaze B2 Storage Service
 *
 * S3-compatible API for image uploads with Cloudflare CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// B2 configuration from environment
const B2_ENDPOINT = process.env.B2_ENDPOINT; // https://s3.us-west-004.backblazeb2.com
const B2_REGION = process.env.B2_REGION || "us-west-004";
const B2_BUCKET = process.env.B2_BUCKET || "divestreams-images";
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const CDN_URL = process.env.CDN_URL; // https://images.divestreams.com

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY) {
    console.warn("B2 storage not configured - image uploads disabled");
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: B2_ENDPOINT,
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY,
      },
    });
  }

  return s3Client;
}

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl: string;
}

export async function uploadToB2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<UploadResult | null> {
  const client = getS3Client();
  if (!client) return null;

  await client.send(new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000", // 1 year cache
  }));

  const url = `${B2_ENDPOINT}/${B2_BUCKET}/${key}`;
  const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

  return { key, url, cdnUrl };
}

export async function deleteFromB2(key: string): Promise<boolean> {
  const client = getS3Client();
  if (!client) return false;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error) {
    console.error("Failed to delete from B2:", error);
    return false;
  }
}

export function getImageKey(
  tenantId: string,
  entityType: string,
  entityId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${tenantId}/${entityType}/${entityId}/${timestamp}-${sanitized}`;
}
```

**Step 2: Create storage index**

Create `lib/storage/index.ts`:

```typescript
export * from "./b2";
```

**Step 3: Verify compilation**

```bash
npm run typecheck
```

**Step 4: Commit**

```bash
git add lib/storage/
git commit -m "feat(images): add Backblaze B2 storage service

S3-compatible client for uploading images to B2 with
Cloudflare CDN URL generation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Image Processing Service

**Files:**
- Create: `lib/storage/image-processor.ts`

**Step 1: Create image processor with Sharp**

Create `lib/storage/image-processor.ts`:

```typescript
/**
 * Image Processing Service
 *
 * Generates thumbnails and optimizes images for web.
 */

import sharp from "sharp";

export interface ProcessedImage {
  original: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export async function processImage(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    thumbnailSize?: number;
    quality?: number;
  } = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    thumbnailSize = 200,
    quality = 80,
  } = options;

  // Get original metadata
  const metadata = await sharp(buffer).metadata();

  // Resize original if too large, convert to WebP
  const originalImage = sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality });

  const originalBuffer = await originalImage.toBuffer();
  const originalMeta = await sharp(originalBuffer).metadata();

  // Generate thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .resize(thumbnailSize, thumbnailSize, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 70 })
    .toBuffer();

  return {
    original: originalBuffer,
    thumbnail: thumbnailBuffer,
    width: originalMeta.width || 0,
    height: originalMeta.height || 0,
    thumbnailWidth: thumbnailSize,
    thumbnailHeight: thumbnailSize,
  };
}

export function isValidImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
}

export function getWebPMimeType(): string {
  return "image/webp";
}
```

**Step 2: Export from index**

Add to `lib/storage/index.ts`:

```typescript
export * from "./image-processor";
```

**Step 3: Commit**

```bash
git add lib/storage/
git commit -m "feat(images): add image processing with Sharp

Generate thumbnails and optimize images to WebP format.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Image Upload API Route

**Files:**
- Create: `app/routes/tenant/api/images.upload.tsx`

**Step 1: Create upload route**

Create `app/routes/tenant/api/images.upload.tsx`:

```typescript
/**
 * Image Upload API
 *
 * POST /tenant/api/images/upload
 *
 * Handles multipart form uploads, processes images,
 * uploads to B2, and saves to database.
 */

import { type ActionFunctionArgs, json } from "react-router";
import { requireTenantAuth } from "~/lib/auth/tenant-auth.server";
import { uploadToB2, getImageKey } from "~/lib/storage/b2";
import { processImage, isValidImageType, getWebPMimeType } from "~/lib/storage/image-processor";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES_PER_ENTITY = 5;

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, schema, db } = await requireTenantAuth(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const entityType = formData.get("entityType") as string;
  const entityId = formData.get("entityId") as string;

  // Validate inputs
  if (!file || !entityType || !entityId) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidImageType(file.type)) {
    return json({ error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: "File too large. Maximum 10MB." }, { status: 400 });
  }

  // Check image count limit
  const existingImages = await db
    .select()
    .from(schema.images)
    .where(
      and(
        eq(schema.images.entityType, entityType),
        eq(schema.images.entityId, entityId)
      )
    );

  if (existingImages.length >= MAX_IMAGES_PER_ENTITY) {
    return json({ error: `Maximum ${MAX_IMAGES_PER_ENTITY} images allowed` }, { status: 400 });
  }

  // Process image
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(buffer);

  // Generate keys
  const originalKey = getImageKey(tenant.id, entityType, entityId, file.name);
  const thumbnailKey = originalKey.replace(/\.[^.]+$/, "-thumb.webp");

  // Upload to B2
  const originalResult = await uploadToB2(originalKey, processed.original, getWebPMimeType());
  const thumbnailResult = await uploadToB2(thumbnailKey, processed.thumbnail, getWebPMimeType());

  if (!originalResult || !thumbnailResult) {
    return json({ error: "Failed to upload image" }, { status: 500 });
  }

  // Determine sort order
  const sortOrder = existingImages.length;
  const isPrimary = existingImages.length === 0;

  // Save to database
  const [image] = await db
    .insert(schema.images)
    .values({
      entityType,
      entityId,
      url: originalResult.cdnUrl,
      thumbnailUrl: thumbnailResult.cdnUrl,
      filename: file.name,
      mimeType: getWebPMimeType(),
      sizeBytes: processed.original.length,
      width: processed.width,
      height: processed.height,
      sortOrder,
      isPrimary,
    })
    .returning();

  return json({ image });
}
```

**Step 2: Add missing imports**

Add at top of file:

```typescript
import { and, eq } from "drizzle-orm";
```

**Step 3: Commit**

```bash
git add app/routes/tenant/api/
git commit -m "feat(images): add image upload API endpoint

Handles multipart uploads, processes with Sharp, uploads to B2,
enforces 5-image limit per entity.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Image Delete API Route

**Files:**
- Create: `app/routes/tenant/api/images.$id.delete.tsx`

**Step 1: Create delete route**

Create `app/routes/tenant/api/images.$id.delete.tsx`:

```typescript
/**
 * Image Delete API
 *
 * DELETE /tenant/api/images/:id
 */

import { type ActionFunctionArgs, json } from "react-router";
import { requireTenantAuth } from "~/lib/auth/tenant-auth.server";
import { deleteFromB2 } from "~/lib/storage/b2";
import { eq } from "drizzle-orm";

export async function action({ request, params }: ActionFunctionArgs) {
  const { schema, db } = await requireTenantAuth(request);

  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const imageId = params.id;
  if (!imageId) {
    return json({ error: "Image ID required" }, { status: 400 });
  }

  // Get image
  const [image] = await db
    .select()
    .from(schema.images)
    .where(eq(schema.images.id, imageId));

  if (!image) {
    return json({ error: "Image not found" }, { status: 404 });
  }

  // Extract key from URL
  const urlParts = image.url.split("/");
  const key = urlParts.slice(-4).join("/"); // tenant/type/entity/filename
  const thumbKey = key.replace(/\.[^.]+$/, "-thumb.webp");

  // Delete from B2
  await deleteFromB2(key);
  await deleteFromB2(thumbKey);

  // Delete from database
  await db
    .delete(schema.images)
    .where(eq(schema.images.id, imageId));

  return json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/routes/tenant/api/
git commit -m "feat(images): add image delete API endpoint

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create Image Manager Component

**Files:**
- Create: `app/components/ImageManager.tsx`

**Step 1: Create reusable image manager component**

Create `app/components/ImageManager.tsx`:

```typescript
/**
 * Image Manager Component
 *
 * Drag-and-drop upload, reorder, set primary, delete.
 */

import { useState, useRef } from "react";
import { useFetcher } from "react-router";

interface Image {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface ImageManagerProps {
  entityType: string;
  entityId: string;
  images: Image[];
  maxImages?: number;
}

export function ImageManager({
  entityType,
  entityId,
  images,
  maxImages = 5,
}: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      uploadFetcher.submit(formData, {
        method: "POST",
        action: "/tenant/api/images/upload",
        encType: "multipart/form-data",
      });
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = (imageId: string) => {
    if (!confirm("Delete this image?")) return;

    deleteFetcher.submit(null, {
      method: "DELETE",
      action: `/tenant/api/images/${imageId}`,
    });
  };

  const canUpload = images.length < maxImages;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Images ({images.length}/{maxImages})
        </h3>
        {canUpload && (
          <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md">
            {uploading ? "Uploading..." : "Add Image"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group aspect-square bg-gray-800 rounded-lg overflow-hidden"
          >
            <img
              src={image.thumbnailUrl}
              alt={image.filename}
              className="w-full h-full object-cover"
            />

            {image.isPrimary && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-500 text-black text-xs font-medium rounded">
                Cover
              </span>
            )}

            <button
              onClick={() => handleDelete(image.id)}
              className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {canUpload && images.length === 0 && (
          <label className="aspect-square border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors">
            <div className="text-center text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">Add Image</span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/components/
git commit -m "feat(images): add ImageManager component

Reusable component for upload, display, and delete of entity images.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Environment Variables

**Files:**
- Modify: `.env.example`

**Step 1: Add B2 configuration to .env.example**

Add to `.env.example`:

```env
# Backblaze B2 Storage
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_BUCKET=divestreams-images
B2_KEY_ID=
B2_APP_KEY=
CDN_URL=https://images.divestreams.com
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add B2 storage configuration to .env.example

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Integrate ImageManager into Tour Edit Page

**Files:**
- Modify: `app/routes/tenant/tours/$id.tsx`

**Step 1: Add image loading to loader**

In the loader, after fetching tour, add:

```typescript
const images = await db
  .select()
  .from(schema.images)
  .where(
    and(
      eq(schema.images.entityType, "tour"),
      eq(schema.images.entityId, tour.id)
    )
  )
  .orderBy(schema.images.sortOrder);

return { tour, images };
```

**Step 2: Add ImageManager to the form**

Import and add component:

```typescript
import { ImageManager } from "~/components/ImageManager";

// In the component, add after description field:
<ImageManager
  entityType="tour"
  entityId={tour.id}
  images={images}
/>
```

**Step 3: Commit**

```bash
git add app/routes/tenant/tours/\$id.tsx
git commit -m "feat(images): integrate ImageManager into tour edit page

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Configure Production B2 + Cloudflare

**Manual Steps:**

1. **Create Backblaze B2 Account** (if not exists)
   - Go to https://www.backblaze.com/b2/
   - Create account or sign in

2. **Create Bucket**
   - Name: `divestreams-images`
   - Type: Public
   - Default Encryption: Disabled
   - Object Lock: Disabled

3. **Create Application Key**
   - Go to App Keys
   - Create new key for `divestreams-images` bucket
   - Save Key ID and Application Key

4. **Configure Cloudflare CDN**
   - Add CNAME record: `images.divestreams.com` -> `f004.backblazeb2.com`
   - Enable SSL/TLS
   - Configure cache rules for images

5. **Update VPS .env**

```bash
ssh root@72.62.166.128 'cat >> /docker/divestreams-v2/.env << EOF

# Backblaze B2 Storage
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_BUCKET=divestreams-images
B2_KEY_ID=<your-key-id>
B2_APP_KEY=<your-app-key>
CDN_URL=https://images.divestreams.com
EOF'
```

6. **Restart containers**

```bash
ssh root@72.62.166.128 'cd /docker/divestreams-v2 && docker compose down && docker compose up -d'
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependencies | `package.json` |
| 2 | Add images table | `lib/db/schema.ts` |
| 3 | Create B2 storage service | `lib/storage/b2.ts` |
| 4 | Create image processor | `lib/storage/image-processor.ts` |
| 5 | Create upload API | `app/routes/tenant/api/` |
| 6 | Create delete API | `app/routes/tenant/api/` |
| 7 | Create ImageManager component | `app/components/` |
| 8 | Add env variables | `.env.example` |
| 9 | Integrate into tours page | `app/routes/tenant/tours/$id.tsx` |
| 10 | Configure production B2 | VPS `.env` |

After completion, extend to other entity pages (dive-sites, boats, equipment).
