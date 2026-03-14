# ── Cloudflare ────────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for divestreams.com"
  type        = string
  default     = "912605970a7d6bf122bf6b7430b2d2ea"
}

# ── AWS ───────────────────────────────────────────────────────────────────────

variable "aws_access_key_id" {
  description = "AWS access key ID for Terraform state and S3 management"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key for Terraform state and S3 management"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# ── GitHub ────────────────────────────────────────────────────────────────────

variable "github_token" {
  description = "GitHub personal access token for managing repo secrets and environments"
  type        = string
  sensitive   = true
}

# ── VPS IPs ───────────────────────────────────────────────────────────────────

variable "prod_vps_ip" {
  description = "IP address of the production app VPS"
  type        = string
}

variable "test_vps_ip" {
  description = "IP address of the test app VPS"
  type        = string
}

variable "db_vps_ip" {
  description = "IP address of the dedicated database VPS"
  type        = string
}

# ── VPS IDs (Hostinger) ───────────────────────────────────────────────────────

variable "prod_vps_id" {
  description = "Hostinger VPS ID for production app server"
  type        = string
}

variable "test_vps_id" {
  description = "Hostinger VPS ID for test app server"
  type        = string
}

variable "db_vps_id" {
  description = "Hostinger VPS ID for dedicated database server"
  type        = string
}

variable "hostinger_api_token" {
  description = "Hostinger API token (used for reference/manual operations, not a TF provider)"
  type        = string
  sensitive   = true
}

# ── Domain ────────────────────────────────────────────────────────────────────

variable "domain" {
  description = "Primary domain name"
  type        = string
  default     = "divestreams.com"
}

# ── Production Secrets ────────────────────────────────────────────────────────

variable "db_password_prod" {
  description = "PostgreSQL password for production"
  type        = string
  sensitive   = true
}

variable "redis_password_prod" {
  description = "Redis password for production"
  type        = string
  sensitive   = true
}

variable "auth_secret_prod" {
  description = "Session signing secret for production"
  type        = string
  sensitive   = true
}

variable "better_auth_secret_prod" {
  description = "Better Auth secret for production"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key_prod" {
  description = "Stripe secret key for production (live)"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key_prod" {
  description = "Stripe publishable key for production (live)"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret_prod" {
  description = "Stripe webhook signing secret for production"
  type        = string
  sensitive   = true
}

variable "smtp_host_prod" {
  description = "SMTP host for production"
  type        = string
}

variable "smtp_port_prod" {
  description = "SMTP port for production"
  type        = string
}

variable "smtp_user_prod" {
  description = "SMTP username for production"
  type        = string
  sensitive   = true
}

variable "smtp_pass_prod" {
  description = "SMTP password for production"
  type        = string
  sensitive   = true
}

variable "smtp_from_prod" {
  description = "SMTP from address for production"
  type        = string
}

variable "s3_access_key_id_prod" {
  description = "S3 access key ID for production app"
  type        = string
  sensitive   = true
}

variable "s3_secret_access_key_prod" {
  description = "S3 secret access key for production app"
  type        = string
  sensitive   = true
}

variable "s3_bucket_prod" {
  description = "S3 bucket name for production"
  type        = string
  default     = "divestreams-images"
}

variable "s3_region_prod" {
  description = "S3 region for production"
  type        = string
  default     = "us-east-1"
}

variable "s3_endpoint_prod" {
  description = "S3 endpoint URL for production"
  type        = string
  default     = "https://s3.amazonaws.com"
}

variable "cdn_url_prod" {
  description = "CDN URL for production image serving"
  type        = string
}

variable "admin_password_prod" {
  description = "Admin panel password for production"
  type        = string
  sensitive   = true
}

variable "platform_admin_email_prod" {
  description = "Platform admin email for production"
  type        = string
}

variable "platform_admin_password_prod" {
  description = "Platform admin password for production"
  type        = string
  sensitive   = true
}

# ── Test Secrets ──────────────────────────────────────────────────────────────

variable "db_password_test" {
  description = "PostgreSQL password for test environment"
  type        = string
  sensitive   = true
}

variable "redis_password_test" {
  description = "Redis password for test environment"
  type        = string
  sensitive   = true
}

variable "auth_secret_test" {
  description = "Session signing secret for test environment"
  type        = string
  sensitive   = true
}

variable "better_auth_secret_test" {
  description = "Better Auth secret for test environment"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key_test" {
  description = "Stripe secret key for test environment (test keys)"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key_test" {
  description = "Stripe publishable key for test environment (test keys)"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret_test" {
  description = "Stripe webhook signing secret for test environment"
  type        = string
  sensitive   = true
}

variable "smtp_host_test" {
  description = "SMTP host for test environment"
  type        = string
}

variable "smtp_port_test" {
  description = "SMTP port for test environment"
  type        = string
}

variable "smtp_user_test" {
  description = "SMTP username for test environment"
  type        = string
  sensitive   = true
}

variable "smtp_pass_test" {
  description = "SMTP password for test environment"
  type        = string
  sensitive   = true
}

variable "smtp_from_test" {
  description = "SMTP from address for test environment"
  type        = string
}

variable "s3_access_key_id_test" {
  description = "S3 access key ID for test app"
  type        = string
  sensitive   = true
}

variable "s3_secret_access_key_test" {
  description = "S3 secret access key for test app"
  type        = string
  sensitive   = true
}

variable "s3_bucket_test" {
  description = "S3 bucket name for test environment"
  type        = string
  default     = "divestreams-images"
}

variable "s3_region_test" {
  description = "S3 region for test environment"
  type        = string
  default     = "us-east-1"
}

variable "s3_endpoint_test" {
  description = "S3 endpoint URL for test environment"
  type        = string
  default     = "https://s3.amazonaws.com"
}

variable "cdn_url_test" {
  description = "CDN URL for test image serving"
  type        = string
}

variable "admin_password_test" {
  description = "Admin panel password for test environment"
  type        = string
  sensitive   = true
}

variable "platform_admin_email_test" {
  description = "Platform admin email for test environment"
  type        = string
}

variable "platform_admin_password_test" {
  description = "Platform admin password for test environment"
  type        = string
  sensitive   = true
}

# ── Grafana Cloud ─────────────────────────────────────────────────────────────

variable "grafana_mimir_url" {
  description = "Grafana Cloud Mimir push endpoint URL"
  type        = string
}

variable "grafana_mimir_username" {
  description = "Grafana Cloud Mimir instance ID"
  type        = string
}

variable "grafana_mimir_api_key" {
  description = "Grafana Cloud API key for Mimir push"
  type        = string
  sensitive   = true
}

variable "grafana_tempo_url" {
  description = "Grafana Cloud Tempo endpoint"
  type        = string
}

variable "grafana_tempo_username" {
  description = "Grafana Cloud Tempo instance ID"
  type        = string
}

variable "grafana_tempo_api_key" {
  description = "Grafana Cloud API key for Tempo push"
  type        = string
  sensitive   = true
}

# ── Shared Secrets ────────────────────────────────────────────────────────────

variable "vps_ssh_key" {
  description = "SSH private key for VPS access (same key used for all VPSs)"
  type        = string
  sensitive   = true
}

variable "promotion_pat" {
  description = "GitHub fine-grained PAT for auto-promotion pipeline (Contents + Pull Requests read/write)"
  type        = string
  sensitive   = true
}
