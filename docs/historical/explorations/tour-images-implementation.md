# Tour & Dive Site Images Implementation Exploration

## Overview

Add image support to Tours and Dive Sites for display in the booking widget, enabling rich visual browsing for customers.

---

## Current State

### Existing Schema (lib/db/schema.ts)

**Tours Table:**
```typescript
tours: pgTable('tours', {
  id: uuid().primaryKey(),
  name: varchar(255).notNull(),
  description: text(),
  price: integer(),
  duration: integer(), // minutes
  maxParticipants: integer(),
  // NO image fields currently
});
```

**Dive Sites Table:**
```typescript
diveSites: pgTable('dive_sites', {
  id: uuid().primaryKey(),
  name: varchar(255).notNull(),
  description: text(),
  latitude: decimal(10, 7),
  longitude: decimal(10, 7),
  maxDepth: integer(),
  difficulty: varchar(20),
  // NO image fields currently
});
```

---

## Schema Additions

### Option A: Single Image per Entity
```typescript
// Add to tours table
coverImageUrl: varchar(500),

// Add to dive_sites table
coverImageUrl: varchar(500),
```

Simple but limited.

### Option B: Multiple Images (Gallery)
```typescript
// New table for all images
images: pgTable('images', {
  id: uuid().primaryKey(),
  tenantId: uuid().notNull(), // For storage isolation
  entityType: varchar(50).notNull(), // 'tour', 'dive_site', 'equipment', 'boat'
  entityId: uuid().notNull(),
  url: varchar(500).notNull(),
  thumbnailUrl: varchar(500), // Optimized preview
  alt: varchar(255),
  caption: text(),
  sortOrder: integer().default(0),
  isPrimary: boolean().default(false), // Cover image
  width: integer(),
  height: integer(),
  sizeBytes: integer(),
  uploadedAt: timestamp().defaultNow(),
});
```

**Recommendation:** Option B - enables galleries and reuse.

---

## Image Storage Options

### Option 1: Cloudflare R2 (Recommended)
```
Cost: $0.015/GB storage, $0 egress
Features: S3-compatible, global CDN, image transformations
```

**Pros:**
- No egress fees (huge savings)
- Built-in CDN
- Cloudflare Images for resizing
- S3-compatible API

### Option 2: AWS S3 + CloudFront
```
Cost: $0.023/GB storage, $0.085/GB egress
Features: Proven, Lambda@Edge for transforms
```

**Pros:**
- Industry standard
- Extensive documentation

**Cons:**
- Egress costs add up

### Option 3: Cloudinary
```
Cost: Free tier 25GB, then $99+/mo
Features: Auto-optimization, transformations, DAM
```

**Pros:**
- Automatic format conversion (WebP, AVIF)
- Resize on-the-fly via URL
- Face detection, cropping

**Cons:**
- Vendor lock-in
- Costs scale with usage

### Option 4: Uploadthing (Simple)
```
Cost: Free 2GB, Pro $25/mo for 100GB
Features: Type-safe uploads, built for React
```

**Pros:**
- Dead simple integration
- TypeScript-first
- Handles resizing

**Recommendation:** Cloudflare R2 + Images API for production, Uploadthing for fast MVP.

---

## Upload Flow

### Admin/Tenant Upload UI

```
┌─────────────────────────────────────────────┐
│  Edit Tour: Snorkeling Adventure            │
├─────────────────────────────────────────────┤
│  Images                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌─────────┐ │
│  │ [img] │ │ [img] │ │ [img] │ │  + Add  │ │
│  │ ★ pri │ │       │ │       │ │         │ │
│  │ [x]   │ │ [x]   │ │ [x]   │ │         │ │
│  └───────┘ └───────┘ └───────┘ └─────────┘ │
│                                             │
│  Drag to reorder • Click star for cover    │
└─────────────────────────────────────────────┘
```

### Upload Implementation

```typescript
// routes/tenant/api/upload.tsx
import { parseFormData } from '@uploadthing/server';

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, schema } = await requireTenantAuth(request);
  const formData = await request.formData();

  const file = formData.get('file') as File;
  const entityType = formData.get('entityType') as string;
  const entityId = formData.get('entityId') as string;

  // Validate file
  if (!file || file.size > 10 * 1024 * 1024) { // 10MB limit
    return json({ error: 'File too large' }, { status: 400 });
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return json({ error: 'Invalid file type' }, { status: 400 });
  }

  // Upload to R2/S3
  const key = `${tenant.id}/${entityType}/${entityId}/${Date.now()}-${file.name}`;
  await s3Client.putObject({
    Bucket: 'divestreams-images',
    Key: key,
    Body: await file.arrayBuffer(),
    ContentType: file.type,
  });

  // Generate thumbnail
  const thumbnailUrl = await generateThumbnail(key);

  // Save to database
  const [image] = await db.insert(schema.images).values({
    tenantId: tenant.id,
    entityType,
    entityId,
    url: `https://images.divestreams.com/${key}`,
    thumbnailUrl,
  }).returning();

  return json({ image });
}
```

---

## Image Optimization

### Automatic Transformations
```typescript
// Generate optimized URLs for different contexts
function getImageUrl(key: string, options: { width?: number; format?: 'webp' | 'avif' }) {
  // Cloudflare Images URL format
  return `https://images.divestreams.com/cdn-cgi/image/width=${options.width},format=${options.format}/${key}`;
}

