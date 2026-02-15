import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { createGalleryAlbum } from "../../../../lib/db/gallery.server";

export const meta: MetaFunction = () => [{ title: "New Album - DiveStreams" }];

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

  const album = await createGalleryAlbum(ctx.org.id, {
    name,
    description: description || null,
    slug,
    sortOrder,
    isPublic,
    coverImageUrl: null,
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

      <form method="post" className="space-y-6">
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
