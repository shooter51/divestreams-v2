# VPS Infrastructure Documentation

## Server Overview

| Property | Value |
|----------|-------|
| **Hostname** | srv1239852.hstgr.cloud |
| **IPv4** | 72.62.166.128 |
| **IPv6** | 2a02:4780:2d:a47c::1 |
| **OS** | Ubuntu 24.04 LTS |
| **Provider** | Hostinger (KVM 4 plan) |
| **Resources** | 4 CPU, 16GB RAM, 200GB SSD |

### SSH Access
```bash
ssh root@72.62.166.128
# or via Tailscale
ssh root@100.76.7.28
```

---

## DNS Configuration

Three DNS entries point to this server:

| Domain | Purpose |
|--------|---------|
| `omi.loopholetom.com` | Routes traffic to Mac Studio via Tailscale |
| `*.divestreams.com` | Hosts multi-tenant DiveStreams applications |
| `storage.loopholetom.com` | Routes to Synology NAS DSM via Tailscale |

---

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Caddy (Reverse Proxy) - Ports 80/443                       │
│  /etc/caddy/Caddyfile                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ├── omi.loopholetom.com ──────► Tailscale (100.112.180.63:8088)
    │                                    └── Mac Studio
    │
    ├── storage.loopholetom.com ──► Tailscale (100.104.114.79:5001)
    │                                    └── Synology NAS DSM
    │
    ├── *.divestreams.com ────────► PM2: divestreams (3001)
    │   (elite, demo, zotz)              └── Docker: elite-adventure-db
    │
    └── nitrox.divestreams.com ───► Docker: nitrox-api (8080)
                                         └── Docker: nitrox-db
```

---

## Services

### 1. OMI Proxy (omi.loopholetom.com)

**Purpose**: Routes traffic to Mac Studio via Tailscale VPN

**Configuration**: `/etc/caddy/Caddyfile`
```caddy
omi.loopholetom.com {
  reverse_proxy 100.112.180.63:8088 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
    header_up X-Real-IP {remote_host}
  }
}
```

**Tailscale Network**:
| Device | Tailscale IP | OS |
|--------|--------------|-----|
| VPS (srv1239852) | 100.76.7.28 | Linux |
| Mac Studio | 100.112.180.63 | macOS |
| Synology NAS (storage) | 100.104.114.79 | DSM |
| iPhone 15 Pro | 100.85.24.52 | iOS |

---

### 2. DiveStreams Multi-Tenant App (*.divestreams.com)

**Purpose**: Dive shop management SaaS

**Location**: `/var/www/divestreams.com`

**Process Manager**: PM2 (Next.js standalone output)

**Services**:
| Process | Type | Port | Purpose |
|---------|------|------|---------|
| divestreams | PM2 (Node.js) | 3001 | Next.js standalone server |
| elite-adventure-db | Docker | internal | PostgreSQL database |

**Tenant Routing** (via X-Tenant-Subdomain header):
| Subdomain | Tenant ID |
|-----------|-----------|
| divestreams.com | (default) |
| elite.divestreams.com | elite |
| demo.divestreams.com | demo |
| zotz.divestreams.com | zotz |

**Environment**: `/var/www/divestreams.com/.env`

#### Deployment Commands
```bash
cd /var/www/divestreams.com

# Sync code from local (no git repo on VPS)
# Run from LOCAL machine:
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  /Users/tomgibson/DiveStreams/ root@72.62.166.128:/var/www/divestreams.com/

# On VPS: Install dependencies and rebuild
npm install
npm run build

# Restart PM2 process
pm2 restart divestreams

# View logs
pm2 logs divestreams
```

**IMPORTANT**: Uses Next.js `output: "standalone"` mode. Must use `node .next/standalone/server.js`, NOT `npm start`.

---

### 3. Nitrox API (nitrox.divestreams.com)

**Purpose**: Scuba tank oxygen content tracking API

**Location**: `/docker/nitrox-api`

**Docker Compose**: `/docker/nitrox-api/docker-compose.yml`

**Containers**:
| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| nitrox-api-api-1 | node:20-alpine | 8080→3000 | Express API |
| nitrox-api-db-1 | postgres:16-alpine | internal | PostgreSQL database |

**API Endpoints**:
- `GET /health` - Health check
- `GET /bottles` - List all bottle records
- `POST /bottles` - Create new bottle record

#### Deployment Commands
```bash
cd /docker/nitrox-api

# Restart
docker compose restart

# View logs
docker logs nitrox-api-api-1 -f
```

---

### 4. Synology NAS (storage.loopholetom.com)

**Purpose**: Network storage and backup destination

**Access**: `https://storage.loopholetom.com` (proxied through VPS via Tailscale)

**Tailscale IP**: 100.104.114.79

**DSM Ports**:
| Port | Service |
|------|---------|
| 5000 | DSM HTTP |
| 5001 | DSM HTTPS |
| 22 | SSH/SFTP |
| 445 | SMB |

