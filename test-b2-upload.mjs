/**
 * Quick test script for B2 upload
 * Run with: node test-b2-upload.mjs
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// B2 configuration
const B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
const B2_REGION = "us-west-000";
const B2_BUCKET = "DiveStreamsStaging";
const B2_KEY_ID = "00002ba56d93c900000000007";
const B2_APP_KEY = "K0001urEkNGE/2mJCT38iP9lAhCDaYM";

// Create S3 client
const client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
  forcePathStyle: true, // Required for B2
});

async function testUpload() {
  try {
    // Create a small test buffer
    const testData = Buffer.from("Hello from B2 test upload! " + new Date().toISOString());
    const bodyArray = new Uint8Array(testData);

    const key = `test-uploads/test-${Date.now()}.txt`;

    console.log(`Testing B2 upload...`);
    console.log(`Bucket: ${B2_BUCKET}`);
    console.log(`Key: ${key}`);
    console.log(`Size: ${bodyArray.length} bytes`);
    console.log(`Type: ${bodyArray.constructor.name}`);
    console.log(`forcePathStyle: true`);
    console.log();

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: bodyArray,
      ContentType: "text/plain",
      ContentLength: bodyArray.length,
      CacheControl: "public, max-age=31536000",
    });

    console.log(`Sending PutObjectCommand...`);
    const response = await client.send(command);

    console.log(`✅ SUCCESS!`);
    console.log(`Response metadata:`, response.$metadata);
    console.log(`ETag:`, response.ETag);
    console.log();
    console.log(`File uploaded to: ${B2_ENDPOINT}/${B2_BUCKET}/${key}`);

  } catch (error) {
    console.error(`❌ FAILED:`);
    console.error(error);
    process.exit(1);
  }
}

testUpload();
