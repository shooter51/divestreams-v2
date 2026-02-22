terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# ── S3 Bucket ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "images" {
  bucket = "divestreams-images"
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "images_public_read" {
  bucket     = aws_s3_bucket.images.id
  depends_on = [aws_s3_bucket_public_access_block.images]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.images.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*.divestreams.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ── IAM User (permanent app credentials) ─────────────────────────────────────

resource "aws_iam_user" "app" {
  name = "divestreams-app"
}

resource "aws_iam_policy" "s3_access" {
  name = "divestreams-s3-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject",
        ]
        Resource = "${aws_s3_bucket.images.arn}/*"
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "app" {
  user       = aws_iam_user.app.name
  policy_arn = aws_iam_policy.s3_access.arn
}

resource "aws_iam_access_key" "app" {
  user = aws_iam_user.app.name
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "bucket_name" {
  value = aws_s3_bucket.images.bucket
}

output "bucket_region" {
  value = "us-east-1"
}

output "access_key_id" {
  value = aws_iam_access_key.app.id
}

output "secret_access_key" {
  value     = aws_iam_access_key.app.secret
  sensitive = true
}
