import type { SeedClient } from "./client";

// Curated Unsplash photo IDs (no API key needed)
// Fetched via https://images.unsplash.com/photo-{ID}?w=1200&q=80
// All IDs verified working as of 2026-02-23
const DIVING_PHOTOS = {
  reef: [
    "1544551763-46a013bb70d5",
    "1559825481-12a05cc00344",
    "1583212292454-1fe6229603b7",
    "1560275619-4662e36fa65c",
    "1682687220742-aba13b6e50ba",
  ],
  wreck: [
    "1571752726703-5e7d1f6a986d",
    "1544551763-77ef2d0cfc6c",
    "1582967788606-a171c1080cb0",
    "1560275619-4662e36fa65c",
    "1544551763-46a013bb70d5",
  ],
  turtle: [
    "1544551763-46a013bb70d5",
    "1516690561799-46d8f74f9abf",
    "1547592180-85f173990554",
    "1583212292454-1fe6229603b7",
    "1682687220742-aba13b6e50ba",
  ],
  "wide-angle": [
    "1544551763-46a013bb70d5",
    "1560275619-4662e36fa65c",
    "1582967788606-a171c1080cb0",
    "1559825481-12a05cc00344",
    "1571752726703-5e7d1f6a986d",
  ],
  equipment: [
    "1571752726703-5e7d1f6a986d",
    "1559825481-12a05cc00344",
    "1583212292454-1fe6229603b7",
    "1544551763-46a013bb70d5",
    "1560275619-4662e36fa65c",
  ],
  night: [
    "1560275619-4662e36fa65c",
    "1582967788606-a171c1080cb0",
    "1571752726703-5e7d1f6a986d",
    "1544551763-46a013bb70d5",
    "1544551763-77ef2d0cfc6c",
  ],
  macro: [
    "1547592180-85f173990554",
    "1516690561799-46d8f74f9abf",
    "1583212292454-1fe6229603b7",
    "1544551763-46a013bb70d5",
    "1560275619-4662e36fa65c",
  ],
} as const;

export type PhotoCategory = keyof typeof DIVING_PHOTOS;

export async function getImageBytes(photoId: string): Promise<Buffer> {
  const url = `https://images.unsplash.com/photo-${photoId}?w=1200&q=80`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Unsplash photo ${photoId}: HTTP ${response.status}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadImage(
  client: SeedClient,
  entityType: string,
  entityId: string,
  photoId: string,
  alt: string
): Promise<{ url: string } | null> {
  try {
    const bytes = await getImageBytes(photoId);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("file", blob, `${photoId}.jpg`);
    formData.set("entityType", entityType);
    formData.set("entityId", entityId);
    formData.set("alt", alt);
    formData.set("_csrf", csrf);

    const result = await client.post("/tenant/images/upload", formData);
    if (!result.ok) {
      console.warn(
        `⚠️  Image upload failed for ${entityType}/${entityId}: HTTP ${result.status}`
      );
      return null;
    }

    let body: { success?: boolean; image?: { url: string } };
    try {
      body = JSON.parse(result.html);
    } catch {
      console.warn(`⚠️  Image upload returned non-JSON for ${entityType}/${entityId}`);
      return null;
    }

    if (!body.success || !body.image?.url) {
      console.warn(`⚠️  Image upload unsuccessful for ${entityType}/${entityId}`);
      return null;
    }

    return { url: body.image.url };
  } catch (err) {
    console.warn(
      `⚠️  Image upload error for ${entityType}/${entityId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export function randomPhoto(category: PhotoCategory): string {
  const photos = DIVING_PHOTOS[category];
  return photos[Math.floor(Math.random() * photos.length)];
}
