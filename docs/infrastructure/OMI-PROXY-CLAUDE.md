# OMI Proxy - Claude Code Configuration

## Overview

omi.loopholetom.com is a reverse proxy that routes traffic through the VPS to your Mac Studio via Tailscale VPN. This allows external access to services running on your local machine without exposing them directly to the internet.

## Architecture

```
Internet
    │
    ▼
omi.loopholetom.com (72.62.166.128)
    │
    ▼
Caddy Reverse Proxy
    │
    ▼ (Tailscale VPN)
Mac Studio (100.112.180.63:8088)
```

## VPS Configuration

| Property | Value |
|----------|-------|
| **Domain** | omi.loopholetom.com |
| **VPS IP** | 72.62.166.128 |
| **Tailscale IP** | 100.76.7.28 |
| **Target** | 100.112.180.63:8088 (Mac Studio) |

## Caddy Configuration

File: `/etc/caddy/Caddyfile`

```caddy
omi.loopholetom.com {
  encode gzip

  request_body {
    max_size 50MB
  }

  reverse_proxy 100.112.180.63:8088 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
    header_up X-Real-IP {remote_host}
  }

  log {
    output file /var/log/caddy/omi-access.log
    format console
  }
}
```

## Tailscale Network

| Device | Tailscale IP | Purpose |
|--------|--------------|---------|
| VPS (srv1239852) | 100.76.7.28 | Proxy server |
| Mac Studio | 100.112.180.63 | Backend service |
| iPhone 15 Pro | 100.85.24.52 | Mobile access |

## Changing the Target

To point to a different port on Mac Studio:

```bash
ssh root@72.62.166.128
sudo nano /etc/caddy/Caddyfile
# Change 100.112.180.63:8088 to desired port
sudo systemctl reload caddy
```

## Troubleshooting

### Connection Refused
1. Check Mac Studio service is running on port 8088
2. Verify Tailscale is connected on both devices:
   ```bash
   # On VPS
   tailscale status

   # On Mac
   tailscale status
   ```
3. Test direct Tailscale connectivity:
   ```bash
   curl http://100.112.180.63:8088
   ```

### Tailscale Issues
```bash
# Check Tailscale status
tailscale status

# Restart Tailscale
sudo systemctl restart tailscaled

# Re-authenticate
sudo tailscale up
```

### View Logs
```bash
# Caddy access logs
tail -f /var/log/caddy/omi-access.log

# Caddy service logs
sudo journalctl -u caddy -f
```

## Notes

- SSL certificate is automatically managed by Caddy
- Max request body size is 50MB (for file uploads)
- Headers are forwarded to preserve client IP
- Tailscale provides encrypted tunnel between VPS and Mac Studio
