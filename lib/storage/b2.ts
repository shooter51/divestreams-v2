/**
 * AWS S3 / B2 Storage Service
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
  // Validate storage is configured with AWS S3 credentials
  if (!B2_KEY_ID || !B2_APP_KEY) {
    console.error("S3 storage not configured - image uploads disabled. Missing:", {
      B2_ENDPOINT: !!B2_ENDPOINT,
      B2_KEY_ID: !!B2_KEY_ID,
      B2_APP_KEY: !!B2_APP_KEY,
      CDN_URL: !!CDN_URL
    });
    return null;
  }

  // SECURITY: Prevent accidental switch to Backblaze B2
  // This project uses AWS S3 only. Backblaze is not supported.
  if (B2_ENDPOINT && B2_ENDPOINT.includes('backblazeb2.com')) {
    console.error('❌ ERROR: Backblaze B2 detected in B2_ENDPOINT');
    console.error('❌ This project uses AWS S3 only.');
    console.error('❌ Please remove B2_ENDPOINT or set it to AWS S3 endpoint.');
    console.error('❌ Current value:', B2_ENDPOINT);
    throw new Error('Backblaze B2 is not supported. Use AWS S3 only.');
  }

  if (!s3Client) {
    // For AWS S3, don't set endpoint - SDK uses default AWS endpoints
    // For B2/R2, set endpoint to their S3-compatible API
    const clientConfig: any = {
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

  console.log(`Uploading to S3: key=${key}, size=${body.length} bytes`);

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

    console.log(`✅ S3 upload SUCCESS!`);

    // Construct S3 URL
    const url = `https://${B2_BUCKET}.s3.${B2_REGION}.amazonaws.com/${key}`;
    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : url;

    console.log(`S3 upload successful: ${cdnUrl}`);

    return { key, url, cdnUrl };
  } catch (error) {
    console.error(`❌ S3 upload failed:`, error);
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
