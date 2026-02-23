# Add Image Upload to Creation Pages

**Problem:** Users must create items first, then go back and edit to add images. This creates unnecessary friction in the creation workflow.

**Goal:** Add image upload capability directly to all "new" creation pages that support images.

---

## Affected Pages

| Page | Current URL | Supports Images | Status |
|------|-------------|-----------------|--------|
| **Tours** | `/tenant/tours/new` | Yes (5 max) | ❌ No upload on create |
| **Boats** | `/tenant/boats/new` | Yes (5 max) | ❌ No upload on create |
| **Dive Sites** | `/tenant/dive-sites/new` | Yes (5 max) | ❌ No upload on create |
| **Products** | `/tenant/pos/products/new` | Yes (5 max) | ❌ No upload on create |

**Impact:** All 4 creation pages require users to create → save → edit → upload images

---

## Current Workflow (Broken UX)

```
User creates new tour
  → Fills out form (name, description, price, etc.)
  → Clicks "Create Tour"
  → Tour created ✓
  → User wants to add images
  → Must navigate to Tours list
  → Find the tour they just created
  → Click Edit
  → THEN can upload images

Total: 7 steps to create tour with images
```

## Desired Workflow

```
User creates new tour
  → Fills out form
  → Uploads images directly in creation form
  → Clicks "Create Tour"
  → Tour created with images ✓

Total: 3 steps
```

---

## Implementation Plan

### Phase 1: Create Reusable Image Upload Component

**File:** `app/components/shared/ImageUploadField.tsx`

```typescript
import { useState } from "react";

interface ImageUploadFieldProps {
  entityType: "tour" | "boat" | "dive-site" | "product";
  maxImages?: number;
  onImagesChange: (imageFiles: File[]) => void;
  existingImages?: string[];
}

export function ImageUploadField({
  entityType,
  maxImages = 5,
  onImagesChange,
  existingImages = []
}: ImageUploadFieldProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + selectedFiles.length + files.length;

    if (totalImages > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    // Create preview URLs
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));

    const updatedFiles = [...selectedFiles, ...validFiles];
    const updatedPreviews = [...previews, ...newPreviews];

    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onImagesChange(updatedFiles);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onImagesChange(updatedFiles);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Images (optional, max {maxImages})
        </label>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={existingImages.length + selectedFiles.length >= maxImages}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
        />

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {existingImages.length + selectedFiles.length} / {maxImages} images selected
        </p>
      </div>

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Phase 2: Update Creation Page Actions

**Pattern to apply to all 4 pages:**

```typescript
// app/routes/tenant/tours/new.tsx
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  // Existing validation...
  const validation = validateFormData(formData, tourSchema);
  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Create the tour first
  const newTour = await createTour(organizationId, { ...tourData });

  // NEWHANDLE IMAGE UPLOADS
  const imageFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('image-') && value instanceof File && value.size > 0) {
      imageFiles.push(value);
    }
  }

  // Upload images if provided
  if (imageFiles.length > 0) {
    try {
      for (const file of imageFiles) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = getImageKey(organizationId, "tour", newTour.id, file.name);

        await uploadToB2(key, buffer, file.type);

        // Create database record
        await db.insert(image).values({
          id: crypto.randomUUID(),
          entityType: "tour",
          entityId: newTour.id,
          organizationId,
          key,
          url: `https://${B2_BUCKET}.s3.${B2_REGION}.amazonaws.com/${key}`,
          cdnUrl: CDN_URL ? `${CDN_URL}/${key}` : undefined,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to upload images:", error);
      // Don't fail the entire creation, just log the error
      // User can still upload images via edit page
    }
  }

  return redirect(`/tenant/tours/${newTour.id}`);
}
```

### Phase 3: Update UI Forms

**Add ImageUploadField to each form:**

```typescript
// app/routes/tenant/tours/new.tsx (UI section)
import { ImageUploadField } from "~/components/shared/ImageUploadField";

export default function NewTour() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  return (
    <form method="post" encType="multipart/form-data">
      {/* Existing fields */}
      <input name="name" />
      <textarea name="description" />

      {/* NEW: Image upload field */}
      <ImageUploadField
        entityType="tour"
        maxImages={5}
        onImagesChange={setImageFiles}
      />

      {/* Hidden inputs to include files in form data */}
      {imageFiles.map((file, index) => (
        <input
          key={index}
          type="hidden"
          name={`image-${index}`}
          value={file}
        />
      ))}

      <button type="submit">Create Tour</button>
    </form>
  );
}
```

---

## File Changes Required

### New Files (1)
1. `app/components/shared/ImageUploadField.tsx` - Reusable component

### Modified Files (4)
1. `app/routes/tenant/tours/new.tsx`
2. `app/routes/tenant/boats/new.tsx`
3. `app/routes/tenant/dive-sites/new.tsx`
4. `app/routes/tenant/pos/products/new.tsx`

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/components/ImageUploadField.test.tsx
describe('ImageUploadField', () => {
  it('allows selecting up to max images', () => {
    const onImagesChange = vi.fn();
    render(<ImageUploadField entityType="tour" maxImages={5} onImagesChange={onImagesChange} />);

    // Upload 5 images
    const input = screen.getByLabelText(/Images/i);
    fireEvent.change(input, { target: { files: [file1, file2, file3, file4, file5] } });

    expect(onImagesChange).toHaveBeenCalledWith(expect.arrayContaining([file1, file2, file3, file4, file5]));
  });

  it('rejects files over 10MB', () => {
    // Test large file rejection
  });

  it('rejects non-image files', () => {
    // Test file type validation
  });

  it('shows preview thumbnails', () => {
    // Test preview generation
  });

  it('allows removing selected images', () => {
    // Test removal functionality
  });
});
```

