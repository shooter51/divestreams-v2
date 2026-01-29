/**
 * Backblaze B2 Storage Service
 *
 * S3-compatible API for image uploads with Cloudflare CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// B2 configuration from environment
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_REGION = process.env.B2_REGION || "us-west-004";
const B2_BUCKET = process.env.B2_BUCKET || "divestreams-images";
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const CDN_URL = process.env.CDN_URL;

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY) {
    console.error("B2 storage not configured - image uploads disabled. Missing:", {
      B2_ENDPOINT: !!B2_ENDPOINT,
      B2_KEY_ID: !!B2_KEY_ID,
      B2_APP_KEY: !!B2_APP_KEY,
      CDN_URL: !!CDN_URL
    });
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: B2_ENDPOINT,
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY,
      },
      forcePathStyle: true, // Required for B2 (uses path-style URLs)
      requestChecksumCalculation: "WHEN_REQUIRED", // Disable automatic checksums
      responseChecksumValidation: "WHEN_REQUIRED", // Disable checksum validation
    });
  }

  return s3Client;
}

export function isStorageConfigured(): boolean {
  return Boolean(B2_ENDPOINT && B2_KEY_ID && B2_APP_KEY);
}

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl: string;
}

export async function uploadToB2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<UploadResult | null> {
  const client = getS3Client();
  if (!client) return null;

  if (!body || body.length === 0) {
    throw new Error("Empty buffer provided for upload");
  }

  console.log(`Uploading to B2 via multipart: key=${key}, size=${body.length} bytes`);

  try {
    // Use Upload class which handles multipart uploads and works better with B2
    const upload = new Upload({
      client,
      params: {
        Bucket: B2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      },
      // Force single part upload for small files to avoid multipart overhead
      queueSize: 1,
      partSize: 1024 * 1024 * 5, // 5MB parts
    });

    await upload.done();

    console.log(`✅ B2 upload SUCCESS via multipart!`);

    // Construct correct URL (endpoint is already full URL, don't append to it)
    const url = `${B2_ENDPOINT.replace(/\/$/, '')}/${B2_BUCKET}/${key}`;
    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

    console.log(`B2 upload successful: ${cdnUrl}`);

    return { key, url, cdnUrl };
  } catch (error) {
    console.error(`❌ B2 multipart upload failed:`, error);
    throw error;
  }
}

export async function deleteFromB2(key: string): Promise<boolean> {
  const client = getS3Client();
  if (!client) return false;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error) {
    console.error("Failed to delete from B2:", error);
    return false;
  }
}

export function getImageKey(
  tenantId: string,
  entityType: string,
  entityId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${tenantId}/${entityType}/${entityId}/${timestamp}-${sanitized}`;
}
