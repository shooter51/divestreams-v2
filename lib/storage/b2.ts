/**
 * AWS S3 / B2 Storage Service
 *
 * S3-compatible API for image uploads with Cloudflare CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { storageLogger } from "../logger";

// B2 configuration from environment
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_REGION = process.env.B2_REGION || "us-west-004";
const B2_BUCKET = process.env.B2_BUCKET || "divestreams-images";
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const CDN_URL = process.env.CDN_URL;

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  // Validate storage is configured with AWS S3 credentials
  if (!B2_KEY_ID || !B2_APP_KEY) {
    storageLogger.error({
      hasEndpoint: !!B2_ENDPOINT,
      hasKeyId: !!B2_KEY_ID,
      hasAppKey: !!B2_APP_KEY,
      hasCdnUrl: !!CDN_URL,
    }, "S3 storage not configured - image uploads disabled");
    return null;
  }

  // SECURITY: Prevent accidental switch to Backblaze B2
  // This project uses AWS S3 only. Backblaze is not supported.
  if (B2_ENDPOINT && B2_ENDPOINT.includes('backblazeb2.com')) {
    storageLogger.error({ endpoint: B2_ENDPOINT }, "Backblaze B2 detected in B2_ENDPOINT. This project uses AWS S3 only. Please remove B2_ENDPOINT or set it to AWS S3 endpoint.");
    throw new Error('Backblaze B2 is not supported. Use AWS S3 only.');
  }

  // CRITICAL: Detect CDN_URL mismatch with storage backend
  // If using AWS S3, CDN_URL must not point to Backblaze
  const isAwsS3 = !B2_ENDPOINT || B2_ENDPOINT.includes('amazonaws.com');
  if (isAwsS3 && CDN_URL && CDN_URL.includes('backblazeb2.com')) {
    storageLogger.error({
      endpoint: B2_ENDPOINT || '(default AWS)',
      cdnUrl: CDN_URL,
    }, "CDN_URL mismatch: Storage is configured for AWS S3, but CDN_URL points to Backblaze B2. Fix: Set CDN_URL to a CloudFront distribution or direct S3 URL");
    throw new Error('CDN_URL mismatch: Using AWS S3 but CDN points to Backblaze B2. Update CDN_URL.');
  }

  if (!s3Client) {
    // For AWS S3, don't set endpoint - SDK uses default AWS endpoints
    // For B2/R2, set endpoint to their S3-compatible API
    const clientConfig: Record<string, unknown> = {
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY,
      },
    };

    // Only set endpoint for non-AWS S3 services (B2, R2, etc)
    if (B2_ENDPOINT && !B2_ENDPOINT.includes('amazonaws.com')) {
      clientConfig.endpoint = B2_ENDPOINT;
      clientConfig.forcePathStyle = true; // Required for B2/R2
    }

    s3Client = new S3Client(clientConfig);
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

  storageLogger.info({ key, size: body.length }, "Uploading to S3");

  try {
    // Use Buffer directly (tested and confirmed working with AWS S3)
    const command = new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    });

    await client.send(command);

    // Construct S3 URL
    const url = `https://${B2_BUCKET}.s3.${B2_REGION}.amazonaws.com/${key}`;
    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

    storageLogger.info({ key, cdnUrl }, "S3 upload successful");

    return { key, url, cdnUrl };
  } catch (error) {
    storageLogger.error({ err: error, key }, "S3 upload failed");
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
  return `${tenantId}/${entityType}/${entityId}/${timestamp}-${sanitized}`;
}
