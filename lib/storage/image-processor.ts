/**
 * Image Processing Service
 *
 * Generates thumbnails and optimizes images for web.
 */

import sharp from "sharp";

export interface ProcessedImage {
  original: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export async function processImage(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    thumbnailSize?: number;
    quality?: number;
  } = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    thumbnailSize = 200,
    quality = 80,
  } = options;

  // Resize original if too large, convert to WebP
  const originalImage = sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality });

  const originalBuffer = await originalImage.toBuffer();
  const originalMeta = await sharp(originalBuffer).metadata();

  // Generate thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .resize(thumbnailSize, thumbnailSize, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 70 })
    .toBuffer();

  return {
    original: originalBuffer,
    thumbnail: thumbnailBuffer,
    width: originalMeta.width || 0,
    height: originalMeta.height || 0,
    thumbnailWidth: thumbnailSize,
    thumbnailHeight: thumbnailSize,
  };
}

export function isValidImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
}

export function getWebPMimeType(): string {
  return "image/webp";
}
