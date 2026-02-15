import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getAllGalleryAlbums } from "../../../../lib/db/gallery.server";
import { useNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Gallery - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const albums = await getAllGalleryAlbums(ctx.org.id);
  return { albums };
}

export default function GalleryIndexPage() {
  const { albums } = useLoaderData<typeof loader>();

  // Show notifications from URL params
  useNotification();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="text-foreground-muted">Manage your photo albums and images</p>
        </div>
        <Link
          to="/tenant/gallery/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          + New Album
        </Link>
      </div>

      {albums.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 text-center shadow-sm">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-xl font-semibold mb-2">No albums yet</h2>
          <p className="text-foreground-muted mb-6">
            Create your first photo album to showcase your dive trips and underwater photography
          </p>
          <Link
            to="/tenant/gallery/new"
            className="inline-block bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
          >
            Create Album
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/tenant/gallery/${album.id}`}
              className="bg-surface-raised rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Cover Image */}
              <div className="aspect-video bg-surface-inset relative">
                {album.coverImageUrl ? (
                  <img
                    src={album.coverImageUrl}
                    alt={album.name}
                    className="w-full h-full object-cover"
                  />
                ) : album.images.length > 0 ? (
                  <img
                    src={album.images[0].thumbnailUrl || album.images[0].imageUrl}
                    alt={album.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground-subtle">
                    <span className="text-4xl">📷</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      album.isPublic
                        ? "bg-success-muted text-success"
                        : "bg-surface-inset text-foreground-muted"
                    }`}
                  >
                    {album.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              </div>

              {/* Album Info */}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{album.name}</h3>
                {album.description && (
                  <p className="text-sm text-foreground-muted mb-2 line-clamp-2">
                    {album.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-foreground-muted">
                  <span>📷 {album.imageCount} photos</span>
                  <span>#{album.sortOrder}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
