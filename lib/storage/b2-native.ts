/**
 * Backblaze B2 Native SDK Storage Service
 *
 * Uses B2's native SDK instead of AWS SDK v3 to avoid IncompleteBody errors.
 * AWS SDK v3 has known incompatibilities with B2's S3-compatible API.
 */

// @ts-ignore - backblaze-b2 doesn't have type definitions
import B2 from 'backblaze-b2';

// B2 configuration from environment
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET || "divestreams-images";
const CDN_URL = process.env.CDN_URL;

let b2Client: B2 | null = null;
let authorizedBucketId: string | null = null;
let authorizationToken: string | null = null;
let uploadUrl: string | null = null;
let uploadAuthToken: string | null = null;

async function getB2Client(): Promise<{ client: B2; bucketId: string } | null> {
  if (!B2_KEY_ID || !B2_APP_KEY) {
    console.error("B2 storage not configured - image uploads disabled. Missing:", {
      B2_KEY_ID: !!B2_KEY_ID,
      B2_APP_KEY: !!B2_APP_KEY,
      CDN_URL: !!CDN_URL
    });
    return null;
  }

  // Create client if not exists
  if (!b2Client) {
    b2Client = new B2({
      applicationKeyId: B2_KEY_ID,
      applicationKey: B2_APP_KEY,
    });
  }

  // Authorize if not authorized yet
  if (!authorizationToken || !authorizedBucketId) {
    try {
      console.log('Authorizing B2 client...');
      const authResponse = await b2Client.authorize();
      authorizationToken = authResponse.data.authorizationToken;

      // Get bucket ID from bucket name
      const bucketsResponse = await b2Client.listBuckets({
        bucketName: B2_BUCKET_NAME,
      });

      if (!bucketsResponse.data.buckets || bucketsResponse.data.buckets.length === 0) {
        console.error(`B2 bucket "${B2_BUCKET_NAME}" not found`);
        return null;
      }

      authorizedBucketId = bucketsResponse.data.buckets[0].bucketId;
      console.log(`✅ B2 authorized. Bucket ID: ${authorizedBucketId}`);
    } catch (error) {
      console.error('Failed to authorize B2:', error);
      return null;
    }
  }

  return {
    client: b2Client,
    bucketId: authorizedBucketId as string,
  };
}

async function getUploadUrl(): Promise<{ url: string; authToken: string } | null> {
  const b2Data = await getB2Client();
  if (!b2Data) return null;

  // Get fresh upload URL if needed
  if (!uploadUrl || !uploadAuthToken) {
    try {
      const response = await b2Data.client.getUploadUrl({
        bucketId: b2Data.bucketId,
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
  return Boolean(B2_KEY_ID && B2_APP_KEY);
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
  if (!body || body.length === 0) {
    throw new Error("Empty buffer provided for upload");
  }

  console.log(`Uploading to B2: key=${key}, size=${body.length} bytes`);

  const uploadData = await getUploadUrl();
  if (!uploadData) {
    throw new Error('Failed to get B2 upload URL');
  }

  const b2Data = await getB2Client();
  if (!b2Data) {
    throw new Error('B2 client not configured');
  }

  try {
    const response = await b2Data.client.uploadFile({
      uploadUrl: uploadData.url,
      uploadAuthToken: uploadData.authToken,
      fileName: key,
      data: body,
      contentType,
      onUploadProgress: null,
    });

    console.log(`✅ B2 upload SUCCESS!`);

    // Construct B2 download URL
    const downloadUrl = response.data.downloadUrl ||
      `https://f000.backblazeb2.com/file/${B2_BUCKET_NAME}/${key}`;

    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : downloadUrl;

    console.log(`B2 upload successful: ${cdnUrl}`);

    // Reset upload URL to get a fresh one for next upload
    uploadUrl = null;
    uploadAuthToken = null;

    return {
      key,
      url: downloadUrl,
      cdnUrl
    };
  } catch (error: any) {
    console.error(`❌ B2 upload failed:`, error);

    // Reset upload credentials on error (may be expired)
    uploadUrl = null;
    uploadAuthToken = null;

    throw error;
  }
}

export async function deleteFromB2(key: string): Promise<boolean> {
  const b2Data = await getB2Client();
  if (!b2Data) return false;

  try {
    // First, find the file by name to get its fileId
    const listResponse = await b2Data.client.listFileNames({
      bucketId: b2Data.bucketId,
      startFileName: key,
      maxFileCount: 1,
    });

    if (!listResponse.data.files || listResponse.data.files.length === 0) {
      console.error(`File not found in B2: ${key}`);
      return false;
    }

    const file = listResponse.data.files.find((f: any) => f.fileName === key);
    if (!file) {
      console.error(`File not found in B2: ${key}`);
      return false;
    }

    // Delete the file using its fileId
    await b2Data.client.deleteFileVersion({
      fileId: file.fileId,
      fileName: file.fileName,
    });

    console.log(`✅ Deleted from B2: ${key}`);
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
