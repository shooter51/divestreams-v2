# Pact Broker Deployment Guide

This guide covers deploying a self-hosted Pact Broker to the Dev VPS.

## Overview

**Deployment Target:** Dev VPS (1296511 - 62.72.3.35)
**URL:** `https://pact.dev.divestreams.com`
**Components:**
- PostgreSQL 16 (database)
- Pact Broker (web UI + API)
- System Caddy (reverse proxy with SSL)

---

## Step 1: Prepare Files on VPS

SSH to the Dev VPS and create the deployment directory:

```bash
ssh root@62.72.3.35

# Create directory for Pact Broker
mkdir -p /opt/pact-broker
cd /opt/pact-broker
```

Upload files to VPS:

```bash
# From your local machine
scp docker-compose.pact-broker.yml root@62.72.3.35:/opt/pact-broker/
scp .env.pact-broker.example root@62.72.3.35:/opt/pact-broker/.env
```

---

## Step 2: Configure Environment

On the VPS, edit the `.env` file:

```bash
cd /opt/pact-broker
nano .env
```

Set a secure database password:

```bash
# Generate secure password
PACT_BROKER_DB_PASSWORD=$(openssl rand -base64 32)

# .env content
PACT_BROKER_DB_PASSWORD=<your-generated-password>
PACT_BROKER_BASE_URL=https://pact.dev.divestreams.com
```

---

## Step 3: Configure System Caddy

The Dev VPS has a system-level Caddy running. Add Pact Broker to its configuration:

```bash
# Edit the system Caddyfile
nano /etc/caddy/Caddyfile
```

Add this block:

```caddyfile
# Pact Broker
pact.dev.divestreams.com {
    reverse_proxy localhost:9292

    # Enable gzip compression
    encode gzip

    # Access logs
    log {
        output file /var/log/caddy/pact-access.log
        format json
    }
}
```

Reload Caddy:

```bash
systemctl reload caddy
# OR if using Docker Caddy:
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## Step 4: Deploy Pact Broker

Start the Pact Broker containers:

```bash
cd /opt/pact-broker
docker-compose -f docker-compose.pact-broker.yml up -d
```

Check status:

```bash
docker-compose -f docker-compose.pact-broker.yml ps
docker-compose -f docker-compose.pact-broker.yml logs -f
```

Expected output:
```
pact-broker-db   Up (healthy)
pact-broker      Up (healthy)
```

---

## Step 5: Verify Deployment

Test the Pact Broker:

```bash
# From VPS
curl http://localhost:9292/diagnostic/status/heartbeat

# From local machine
curl https://pact.dev.divestreams.com/diagnostic/status/heartbeat
```

Expected response:
```json
{"ok": true}
```

Access the web UI:
- Open browser: `https://pact.dev.divestreams.com`
- You should see the Pact Broker interface

---

## Step 6: Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to: `https://github.com/shooter51/divestreams-v2/settings/secrets/actions`

2. Add repository secrets:
   - **Name:** `PACT_BROKER_BASE_URL`
   - **Value:** `https://pact.dev.divestreams.com`

3. No token needed since the broker has public access

---

## Step 7: Test Contract Publishing

From your local development machine:

```bash
# Set environment variable
export PACT_BROKER_BASE_URL=https://pact.dev.divestreams.com

# Generate and publish contracts
npm run pact:consumer
npm run pact:publish
```

Expected output:
```
📦 Publishing Pact contracts to Pact Broker...
   Version: 1234567
   Branch: develop
   Broker: https://pact.dev.divestreams.com
✅ Pact contracts published successfully!
```

Check the web UI:
- Open: `https://pact.dev.divestreams.com`
- You should see 4 contracts listed:
  - DiveStreamsFrontend → DiveStreamsAPI
  - Zapier → DiveStreamsAPI
  - OAuthProvider → DiveStreamsAPI
  - Stripe → DiveStreamsAPI

---

## Maintenance

### View Logs

```bash
cd /opt/pact-broker
docker-compose -f docker-compose.pact-broker.yml logs -f
docker-compose -f docker-compose.pact-broker.yml logs pact-broker
docker-compose -f docker-compose.pact-broker.yml logs postgres
```

### Restart Services

```bash
cd /opt/pact-broker
docker-compose -f docker-compose.pact-broker.yml restart
```

### Update Pact Broker

```bash
cd /opt/pact-broker
docker-compose -f docker-compose.pact-broker.yml pull
docker-compose -f docker-compose.pact-broker.yml up -d
```

### Backup Database

```bash
# Create backup
docker exec pact-broker-db pg_dump -U pact_broker pact_broker > pact-broker-backup-$(date +%Y%m%d).sql

# Restore from backup
cat pact-broker-backup-20260215.sql | docker exec -i pact-broker-db psql -U pact_broker pact_broker
```