### E2E Tests

```typescript
// tests/e2e/tour-creation-with-images.spec.ts
test('create tour with images', async ({ page }) => {
  await page.goto('/tenant/tours/new');

  // Fill form
  await page.fill('input[name="name"]', 'Test Tour');
  await page.fill('textarea[name="description"]', 'Test description');
  await page.fill('input[name="price"]', '100');

  // Upload images
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    'tests/fixtures/tour-image-1.jpg',
    'tests/fixtures/tour-image-2.jpg',
  ]);

  // Verify previews shown
  await expect(page.locator('img[alt*="Preview"]')).toHaveCount(2);

  // Submit form
  await page.click('button:has-text("Create Tour")');

  // Verify redirect to tour detail page
  await expect(page).toHaveURL(/\/tenant\/tours\/[a-z0-9-]+$/);

  // Verify images appear on tour detail page
  await expect(page.locator('img[alt*="Tour image"]')).toHaveCount(2);
});
```

---

## Acceptance Criteria

**Functional:**
- [ ] User can select multiple images during tour/boat/dive-site/product creation
- [ ] Image previews display before submitting form
- [ ] User can remove selected images before submitting
- [ ] Max 5 images enforced
- [ ] File size limit (10MB) enforced
- [ ] Only image files accepted (no PDFs, videos, etc.)
- [ ] Images upload successfully when form submitted
- [ ] Images appear on detail page after creation
- [ ] If image upload fails, entity is still created (images optional)

**UX:**
- [ ] Loading indicator shown during upload
- [ ] Clear error messages for file size/type issues
- [ ] Image counter shows "X / 5 images selected"
- [ ] Drag-and-drop support (bonus)
- [ ] Dark mode support

**Technical:**
- [ ] Component is reusable across all 4 pages
- [ ] Existing image upload endpoint used
- [ ] No code duplication
- [ ] Unit tests pass
- [ ] E2E tests pass

---

## Estimated Time to Complete

- **Phase 1:** Create ImageUploadField component (2 hours)
- **Phase 2:** Update tour creation action (1 hour)
- **Phase 3:** Update tour creation UI (1 hour)
- **Phase 4:** Apply to boats, dive sites, products (2 hours)
- **Phase 5:** Unit tests (1 hour)
- **Phase 6:** E2E tests (1 hour)
- **Phase 7:** Manual QA testing (1 hour)

**Total:** ~9 hours

---

## Dependencies

- Existing `/tenant/images/upload` endpoint
- AWS S3 / Backblaze B2 storage configured (KAN-605 already fixed)
- Image table schema in database
- `getImageKey()` and `uploadToB2()` functions

---

## Future Enhancements

1. **Drag-and-drop support** - More intuitive than file picker
2. **Image reordering** - Let user set primary image
3. **Bulk upload** - Upload multiple files at once
4. **Image editing** - Crop, rotate, resize before upload
5. **AI caption generation** - Auto-generate alt text for accessibility

---

## Rollback Plan

If issues occur:
1. Revert ImageUploadField component
2. Remove image upload code from action handlers
3. Users fall back to existing workflow (create → edit → upload)

---

## Success Metrics

**Before:**
- Average steps to create item with images: 7
- User friction: High (must remember to go back and edit)
- Time to complete: ~2 minutes

**After:**
- Average steps to create item with images: 3
- User friction: Low (all in one flow)
- Time to complete: ~30 seconds

---

**Created:** February 2, 2026
**Status:** Ready for Implementation
**Priority:** High (affects 4 major features, UX improvement)
