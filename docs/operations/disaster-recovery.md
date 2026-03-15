# Disaster Recovery Plan — DiveStreams

> **Last Updated:** 2026-03-15
>
> **RPO (Recovery Point Objective):** Seconds — streaming replication lag is typically 0 bytes
>
> **RTO (Recovery Time Objective):** ~2 minutes via automated script, ~10 minutes manual

---

## Architecture Overview

```
Normal Operation:

  Boston Datacenter                          Phoenix Datacenter
  ┌─────────────────────────┐               ┌─────────────────────────┐
  │ Production App (KVM 4)  │               │ Test App (KVM 8)        │
  │ 76.13.28.28             │               │ 62.72.3.35              │
  │ 100.112.155.18 (TS)     │               │ 100.109.71.112 (TS)     │
  │                         │               │                         │
  │ ┌─────┐ ┌──────┐       │               │ ┌─────┐ ┌──────┐       │
  │ │ App │ │Worker│ Caddy  │               │ │ App │ │Worker│ Caddy  │
  │ └──┬──┘ └──┬───┘       │               │ └──┬──┘ └──┬───┘       │
  │    │       │            │               │    │       │            │
  ├────┼───────┼────────────┤               │ ┌──┴──┐ ┌─┴───────┐   │
  │    │       │            │               │ │Test │ │DR Replica│   │
  │ Database (KVM 4)        │  ──WAL──────▶ │ │ DB  │ │Port 5433│   │
  │ 72.62.166.128           │   stream      │ │5432 │ │Standby  │   │
  │ 100.104.105.34 (TS)     │   Tailscale   │ └─────┘ └─────────┘   │
  │ Port 5432               │               │                        │
  └─────────────────────────┘               └────────────────────────┘

  Notes:
  - Test App connects to local Test DB (divestreams-test-db, port 5432) — no cross-network queries
  - DR Replica streams from Boston primary via Tailscale — for disaster recovery only
  - Boston DB serves production only
       ▲                                         ▲
       │ Tailscale encrypted mesh                │
       └─────────────────────────────────────────┘
```

```
After Failover (Boston down):

  Boston Datacenter                          Phoenix Datacenter
  ┌─────────────────────────┐               ┌─────────────────────────┐
  │                         │               │ Production App (DR)     │
  │      ████ DOWN ████     │               │ 62.72.3.35              │
  │                         │               │                         │
  │                         │               │ ┌─────┐ ┌──────┐       │
  │                         │               │ │ App │ │Worker│ Caddy  │
  │                         │               │ └──┬──┘ └──┬───┘       │
  │                         │               │    │       │            │
  │                         │               │ ┌──┴───────┴──┐        │
  │                         │               │ │ Promoted DB │        │
  │                         │               │ │ Port 5433   │        │
  │                         │               │ │ Read-Write  │        │
  │                         │               │ └─────────────┘        │
  └─────────────────────────┘               └─────────────────────────┘
```

## Failure Scenarios

### Scenario 1: Boston App VPS Down (DB still up)

**Impact:** Production app is down. Database is fine. Test still running.

**Recovery:** Re-deploy production on Boston VPS or use the Phoenix failover script.

**Preferred action:** SSH to Boston App VPS via Hostinger VNC console, restart Docker containers. If the VPS itself is dead, Hostinger can restart it. If it's a longer outage, run the failover script.

### Scenario 2: Boston DB VPS Down (App VPS still up)

**Impact:** Both production and test apps lose database connectivity. Errors on all requests.