### Stop/Remove

```bash
cd /opt/pact-broker

# Stop
docker-compose -f docker-compose.pact-broker.yml stop

# Stop and remove (keeps data)
docker-compose -f docker-compose.pact-broker.yml down

# Stop and remove everything (INCLUDING DATA!)
docker-compose -f docker-compose.pact-broker.yml down -v  # ⚠️ DANGEROUS
```

---

## Troubleshooting

### Can't connect to broker

**Problem:** `ECONNREFUSED` when trying to publish

**Solutions:**
1. Check containers are running: `docker ps | grep pact`
2. Check Pact Broker logs: `docker logs pact-broker`
3. Test local access: `curl http://localhost:9292/diagnostic/status/heartbeat`
4. Check Caddy config: `caddy validate --config /etc/caddy/Caddyfile`
5. Verify DNS: `nslookup pact.dev.divestreams.com`

### Database connection errors

**Problem:** Pact Broker can't connect to PostgreSQL

**Solutions:**
1. Check PostgreSQL is healthy: `docker ps | grep pact-broker-db`
2. View PostgreSQL logs: `docker logs pact-broker-db`
3. Verify environment variable: `docker exec pact-broker env | grep DATABASE_URL`
4. Restart services: `docker-compose restart`

### SSL certificate issues

**Problem:** Certificate errors when accessing `https://pact.dev.divestreams.com`

**Solutions:**
1. Check Caddy is running: `systemctl status caddy` or `docker ps | grep caddy`
2. View Caddy logs: `journalctl -u caddy -f` or `docker logs caddy`
3. Verify DNS is configured: `dig pact.dev.divestreams.com`
4. Reload Caddy: `systemctl reload caddy` or `docker exec caddy caddy reload`

### Contracts not appearing

**Problem:** Published contracts don't show in web UI

**Solutions:**
1. Check publish output for errors
2. Verify `PACT_BROKER_BASE_URL` is correct
3. Check database has data: `docker exec pact-broker-db psql -U pact_broker -d pact_broker -c "SELECT COUNT(*) FROM pact_publications;"`
4. Review Pact Broker logs: `docker logs pact-broker`

---

## DNS Configuration

If `pact.dev.divestreams.com` doesn't resolve, configure DNS:

### Option 1: Cloudflare (Recommended)

1. Log in to Cloudflare
2. Select `divestreams.com` domain
3. Go to DNS → Records
4. Add A record:
   - **Type:** A
   - **Name:** `pact.dev`
   - **IPv4 address:** `62.72.3.35`
   - **Proxy status:** DNS only (gray cloud)
   - **TTL:** Auto

### Option 2: /etc/hosts (Local Testing)

For local testing only, add to `/etc/hosts`:

```bash
62.72.3.35  pact.dev.divestreams.com
```

---

## Security Considerations

### Current Setup

- ✅ HTTPS via Caddy with automatic Let's Encrypt certificates
- ✅ PostgreSQL is not exposed externally (only accessible within Docker network)
- ⚠️ No authentication required (public access)

### Adding Authentication (Optional)

If you want to add token-based authentication:

1. Edit `.env`:
   ```bash
   PACT_BROKER_API_KEY=your-secure-token-here
   ```

2. Update `docker-compose.pact-broker.yml`:
   ```yaml
   environment:
     PACT_BROKER_BEARER_TOKEN: ${PACT_BROKER_API_KEY}
   ```

3. Restart: `docker-compose restart`

4. Update GitHub secret:
   - **Name:** `PACT_BROKER_TOKEN`
   - **Value:** `your-secure-token-here`

5. Update `.github/workflows/pact-tests.yml` to use the token

---

## Resource Usage

**Estimated VPS Resources:**
- **RAM:** ~200-300 MB
- **Disk:** ~100 MB (database grows with contracts)
- **CPU:** Minimal (<5%)

The Pact Broker is very lightweight and should run smoothly on the Dev VPS alongside other services.

---

## Next Steps

After successful deployment:

1. ✅ Publish contracts from CI/CD
2. ✅ View contracts in web UI
3. ✅ Implement provider verification
4. ✅ Enable can-i-deploy checks
5. ✅ Set up webhooks (optional)

---

## Quick Reference

```bash
# Deploy
cd /opt/pact-broker && docker-compose up -d

# Status
docker-compose ps

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose stop

# Update
docker-compose pull && docker-compose up -d

# Test
curl https://pact.dev.divestreams.com/diagnostic/status/heartbeat
```

---

**Deployment Location:** `/opt/pact-broker` on Dev VPS (62.72.3.35)
**Web UI:** https://pact.dev.divestreams.com
**API:** https://pact.dev.divestreams.com
