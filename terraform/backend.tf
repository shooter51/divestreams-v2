# Using local backend until S3 bucket is created with proper IAM permissions.
# To migrate to S3 later:
#   1. Create bucket: aws s3 mb s3://divestreams-terraform-state --region us-east-1
#   2. Uncomment the S3 backend block below
#   3. Run: terraform init -migrate-state

# terraform {
#   backend "s3" {
#     bucket  = "divestreams-terraform-state"
#     key     = "infra/terraform.tfstate"
#     region  = "us-east-1"
#     encrypt = true
#   }
# }
