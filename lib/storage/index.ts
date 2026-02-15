/**
 * Storage Module - AWS S3 ONLY
 *
 * ⚠️ WARNING: This project uses AWS S3 exclusively.
 * Do NOT configure Backblaze B2 or other S3-compatible providers.
 *
 * Configuration (.env):
 *   - B2_ENDPOINT: Leave blank for AWS S3 (or set to AWS endpoint)
 *   - B2_REGION: AWS region (e.g., us-east-1)
 *   - B2_BUCKET: S3 bucket name
 *   - B2_KEY_ID: AWS access key ID
 *   - B2_APP_KEY: AWS secret access key
 *
 * Note: Variable names use "B2" prefix for legacy reasons,
 * but they configure AWS S3 (not Backblaze).
 */
export * from "./b2";
export * from "./image-processor";
