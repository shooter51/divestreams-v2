# ── GitHub Actions Environments ───────────────────────────────────────────────

resource "github_repository_environment" "test" {
  repository  = "divestreams-v2"
  environment = "test"
}

resource "github_repository_environment" "production" {
  repository  = "divestreams-v2"
  environment = "production"
}

# ── Environment Variables — Test ──────────────────────────────────────────────

resource "github_actions_environment_variable" "test_vps_ip" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "TEST_VPS_IP"
  value         = var.test_vps_ip
}

resource "github_actions_environment_variable" "test_vps_id" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "TEST_VPS_ID"
  value         = var.test_vps_id
}

resource "github_actions_environment_variable" "db_vps_ip_test" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "DB_VPS_IP"
  value         = var.db_vps_ip
}

resource "github_actions_environment_variable" "test_vps_tailscale_ip" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "TEST_VPS_TAILSCALE_IP"
  value         = var.test_vps_tailscale_ip
}

resource "github_actions_environment_variable" "db_vps_tailscale_ip_test" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "DB_VPS_TAILSCALE_IP"
  value         = var.db_vps_tailscale_ip
}

# ── Environment Variables — Production ───────────────────────────────────────

resource "github_actions_environment_variable" "prod_vps_ip" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "PROD_VPS_IP"
  value         = var.prod_vps_ip
}

resource "github_actions_environment_variable" "prod_vps_id" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "PROD_VPS_ID"
  value         = var.prod_vps_id
}

resource "github_actions_environment_variable" "db_vps_ip_prod" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "DB_VPS_IP"
  value         = var.db_vps_ip
}

resource "github_actions_environment_variable" "prod_vps_tailscale_ip" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "PROD_VPS_TAILSCALE_IP"
  value         = var.prod_vps_tailscale_ip
}

resource "github_actions_environment_variable" "db_vps_tailscale_ip_prod" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "DB_VPS_TAILSCALE_IP"
  value         = var.db_vps_tailscale_ip
}

# ── Environment Secrets — Test ────────────────────────────────────────────────

resource "github_actions_environment_secret" "hostinger_api_token_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "HOSTINGER_API_TOKEN"
  plaintext_value = var.hostinger_api_token
}

resource "github_actions_environment_secret" "vps_ssh_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "VPS_SSH_KEY"
  plaintext_value = var.vps_ssh_key
}

resource "github_actions_environment_secret" "db_password_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "DB_PASSWORD"
  plaintext_value = var.db_password_test
}

resource "github_actions_environment_secret" "redis_password_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "REDIS_PASSWORD"
  plaintext_value = var.redis_password_test
}

resource "github_actions_environment_secret" "auth_secret_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "AUTH_SECRET"
  plaintext_value = var.auth_secret_test
}

resource "github_actions_environment_secret" "better_auth_secret_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "BETTER_AUTH_SECRET"
  plaintext_value = var.better_auth_secret_test
}

resource "github_actions_environment_secret" "stripe_secret_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "STRIPE_SECRET_KEY"
  plaintext_value = var.stripe_secret_key_test
}

resource "github_actions_environment_secret" "stripe_publishable_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "STRIPE_PUBLISHABLE_KEY"
  plaintext_value = var.stripe_publishable_key_test
}

resource "github_actions_environment_secret" "stripe_webhook_secret_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "STRIPE_WEBHOOK_SECRET"
  plaintext_value = var.stripe_webhook_secret_test
}

resource "github_actions_environment_secret" "smtp_host_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "SMTP_HOST"
  plaintext_value = var.smtp_host_test
}

resource "github_actions_environment_secret" "smtp_port_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "SMTP_PORT"
  plaintext_value = var.smtp_port_test
}

resource "github_actions_environment_secret" "smtp_user_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "SMTP_USER"
  plaintext_value = var.smtp_user_test
}

resource "github_actions_environment_secret" "smtp_pass_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "SMTP_PASS"
  plaintext_value = var.smtp_pass_test
}

resource "github_actions_environment_secret" "smtp_from_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "SMTP_FROM"
  plaintext_value = var.smtp_from_test
}

