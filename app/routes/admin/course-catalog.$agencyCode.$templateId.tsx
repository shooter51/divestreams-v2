import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import {
  getTemplateById,
  updateTemplate,
  AGENCY_METADATA,
} from "../../../lib/db/training-templates.server";
import { uploadToS3, getImageKey, isStorageConfigured } from "../../../lib/storage/s3";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePlatformContext(request);

  const template = await getTemplateById(params.templateId!);
  if (!template) {
    throw new Response("Template not found", { status: 404 });
  }

  const agencyName = AGENCY_METADATA[params.agencyCode!]?.name || params.agencyCode!.toUpperCase();

  return { template, agencyCode: params.agencyCode!, agencyName, s3Configured: isStorageConfigured() };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requirePlatformContext(request);

  const templateId = params.templateId!;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-details") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const durationDays = parseInt(formData.get("durationDays") as string) || 1;
    const classroomHours = parseInt(formData.get("classroomHours") as string) || 0;
    const poolHours = parseInt(formData.get("poolHours") as string) || 0;
    const openWaterDives = parseInt(formData.get("openWaterDives") as string) || 0;
    const minAge = parseInt(formData.get("minAge") as string) || null;
    const prerequisites = (formData.get("prerequisites") as string) || null;
    const medicalRequirements = (formData.get("medicalRequirements") as string) || null;

    await updateTemplate(templateId, {
      name,
      description: description || null,
      durationDays,
      classroomHours,
      poolHours,
      openWaterDives,
      minAge,
      prerequisites,
      medicalRequirements,
    });

    return { success: true, message: "Template details updated" };
  }

  if (intent === "upload-image") {
    if (!isStorageConfigured()) {
      return { error: "S3 storage is not configured" };
    }

    const file = formData.get("imageFile") as File | null;
    if (!file || file.size === 0) {
      return { error: "No image file provided" };
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = getImageKey("global", "template", templateId, file.name);
      const result = await uploadToS3(key, buffer, file.type || "image/jpeg");
      const imageUrl = result?.cdnUrl || result?.url;

      if (!imageUrl) {
        return { error: "Upload failed - no URL returned" };
      }

      // Add to template's images array
      const template = await getTemplateById(templateId);
      const currentImages = template?.images || [];
      await updateTemplate(templateId, {
        images: [...currentImages, imageUrl],
      });

      return { success: true, message: "Image uploaded" };
    } catch (e) {
      return { error: `Upload failed: ${e instanceof Error ? e.message : "Unknown error"}` };
    }
  }

  if (intent === "reupload-image") {
    // Re-download an external URL and upload to S3
    const externalUrl = formData.get("externalUrl") as string;
    const imageIndex = parseInt(formData.get("imageIndex") as string);

    if (!externalUrl || !isStorageConfigured()) {
      return { error: "Missing URL or S3 not configured" };
    }

    try {
      const res = await fetch(externalUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = externalUrl.split("/").pop() || "image.jpg";
      const key = getImageKey("global", "template", templateId, filename);
      const result = await uploadToS3(key, buffer, contentType);
      const s3Url = result?.cdnUrl || result?.url;

      if (!s3Url) {
        return { error: "Re-upload failed" };
      }

      // Replace the external URL with S3 URL in the images array
      const template = await getTemplateById(templateId);
      const images = [...(template?.images || [])];
      if (imageIndex >= 0 && imageIndex < images.length) {
        images[imageIndex] = s3Url;
      } else {
        images.push(s3Url);
      }
      await updateTemplate(templateId, { images });

      return { success: true, message: "Image re-uploaded to S3" };
    } catch (e) {
      return { error: `Re-upload failed: ${e instanceof Error ? e.message : "Unknown error"}` };
    }
  }

  if (intent === "remove-image") {
    const imageIndex = parseInt(formData.get("imageIndex") as string);
    const template = await getTemplateById(templateId);
    const images = [...(template?.images || [])];
    if (imageIndex >= 0 && imageIndex < images.length) {
      images.splice(imageIndex, 1);
      await updateTemplate(templateId, { images });
      return { success: true, message: "Image removed" };
    }
    return { error: "Invalid image index" };
  }

  if (intent === "reupload-all") {
    // Re-upload all external URLs to S3
    if (!isStorageConfigured()) {
      return { error: "S3 not configured" };
    }

    const template = await getTemplateById(templateId);
    const images = template?.images || [];
    const newImages: string[] = [];
    let uploaded = 0;

    for (const url of images) {
      // Skip already-S3 URLs
      if (url.includes("s3.") || url.includes("amazonaws.com")) {
        newImages.push(url);
        continue;
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          newImages.push(url); // Keep original if fetch fails
          continue;
        }
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = url.split("/").pop() || "image.jpg";
        const key = getImageKey("global", "template", templateId, filename);
        const result = await uploadToS3(key, buffer, contentType);
        const s3Url = result?.cdnUrl || result?.url;
        newImages.push(s3Url || url);
        if (s3Url) uploaded++;
      } catch {
        newImages.push(url);
      }
    }

    await updateTemplate(templateId, { images: newImages });
    return { success: true, message: `Re-uploaded ${uploaded} image(s) to S3` };
  }

  return { error: "Unknown action" };
}

