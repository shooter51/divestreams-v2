import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getAllGalleryAlbums } from "../../../../lib/db/gallery.server";

export const meta: MetaFunction = () => [{ title: "Gallery - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const albums = await getAllGalleryAlbums(organizationId);
  return { albums };
}

export default function GalleryIndexPage() {
  const { albums } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="text-gray-500">Manage your photo albums and images</p>
        </div>
        <Link
          to="/tenant/gallery/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Album
        </Link>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-xl font-semibold mb-2">No albums yet</h2>
          <p className="text-gray-500 mb-6">
            Create your first photo album to showcase your dive trips and underwater photography
          </p>
          <Link
            to="/tenant/gallery/new"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
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
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Cover Image */}
              <div className="aspect-video bg-gray-100 relative">
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
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-4xl">📷</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      album.isPublic
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
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
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                    {album.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
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