resource "github_actions_environment_secret" "s3_access_key_id_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "S3_ACCESS_KEY_ID"
  plaintext_value = var.s3_access_key_id_test
}

resource "github_actions_environment_secret" "s3_secret_access_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "S3_SECRET_ACCESS_KEY"
  plaintext_value = var.s3_secret_access_key_test
}

resource "github_actions_environment_secret" "s3_bucket_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "S3_BUCKET"
  plaintext_value = var.s3_bucket_test
}

resource "github_actions_environment_secret" "s3_region_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "S3_REGION"
  plaintext_value = var.s3_region_test
}

resource "github_actions_environment_secret" "s3_endpoint_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "S3_ENDPOINT"
  plaintext_value = var.s3_endpoint_test
}

resource "github_actions_environment_secret" "cdn_url_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "CDN_URL"
  plaintext_value = var.cdn_url_test
}

resource "github_actions_environment_secret" "admin_password_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "ADMIN_PASSWORD"
  plaintext_value = var.admin_password_test
}

resource "github_actions_environment_secret" "platform_admin_email_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "PLATFORM_ADMIN_EMAIL"
  plaintext_value = var.platform_admin_email_test
}

resource "github_actions_environment_secret" "platform_admin_password_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "PLATFORM_ADMIN_PASSWORD"
  plaintext_value = var.platform_admin_password_test
}

resource "github_actions_environment_variable" "platform_admin_name_test" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.test.environment
  variable_name = "PLATFORM_ADMIN_NAME"
  value         = "Platform Admin"
}

resource "github_actions_environment_secret" "grafana_mimir_url_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_MIMIR_URL"
  plaintext_value = var.grafana_mimir_url
}

resource "github_actions_environment_secret" "grafana_mimir_username_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_MIMIR_USERNAME"
  plaintext_value = var.grafana_mimir_username
}

resource "github_actions_environment_secret" "grafana_mimir_api_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_MIMIR_API_KEY"
  plaintext_value = var.grafana_mimir_api_key
}

resource "github_actions_environment_secret" "grafana_tempo_url_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_TEMPO_URL"
  plaintext_value = var.grafana_tempo_url
}

resource "github_actions_environment_secret" "grafana_tempo_username_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_TEMPO_USERNAME"
  plaintext_value = var.grafana_tempo_username
}

resource "github_actions_environment_secret" "grafana_tempo_api_key_test" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.test.environment
  secret_name     = "GRAFANA_TEMPO_API_KEY"
  plaintext_value = var.grafana_tempo_api_key
}
# ── Environment Secrets — Production ─────────────────────────────────────────

resource "github_actions_environment_secret" "hostinger_api_token_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "HOSTINGER_API_TOKEN"
  plaintext_value = var.hostinger_api_token
}

resource "github_actions_environment_secret" "vps_ssh_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "VPS_SSH_KEY"
  plaintext_value = var.vps_ssh_key
}

resource "github_actions_environment_secret" "db_password_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "DB_PASSWORD"
  plaintext_value = var.db_password_prod
}

resource "github_actions_environment_secret" "redis_password_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "REDIS_PASSWORD"
  plaintext_value = var.redis_password_prod
}

resource "github_actions_environment_secret" "auth_secret_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "AUTH_SECRET"
  plaintext_value = var.auth_secret_prod
}

resource "github_actions_environment_secret" "better_auth_secret_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "BETTER_AUTH_SECRET"
  plaintext_value = var.better_auth_secret_prod
}

resource "github_actions_environment_secret" "stripe_secret_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "STRIPE_SECRET_KEY"
  plaintext_value = var.stripe_secret_key_prod
}

resource "github_actions_environment_secret" "stripe_publishable_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "STRIPE_PUBLISHABLE_KEY"
  plaintext_value = var.stripe_publishable_key_prod
}

resource "github_actions_environment_secret" "stripe_webhook_secret_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "STRIPE_WEBHOOK_SECRET"
  plaintext_value = var.stripe_webhook_secret_prod
}

