import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, Link } from "react-router";
import { useCsrfFetcher } from "../../../hooks/use-csrf-fetcher";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import {
  getGalleryAlbum,
  updateGalleryAlbum,
  deleteGalleryAlbum,
  getAllGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
} from "../../../../lib/db/gallery.server";
import { uploadToS3, getWebPMimeType, processImage, isValidImageType, getS3Client } from "../../../../lib/storage";
import { storageLogger } from "../../../../lib/logger";
import { useNotification } from "../../../../lib/use-notification";
import { CsrfInput } from "../../../components/CsrfInput";
import { enqueueTranslation } from "../../../../lib/jobs/index";
import { SUPPORTED_LOCALES } from "../../../i18n/types";
import { resolveLocale } from "../../../i18n/resolve-locale";
import { getContentTranslations } from "../../../../lib/db/translations.server";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Album - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
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

  // Apply content translations for non-English locales
  const locale = resolveLocale(request);
  if (true) { // Apply translations for all locales (bidirectional)
    const tr = await getContentTranslations(organizationId, "gallery_album", albumId, locale);
    if (tr.name) album.name = tr.name;
    if (tr.description) album.description = tr.description;
  }

  return { album, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
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
    const removeCover = formData.get("removeCover") === "true";

    const updateData: Parameters<typeof updateGalleryAlbum>[2] = {
      name,
      description: description || null,
      sortOrder,
      isPublic,
    };

    // Handle cover image removal
    if (removeCover) {
      updateData.coverImageUrl = null;
    }

    // Handle cover image upload
    const coverFile = formData.get("coverImage") as File | null;
    if (coverFile && coverFile.size > 0) {
      if (!isValidImageType(coverFile.type)) {
        return { error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF" };
      }

      if (coverFile.size > 10 * 1024 * 1024) {
        return { error: "Cover image must be under 10MB" };
      }

      const s3Client = getS3Client();
      if (!s3Client) {
        return { error: "Image storage is not configured. Contact support." };
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
          updateData.coverImageUrl = uploadResult.cdnUrl;
        }
      } catch (error) {
        storageLogger.error({ err: error, filename: coverFile.name }, "Failed to upload album cover image");
        return { error: "Failed to upload cover image. Please try again." };
      }
    }

    await updateGalleryAlbum(organizationId, albumId, updateData);

    // Enqueue translation for name and description
    const fieldsToTranslate = [
      { field: "name", text: name },
      ...(description?.trim() ? [{ field: "description", text: description }] : []),
    ];
    const sourceLocale = resolveLocale(request);
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === sourceLocale) continue;
      await enqueueTranslation({
        orgId: organizationId,
        entityType: "gallery_album",
        entityId: albumId!,
        fields: fieldsToTranslate,
        sourceLocale,
        targetLocale: locale,
      });
    }

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
  const fetcher = useCsrfFetcher<{ error?: string; updated?: boolean; imageDeleted?: boolean; statusUpdated?: boolean; featuredUpdated?: boolean }>();
  const t = useT();

  // Show notifications from URL params
  useNotification();

  const handleDeleteAlbum = () => {
    if (
      confirm(
        t("tenant.gallery.confirmDeleteAlbum", { name: album.name, count: images.length })
      )
    ) {
      fetcher.submit({ intent: "delete-album" }, { method: "post" });
    }
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm(t("tenant.gallery.confirmDeleteImage"))) {
      fetcher.submit({ intent: "delete-image", imageId }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/gallery" className="text-brand hover:underline text-sm">
          {t("tenant.gallery.backToGallery")}
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
              {album.isPublic ? t("tenant.gallery.public") : t("tenant.gallery.private")}
            </span>
          </div>
        </div>

        {/* Edit Form */}
        <fetcher.Form method="post" encType="multipart/form-data" className="space-y-4">
          <CsrfInput />
          <input type="hidden" name="intent" value="update-album" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                {t("tenant.gallery.albumName")}
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
                {t("tenant.gallery.sortOrder")}
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
              {t("common.description")}
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={album.description || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium mb-2">{t("tenant.gallery.coverImage")}</label>
            {album.coverImageUrl && (
              <div className="mb-3">
                <div className="relative inline-block">
                  <img
                    src={album.coverImageUrl}
                    alt={`${album.name} cover`}
                    className="w-40 h-24 object-cover rounded-lg border"
                  />
                </div>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    name="removeCover"
                    value="true"
                    className="rounded"
                  />
                  <span className="text-sm text-foreground-muted">{t("tenant.gallery.removeCoverImage")}</span>
                </label>
              </div>
            )}
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
              {t("tenant.gallery.coverImageHint")}
            </p>
            {fetcher.data?.error && (
              <p className="text-danger text-sm mt-1">{fetcher.data.error}</p>
            )}
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
              <span className="text-sm font-medium">{t("tenant.gallery.showOnPublicWebsite")}</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
            >
              {t("common.saveChanges")}
            </button>
            <button
              type="button"
              onClick={handleDeleteAlbum}
              className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
            >
              {t("tenant.gallery.deleteAlbum")}
            </button>
          </div>
        </fetcher.Form>
      </div>

      {/* Images Section */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {t("tenant.gallery.imagesCount", { count: images.length })}
          </h2>
          <Link
            to={`/tenant/gallery/upload-images?albumId=${album.id}`}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            {t("tenant.gallery.uploadImages")}
          </Link>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-lg font-semibold mb-2">{t("tenant.gallery.noImagesYet")}</h3>
            <p className="text-foreground-muted mb-4">
              {t("tenant.gallery.noImagesDescription")}
            </p>
            <Link
              to={`/tenant/gallery/upload-images?albumId=${album.id}`}
              className="inline-block bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.gallery.uploadImages")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square bg-surface-inset rounded-lg overflow-hidden">
                  <img
                    src={image.thumbnailUrl || image.imageUrl}
                    alt={image.title || t("tenant.gallery.galleryImage")}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Image Actions Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <fetcher.Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="update-image-status" />
                    <input type="hidden" name="imageId" value={image.id} />
                    <select
                      name="status"
                      defaultValue={image.status}
                      onChange={(e) => {
                        const form = e.currentTarget.form;
                        if (form) fetcher.submit(form);
                      }}
                      className="px-2 py-1 text-xs rounded bg-surface-raised text-foreground border border-border-strong"
                    >
                      <option value="published">{t("tenant.gallery.statusPublished")}</option>
                      <option value="draft">{t("tenant.gallery.statusDraft")}</option>
                      <option value="archived">{t("tenant.gallery.statusArchived")}</option>
                    </select>
                  </fetcher.Form>

                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="px-2 py-1 text-xs bg-danger text-white rounded hover:bg-danger-hover"
                  >
                    {t("common.delete")}
                  </button>
                </div>

                {/* Featured Badge */}
                {image.isFeatured && (
                  <div className="absolute top-2 left-2">
                    <span className="text-xs px-2 py-1 bg-warning-muted text-warning rounded-full">
                      {t("tenant.gallery.featured")}
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
