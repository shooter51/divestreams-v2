# ── AWS S3 + IAM ────────────────────────────────────────────────────────────
#
# These resources already exist in AWS and are managed outside Terraform.
# The IAM user (divestreams-app) has limited permissions (S3 only) and cannot
# import/manage its own IAM resources or perform bucket management operations.
#
# To bring these under Terraform management:
#   1. Use AWS SSO admin credentials (not the app IAM user)
#   2. Uncomment the import blocks and resource definitions below
#   3. Run: terraform import aws_s3_bucket.images divestreams-images
#
# For now, S3 credentials are passed directly to app containers via .env files.
# No Terraform management of AWS resources is needed for the rebuild.

# import {
#   to = aws_s3_bucket.images
#   id = "divestreams-images"
# }
#
# import {
#   to = aws_s3_bucket_public_access_block.images
#   id = "divestreams-images"
# }
#
# import {
#   to = aws_s3_bucket_policy.images_public_read
#   id = "divestreams-images"
# }
#
# import {
#   to = aws_s3_bucket_cors_configuration.images
#   id = "divestreams-images"
# }
#
# import {
#   to = aws_iam_user.app
#   id = "divestreams-app"
# }
#
# import {
#   to = aws_iam_policy.s3_access
#   id = "arn:aws:iam::546460569235:policy/divestreams-s3-access"
# }
#
# import {
#   to = aws_iam_user_policy_attachment.app
#   id = "divestreams-app/arn:aws:iam::546460569235:policy/divestreams-s3-access"
# }
#
# resource "aws_s3_bucket" "images" {
#   bucket = "divestreams-images"
# }
#
# resource "aws_s3_bucket_public_access_block" "images" {
#   bucket = aws_s3_bucket.images.id
#   block_public_acls       = false
#   block_public_policy     = false
#   ignore_public_acls      = false
#   restrict_public_buckets = false
# }
#
# resource "aws_s3_bucket_policy" "images_public_read" {
#   bucket     = aws_s3_bucket.images.id
#   depends_on = [aws_s3_bucket_public_access_block.images]
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Sid       = "PublicReadGetObject"
#       Effect    = "Allow"
#       Principal = "*"
#       Action    = "s3:GetObject"
#       Resource  = "${aws_s3_bucket.images.arn}/*"
#     }]
#   })
# }
#
# resource "aws_s3_bucket_cors_configuration" "images" {
#   bucket = aws_s3_bucket.images.id
#   cors_rule {
#     allowed_headers = ["*"]
#     allowed_methods = ["GET", "PUT", "POST", "DELETE"]
#     allowed_origins = ["https://*.${var.domain}", "https://*.test.${var.domain}"]
#     expose_headers  = ["ETag"]
#     max_age_seconds = 3000
#   }
# }
#
# resource "aws_iam_user" "app" {
#   name = "divestreams-app"
# }
#
# resource "aws_iam_policy" "s3_access" {
#   name = "divestreams-s3-access"
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect   = "Allow"
#       Action   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"]
#       Resource = "${aws_s3_bucket.images.arn}/*"
#     }]
#   })
# }
#
# resource "aws_iam_user_policy_attachment" "app" {
#   user       = aws_iam_user.app.name
#   policy_arn = aws_iam_policy.s3_access.arn
# }