resource "github_actions_environment_secret" "smtp_host_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "SMTP_HOST"
  plaintext_value = var.smtp_host_prod
}

resource "github_actions_environment_secret" "smtp_port_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "SMTP_PORT"
  plaintext_value = var.smtp_port_prod
}

resource "github_actions_environment_secret" "smtp_user_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "SMTP_USER"
  plaintext_value = var.smtp_user_prod
}

resource "github_actions_environment_secret" "smtp_pass_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "SMTP_PASS"
  plaintext_value = var.smtp_pass_prod
}

resource "github_actions_environment_secret" "smtp_from_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "SMTP_FROM"
  plaintext_value = var.smtp_from_prod
}

resource "github_actions_environment_secret" "s3_access_key_id_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "S3_ACCESS_KEY_ID"
  plaintext_value = var.s3_access_key_id_prod
}

resource "github_actions_environment_secret" "s3_secret_access_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "S3_SECRET_ACCESS_KEY"
  plaintext_value = var.s3_secret_access_key_prod
}

resource "github_actions_environment_secret" "s3_bucket_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "S3_BUCKET"
  plaintext_value = var.s3_bucket_prod
}

resource "github_actions_environment_secret" "s3_region_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "S3_REGION"
  plaintext_value = var.s3_region_prod
}

resource "github_actions_environment_secret" "s3_endpoint_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "S3_ENDPOINT"
  plaintext_value = var.s3_endpoint_prod
}

resource "github_actions_environment_secret" "cdn_url_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "CDN_URL"
  plaintext_value = var.cdn_url_prod
}

resource "github_actions_environment_secret" "admin_password_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "ADMIN_PASSWORD"
  plaintext_value = var.admin_password_prod
}

resource "github_actions_environment_secret" "platform_admin_email_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "PLATFORM_ADMIN_EMAIL"
  plaintext_value = var.platform_admin_email_prod
}

resource "github_actions_environment_secret" "platform_admin_password_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "PLATFORM_ADMIN_PASSWORD"
  plaintext_value = var.platform_admin_password_prod
}

resource "github_actions_environment_variable" "platform_admin_name_prod" {
  repository    = "divestreams-v2"
  environment   = github_repository_environment.production.environment
  variable_name = "PLATFORM_ADMIN_NAME"
  value         = "Platform Admin"
}

resource "github_actions_environment_secret" "grafana_mimir_url_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_MIMIR_URL"
  plaintext_value = var.grafana_mimir_url
}

resource "github_actions_environment_secret" "grafana_mimir_username_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_MIMIR_USERNAME"
  plaintext_value = var.grafana_mimir_username
}

resource "github_actions_environment_secret" "grafana_mimir_api_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_MIMIR_API_KEY"
  plaintext_value = var.grafana_mimir_api_key
}

resource "github_actions_environment_secret" "grafana_tempo_url_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_TEMPO_URL"
  plaintext_value = var.grafana_tempo_url
}

resource "github_actions_environment_secret" "grafana_tempo_username_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_TEMPO_USERNAME"
  plaintext_value = var.grafana_tempo_username
}

resource "github_actions_environment_secret" "grafana_tempo_api_key_prod" {
  repository      = "divestreams-v2"
  environment     = github_repository_environment.production.environment
  secret_name     = "GRAFANA_TEMPO_API_KEY"
  plaintext_value = var.grafana_tempo_api_key
}
# ── Repository-Level Secrets ──────────────────────────────────────────────────

resource "github_actions_secret" "promotion_pat" {
  repository      = "divestreams-v2"
  secret_name     = "PROMOTION_PAT"
  plaintext_value = var.promotion_pat
}

resource "github_actions_secret" "hostinger_api_token" {
  repository      = "divestreams-v2"
  secret_name     = "HOSTINGER_API_TOKEN"
  plaintext_value = var.hostinger_api_token
}

resource "github_actions_secret" "tailscale_auth_key" {
  repository      = "divestreams-v2"
  secret_name     = "TAILSCALE_AUTH_KEY"
  plaintext_value = var.tailscale_auth_key
}
