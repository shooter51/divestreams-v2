#!/usr/bin/env node
/**
 * Test S3 upload with different approaches
 * Simulates the real application flow: file → Sharp → Buffer → upload
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { readFileSync } from "fs";
import { Readable } from "stream";

// Test configuration
const config = {
  endpoint: process.env.B2_ENDPOINT?.includes('amazonaws.com') ? undefined : process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || "us-east-2",
  bucket: process.env.B2_BUCKET || "divestreams-staging",
  keyId: process.env.B2_KEY_ID,
  appKey: process.env.B2_APP_KEY,
};

console.log("Test Configuration:");
console.log("- Endpoint:", config.endpoint || "default AWS S3");
console.log("- Region:", config.region);
console.log("- Bucket:", config.bucket);
console.log("- Key ID:", config.keyId?.substring(0, 8) + "...");
console.log();

if (!config.keyId || !config.appKey) {
  console.error("❌ Missing credentials in .env");
  process.exit(1);
}

// Create S3 client
const clientConfig = {
  region: config.region,
  credentials: {
    accessKeyId: config.keyId,
    secretAccessKey: config.appKey,
  },
};

if (config.endpoint) {
  clientConfig.endpoint = config.endpoint;
  clientConfig.forcePathStyle = true;
}

const client = new S3Client(clientConfig);

// Test approaches
const approaches = [
  {
    name: "Buffer as-is",
    prepare: (buffer) => ({ Body: buffer }),
  },
  {
    name: "Uint8Array",
    prepare: (buffer) => ({ Body: new Uint8Array(buffer) }),
  },
  {
    name: "Readable stream",
    prepare: (buffer) => ({ Body: Readable.from(buffer), ContentLength: buffer.length }),
  },
  {
    name: "Readable stream with explicit size",
    prepare: (buffer) => {
      const stream = Readable.from(buffer);
      return { Body: stream, ContentLength: buffer.length };
    },
  },
  {
    name: "Raw buffer data",
    prepare: (buffer) => ({ Body: Buffer.from(buffer) }),
  },
];

async function testUpload(approach, buffer) {
  const key = `test-uploads/test-${approach.name.replace(/\s+/g, "-")}-${Date.now()}.webp`;

  console.log(`\n🧪 Testing: ${approach.name}`);
  console.log(`   Buffer size: ${buffer.length} bytes`);

  try {
    const params = approach.prepare(buffer);
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000",
      ...params,
    });

    const start = Date.now();
    const response = await client.send(command);
    const duration = Date.now() - start;

    console.log(`   ✅ SUCCESS! (${duration}ms)`);
    console.log(`   ETag: ${response.ETag}`);
    console.log(`   URL: https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`);

    return true;
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.Code || error.name}`);
    console.log(`   Message: ${error.message}`);
    if (error.$metadata) {
      console.log(`   HTTP Status: ${error.$metadata.httpStatusCode}`);
    }
    return false;
  }
}

async function main() {
  console.log("📸 Creating test image with Sharp (simulating real app flow)...\n");

  // Create a simple test image with Sharp (like the app does)
  const testBuffer = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  })
  .webp({ quality: 80 })
  .toBuffer();

  console.log(`Generated WebP image: ${testBuffer.length} bytes\n`);
  console.log("=" .repeat(60));

  // Test each approach
  for (const approach of approaches) {
    const success = await testUpload(approach, testBuffer);
    if (success) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🎉 WINNER: "${approach.name}" works!`);
      console.log(`${"=".repeat(60)}\n`);

      console.log("Update lib/storage/b2.ts to use this approach:");
      console.log(JSON.stringify(approach, null, 2));
      process.exit(0);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("❌ All approaches failed. This indicates a deeper issue:");
  console.log("   1. Bucket permissions/CORS");
  console.log("   2. Invalid credentials");
  console.log("   3. AWS SDK v3 + Buffer incompatibility");
  console.log(`${"=".repeat(60)}`);
  process.exit(1);
}

main().catch(console.error);