export default function TemplateDetail() {
  const { template, agencyCode, agencyName, s3Configured } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [activeTab, setActiveTab] = useState<"details" | "images">("details");

  const hasExternalImages = template.images?.some(
    (url: string) => !url.includes("s3.") && !url.includes("amazonaws.com")
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/course-catalog" className="text-brand hover:underline text-sm">
          All Agencies
        </Link>
        <span className="text-muted">/</span>
        <Link to={`/course-catalog/${agencyCode}`} className="text-brand hover:underline text-sm">
          {agencyName}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-heading mb-1">{template.name}</h1>
      <div className="flex gap-2 mb-6">
        <span className="text-xs bg-surface-inset px-2 py-0.5 rounded text-muted">{template.code}</span>
        {template.levelCode && (
          <span className="text-xs bg-blue-50 px-2 py-0.5 rounded text-blue-700">{template.levelCode}</span>
        )}
      </div>

      {/* Feedback messages */}
      {actionData && "success" in actionData && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          {actionData.message}
        </div>
      )}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {actionData.error}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 border-b border-default">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-heading"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("images")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "images"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-heading"
          }`}
        >
          Images ({template.images?.length ?? 0})
        </button>
      </div>

      {activeTab === "details" && (
        <Form method="post">
          <input type="hidden" name="intent" value="update-details" />
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-heading mb-1">Name</label>
              <input
                name="name"
                defaultValue={template.name}
                className="w-full border border-default rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-heading mb-1">Description</label>
              <textarea
                name="description"
                defaultValue={template.description ?? ""}
                rows={4}
                className="w-full border border-default rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">Duration (days)</label>
                <input
                  name="durationDays"
                  type="number"
                  defaultValue={template.durationDays}
                  min={1}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1">Classroom Hours</label>
                <input
                  name="classroomHours"
                  type="number"
                  defaultValue={template.classroomHours ?? 0}
                  min={0}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1">Pool Hours</label>
                <input
                  name="poolHours"
                  type="number"
                  defaultValue={template.poolHours ?? 0}
                  min={0}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1">OW Dives</label>
                <input
                  name="openWaterDives"
                  type="number"
                  defaultValue={template.openWaterDives ?? 0}
                  min={0}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">Min Age</label>
                <input
                  name="minAge"
                  type="number"
                  defaultValue={template.minAge ?? ""}
                  min={0}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1">Prerequisites</label>
                <input
                  name="prerequisites"
                  defaultValue={template.prerequisites ?? ""}
                  className="w-full border border-default rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-heading mb-1">Medical Requirements</label>
              <input
                name="medicalRequirements"
                defaultValue={template.medicalRequirements ?? ""}
                className="w-full border border-default rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand text-white rounded text-sm hover:bg-brand/90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Form>
      )}

      {activeTab === "images" && (
        <div className="space-y-6">
          {/* Bulk re-upload banner */}
          {hasExternalImages && s3Configured && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">
                Some images are still hosted externally. Re-upload them to S3 for reliable display.
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="reupload-all" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Re-uploading..." : "Re-upload All External Images to S3"}
                </button>
              </Form>
            </div>
          )}

          {/* Image gallery */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {template.images?.map((url: string, index: number) => {
              const isExternal = !url.includes("s3.") && !url.includes("amazonaws.com");
              return (
                <div key={index} className="relative group border border-default rounded-lg overflow-hidden">
                  <img
                    src={url}
                    alt={`${template.name} image ${index + 1}`}
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' fill='%23fee'%3E%3Crect width='200' height='160'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23c33' font-size='12'%3EBroken%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isExternal && s3Configured && (
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="reupload-image" />
                        <input type="hidden" name="externalUrl" value={url} />
                        <input type="hidden" name="imageIndex" value={String(index)} />
                        <button
                          type="submit"
                          className="p-1.5 bg-amber-500 text-white rounded text-xs"
                          title="Re-upload to S3"
                        >
                          S3
                        </button>
                      </Form>
                    )}
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="remove-image" />
                      <input type="hidden" name="imageIndex" value={String(index)} />
                      <button
                        type="submit"
                        className="p-1.5 bg-red-500 text-white rounded text-xs"
                        title="Remove image"
                      >
                        X
                      </button>
                    </Form>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                    {isExternal ? "External" : "S3"}: {url.split("/").pop()}
                  </div>
                </div>
              );
            })}
          </div>

          {(!template.images || template.images.length === 0) && (
            <div className="text-center py-8 text-muted border border-dashed border-default rounded-lg">
              No images. Upload one below.
            </div>
          )}

          {/* Upload new image */}
          {s3Configured && (
            <div className="border border-default rounded-lg p-4">
              <h3 className="text-sm font-medium text-heading mb-3">Upload New Image</h3>
              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="intent" value="upload-image" />
                <div className="flex gap-3 items-end">
                  <div className="flex-grow">
                    <input
                      type="file"
                      name="imageFile"
                      accept="image/*"
                      className="w-full text-sm border border-default rounded px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-brand text-white rounded text-sm hover:bg-brand/90 disabled:opacity-50"
                  >
                    {isSubmitting ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </Form>
            </div>
          )}

          {!s3Configured && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              S3 storage is not configured. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to enable image uploads.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
