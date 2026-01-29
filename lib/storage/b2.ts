/**
 * Backblaze B2 Storage Service
 *
 * S3-compatible API for image uploads with Cloudflare CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

  // Ensure buffer is valid
  if (!body || body.length === 0) {
    throw new Error("Empty buffer provided for upload");
  }

  console.log(`Uploading to B2: key=${key}, size=${body.length} bytes, contentType=${contentType}`);
  console.log(`B2 Config: bucket=${B2_BUCKET}, endpoint=${B2_ENDPOINT}, region=${B2_REGION}`);
  console.log(`Buffer type: ${body.constructor.name}, isBuffer: ${Buffer.isBuffer(body)}`);

  // Convert Buffer to Uint8Array for better compatibility with AWS SDK v3
  const bodyArray = new Uint8Array(body);

  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: bodyArray,
    ContentType: contentType,
    ContentLength: bodyArray.length,
    CacheControl: "public, max-age=31536000",
    ChecksumAlgorithm: undefined, // Disable checksums for B2 compatibility
  });

  console.log(`Sending PutObjectCommand...`);

  try {
    const response = await client.send(command);
    console.log(`B2 upload response:`, response.$metadata);
  } catch (error) {
    console.error(`B2 upload failed:`, error);
    throw error;
  }

  // Construct correct URL (endpoint is already full URL, don't append to it)
  const url = `${B2_ENDPOINT.replace(/\/$/, '')}/${B2_BUCKET}/${key}`;
  const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

  console.log(`B2 upload successful: ${cdnUrl}`);

  return { key, url, cdnUrl };
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
