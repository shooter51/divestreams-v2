import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { createGalleryAlbum } from "../../../../lib/db/gallery.server";
import { uploadToS3, getWebPMimeType, processImage, isValidImageType, getS3Client } from "../../../../lib/storage";
import { storageLogger } from "../../../../lib/logger";

export const meta: MetaFunction = () => [{ title: "New Album - DiveStreams" }];

const MAX_COVER_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOrgContext(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const slug = formData.get("slug") as string || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
  const isPublic = formData.get("isPublic") === "true";

  if (!name) {
    return { errors: { name: "Album name is required" } };
  }

  // Handle cover image upload
  let coverImageUrl: string | null = null;
  const coverFile = formData.get("coverImage") as File | null;

  if (coverFile && coverFile.size > 0) {
    if (!isValidImageType(coverFile.type)) {
      return { errors: { coverImage: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF" } };
    }

    if (coverFile.size > MAX_COVER_IMAGE_SIZE) {
      return { errors: { coverImage: "Cover image must be under 10MB" } };
    }

    const s3Client = getS3Client();
    if (!s3Client) {
      return { errors: { coverImage: "Image storage is not configured. Contact support." } };
    }

    try {
      const arrayBuffer = await coverFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const processed = await processImage(buffer);

      const timestamp = Date.now();
      const safeFilename = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const coverKey = `${ctx.org.slug}/gallery/covers/${timestamp}-${safeFilename}.webp`;

      const uploadResult = await uploadToS3(coverKey, processed.original, getWebPMimeType());
      if (uploadResult) {
        coverImageUrl = uploadResult.cdnUrl;
      }
    } catch (error) {
      storageLogger.error({ err: error, filename: coverFile.name }, "Failed to upload album cover image");
      return { errors: { coverImage: "Failed to upload cover image. Please try again." } };
    }
  }

  const album = await createGalleryAlbum(ctx.org.id, {
    name,
    description: description || null,
    slug,
    sortOrder,
    isPublic,
    coverImageUrl,
  });

  return redirect(`/tenant/gallery/${album.id}`);
}

export default function NewGalleryAlbumPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/gallery" className="text-brand hover:underline text-sm">
          ← Back to Gallery
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create New Album</h1>
      </div>

      <form method="post" encType="multipart/form-data" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Album Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Album Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="e.g., Summer 2024 Dives"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium mb-1">
                URL Slug
              </label>
              <input
                type="text"
                id="slug"
                name="slug"
                placeholder="auto-generated from name"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Leave blank to auto-generate from album name
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Brief description of this album..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="sortOrder" className="block text-sm font-medium mb-1">
                Sort Order
              </label>
              <input
                type="number"
                id="sortOrder"
                name="sortOrder"
                min="0"
                defaultValue="0"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Lower numbers appear first (0 = first, 10 = later)
              </p>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Cover Image</h2>
          <div>
            <label htmlFor="coverImage" className="block text-sm font-medium mb-2">
              Cover Image
            </label>
            <input
              type="file"
              id="coverImage"
              name="coverImage"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-foreground-muted
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-brand file:text-white
                hover:file:bg-brand-hover
                file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Optional. Upload a cover image for this album (JPEG, PNG, WebP, GIF). Max 10MB.
            </p>
            {actionData?.errors?.coverImage && (
              <p className="text-danger text-sm mt-1">{actionData.errors.coverImage}</p>
            )}
          </div>
        </div>

        {/* Visibility */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Visibility</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublic"
              value="true"
              defaultChecked={true}
              className="rounded"
            />
            <span className="text-sm font-medium">Show on public website</span>
          </label>
          <p className="text-xs text-foreground-muted mt-1">
            Make this album visible on your public gallery page
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Creating..." : "Create Album"}
          </button>
          <Link
            to="/tenant/gallery"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