**Caddy Configuration**:
```caddy
storage.loopholetom.com {
  reverse_proxy 100.104.114.79:5001 {
    transport http {
      tls
      tls_insecure_skip_verify
    }
  }
}
```

---

## Backups

**Script**: `/opt/backups/scripts/backup-to-nas.sh`

**Schedule**: Daily at 3:00 AM UTC (cron)

**What's Backed Up**:
| Item | Destination |
|------|-------------|
| DiveStreams PostgreSQL | `/opt/backups/databases/divestreams_*.sql.gz` |
| Nitrox PostgreSQL | `/opt/backups/databases/nitrox_*.sql.gz` |
| Caddy config | `/opt/backups/configs/Caddyfile_*` |
| Environment files | `/opt/backups/configs/*.env_*` |

**Retention**: 7 days (local), synced to NAS at `/volume1/backups/vps/`

### Enable NAS Sync
To enable automatic sync to the Synology NAS:
```bash
# Generate SSH key if needed
ssh-keygen -t ed25519 -f ~/.ssh/nas_backup -N ""

# Copy key to NAS (requires NAS admin password)
ssh-copy-id -i ~/.ssh/nas_backup admin@100.104.114.79

# Test backup
/opt/backups/scripts/backup-to-nas.sh
```

### Manual Backup Commands
```bash
# Run backup now
/opt/backups/scripts/backup-to-nas.sh

# View backup log
tail -50 /opt/backups/backup.log

# List local backups
ls -la /opt/backups/databases/
ls -la /opt/backups/configs/
```

---

## Caddy Configuration

**File**: `/etc/caddy/Caddyfile`

**Logs**: `/var/log/caddy/`

### Management Commands
```bash
# Reload configuration
sudo systemctl reload caddy

# Restart Caddy
sudo systemctl restart caddy

# View status
sudo systemctl status caddy

# Edit config
sudo nano /etc/caddy/Caddyfile

# Validate config
caddy validate --config /etc/caddy/Caddyfile
```

---

## System Services

| Service | Status | Purpose |
|---------|--------|---------|
| caddy | enabled | Reverse proxy with auto-SSL |
| docker | enabled | Container runtime |
| tailscaled | enabled | VPN mesh network |
| fail2ban | enabled | Intrusion prevention |
| monarx-agent | enabled | Security monitoring |
| postgresql | enabled | Native PostgreSQL (legacy, can be removed) |

---

## Docker Management

### View All Containers
```bash
docker ps -a
```

### Clean Up Resources
```bash
# Remove unused images, containers, volumes
docker system prune -af --volumes

# Check disk usage
docker system df
```

### Container Logs
```bash
# Follow logs
docker logs <container-name> -f

# Last 100 lines
docker logs <container-name> --tail 100
```

---

## Troubleshooting

### DiveStreams App Not Responding
```bash
# Check PM2 status
pm2 status

# Check app logs
pm2 logs divestreams --lines 50

# Restart PM2 process
pm2 restart divestreams
```

### Database Issues
```bash
# Connect to Docker PostgreSQL
docker exec -it elite-adventure-db psql -U postgres -d elite_adventure

# Check database health
docker exec elite-adventure-db pg_isready
```

### SSL Certificate Issues
```bash
# Caddy handles SSL automatically
# Check Caddy logs
sudo journalctl -u caddy -f
```

### Port Conflicts
```bash
# Check what's using a port
ss -tlnp | grep <port>

# Kill process on port
fuser -k <port>/tcp
```

---

## Cleanup Notes

### Current State
- DiveStreams runs via PM2 with Next.js standalone server (not Docker)
- Database still runs in Docker (elite-adventure-db)
- `/opt/elite-adventure` was removed (duplicate)

### Can Be Removed (Not Currently Used)
- Native PostgreSQL service (`postgresql.service`) - All apps use Docker PostgreSQL
- Database `elite_adventure` in native PostgreSQL - Legacy from native setup

To remove native PostgreSQL:
```bash
# Stop and disable
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Remove packages (optional)
sudo apt remove postgresql postgresql-contrib
```

---

## Future Improvements

1. **PowerSync**: Currently not running. Needs `/docker/powersync/powersync.yaml` configuration
2. ~~**Database Backups**: Set up automated PostgreSQL backups~~ ✅ Done - Daily backups to NAS
3. **Monitoring**: Consider adding Prometheus/Grafana for metrics
4. **CI/CD**: Automate deployments from GitHub

---

## Quick Reference

```bash
# SSH to VPS
ssh root@72.62.166.128

# DiveStreams (PM2)
pm2 status
pm2 logs divestreams
pm2 restart divestreams

# Nitrox (Docker)
cd /docker/nitrox-api
docker compose logs -f

# Caddy
sudo systemctl reload caddy
tail -f /var/log/caddy/*.log

# All containers
docker ps

# Backups
/opt/backups/scripts/backup-to-nas.sh  # Run manual backup
tail -50 /opt/backups/backup.log        # View backup log

# NAS (via Tailscale)
ssh admin@100.104.114.79               # SSH to NAS
```