// Usage in widget
<img
  src={getImageUrl(tour.coverImage, { width: 400, format: 'webp' })}
  srcSet={`
    ${getImageUrl(tour.coverImage, { width: 400, format: 'webp' })} 400w,
    ${getImageUrl(tour.coverImage, { width: 800, format: 'webp' })} 800w
  `}
  alt={tour.name}
/>
```

### Thumbnail Generation
```typescript
// On upload, generate:
// - thumbnail: 200x200 (list views)
// - medium: 600x400 (cards)
// - large: 1200x800 (hero/lightbox)
```

---

## Widget Integration

### Tour Card with Image
```tsx
function TourCard({ tour }: { tour: Tour }) {
  const coverImage = tour.images.find(i => i.isPrimary) || tour.images[0];

  return (
    <div className="tour-card">
      {coverImage ? (
        <img
          src={coverImage.thumbnailUrl}
          alt={coverImage.alt || tour.name}
          loading="lazy"
        />
      ) : (
        <div className="placeholder-image">
          <CameraIcon />
        </div>
      )}
      <h3>{tour.name}</h3>
      <p>{tour.description}</p>
    </div>
  );
}
```

### Gallery Lightbox
```tsx
function TourGallery({ images }: { images: Image[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="thumbnails">
        {images.map((img, i) => (
          <button key={img.id} onClick={() => { setSelectedIndex(i); setIsOpen(true); }}>
            <img src={img.thumbnailUrl} alt={img.alt} />
          </button>
        ))}
      </div>

      {isOpen && (
        <Lightbox
          images={images.map(i => i.url)}
          currentIndex={selectedIndex}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

---

## Routes to Create/Modify

### New Routes
```
/app/routes/tenant/api/
├── upload.tsx          # Image upload endpoint
├── images.$id.delete.tsx  # Delete image

/app/routes/embed/$tenant/
├── tours.$id.tsx       # Tour detail with gallery
├── sites.$id.tsx       # Dive site detail with gallery
```

### Modified Routes
```
/app/routes/tenant/tours/$id.tsx   # Add image management
/app/routes/tenant/dive-sites/$id.tsx  # Add image management
```

---

## Mobile Upload

### Camera/Gallery Access
```tsx
<input
  type="file"
  accept="image/*"
  capture="environment" // Opens camera on mobile
  onChange={handleFileSelect}
/>
```

### Drag and Drop (Desktop)
```tsx
function ImageDropZone({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        files.forEach(onUpload);
      }}
      className={isDragging ? 'dropzone active' : 'dropzone'}
    >
      Drop images here or click to upload
    </div>
  );
}
```

---

## Implementation Priority

### Phase 1 (MVP)
1. Add `coverImageUrl` field to tours and dive_sites tables
2. Simple file upload (single image)
3. Display cover image in widget tour cards
4. Use Uploadthing or direct S3 upload

### Phase 2 (Gallery)
1. Create images table
2. Multi-image upload with drag-and-drop
3. Reorder and set primary image
4. Thumbnail generation

### Phase 3 (Optimization)
1. Cloudflare R2 + Images API
2. Automatic WebP/AVIF conversion
3. Responsive srcset generation
4. Lazy loading

### Phase 4 (Advanced)
1. AI auto-tagging (underwater, fish species)
2. Bulk upload from ZIP
3. Stock photo integration
4. Image compression on client before upload

---

## Dependencies

```bash
# Phase 1 (Simple)
npm install uploadthing @uploadthing/react

# Phase 2+ (Full control)
npm install @aws-sdk/client-s3 sharp
```

## Estimated Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | Single cover image | 1-2 days |
| Phase 2 | Gallery + reorder | 2-3 days |
| Phase 3 | R2 + optimization | 2-3 days |
| Phase 4 | Advanced features | 3-4 days |

---

## Questions to Resolve

1. Single cover image enough for MVP?
2. Storage provider preference (R2 vs S3 vs Uploadthing)?
3. Max images per tour/site?
4. Video support needed (underwater footage)?
5. Watermarking for copyright protection?