**Recovery:** Run failover script on Phoenix. Production app on Boston can be stopped (it's useless without DB).

### Scenario 3: Entire Boston Datacenter Down (BOTH VPSs)

**Impact:** Production app AND database both gone. This is the worst case.

**Recovery:** Run failover script on Phoenix. Full recovery in ~2 minutes.

### Scenario 4: Phoenix VPS Down

**Impact:** Test environment down. Read replica stops receiving WAL. No production impact.

**Recovery:** Restart Phoenix VPS via Hostinger. Replica will automatically reconnect and catch up on missed WAL segments (the replication slot retains the position).

### Scenario 5: Tailscale Network Down

**Impact:** Inter-VPS communication fails. If only Tailscale is down but VPSs are up, the app continues to serve traffic on the public interface. However, the Boston App VPS can't reach the Boston DB VPS (they communicate via Tailscale). SSH access is also blocked.

**Recovery:** Use Hostinger VNC console to access VPSs. Restart Tailscale: `systemctl restart tailscaled`. If Tailscale is down globally, temporarily re-enable public SSH and update `pg_hba.conf` to allow the app VPS's public IP.

---

## Automated Failover Procedure

### Quick Reference

```bash
# From any machine on the Tailscale network:
ssh root@100.109.71.112 /docker/dr-failover.sh
```

### What the Script Does

| Step | Action | Time |
|------|--------|------|
| Pre-flight | Verify on Phoenix, replica running, env file present | 2s |
| 1 | Confirm Boston is unreachable (ping test) | 10s |
| 2 | Stop test containers (free CPU/RAM) | 15s |
| 3 | Promote replica to primary (`pg_promote()`) | 5s |
| 4 | Create production Docker environment | 5s |
| 5 | Update Cloudflare DNS (3 A records → Phoenix IP) | 5s |
| 6 | Start production containers | 30s |
| 7 | Wait for health check + TLS cert provisioning | 60s |
| **Total** | | **~2 min** |

### Pre-Staged Files on Phoenix

These files must exist BEFORE a disaster. They are deployed during normal operations and should be refreshed whenever production credentials change.

| File | Purpose | Permissions |
|------|---------|-------------|
| `/docker/dr-failover.sh` | Automated failover script | `755` (executable) |
| `/docker/dr-failover-env` | Production .env with all credentials | `600` (root only) |
| `/docker/dr-failover-Caddyfile` | Production Caddy config | `644` |
| `/docker/divestreams-replica/` | Live streaming PostgreSQL replica | Running container |

### Safety Features

- **Location check:** Won't run unless executed on Phoenix VPS (verifies Tailscale IP)
- **Replica check:** Won't run if the replica container isn't running
- **False alarm protection:** If Boston is reachable, requires typing `FAILOVER` to confirm
- **Recovery point display:** Shows the last WAL replay timestamp so you know how much data (if any) is at risk
- **Non-fatal health check:** Doesn't abort if the app takes longer than expected to start

### Updating Pre-Staged Files

When production credentials change (password rotation, new Stripe keys, etc.), update the DR files:

```bash
# From your local machine:
# 1. Update /docker/dr-failover-env with new credentials
scp scripts/infra/dr-failover.sh root@100.109.71.112:/docker/dr-failover.sh
# 2. If Caddyfile changed:
scp Caddyfile root@100.109.71.112:/docker/dr-failover-Caddyfile
# 3. Update the env file (build from Vault values):
# ssh root@100.109.71.112 "vi /docker/dr-failover-env"
```

---

## Manual Failover Procedure

If the script is unavailable or you need more control:

### Step 1: Promote the Replica

```bash
ssh root@100.109.71.112

# Check last replicated position (your Recovery Point)
docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -c \
  "SELECT pg_last_xact_replay_timestamp();"

# Promote
docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -c \
  "SELECT pg_promote();"

# Verify promotion
docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -c \
  "SELECT pg_is_in_recovery();"
# Expected: f (false)
```

### Step 2: Stop Test Containers

```bash
cd /docker/divestreams-test
docker compose down
```

### Step 3: Create Production Environment

```bash
mkdir -p /docker/divestreams-prod-dr
cp /docker/dr-failover-env /docker/divestreams-prod-dr/.env
cp /docker/dr-failover-Caddyfile /docker/divestreams-prod-dr/Caddyfile

# Ensure DB_HOST points to local replica
grep DB_HOST /docker/divestreams-prod-dr/.env
# Should show: DB_HOST=100.109.71.112
# Should show: DB_PORT=5433
```

Copy the docker-compose from the repo or use the one embedded in the failover script.

### Step 4: Update DNS

```bash
CF_TOKEN="<cloudflare api token>"
ZONE="912605970a7d6bf122bf6b7430b2d2ea"

# divestreams.com → Phoenix
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/bcf40f7204385ff9edac4e3cdac67bed" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  --data '{"content":"62.72.3.35"}'

# *.divestreams.com → Phoenix
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/8cd2be60ca964d9056591dbc51d9436a" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  --data '{"content":"62.72.3.35"}'

# www.divestreams.com → Phoenix
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/cb60b0090858d5d78a139b3b7849c429" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  --data '{"content":"62.72.3.35"}'
```

### Step 5: Start Production

```bash
cd /docker/divestreams-prod-dr
docker compose up -d
```

### Step 6: Verify

```bash
# Internal health
curl http://localhost:3000/api/health

# External health (after DNS propagation)
curl https://divestreams.com/api/health
```

---

## Recovery After Boston is Restored

**CRITICAL: Do NOT simply restart the old Boston primary database.** After a failover, the Phoenix promoted replica is the source of truth. The old Boston primary has stale data and will diverge.

### Step 1: Verify Boston is Back

```bash
ping 100.104.105.34   # DB VPS
ping 100.112.155.18   # App VPS
```

### Step 2: Stop the Old Primary (if it auto-started)

```bash
ssh root@100.104.105.34
cd /docker/divestreams-db
docker compose down
```

### Step 3: Resync Boston DB from Phoenix

The Phoenix database (port 5433) is now the canonical primary. Take a fresh base backup from Phoenix and restore it to Boston:

```bash
# On Boston DB VPS:
ssh root@100.104.105.34

# Remove old data
rm -rf /docker/divestreams-db/data/*

# Base backup from Phoenix primary
docker run --rm \
  --network host \
  -v /docker/divestreams-db/data:/var/lib/postgresql/data \
  -e PGPASSWORD=<db_password> \
  postgres:16-alpine \
  pg_basebackup \
    -h 100.109.71.112 \
    -p 5433 \
    -U divestreams \
    -D /var/lib/postgresql/data \
    -X stream \
    -P

# Fix ownership
chown -R 70:70 /docker/divestreams-db/data
```

### Step 4: Reconfigure Boston as Primary

Remove the `standby.signal` file (if present) and start Boston DB as a standalone primary:

```bash
ssh root@100.104.105.34
rm -f /docker/divestreams-db/data/standby.signal
cd /docker/divestreams-db
docker compose up -d
```

### Step 5: Reconfigure Phoenix as Replica

Stop the DR production on Phoenix. Wipe the Phoenix replica data and re-establish streaming replication from Boston:

```bash
ssh root@100.109.71.112

# Stop DR production
cd /docker/divestreams-prod-dr && docker compose down

# Stop the promoted DB
cd /docker/divestreams-replica && docker compose down

# Wipe and re-sync from Boston primary
rm -rf /docker/divestreams-replica/data/*
docker run --rm \
  --network host \
  -v /docker/divestreams-replica/data:/var/lib/postgresql/data \
  -e PGPASSWORD=<replication_password> \
  postgres:16-alpine \
  pg_basebackup \
    -h 100.104.105.34 \
    -p 5432 \
    -U replicator \
    -D /var/lib/postgresql/data \
    -S phoenix_replica \
    -X stream \
    -P \
    -R

chown -R 70:70 /docker/divestreams-replica/data
cd /docker/divestreams-replica && docker compose up -d
```

### Step 6: Restore Normal Operations

1. **Revert DNS** — On your local machine:
   ```bash
   cd terraform
   # Ensure terraform.tfvars has prod_vps_ip = "76.13.28.28" (Boston)
   terraform apply
   ```

2. **Restart production on Boston:**
   ```bash
   ssh root@100.112.155.18
   cd /docker/divestreams-prod
   docker compose up -d
   ```

3. **Restart test on Phoenix:**
   ```bash
   ssh root@100.109.71.112
   cd /docker/divestreams-test
   docker compose up -d
   ```

4. **Verify replication is streaming:**
   ```bash
   ssh root@100.104.105.34
   docker exec divestreams-db psql -U divestreams -d divestreams -c \
     "SELECT client_addr, state FROM pg_stat_replication;"
   # Should show Phoenix IP with state = 'streaming'
   ```

---

## Monitoring & Alerting

### Replication Lag

Check replication lag from the primary:

```bash
ssh root@100.104.105.34
docker exec divestreams-db psql -U divestreams -d divestreams -c \
  "SELECT slot_name, active,
          pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes
   FROM pg_replication_slots
   WHERE slot_name = 'phoenix_replica';"
```

- `active = t` and `lag_bytes < 1048576` (1MB): Healthy
- `active = f`: Replica disconnected — investigate immediately
- `lag_bytes > 10485760` (10MB): High lag — check network or Phoenix load

### Health Endpoints

```bash
# Production
curl -s https://divestreams.com/api/health

# Test
curl -s https://test.divestreams.com/api/health
```

### Container Health

```bash
# All VPSs (via Tailscale)
for ip in 100.112.155.18 100.109.71.112 100.104.105.34; do
  echo "=== $ip ==="
  ssh root@$ip "docker ps --format '{{.Names}}: {{.Status}}'"
done
```

---

## Key Credentials & Access

All credentials are stored in HashiCorp Vault at `secret/divestreams/`.

| What | Vault Path |
|------|-----------|
| Production DB password | `secret/divestreams/prod` → `db_password` |
| Replication password | `secret/divestreams/db` → `replication_password` |
| Cloudflare API token | `secret/divestreams/cloudflare` → `api_token` |
| Full production env | `secret/divestreams/prod` (all keys) |
| Tailscale auth key | `secret/divestreams/tailscale` → `auth-key-reusable` |

### Emergency Access (if Tailscale is down)

Use **Hostinger VNC Console**:
1. Log in to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Navigate to the VPS
3. Open the VNC/Console
4. Temporarily re-enable public SSH: `iptables -D INPUT -p tcp --dport 22 -j DROP`
5. Fix Tailscale, then re-apply: `iptables -I INPUT -p tcp --dport 22 -j DROP`

---

## Resource Budget

### Normal Operation

| VPS | Role | CPU Used | RAM Used | Total Available |
|-----|------|----------|----------|-----------------|
| Boston (KVM 4) | Production App | ~4.5 | ~10GB | 4 CPU / 16GB |
| Phoenix (KVM 8) | Test App + Test DB + DR Replica | ~8.0 | ~17GB | 8 CPU / 32GB |
| Boston DB (KVM 4) | Production Database | ~3.0 | ~12GB | 4 CPU / 16GB |

### During Failover (Phoenix runs everything)

| Service | CPU | RAM |
|---------|-----|-----|
| Production App (x1) | 3.0 | 8192M |
| Worker | 0.5 | 512M |
| Zapier Worker | 0.25 | 256M |
| Redis | 0.5 | 1024M |
| Caddy | 0.25 | 256M |
| Promoted DB | 2.0 | 4096M |
| **Total** | **6.5** | **14.3GB** |
| **Available (KVM 8)** | **8.0** | **32GB** |
| **Headroom** | **1.5** | **17.7GB** |

---

## Testing the DR Plan

Perform a DR test quarterly by:

1. Stopping the Boston DB VPS (via Hostinger API or console)
2. Running the failover script on Phoenix
3. Verifying production works on Phoenix
4. Restoring Boston and re-establishing replication
5. Documenting any issues found

**Never test DR in production without a maintenance window.** Use a low-traffic period (e.g., Sunday 2-4 AM UTC).
