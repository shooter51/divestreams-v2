/**
 * S3-Native SDK Storage Service (Legacy)
 *
 * Uses native SDK instead of AWS SDK v3.
 * Retained for backward compatibility reference.
 */

// @ts-expect-error -- backblaze-b2 doesn't have type definitions
import B2 from 'backblaze-b2';

// S3 configuration from environment
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET || "divestreams-images";
const CDN_URL = process.env.CDN_URL;

let b2Client: B2 | null = null;
let authorizedBucketId: string | null = null;
let authorizationToken: string | null = null;
let uploadUrl: string | null = null;
let uploadAuthToken: string | null = null;

async function getS3NativeClient(): Promise<{ client: B2; bucketId: string } | null> {
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    console.error("S3 storage not configured - image uploads disabled. Missing:", {
      S3_ACCESS_KEY_ID: !!S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: !!S3_SECRET_ACCESS_KEY,
      CDN_URL: !!CDN_URL
    });
    return null;
  }

  // Create client if not exists
  if (!b2Client) {
    b2Client = new B2({
      applicationKeyId: S3_ACCESS_KEY_ID,
      applicationKey: S3_SECRET_ACCESS_KEY,
    });
  }

  // Authorize if not authorized yet
  if (!authorizationToken || !authorizedBucketId) {
    try {
      console.log('Authorizing S3 native client...');
      const authResponse = await b2Client.authorize();
      authorizationToken = authResponse.data.authorizationToken;

      // Get bucket ID from bucket name
      const bucketsResponse = await b2Client.listBuckets({
        bucketName: S3_BUCKET_NAME,
      });

      if (!bucketsResponse.data.buckets || bucketsResponse.data.buckets.length === 0) {
        console.error(`S3 bucket "${S3_BUCKET_NAME}" not found`);
        return null;
      }

      authorizedBucketId = bucketsResponse.data.buckets[0].bucketId;
      console.log(`S3 native client authorized. Bucket ID: ${authorizedBucketId}`);
    } catch (error) {
      console.error('Failed to authorize S3 native client:', error);
      return null;
    }
  }

  return {
    client: b2Client,
    bucketId: authorizedBucketId as string,
  };
}

async function getUploadUrl(): Promise<{ url: string; authToken: string } | null> {
  const s3Data = await getS3NativeClient();
  if (!s3Data) return null;

  // Get fresh upload URL if needed
  if (!uploadUrl || !uploadAuthToken) {
    try {
      const response = await s3Data.client.getUploadUrl({
        bucketId: s3Data.bucketId,
      });

      uploadUrl = response.data.uploadUrl as string;
      uploadAuthToken = response.data.authorizationToken as string;
    } catch (error) {
      console.error('Failed to get upload URL:', error);
      return null;
    }
  }

  return {
    url: uploadUrl,
    authToken: uploadAuthToken,
  };
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
  if (!body || body.length === 0) {
    throw new Error("Empty buffer provided for upload");
  }

  console.log(`Uploading to S3: key=${key}, size=${body.length} bytes`);

  const uploadData = await getUploadUrl();
  if (!uploadData) {
    throw new Error('Failed to get S3 upload URL');
  }

  const s3Data = await getS3NativeClient();
  if (!s3Data) {
    throw new Error('S3 client not configured');
  }

  try {
    const response = await s3Data.client.uploadFile({
      uploadUrl: uploadData.url,
      uploadAuthToken: uploadData.authToken,
      fileName: key,
      data: body,
      contentType,
      onUploadProgress: null,
    });

    console.log(`S3 upload SUCCESS!`);

    // Construct download URL
    const downloadUrl = response.data.downloadUrl ||
      `https://f000.backblazeb2.com/file/${S3_BUCKET_NAME}/${key}`;

    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : downloadUrl;

    console.log(`S3 upload successful: ${cdnUrl}`);

    // Reset upload URL to get a fresh one for next upload
    uploadUrl = null;
    uploadAuthToken = null;

    return {
      key,
      url: downloadUrl,
      cdnUrl
    };
  } catch (error: unknown) {
    console.error(`S3 upload failed:`, error);

    // Reset upload credentials on error (may be expired)
    uploadUrl = null;
    uploadAuthToken = null;

    throw error;
  }
}

export async function deleteFromS3(key: string): Promise<boolean> {
  const s3Data = await getS3NativeClient();
  if (!s3Data) return false;

  try {
    // First, find the file by name to get its fileId
    const listResponse = await s3Data.client.listFileNames({
      bucketId: s3Data.bucketId,
      startFileName: key,
      maxFileCount: 1,
    });

    if (!listResponse.data.files || listResponse.data.files.length === 0) {
      console.error(`File not found in S3: ${key}`);
      return false;
    }

    const file = listResponse.data.files.find((f: { fileName: string }) => f.fileName === key);
    if (!file) {
      console.error(`File not found in S3: ${key}`);
      return false;
    }

    // Delete the file using its fileId
    await s3Data.client.deleteFileVersion({
      fileId: file.fileId,
      fileName: file.fileName,
    });

    console.log(`Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error("Failed to delete from S3:", error);
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
