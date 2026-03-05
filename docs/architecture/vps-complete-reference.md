# VPS Complete Reference Guide

> **Server**: srv1239852.hstgr.cloud
> **IP**: 72.62.166.128
> **Provider**: Hostinger KVM 4
> **OS**: Ubuntu 24.04 LTS
> **Last Updated**: January 11, 2026

---

## Table of Contents

1. [Server Overview](#server-overview)
2. [Network & DNS](#network--dns)
3. [Directory Structure](#directory-structure)
4. [Docker Services](#docker-services)
5. [APIs](#apis)
6. [Caddy Reverse Proxy](#caddy-reverse-proxy)
7. [System Services](#system-services)
8. [Quick Commands](#quick-commands)
9. [Troubleshooting](#troubleshooting)

---

## Server Overview

### Hardware Resources

| Resource | Allocation |
|----------|------------|
| **CPU** | 4 vCPUs |
| **RAM** | 16 GB |
| **Storage** | 200 GB SSD |
| **Bandwidth** | 16 TB/month |

### Access Methods

```bash
# Direct SSH
ssh root@72.62.166.128

# Via Tailscale VPN
ssh root@100.76.7.28
```

### Key Credentials Location

| Service | Location |
|---------|----------|
| DiveStreams | `/var/www/divestreams.com/.env` |
| Nitrox API | `/docker/nitrox-api/docker-compose.yml` |
| Caddy | `/etc/caddy/Caddyfile` |

---

## Network & DNS

### Public DNS Records

| Domain | Type | Points To |
|--------|------|-----------|
| `omi.loopholetom.com` | A | 72.62.166.128 |
| `divestreams.com` | A | 72.62.166.128 |
| `*.divestreams.com` | A | 72.62.166.128 |

### Tailscale VPN Network

| Device | Tailscale IP | Role |
|--------|--------------|------|
| **VPS** | 100.76.7.28 | Proxy Server |
| **Mac Studio** | 100.112.180.63 | Backend Services |
| **iPhone 15 Pro** | 100.85.24.52 | Mobile Client |

### Port Mapping

| External Port | Internal Service | Protocol |
|---------------|------------------|----------|
| 22 | SSH | TCP |
| 80 | Caddy (HTTP→HTTPS redirect) | TCP |
| 443 | Caddy (HTTPS) | TCP |
| 3001 | DiveStreams App (Docker) | TCP |
| 8080 | Nitrox API (Docker) | TCP |

---

## Directory Structure

```
/
├── docker/
│   └── nitrox-api/
│       └── docker-compose.yml      # Nitrox API stack
│
├── etc/
│   └── caddy/
│       └── Caddyfile               # Reverse proxy config
│
├── var/
│   ├── log/
│   │   └── caddy/                  # Caddy access logs
│   │       ├── divestreams-access.log
│   │       ├── elite-divestreams-access.log
│   │       ├── demo-divestreams-access.log
│   │       ├── zotz-divestreams-access.log
│   │       ├── nitrox-divestreams-access.log
│   │       └── omi-access.log
│   │
│   └── www/
│       └── divestreams.com/        # DiveStreams application
│           ├── .env                # Environment config
│           ├── docker-compose.yml  # Docker stack
│           ├── Dockerfile          # App container
│           ├── Dockerfile.migrate  # Migration container
│           ├── src/                # Next.js source
│           ├── drizzle/            # Database migrations
│           └── docker/
│               ├── postgres/       # PostgreSQL config
│               └── powersync/      # PowerSync config (inactive)
│
└── root/
    └── .ssh/                       # SSH keys
```

---

## Docker Services

### Container Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER NETWORK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  divestreamscom_elite-network                           │    │
│  │                                                         │    │
│  │  ┌─────────────────────┐    ┌─────────────────────┐    │    │
│  │  │ elite-adventure-app │───▶│ elite-adventure-db  │    │    │
│  │  │ (Next.js)           │    │ (PostgreSQL)        │    │    │
│  │  │ Port: 3001→3000     │    │ Port: 5432          │    │    │
│  │  └─────────────────────┘    └─────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  nitrox-api_default                                     │    │
│  │                                                         │    │
│  │  ┌─────────────────────┐    ┌─────────────────────┐    │    │
│  │  │ nitrox-api-api-1    │───▶│ nitrox-api-db-1     │    │    │
│  │  │ (Node.js/Express)   │    │ (PostgreSQL)        │    │    │
│  │  │ Port: 8080→3000     │    │ Port: 5432          │    │    │
│  │  └─────────────────────┘    └─────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### DiveStreams Stack

| Container | Image | Port | Health |
|-----------|-------|------|--------|
| `elite-adventure-app` | `divestreamscom-app` | 3001→3000 | `/api/health` |
| `elite-adventure-db` | `postgres:16-alpine` | internal | `pg_isready` |

**Location**: `/var/www/divestreams.com`

**Start/Stop**:
```bash
cd /var/www/divestreams.com
docker compose up -d      # Start
docker compose down       # Stop
docker compose restart    # Restart
```

### Nitrox API Stack

| Container | Image | Port | Health |
|-----------|-------|------|--------|
| `nitrox-api-api-1` | `node:20-alpine` | 8080→3000 | `/health` |
| `nitrox-api-db-1` | `postgres:16-alpine` | internal | `pg_isready` |

**Location**: `/docker/nitrox-api`

**Start/Stop**:
```bash
cd /docker/nitrox-api
docker compose up -d      # Start
docker compose down       # Stop
docker compose restart    # Restart
```

### Docker Volumes

| Volume | Purpose | Container |
|--------|---------|-----------|
| `divestreamscom_postgres_data` | DiveStreams database | elite-adventure-db |
| `nitrox-api_pgdata` | Nitrox database | nitrox-api-db-1 |

---

## APIs

### DiveStreams API

**Base URL**: `https://divestreams.com/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/*` | * | NextAuth.js endpoints |
| `/api/tours` | GET | List tours |
| `/api/tours/[id]` | GET | Get tour details |
| `/api/bookings` | GET/POST | Manage bookings |
| `/api/customers` | GET/POST | Manage customers |
| `/api/tank-fills` | GET/POST | Tank fill records |
| `/api/training/*` | * | Training management |

**Multi-Tenant Headers**:
```
X-Tenant-Subdomain: elite | demo | zotz
```

### Nitrox API

**Base URL**: `https://nitrox.divestreams.com`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/bottles` | GET | List all bottle records |
| `/bottles` | POST | Create bottle record |

**Request Body (POST /bottles)**:
```json
{
  "tank_id": "AL80-001",
  "o2": 32.0,
  "analyst": "John Doe",
  "diver": "Jane Smith",
  "mod": 33.8,
  "notes": "Optional notes",
  "sig": "base64-signature",
  "nfc": "nfc-tag-id"
}
```

**Response**:
```json
{
  "id": 1,
  "tank_id": "AL80-001",
  "o2": "32.00",
  "analyst": "John Doe",
  "diver": "Jane Smith",
  "mod": "33.80",
  "notes": "Optional notes",
  "sig": "base64-signature",
  "nfc": "nfc-tag-id",
  "created_at": "2026-01-11T15:00:00.000Z"
}
```

### OMI Proxy

**Base URL**: `https://omi.loopholetom.com`

Routes all traffic to Mac Studio (`100.112.180.63:8088`) via Tailscale.

---

## Caddy Reverse Proxy

### Configuration File

**Location**: `/etc/caddy/Caddyfile`

### Route Table

| Domain | Backend | Headers |
|--------|---------|---------|
| `omi.loopholetom.com` | `100.112.180.63:8088` | X-Forwarded-Proto, X-Forwarded-Host, X-Real-IP |
| `divestreams.com` | `localhost:3001` | X-Real-IP |
| `www.divestreams.com` | `localhost:3001` | X-Real-IP |
| `elite.divestreams.com` | `localhost:3001` | X-Real-IP, X-Tenant-Subdomain: elite |
| `demo.divestreams.com` | `localhost:3001` | X-Real-IP, X-Tenant-Subdomain: demo |
| `zotz.divestreams.com` | `localhost:3001` | X-Real-IP, X-Tenant-Subdomain: zotz |
| `nitrox.divestreams.com` | `localhost:8080` | X-Real-IP, X-Forwarded-Proto |

### SSL Certificates

Caddy automatically provisions and renews Let's Encrypt certificates for all domains.

### Management

```bash
# Reload config (no downtime)
sudo systemctl reload caddy

# Restart service
sudo systemctl restart caddy

# View status
sudo systemctl status caddy

# Validate config
caddy validate --config /etc/caddy/Caddyfile

# View logs
sudo journalctl -u caddy -f
```

---

## System Services

### Active Services

| Service | Status | Purpose |
|---------|--------|---------|
| `caddy` | ✅ enabled | Reverse proxy with auto-SSL |
| `docker` | ✅ enabled | Container runtime |
| `containerd` | ✅ enabled | Container runtime daemon |
| `tailscaled` | ✅ enabled | Tailscale VPN mesh |
| `fail2ban` | ✅ enabled | Intrusion prevention |
| `monarx-agent` | ✅ enabled | Security monitoring |
| `sshd` | ✅ enabled | SSH server |

### Legacy Services (Can Be Removed)

| Service | Status | Notes |
|---------|--------|-------|
| `postgresql` | enabled | Not used - all DBs are in Docker |
| `pm2-root` | enabled | Not used - was for native Node.js |

### Remove Legacy Services (Optional)

```bash
# Stop and disable native PostgreSQL
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Stop and disable PM2
sudo systemctl stop pm2-root
sudo systemctl disable pm2-root
pm2 kill
```

---

## Quick Commands

### SSH Access

```bash
ssh root@72.62.166.128
```

### View All Containers

```bash
docker ps -a
```

### DiveStreams

```bash
cd /var/www/divestreams.com

# View logs
docker logs elite-adventure-app -f

# Restart
docker compose restart

# Rebuild after code changes
git pull origin main
docker compose build app
docker compose up -d

# Run migrations
docker compose run --rm migrate

# Database shell
docker exec -it elite-adventure-db psql -U postgres -d elite_adventure
```

### Nitrox API

```bash
cd /docker/nitrox-api

# View logs
docker compose logs -f

# Restart
docker compose restart

# Database shell
docker exec -it nitrox-api-db-1 psql -U nitrox -d nitrox
```

### Caddy

```bash
# Reload config
sudo systemctl reload caddy

# View access logs
tail -f /var/log/caddy/*.log

# Edit config
sudo nano /etc/caddy/Caddyfile
```

### Docker Cleanup

```bash
# Remove unused images, containers, volumes
docker system prune -af --volumes

# Check disk usage
docker system df

# View all images
docker images
```

### System Monitoring

```bash
# Disk usage
df -h /

# Memory usage
free -h

# Running processes
htop

# Network connections
ss -tlnp
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs <container-name> --tail 100

# Check if port is in use
ss -tlnp | grep <port>

# Force recreate
docker compose up -d --force-recreate
```

### Database Connection Failed

```bash
# Check if DB container is running
docker ps | grep db

# Test database connection
docker exec -it <db-container> pg_isready

# View DB logs
docker logs <db-container> --tail 50
```

### 502 Bad Gateway

```bash
# Check if backend is running
curl localhost:3001/api/health   # DiveStreams
curl localhost:8080/health       # Nitrox

# Restart Caddy
sudo systemctl restart caddy

# Check Caddy logs
sudo journalctl -u caddy --since "5 minutes ago"
```

### SSL Certificate Issues

```bash
# Caddy auto-renews - just restart if issues
sudo systemctl restart caddy

# Force certificate renewal
caddy reload --config /etc/caddy/Caddyfile
```

### Tailscale Connection Lost

```bash
# Check status
tailscale status

# Restart
sudo systemctl restart tailscaled

# Re-authenticate
sudo tailscale up
```

### Out of Disk Space

```bash
# Check disk usage
df -h /

# Clean Docker
docker system prune -af --volumes

# Find large files
du -h / --max-depth=1 | sort -hr | head -20
```

---

## Architecture Diagram

```
                                    INTERNET
                                        │
                                        ▼
                              ┌─────────────────┐
                              │   Cloudflare    │
                              │   (DNS only)    │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        VPS (72.62.166.128)                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    CADDY (Port 80/443)                             │  │
│  │                    Auto-SSL via Let's Encrypt                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│           │                    │                        │                │
│           ▼                    ▼                        ▼                │
│  ┌─────────────────┐  ┌─────────────────┐      ┌─────────────────┐      │
│  │ omi.loophole    │  │ *.divestreams   │      │ nitrox.dive     │      │
│  │ tom.com         │  │ .com            │      │ streams.com     │      │
│  └────────┬────────┘  └────────┬────────┘      └────────┬────────┘      │
│           │                    │                        │                │
│           ▼                    ▼                        ▼                │
│  ┌─────────────────┐  ┌─────────────────┐      ┌─────────────────┐      │
│  │   TAILSCALE     │  │     DOCKER      │      │     DOCKER      │      │
│  │   100.112.180   │  │   Port 3001     │      │   Port 8080     │      │
│  │   .63:8088      │  ├─────────────────┤      ├─────────────────┤      │
│  └────────┬────────┘  │ elite-adventure │      │ nitrox-api-api  │      │
│           │           │     -app        │      │                 │      │
│           │           ├─────────────────┤      ├─────────────────┤      │
│           │           │ elite-adventure │      │ nitrox-api-db   │      │
│           │           │     -db         │      │                 │      │
│           │           └─────────────────┘      └─────────────────┘      │
│           │                                                              │
└───────────┼──────────────────────────────────────────────────────────────┘
            │
            ▼ (Tailscale VPN Tunnel)
   ┌─────────────────┐
   │   MAC STUDIO    │
   │  100.112.180.63 │
   │    Port 8088    │
   └─────────────────┘
```

---

## Environment Variables Reference

### DiveStreams (`/var/www/divestreams.com/.env`)

```env
# Database
POSTGRES_PASSWORD=elite_secure_2026
POSTGRES_DB=elite_adventure

# Authentication
AUTH_SECRET=<base64-secret>
AUTH_URL=https://divestreams.com

# Stripe (configure when ready)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email
RESEND_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=https://divestreams.com
NODE_ENV=production
APP_PORT=3001

# PowerSync (not active)
POWERSYNC_PORT=6060
POWERSYNC_SECRET_KEY=<secret>
```

### Nitrox API (`/docker/nitrox-api/docker-compose.yml`)

```yaml
# Inline in docker-compose.yml
POSTGRES_USER: nitrox
POSTGRES_PASSWORD: nitrox2026
POSTGRES_DB: nitrox
DATABASE_URL: postgresql://nitrox:nitrox2026@db:5432/nitrox
```

---

## Backup Recommendations

### Database Backups

```bash
# DiveStreams
docker exec elite-adventure-db pg_dump -U postgres elite_adventure > backup_divestreams_$(date +%Y%m%d).sql

# Nitrox
docker exec nitrox-api-db-1 pg_dump -U nitrox nitrox > backup_nitrox_$(date +%Y%m%d).sql
```

### Configuration Backups

```bash
# Caddy
cp /etc/caddy/Caddyfile ~/backups/

# Docker Compose files
cp /var/www/divestreams.com/docker-compose.yml ~/backups/
cp /docker/nitrox-api/docker-compose.yml ~/backups/

# Environment files
cp /var/www/divestreams.com/.env ~/backups/
```

---

*Generated by Claude Code on January 11, 2026*
