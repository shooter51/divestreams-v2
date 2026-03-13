# ── DNS Records for divestreams.com ──────────────────────────────────────────

# Root domain → production VPS (proxied)
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "A"
  content = var.prod_vps_ip
  proxied = true
  ttl     = 1 # Auto when proxied
}

# www → root (proxied)
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = var.domain
  proxied = true
  ttl     = 1
}

# Wildcard *.divestreams.com → production VPS (not proxied — Cloudflare free plan cannot proxy wildcards)
resource "cloudflare_record" "wildcard_prod" {
  zone_id = var.cloudflare_zone_id
  name    = "*.${var.domain}"
  type    = "A"
  content = var.prod_vps_ip
  proxied = false
  ttl     = 300
}

# test.divestreams.com → test VPS (proxied)
resource "cloudflare_record" "test" {
  zone_id = var.cloudflare_zone_id
  name    = "test.${var.domain}"
  type    = "A"
  content = var.test_vps_ip
  proxied = true
  ttl     = 1
}

# *.test.divestreams.com → test VPS (not proxied — wildcard cannot be proxied on free plan)
resource "cloudflare_record" "wildcard_test" {
  zone_id = var.cloudflare_zone_id
  name    = "*.test.${var.domain}"
  type    = "A"
  content = var.test_vps_ip
  proxied = false
  ttl     = 300
}
