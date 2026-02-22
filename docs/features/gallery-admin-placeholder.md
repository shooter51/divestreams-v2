# Gallery Admin Pages - To Be Implemented

The admin gallery management pages will be created in a separate task to keep this implementation focused.

## Planned Admin Features

### Gallery Images Management (app/routes/admin/gallery/images.tsx)
- List all gallery images (published, draft, archived)
- Upload new images (single or bulk upload)
- Edit image metadata (title, description, category, tags, location)
- Assign images to albums
- Set featured images
- Change image status (published/draft/archived)
- Delete images
- Reorder images (drag-and-drop)
- Image preview and lightbox

### Gallery Albums Management (app/routes/admin/gallery/albums.tsx)
- List all albums
- Create new albums
- Edit album details (name, description, slug, cover image)
- Set album visibility (public/private)
- Reorder albums
- Delete albums
- View album contents

### Image Upload Component
- Support for multiple file uploads
- Image preview before upload
- Automatic thumbnail generation
- Image optimization/compression
- EXIF data extraction (date taken, camera info, location)
- Batch metadata editing

### Integration with Public Site
- Images uploaded via admin panel appear in public gallery
- Real-time updates when images are published/unpublished
- Album organization reflects in public site filtering

## Implementation Notes

For now, gallery content can be managed by:
1. Running the seed data script: `npx tsx scripts/seed-gallery-data.ts <org-id>`
2. Direct database inserts for custom content
3. Future admin panel implementation will provide full CRUD capabilities

## Database Tables
- `gallery_albums` - Album/collection organization
- `gallery_images` - Individual images with metadata
- Both tables support multi-tenant isolation via organization_id
