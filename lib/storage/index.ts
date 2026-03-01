/**
 * Storage Module - AWS S3 ONLY
 *
 * Configuration (.env):
 *   - S3_ENDPOINT: Leave blank for AWS S3 (or set to AWS endpoint)
 *   - S3_REGION: AWS region (e.g., us-east-1)
 *   - S3_BUCKET: S3 bucket name
 *   - S3_ACCESS_KEY_ID: AWS access key ID
 *   - S3_SECRET_ACCESS_KEY: AWS secret access key
 */
export * from "./s3";
export * from "./image-processor";
