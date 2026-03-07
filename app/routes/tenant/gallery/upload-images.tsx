/**
 * Gallery Image Upload Page
 *
 * GET /tenant/gallery/upload-images
 * Form page for uploading images to albums
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, useSearchParams, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getAllGalleryAlbums } from "../../../../lib/db/gallery.server";
import { useNotification } from "../../../../lib/use-notification";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Upload Gallery Images - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get all albums for selection
  const albums = await getAllGalleryAlbums(ctx.org.id);

  return { albums };
}

export default function GalleryUploadPage() {
  const { albums } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const preselectedAlbumId = searchParams.get("albumId") || "";
  const t = useT();

  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to={preselectedAlbumId ? `/tenant/gallery/${preselectedAlbumId}` : "/tenant/gallery"}
          className="text-brand hover:underline text-sm"
        >
          {t("tenant.gallery.backToGallery")}
        </Link>
      </div>

      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6">{t("tenant.gallery.uploadGalleryImages")}</h1>

        <form method="post" action="/tenant/gallery/upload" encType="multipart/form-data" className="space-y-6">
          <CsrfInput />
          {/* Album Selection */}
          <div>
            <label htmlFor="albumId" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.albumOptional")}
            </label>
            <select
              id="albumId"
              name="albumId"
              defaultValue={preselectedAlbumId}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">{t("tenant.gallery.noAlbumUncategorized")}</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.gallery.albumSelectionHint")}
            </p>
          </div>

          {/* File Input */}
          <div>
            <label htmlFor="file" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.imagesRequired")}
            </label>
            <input
              type="file"
              id="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              required
              className="block w-full text-sm text-foreground-muted
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-brand file:text-white
                hover:file:bg-brand-hover
                file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.gallery.imageFileHint")}
            </p>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.imageTitle")}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              placeholder={t("tenant.gallery.imageTitlePlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              {t("common.description")}
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder={t("tenant.gallery.optionalDescription")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.category")}
            </label>
            <select
              id="category"
              name="category"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">{t("tenant.gallery.categoryNone")}</option>
              <option value="coral-reefs">{t("tenant.gallery.categoryCoralReefs")}</option>
              <option value="marine-life">{t("tenant.gallery.categoryMarineLife")}</option>
              <option value="wrecks">{t("tenant.gallery.categoryWrecks")}</option>
              <option value="underwater">{t("tenant.gallery.categoryUnderwater")}</option>
              <option value="team">{t("tenant.gallery.categoryTeam")}</option>
              <option value="customers">{t("tenant.gallery.categoryCustomers")}</option>
              <option value="equipment">{t("tenant.gallery.categoryEquipment")}</option>
              <option value="events">{t("tenant.gallery.categoryEvents")}</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.location")}
            </label>
            <input
              type="text"
              id="location"
              name="location"
              placeholder={t("tenant.gallery.locationPlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Photographer */}
          <div>
            <label htmlFor="photographer" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.photographer")}
            </label>
            <input
              type="text"
              id="photographer"
              name="photographer"
              placeholder={t("tenant.gallery.photographerPlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium mb-2">
              {t("tenant.gallery.tags")}
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              placeholder={t("tenant.gallery.tagsPlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.gallery.tagsHint")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
            >
              {isSubmitting ? t("tenant.gallery.uploading") : t("tenant.gallery.uploadImages")}
            </button>
            <Link
              to={preselectedAlbumId ? `/tenant/gallery/${preselectedAlbumId}` : "/tenant/gallery"}
              className="px-6 py-2 border border-border-strong rounded-lg hover:bg-surface-inset"
            >
              {t("common.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
