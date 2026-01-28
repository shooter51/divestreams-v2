/**
 * Gallery Image Upload Page
 *
 * GET /tenant/gallery/upload-images
 * Form page for uploading images to albums
 */

import { useState, useRef } from "react";
import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams, Link } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getAllGalleryAlbums } from "../../../../lib/db/gallery.server";

export const meta: MetaFunction = () => [{ title: "Upload Gallery Images - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);

  // Get all albums for selection
  const albums = await getAllGalleryAlbums(organizationId);

  return { albums };
}

export default function GalleryUploadPage() {
  const { albums } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAlbumId = searchParams.get("albumId") || "";

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const files = fileInputRef.current?.files;

    if (!files || files.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadedCount(0);

    const albumId = formData.get("albumId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const location = formData.get("location") as string;
    const photographer = formData.get("photographer") as string;
    const tags = formData.get("tags") as string;

    try {
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        if (albumId) uploadFormData.append("albumId", albumId);
        uploadFormData.append("title", title || file.name);
        if (description) uploadFormData.append("description", description);
        if (category) uploadFormData.append("category", category);
        if (location) uploadFormData.append("location", location);
        if (photographer) uploadFormData.append("photographer", photographer);
        if (tags) uploadFormData.append("tags", tags);

        const response = await fetch("/tenant/gallery/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Failed to upload ${file.name}`);
        }

        setUploadedCount(i + 1);
      }

      // Success - navigate back
      if (albumId) {
        navigate(`/tenant/gallery/${albumId}`);
      } else {
        navigate("/tenant/gallery");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to={preselectedAlbumId ? `/tenant/gallery/${preselectedAlbumId}` : "/tenant/gallery"}
          className="text-brand hover:underline text-sm"
        >
          ← Back to Gallery
        </Link>
      </div>

      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Upload Gallery Images</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Album Selection */}
          <div>
            <label htmlFor="albumId" className="block text-sm font-medium mb-2">
              Album (Optional)
            </label>
            <select
              id="albumId"
              name="albumId"
              defaultValue={preselectedAlbumId}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">No Album (Uncategorized)</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground-muted mt-1">
              Choose an album to organize your images
            </p>
          </div>

          {/* File Input */}
          <div>
            <label htmlFor="file" className="block text-sm font-medium mb-2">
              Images *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Select one or more images (JPEG, PNG, WebP, GIF). Max 10MB per file.
            </p>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              placeholder="Image title (uses filename if empty)"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional description..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">None</option>
              <option value="coral-reefs">Coral Reefs</option>
              <option value="marine-life">Marine Life</option>
              <option value="wrecks">Wrecks</option>
              <option value="underwater">Underwater</option>
              <option value="team">Team</option>
              <option value="customers">Customers</option>
              <option value="equipment">Equipment</option>
              <option value="events">Events</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-2">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              placeholder="e.g., Great Barrier Reef"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Photographer */}
          <div>
            <label htmlFor="photographer" className="block text-sm font-medium mb-2">
              Photographer
            </label>
            <input
              type="text"
              id="photographer"
              name="photographer"
              placeholder="Photographer name"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium mb-2">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              placeholder="scuba, diving, reef (comma-separated)"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-danger-muted text-danger px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && uploadedCount > 0 && (
            <div className="bg-success-muted text-success px-4 py-3 rounded-lg">
              Uploaded {uploadedCount} image{uploadedCount !== 1 ? "s" : ""}...
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload Images"}
            </button>
            <Link
              to={preselectedAlbumId ? `/tenant/gallery/${preselectedAlbumId}` : "/tenant/gallery"}
              className="px-6 py-2 border border-border-strong rounded-lg hover:bg-surface-inset"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
