/**
 * ImageManager Component
 *
 * A reusable component for managing entity images with upload, reorder, and delete.
 */

import { useState, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "./Button";

export interface Image {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  width?: number;
  height?: number;
  alt?: string;
  sortOrder: number;
  isPrimary: boolean;
}

interface ImageManagerProps {
  entityType: "tour" | "diveSite" | "boat" | "equipment" | "staff" | "course" | "product";
  entityId: string;
  images: Image[];
  maxImages?: number;
  onImagesChange?: (images: Image[]) => void;
}

export function ImageManager({
  entityType,
  entityId,
  images: initialImages,
  maxImages = 5,
  onImagesChange,
}: ImageManagerProps) {
  const [images, setImages] = useState<Image[]>(initialImages);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const reorderFetcher = useFetcher();

  const handleUpload = useCallback(async (file: File) => {
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);

    try {
      const response = await fetch("/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Upload failed");
        return;
      }

      console.log("Upload response:", result);

      if (!result.image) {
        console.error("No image in response:", result);
        setError("Invalid response from server");
        return;
      }

      const newImages = [...images, result.image];
      setImages(newImages);
      onImagesChange?.(newImages);
    } catch (error) {
      console.error("Upload error:", error);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [images, maxImages, entityType, entityId, onImagesChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [handleUpload]);

  const handleDelete = useCallback(async (imageId: string) => {
    const formData = new FormData();
    formData.append("imageId", imageId);

    try {
      const response = await fetch("/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Delete failed");
        return;
      }

      const newImages = images.filter((img) => img.id !== imageId);
      // Update primary if needed
      if (newImages.length > 0 && !newImages.some((img) => img.isPrimary)) {
        newImages[0].isPrimary = true;
      }
      setImages(newImages);
      onImagesChange?.(newImages);
    } catch {
      setError("Delete failed. Please try again.");
    }
  }, [images, onImagesChange]);

  const handleSetPrimary = useCallback(async (imageId: string) => {
    const newImages = images.map((img) => ({
      ...img,
      isPrimary: img.id === imageId,
    }));

    setImages(newImages);
    onImagesChange?.(newImages);

    // Save to server
    try {
      await fetch("/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          images: newImages.map((img) => ({
            id: img.id,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        }),
      });
    } catch {
      setError("Failed to update primary image");
    }
  }, [images, entityType, entityId, onImagesChange]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    // Update sort orders
    newImages.forEach((img, i) => {
      img.sortOrder = i;
    });

    setImages(newImages);
    setDraggedIndex(index);
  }, [draggedIndex, images]);

  const handleDragEnd = useCallback(async () => {
    if (draggedIndex === null) return;

    setDraggedIndex(null);
    onImagesChange?.(images);

    // Save new order to server
    try {
      await fetch("/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          images: images.map((img) => ({
            id: img.id,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        }),
      });
    } catch {
      setError("Failed to save image order");
    }
  }, [draggedIndex, images, entityType, entityId, onImagesChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Images ({images.length}/{maxImages})
        </label>
        {images.length < maxImages && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            Add Image
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="text-sm text-danger bg-danger-muted px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className="border-2 border-dashed border-border-strong rounded-lg p-8 text-center">
          <div className="text-foreground-subtle text-4xl mb-2">📷</div>
          <p className="text-foreground-muted text-sm">No images yet</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            Upload your first image
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-move rounded-lg overflow-hidden border-2 ${
                image.isPrimary
                  ? "border-brand"
                  : "border-border hover:border-border-strong"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <img
                src={image.thumbnailUrl || image.url}
                alt={image.alt || image.filename}
                className="w-full aspect-square object-cover"
              />

              {/* Primary badge */}
              {image.isPrimary && (
                <div className="absolute top-1 left-1 bg-brand text-white text-xs px-1.5 py-0.5 rounded">
                  Primary
                </div>
              )}

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!image.isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(image.id)}
                    className="p-1.5 bg-white rounded-full text-brand hover:bg-brand-muted"
                    title="Set as primary"
                  >
                    ⭐
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  className="p-1.5 bg-white rounded-full text-danger hover:bg-danger-muted"
                  title="Delete image"
                >
                  🗑️
                </button>
              </div>

              {/* Drag handle indicator */}
              <div className="absolute bottom-1 right-1 text-foreground-subtle text-xs opacity-0 group-hover:opacity-100">
                ⋮⋮
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-foreground-muted">
        Drag images to reorder. The primary image will be shown first in listings.
        Supported formats: JPEG, PNG, WebP, GIF. Max 10MB per image.
      </p>
    </div>
  );
}
