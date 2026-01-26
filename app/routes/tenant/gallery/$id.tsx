import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import {
  getGalleryAlbum,
  updateGalleryAlbum,
  deleteGalleryAlbum,
  getAllGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
} from "../../../../lib/db/gallery.server";

export const meta: MetaFunction = () => [{ title: "Album - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const albumId = params.id;

  if (!albumId) {
    throw new Response("Album ID required", { status: 400 });
  }

  // Get album details
  const album = await getGalleryAlbum(organizationId, albumId);

  if (!album) {
    throw new Response("Album not found", { status: 404 });
  }

  // Get images in this album
  const images = await getAllGalleryImages(organizationId, { albumId });

  return { album, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const albumId = params.id;

  if (!albumId) {
    return { error: "Album ID required" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-album") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
    const isPublic = formData.get("isPublic") === "true";

    await updateGalleryAlbum(organizationId, albumId, {
      name,
      description: description || null,
      sortOrder,
      isPublic,
    });

    return { updated: true };
  }

  if (intent === "delete-album") {
    await deleteGalleryAlbum(organizationId, albumId);
    return redirect("/tenant/gallery");
  }

  if (intent === "delete-image") {
    const imageId = formData.get("imageId") as string;
    if (imageId) {
      await deleteGalleryImage(organizationId, imageId);
    }
    return { imageDeleted: true };
  }

  if (intent === "update-image-status") {
    const imageId = formData.get("imageId") as string;
    const status = formData.get("status") as string;
    if (imageId && status) {
      await updateGalleryImage(organizationId, imageId, { status });
    }
    return { statusUpdated: true };
  }

  if (intent === "set-featured") {
    const imageId = formData.get("imageId") as string;
    const isFeatured = formData.get("isFeatured") === "true";
    if (imageId) {
      await updateGalleryImage(organizationId, imageId, { isFeatured });
    }
    return { featuredUpdated: true };
  }

  return null;
}

export default function AlbumDetailPage() {
  const { album, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDeleteAlbum = () => {
    if (
      confirm(
        `Are you sure you want to delete "${album.name}"? This will also delete all ${images.length} images in this album.`
      )
    ) {
      fetcher.submit({ intent: "delete-album" }, { method: "post" });
    }
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm("Delete this image?")) {
      fetcher.submit({ intent: "delete-image", imageId }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/gallery" className="text-brand hover:underline text-sm">
          ← Back to Gallery
        </Link>
      </div>

      {/* Album Header */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{album.name}</h1>
            {album.description && (
              <p className="text-foreground-muted mt-1">{album.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                album.isPublic
                  ? "bg-success-muted text-success"
                  : "bg-surface-inset text-foreground-muted"
              }`}
            >
              {album.isPublic ? "Public" : "Private"}
            </span>
          </div>
        </div>

        {/* Edit Form */}
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-album" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Album Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={album.name}
                required
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
                defaultValue={album.sortOrder}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={album.description || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={album.isPublic}
                className="rounded"
              />
              <span className="text-sm font-medium">Show on public website</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleDeleteAlbum}
              className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
            >
              Delete Album
            </button>
          </div>
        </fetcher.Form>
      </div>

      {/* Images Section */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Images ({images.length})
          </h2>
          <Link
            to="/tenant/images/upload"
            state={{ albumId: album.id }}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            + Upload Images
          </Link>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-lg font-semibold mb-2">No images yet</h3>
            <p className="text-foreground-muted mb-4">
              Upload your first images to this album
            </p>
            <Link
              to="/tenant/images/upload"
              state={{ albumId: album.id }}
              className="inline-block bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
            >
              Upload Images
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square bg-surface-inset rounded-lg overflow-hidden">
                  <img
                    src={image.thumbnailUrl || image.imageUrl}
                    alt={image.title || "Gallery image"}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Image Actions Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="update-image-status" />
                    <input type="hidden" name="imageId" value={image.id} />
                    <select
                      name="status"
                      defaultValue={image.status}
                      onChange={(e) => {
                        const form = e.currentTarget.form;
                        if (form) fetcher.submit(form);
                      }}
                      className="px-2 py-1 text-xs rounded bg-surface-raised"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </fetcher.Form>

                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="px-2 py-1 text-xs bg-danger text-white rounded hover:bg-danger-hover"
                  >
                    Delete
                  </button>
                </div>

                {/* Featured Badge */}
                {image.isFeatured && (
                  <div className="absolute top-2 left-2">
                    <span className="text-xs px-2 py-1 bg-warning-muted text-warning rounded-full">
                      ⭐ Featured
                    </span>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      image.status === "published"
                        ? "bg-success-muted text-success"
                        : image.status === "draft"
                        ? "bg-surface-inset text-foreground-muted"
                        : "bg-danger-muted text-danger"
                    }`}
                  >
                    {image.status}
                  </span>
                </div>

                {/* Image Title */}
                {image.title && (
                  <p className="text-sm mt-2 text-foreground truncate">{image.title}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
