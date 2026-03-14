/**
 * AWS S3 Storage Service
 *
 * S3-compatible API for image uploads with Cloudflare CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { storageLogger } from "../logger";

// S3 configuration from environment
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_BUCKET = process.env.S3_BUCKET || "divestreams-images";
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const CDN_URL = process.env.CDN_URL;

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  // Validate storage is configured with AWS S3 credentials
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    storageLogger.error({
      hasEndpoint: !!S3_ENDPOINT,
      hasKeyId: !!S3_ACCESS_KEY_ID,
      hasSecretKey: !!S3_SECRET_ACCESS_KEY,
      hasCdnUrl: !!CDN_URL,
    }, "S3 storage not configured - image uploads disabled");
    return null;
  }

  if (!s3Client) {
    // For AWS S3, don't set endpoint - SDK uses default AWS endpoints
    // For other S3-compatible services, set endpoint to their S3-compatible API
    const clientConfig: Record<string, unknown> = {
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    };

    // Only set endpoint for non-AWS S3 services (R2, etc)
    if (S3_ENDPOINT && !S3_ENDPOINT.includes('amazonaws.com')) {
      clientConfig.endpoint = S3_ENDPOINT;
      clientConfig.forcePathStyle = true; // Required for S3-compatible services
    }

    s3Client = new S3Client(clientConfig);
  }

  return s3Client;
}

export function isStorageConfigured(): boolean {
  return Boolean(S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl: string;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<UploadResult | null> {
  const client = getS3Client();
  if (!client) return null;

  if (!body || body.length === 0) {
    throw new Error("Empty buffer provided for upload");
  }

  storageLogger.info({ key, size: body.length }, "Uploading to S3");

  try {
    // Use Buffer directly (tested and confirmed working with AWS S3)
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    });

    await client.send(command);

    // Construct S3 URL
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

    storageLogger.info({ key, cdnUrl }, "S3 upload successful");

    return { key, url, cdnUrl };
  } catch (error) {
    storageLogger.error({ err: error, key }, "S3 upload failed");
    throw error;
  }
}

export async function deleteFromS3(key: string): Promise<boolean> {
  const client = getS3Client();
  if (!client) return false;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error) {
    storageLogger.error({ err: error, key }, "Failed to delete from S3");
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
  // Sanitize path components to prevent path traversal
  const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeEntityType = entityType.replace(/[^a-zA-Z0-9-]/g, "");
  const safeEntityId = entityId.replace(/[^a-zA-Z0-9-]/g, "");
  return `${safeTenantId}/${safeEntityType}/${safeEntityId}/${timestamp}-${sanitized}`;
}
