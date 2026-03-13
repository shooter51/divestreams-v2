# ── Outputs ───────────────────────────────────────────────────────────────────

output "cloudflare_nameservers" {
  description = "Cloudflare nameservers for the zone (update at registrar if needed)"
  value       = "See Cloudflare dashboard → divestreams.com → Overview → Nameservers"
}

output "s3_bucket_url" {
  description = "Public base URL for the S3 images bucket"
  value       = "https://divestreams-images.s3.us-east-1.amazonaws.com"
}

output "prod_url" {
  description = "Production application URL"
  value       = "https://${var.domain}"
}

output "test_url" {
  description = "Test environment URL"
  value       = "https://test.${var.domain}"
}

output "db_vps_ip" {
  description = "IP address of the dedicated database VPS (for SSH access)"
  value       = var.db_vps_ip
}
