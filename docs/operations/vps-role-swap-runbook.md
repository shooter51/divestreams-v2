# VPS Role Swap Runbook: Phoenix <-> Boston

> **Purpose**: Swap production and test VPS roles so production runs on the Boston VPS (close to the DB VPS) to reduce query latency.
>
> **Date Created**: 2026-03-15
>
> **Estimated Downtime**: 5-15 minutes for production, depending on DNS propagation

---

## Background

The Database VPS is in Boston. The Production VPS is in Phoenix, causing high-latency DB queries. The Test VPS is in Boston (same datacenter as DB). Swapping roles puts production next to the database.

### Current State

| VPS | Current Role | VPS ID | Public IP | Tailscale IP | Location | Specs |
|-----|-------------|--------|-----------|-------------|----------|-------|
| Phoenix | **Production** | 1296511 | 62.72.3.35 | 100.109.71.112 | Phoenix | KVM 8 (8 CPU, 32GB RAM, 400GB SSD) |
| Boston-App | **Test** | 1271895 | 76.13.28.28 | 100.112.155.18 | Boston | KVM 4 (4 CPU, 16GB RAM, 200GB SSD) |
| Boston-DB | Database | 1239852 | 72.62.166.128 | 100.104.105.34 | Boston | KVM 4 (4 CPU, 16GB RAM, 200GB SSD) |

### Target State

| VPS | New Role | VPS ID | Public IP | Tailscale IP | Location | Specs |
|-----|----------|--------|-----------|-------------|----------|-------|
| Boston-App | **Production** | 1271895 | 76.13.28.28 | 100.112.155.18 | Boston | KVM 4 |
| Phoenix | **Test** | 1296511 | 62.72.3.35 | 100.109.71.112 | Phoenix | KVM 8 |
| Boston-DB | Database | 1239852 | 72.62.166.128 | 100.104.105.34 | Boston | KVM 4 |

### Important Consideration: Resource Asymmetry

Production will move from KVM 8 (8 CPU, 32GB RAM) to KVM 4 (4 CPU, 16GB RAM). This is an accepted tradeoff -- the latency reduction from Boston-to-Boston DB access outweighs the resource reduction. However, the docker-compose resource limits must be adjusted:

**Current `docker-compose.prod.yml` limits (designed for KVM 8):**
- app: 2 replicas, 3.0 CPU / 8192MB each
- worker: 1.0 CPU / 1024MB
- redis: 0.5 CPU / 2048MB (maxmemory 1536mb)
- alloy: 0.5 CPU / 384MB
- Total: ~8.5 CPU / ~20GB RAM -- exceeds KVM 4 capacity

**Must reduce to fit KVM 4 (4 CPU, 16GB RAM):**
- app: 1 replica (not 2), 3.0 CPU / 8192MB
- worker: 0.5 CPU / 512MB
- redis: 0.5 CPU / 1024MB (maxmemory 768mb)
- alloy: 0.5 CPU / 384MB
- Total: ~4.5 CPU / ~10GB RAM

---

## Pre-Flight Checks

Run all of these before starting the swap.

### 1. Verify both VPSs are healthy

```bash
# Production (Phoenix) -- current prod (Phoenix via Tailscale)
ssh root@100.109.71.112 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Test (Boston) -- current test (Boston App via Tailscale)
ssh root@100.112.155.18 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Database (Boston DB via Tailscale)
ssh root@100.104.105.34 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

### 2. Verify both apps are serving traffic

```bash
curl -s -o /dev/null -w '%{http_code}' https://divestreams.com/api/health
# Expected: 200

curl -s -o /dev/null -w '%{http_code}' https://test.divestreams.com/api/health
# Expected: 200
```

### 3. Check no active CI/CD deployments

```bash
gh run list --limit 5
# Ensure no runs are in-progress or queued
```

### 4. Confirm both VPSs have GHCR auth

```bash
# Phoenix via Tailscale
ssh root@100.109.71.112 "docker pull ghcr.io/shooter51/divestreams-app:latest --quiet && echo OK"
# Boston App via Tailscale
ssh root@100.112.155.18 "docker pull ghcr.io/shooter51/divestreams-app:test --quiet && echo OK"
```

### 5. Back up production database

```bash
./scripts/infra/backup-db.sh
```

### 6. Note current DNS TTLs

The Cloudflare DNS records have these TTLs (from `terraform/cloudflare.tf`):
- `divestreams.com` (A record, proxied): TTL=Auto (effectively ~300s via Cloudflare proxy)
- `*.divestreams.com` (A record, NOT proxied): TTL=300s
- `test.divestreams.com` (A record, proxied): TTL=Auto
- `*.test.divestreams.com` (A record, NOT proxied): TTL=300s

Wildcard records are NOT proxied through Cloudflare (free plan limitation), so they respect the 300s TTL directly. Plan for 5 minutes of DNS propagation for wildcard subdomains.

### 7. Freeze deployments

Pause the auto-promotion pipeline and block any merges to `test` or `main` during the swap:
- Set branch protection on `develop` to require 1 approval (temporarily blocks auto-merge)
- Or simply communicate to the team: no merges during the maintenance window

---

## Step-by-Step Procedure

### Phase 1: Prepare the Boston VPS for Production Role

#### 1.1 SSH into Boston VPS (currently test) and stop test containers

```bash
ssh root@100.112.155.18  # Boston App via Tailscale
cd /docker/divestreams-test
docker compose down
```

#### 1.2 Create production Docker project directory

```bash
# On Boston VPS (76.13.28.28)
mkdir -p /docker/divestreams-prod
```

#### 1.3 Copy the production .env file from Phoenix to Boston

```bash
# From your local machine:
scp root@100.109.71.112:/docker/divestreams-prod/.env /tmp/prod-env-backup

# Review and copy to Boston VPS:
scp /tmp/prod-env-backup root@100.112.155.18:/docker/divestreams-prod/.env

# IMPORTANT: Verify DB_HOST in the .env points to the DB VPS Tailscale IP
# Boston App via Tailscale
ssh root@100.112.155.18 "grep DB_HOST /docker/divestreams-prod/.env"
# Should show: DB_HOST=100.104.105.34 (DB VPS Tailscale IP)
```

#### 1.4 Update production .env on Boston: verify AUTH_URL, APP_URL, and CLOUDFLARE_API_TOKEN

```bash
ssh root@100.112.155.18  # Boston App via Tailscale
# These should already be correct since they reference the domain, not the IP:
grep -E 'AUTH_URL|APP_URL' /docker/divestreams-prod/.env
# Should show: AUTH_URL=https://divestreams.com
# Should show: APP_URL=https://divestreams.com

# IMPORTANT: Caddy needs CLOUDFLARE_API_TOKEN for DNS-01 wildcard cert provisioning.
# Verify it exists in the prod .env:
grep CLOUDFLARE_API_TOKEN /docker/divestreams-prod/.env
# If missing, copy from the test .env or retrieve from Vault:
#   vault kv get -field=cloudflare_api_token secret/divestreams/caddy
```

#### 1.5 Copy docker-compose.prod.yml and Caddyfile to Boston

```bash
# From your local machine (repo root):
scp docker-compose.prod.yml root@100.112.155.18:/docker/divestreams-prod/docker-compose.yml
scp Caddyfile root@100.112.155.18:/docker/divestreams-prod/Caddyfile
```

#### 1.6 Adjust resource limits for KVM 4

On the Boston VPS, edit the docker-compose.yml to reduce resource limits:

```bash
ssh root@100.112.155.18  # Boston App via Tailscale
vi /docker/divestreams-prod/docker-compose.yml
```

Changes needed in docker-compose.yml on Boston:
- `app` service: change `replicas: 2` to `replicas: 1`
- `worker` service: change cpus `1.0` to `0.5`, memory `1024M` to `512M`
- `redis` service: change memory `2048M` to `1024M`, change `--maxmemory 1536mb` to `--maxmemory 768mb`

#### 1.7 Copy Alloy config

```bash
# Boston App via Tailscale
ssh root@100.112.155.18 "mkdir -p /docker/divestreams-prod/config/alloy"

# From local machine:
scp config/alloy/config.alloy root@100.112.155.18:/docker/divestreams-prod/config/alloy/config.alloy
```

#### 1.8 Pull production image on Boston VPS

```bash
# Boston App via Tailscale
ssh root@100.112.155.18 "docker pull ghcr.io/shooter51/divestreams-app:latest"
```

---

### Phase 2: Prepare the Phoenix VPS for Test Role

#### 2.1 Copy the test .env file from Boston to Phoenix

```bash
# From local machine:
scp root@100.112.155.18:/docker/divestreams-test/.env /tmp/test-env-backup
scp /tmp/test-env-backup root@100.109.71.112:/docker/divestreams-test/.env

# If divestreams-test directory doesn't exist on Phoenix:
# Phoenix via Tailscale
ssh root@100.109.71.112 "mkdir -p /docker/divestreams-test"
scp /tmp/test-env-backup root@100.109.71.112:/docker/divestreams-test/.env
```

#### 2.2 Verify test .env has correct values

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
grep -E 'AUTH_URL|APP_URL|DB_HOST' /docker/divestreams-test/.env
# AUTH_URL=https://test.divestreams.com
# APP_URL=https://test.divestreams.com
# DB_HOST=100.104.105.34 (DB VPS Tailscale IP -- still correct)
```

Note: The Phoenix VPS will now have higher latency to the DB for test queries. This is acceptable for a test environment.

#### 2.3 Copy docker-compose.test.yml and Caddyfile.test to Phoenix

```bash
# From local machine:
scp docker-compose.test.yml root@100.109.71.112:/docker/divestreams-test/docker-compose.yml
scp Caddyfile.test root@100.109.71.112:/docker/divestreams-test/Caddyfile.test
```

#### 2.4 Copy Alloy config to Phoenix test directory

```bash
# Phoenix via Tailscale
ssh root@100.109.71.112 "mkdir -p /docker/divestreams-test/config/alloy"
scp config/alloy/config.alloy root@100.109.71.112:/docker/divestreams-test/config/alloy/config.alloy
```

#### 2.5 Pull test image on Phoenix VPS

```bash
# Phoenix via Tailscale
ssh root@100.109.71.112 "docker pull ghcr.io/shooter51/divestreams-app:test"
```

---

### Phase 3: DNS Cutover (The Critical Moment)

This is the point of no return. Production will be briefly unavailable.

#### 3.1 Stop production on Phoenix VPS

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
cd /docker/divestreams-prod
docker compose down
```

**Production is now DOWN.**

#### 3.2 Start production on Boston VPS

```bash
ssh root@100.112.155.18  # Boston App via Tailscale
cd /docker/divestreams-prod
docker compose up -d
```

#### 3.3 Wait for containers and verify health

```bash
# Boston App via Tailscale
ssh root@100.112.155.18 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
# Wait for all containers to show "healthy"

# Test health endpoint directly via IP (bypassing DNS):
curl -s -o /dev/null -w '%{http_code}' --resolve divestreams.com:443:76.13.28.28 https://divestreams.com/api/health
# Expected: 200
```

#### 3.4 Update Cloudflare DNS via Terraform

Edit `terraform/terraform.tfvars` -- swap the IP values:

```hcl
# BEFORE:
prod_vps_ip = "62.72.3.35"   # Phoenix
test_vps_ip = "76.13.28.28"  # Boston

# AFTER:
prod_vps_ip = "76.13.28.28"  # Boston (now production)
test_vps_ip = "62.72.3.35"   # Phoenix (now test)
```

Also swap the VPS IDs:

```hcl
# BEFORE:
prod_vps_id = "1296511"  # Phoenix
test_vps_id = "1271895"  # Boston

# AFTER:
prod_vps_id = "1271895"  # Boston (now production)
test_vps_id = "1296511"  # Phoenix (now test)
```

Also swap the Tailscale IPs:

```hcl
# BEFORE:
prod_vps_tailscale_ip = "100.109.71.112"  # Phoenix
test_vps_tailscale_ip = "100.112.155.18"  # Boston

# AFTER:
prod_vps_tailscale_ip = "100.112.155.18"  # Boston (now production)
test_vps_tailscale_ip = "100.109.71.112"  # Phoenix (now test)
```

Apply the Terraform changes:

```bash
cd terraform
terraform plan    # Review -- should show DNS record updates + GitHub env var updates
terraform apply   # Apply DNS + GitHub environment variable changes
```

This single `terraform apply` updates:
- **Cloudflare DNS**: `divestreams.com` A record -> 76.13.28.28, `*.divestreams.com` -> 76.13.28.28, `test.divestreams.com` -> 62.72.3.35, `*.test.divestreams.com` -> 62.72.3.35
- **GitHub environment variables**: `PROD_VPS_IP`, `PROD_VPS_ID`, `TEST_VPS_IP`, `TEST_VPS_ID` in both `test` and `production` environments

#### 3.5 Wait for DNS propagation

```bash
# Check DNS resolution (may take up to 5 minutes for wildcard records)
dig +short divestreams.com
# Expected: Cloudflare proxy IPs (since it's proxied)

dig +short demo.divestreams.com
# Expected: 76.13.28.28 (direct A record, not proxied)

dig +short test.divestreams.com
# Expected: Cloudflare proxy IPs

dig +short demo.test.divestreams.com
# Expected: 62.72.3.35
```

#### 3.6 Verify production is serving via DNS

```bash
curl -s -o /dev/null -w '%{http_code}' https://divestreams.com/api/health
# Expected: 200

curl -s -o /dev/null -w '%{http_code}' https://demo.divestreams.com/api/health
# Expected: 200
```

**Production is now UP on the Boston VPS.**

---

### Phase 4: Start Test Environment on Phoenix VPS

#### 4.1 Start test containers on Phoenix

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
cd /docker/divestreams-test
docker compose up -d
```

#### 4.2 Verify test environment

```bash
curl -s -o /dev/null -w '%{http_code}' https://test.divestreams.com/api/health
# Expected: 200
```

---

### Phase 5: Clean Up Old Docker Projects

> **Wait at least 48 hours** after the swap is verified before cleaning up old projects. During the verification period, keep the old project directories as a rollback safety net.

#### 5.1 Remove old production project from Phoenix VPS

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
cd /docker/divestreams-prod
docker compose down --volumes --remove-orphans 2>/dev/null || true
# Optionally remove the directory (keep .env as backup):
cp /docker/divestreams-prod/.env /root/prod-env-backup-pre-swap
rm -rf /docker/divestreams-prod
```

#### 5.2 Remove old test project from Boston VPS

```bash
ssh root@100.112.155.18  # Boston App via Tailscale
cd /docker/divestreams-test
docker compose down --volumes --remove-orphans 2>/dev/null || true
cp /docker/divestreams-test/.env /root/test-env-backup-pre-swap
rm -rf /docker/divestreams-test
```

#### 5.3 Clean up unused Docker images

```bash
# On both VPSs:
# Phoenix via Tailscale
ssh root@100.109.71.112 "docker system prune -af"
# Boston App via Tailscale
ssh root@100.112.155.18 "docker system prune -af"
```

---

### Phase 6: Update Tailscale Hostnames

```bash
# On Boston VPS (now production) -- Boston App via Tailscale
ssh root@100.112.155.18 "tailscale set --hostname=ds-prod"

# On Phoenix VPS (now test) -- Phoenix via Tailscale
ssh root@100.109.71.112 "tailscale set --hostname=ds-test"
```

---

### Phase 7: Update Stripe Webhooks

Stripe webhooks are configured to send to specific URLs. Since the URLs (`divestreams.com` and `test.divestreams.com`) stay the same and DNS now points to the correct VPSs, no Stripe changes are needed. However, verify:

- The production Stripe webhook endpoint (`https://divestreams.com/api/stripe-webhook`) is using **live** Stripe keys (from the prod .env)
- The test Stripe webhook endpoint (`https://test.divestreams.com/api/stripe-webhook`) is using **test** Stripe keys (from the test .env)

The webhook signing secrets (`STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_THIN`) are tied to the endpoint URL in Stripe's dashboard, not to the server IP. Since URLs are unchanged, the secrets remain valid.

---

### Phase 8: Update Code and Documentation

#### 8.1 Update CLAUDE.md

In the VPS Infrastructure table, swap the roles:

| VPS | Role | VPS ID | Public IP | Tailscale IP |
|-----|------|--------|-----------|--------------|
| **Production** | App | **1271895** | **76.13.28.28** | **100.112.155.18** |
| **Test** | App | **1296511** | **62.72.3.35** | **100.109.71.112** |
| **Database** | PostgreSQL | 1239852 | 72.62.166.128 | 100.104.105.34 |

Also update the "Check VPS Status" commands and any IP references.

#### 8.2 Update `scripts/infra/backup-db.sh`

The `PROD_VPS_IP` default on line 17 is hardcoded to `72.62.166.128` (the DB VPS). This script SSHs into the prod app VPS, not the DB VPS. Review and update:

```bash
# BEFORE:
PROD_VPS_IP="${PROD_VPS_IP:-72.62.166.128}"

# AFTER (use Tailscale IP since SSH is locked to Tailscale only):
PROD_VPS_IP="${PROD_VPS_IP:-100.112.155.18}"
```

Note: The script also references `divestreams-prod-app` container name. Verify this matches the new container names on the Boston VPS.

#### 8.3 Update MEMORY.md

Update the VPS Infrastructure table in `~/.claude/projects/-Users-tomgibson-divestreams-v2/memory/MEMORY.md` to reflect the new roles and IPs.

#### 8.4 Update CLAUDE.md SSH commands

The "Check VPS Status" section uses public IPs. Update to Tailscale IPs:

```bash
# BEFORE (lines ~403-409):
ssh root@62.72.3.35 "docker ps ..."
ssh root@76.13.28.28 "docker ps ..."
ssh root@72.62.166.128 "docker ps ..."

# AFTER:
ssh root@100.112.155.18 "docker ps ..."   # Production (Boston)
ssh root@100.109.71.112 "docker ps ..."   # Test (Phoenix)
ssh root@100.104.105.34 "docker ps ..."   # DB (Boston)
```

#### 8.5 Update README.md

Line 88 has a hardcoded SSH command to the DB VPS with its public IP. Update to Tailscale IP:

```bash
# BEFORE:
ssh root@72.62.166.128

# AFTER:
ssh root@100.104.105.34  # DB VPS via Tailscale
```

#### 8.6 Update `scripts/infra/nuke.sh`

Line 11 references the DB VPS public IP. Update the default:

```bash
# BEFORE:
PROD_VPS_IP (for backup, default: 72.62.166.128)

# AFTER:
PROD_VPS_IP (for backup, default: 100.112.155.18)
```

#### 8.7 Rotate production passwords

The VPS swap is the ideal time to rotate weak production passwords. New secure passwords have been generated and stored in Vault at `secret/divestreams/prod`.

**On the DB VPS — change PostgreSQL password:**
```bash
ssh root@100.104.105.34
docker exec -it divestreams-db psql -U divestreams -d divestreams -c \
  "ALTER USER divestreams PASSWORD '<new_db_password from Vault>';"
```

**In the new prod `.env` on Boston VPS — use ALL new passwords from Vault:**
- `DB_PASSWORD` → from `vault read secret/divestreams/prod` key `db_password`
- `REDIS_PASSWORD` → key `redis_password`
- `AUTH_SECRET` → key `auth_secret`
- `BETTER_AUTH_SECRET` → key `better_auth_secret`
- `ADMIN_PASSWORD` → key `admin_password`
- `PLATFORM_ADMIN_PASSWORD` → key `platform_admin_password`

**Warning:** Changing `AUTH_SECRET` and `BETTER_AUTH_SECRET` invalidates all existing sessions. All users will need to re-login after the swap. This is acceptable since the swap involves downtime anyway.

**Warning:** The DB password change on the DB VPS must happen BEFORE starting the new prod containers, otherwise they can't connect.

#### 8.8 Clean up legacy scripts (optional)

These scripts reference old IPs and are no longer used. They can be deleted or updated at leisure:

| Script | Issue | Action |
|--------|-------|--------|
| `scripts/deploy-pact-broker.sh` | Hardcoded Phoenix public IP — pact broker not deployed | Delete |
| `scripts/deploy-to-dev.sh` | References Phoenix public IP — dev VPS doesn't exist | Delete |
| `scripts/update-staging-vps-s3.sh` | References Boston public IP — staging replaced by test | Delete |
| `scripts/setup-runner-playwright-deps.sh` | Comment references Boston public IP | Update comment |

#### 8.9 Historical docs (no action required)

These files in `docs/` contain old IP references but are historical records, not operational:

- `docs/architecture/vps-infrastructure.md` — old single-VPS era
- `docs/architecture/vps-complete-reference.md` — pre-split reference
- `docs/historical/` — 8 files with old IPs (bug fix guides, infrastructure fix guides)
- `docs/integrations/` — 6 files (stripe, email, pact guides)
- `docs/features/` — 2 files (training seed data, subscription testing)

These do NOT need updating for the swap to succeed. They can be cleaned up later or left as historical artifacts.

#### 8.10 Commit documentation changes

After all updates, commit the changes on a feature branch and merge via normal PR process.

#### Audit verification summary

The repo audit confirmed:

| Category | Status |
|----------|--------|
| GitHub Actions workflows | CLEAN — fully parameterized, Tailscale SSH |
| Terraform | CLEAN — all IPs via variables |
| Docker Compose / Caddyfiles | CLEAN — no hardcoded IPs |
| Application code (`lib/`, `app/`, `server/`) | CLEAN — zero IP references |
| Config (`config/alloy/`) | CLEAN — uses env vars |
| `CLAUDE.md` | MUST UPDATE — VPS table + SSH commands |
| `scripts/infra/backup-db.sh` | MUST UPDATE — default IP |
| `README.md` | SHOULD UPDATE — SSH command |
| Legacy scripts (4 files) | OPTIONAL — delete or update |
| Historical docs (15+ files) | NO ACTION — reference material |

---

### Phase 8.5: SSH Hardening — Lock Down to Tailscale Only

All three VPSs should have SSH restricted to Tailscale IPs only. This was implemented on 2026-03-15.

#### Rules Applied (identical on all 3 VPSs)

```bash
iptables -I INPUT 1 -p tcp --dport 22 -s 100.64.0.0/10 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 22 -s 127.0.0.0/8 -j ACCEPT
iptables -I INPUT 3 -p tcp --dport 22 -j DROP
mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4
```

#### Verification

```bash
# Tailscale SSH should work:
ssh root@100.109.71.112 "echo OK"   # Prod
ssh root@100.112.155.18 "echo OK"   # Test
ssh root@100.104.105.34 "echo OK"   # DB

# Public SSH should timeout:
ssh -o ConnectTimeout=5 root@62.72.3.35 "echo FAIL"   # Should fail
ssh -o ConnectTimeout=5 root@76.13.28.28 "echo FAIL"   # Should fail
ssh -o ConnectTimeout=5 root@72.62.166.128 "echo FAIL" # Should fail
```

#### Emergency Access

If Tailscale is down and SSH is locked out, use **Hostinger VNC console** (web-based, bypasses network entirely) to:
1. Log in via console
2. Run `iptables -D INPUT -p tcp --dport 22 -j DROP` to temporarily re-open SSH
3. Fix Tailscale, then re-apply the DROP rule

#### CI/CD Impact

GitHub Actions deploy workflows use SSH to deploy to VPSs. With public SSH blocked, workflows must join the Tailscale network first. The deploy workflows (`deploy-test.yml`, `deploy-prod.yml`) use the `tailscale/github-action@v3` action with a reusable auth key (`TAILSCALE_AUTH_KEY` repo secret) before any SSH commands. All SSH targets use Tailscale IPs via `vars.TEST_VPS_TAILSCALE_IP`, `vars.PROD_VPS_TAILSCALE_IP`, and `vars.DB_VPS_TAILSCALE_IP`.

#### Ensuring iptables Rules Survive Reboot

The `iptables-save` command persists rules to `/etc/iptables/rules.v4`, but they will only auto-load on boot if `iptables-persistent` is installed:

```bash
# Install on all 3 VPSs (Debian/Ubuntu):
apt-get install -y iptables-persistent
# Rules in /etc/iptables/rules.v4 will be auto-loaded on boot
```

If already installed, verify with: `systemctl status netfilter-persistent`

#### Post-Swap Port Exposure Summary

| VPS | Public Ports | Tailscale-Only Ports | Public Ports |
|-----|-------------|---------------------|-------------|
| Prod App | :80 (redirect), :443 (HTTPS) | :22 (SSH) | 2 |
| Test App | :80 (redirect), :443 (HTTPS) | :22 (SSH) | 2 |
| Database | **none** | :22 (SSH), :5432 (PostgreSQL) | 0 |

The DB VPS has **zero public-facing ports**. It is only reachable via the Tailscale mesh network.

#### Read Replica Network Path

After the swap, the Phoenix VPS (test + DR) runs a PostgreSQL read replica that streams WAL from the Boston DB VPS. This traffic flows over Tailscale:

```
Boston DB VPS (100.104.105.34:5432)  ──Tailscale──▶  Phoenix VPS (replica container)
         Primary                                          Standby
```

The `primary_conninfo` in the replica's `postgresql.auto.conf` uses the Tailscale IP:
```
primary_conninfo = 'host=100.104.105.34 port=5432 user=replicator password=...'
```

The DB VPS `pg_hba.conf` already allows replication from the Phoenix Tailscale IP (`100.109.71.112/32`). No public network exposure is needed for replication.

---

## Rollback Plan

If production is broken on the Boston VPS and cannot be quickly fixed:

### Quick Rollback (< 5 minutes)

1. **Start production back on Phoenix:**
   ```bash
   ssh root@100.109.71.112  # Phoenix via Tailscale
   cd /docker/divestreams-prod
   docker compose up -d
   ```

2. **Revert DNS via Terraform:**
   ```bash
   cd terraform
   # Revert terraform.tfvars to original values
   terraform apply
   ```

3. **Stop broken production on Boston:**
   ```bash
   ssh root@100.112.155.18  # Boston App via Tailscale
   cd /docker/divestreams-prod
   docker compose down
   ```

### Prerequisites for Rollback

- Do NOT delete `/docker/divestreams-prod` on Phoenix until the swap is fully verified (Phase 5)
- Do NOT delete the `.env` backup files until at least 48 hours after the swap
- Keep the old terraform.tfvars values noted somewhere (or use git history)

---

## Post-Swap Verification Checklist

Run through this entire checklist before declaring the swap complete.

### Production (Boston VPS -- 76.13.28.28)

- [ ] `https://divestreams.com/api/health` returns 200
- [ ] `https://demo.divestreams.com/api/health` returns 200
- [ ] Can log in to production app at `https://divestreams.com`
- [ ] Can log in to a tenant subdomain (e.g., `https://demo.divestreams.com`)
- [ ] All containers running: `ssh root@100.112.155.18 "docker ps"` (Boston App via Tailscale)
- [ ] Production is using the `divestreams` database (NOT `divestreams_test`)
- [ ] Stripe webhooks are processing (check Stripe dashboard for recent successful deliveries)
- [ ] Email delivery working (trigger a test email if possible)

### Test (Phoenix VPS -- 62.72.3.35)

- [ ] `https://test.divestreams.com/api/health` returns 200
- [ ] `https://demo.test.divestreams.com/api/health` returns 200
- [ ] Can log in to test app
- [ ] All containers running: `ssh root@100.109.71.112 "docker ps"` (Phoenix via Tailscale)
- [ ] Test is using the `divestreams_test` database (NOT `divestreams`)

### DNS

- [ ] `dig +short divestreams.com` resolves (through Cloudflare proxy)
- [ ] `dig +short demo.divestreams.com` resolves to `76.13.28.28`
- [ ] `dig +short test.divestreams.com` resolves (through Cloudflare proxy)
- [ ] `dig +short demo.test.divestreams.com` resolves to `62.72.3.35`

### CI/CD Pipeline

- [ ] Push a trivial change to `develop` and verify the full pipeline:
  - ci.yml passes
  - promote.yml creates PR to test
  - deploy-test.yml deploys to Phoenix VPS (62.72.3.35)
- [ ] Verify `deploy-test.yml` SSHs to the correct IP (check GitHub Actions logs)
- [ ] Verify Hostinger API calls use the correct VPS IDs

### GitHub Environment Variables (via Terraform)

- [ ] `PROD_VPS_IP` = `76.13.28.28` in `production` environment
- [ ] `PROD_VPS_ID` = `1271895` in `production` environment
- [ ] `TEST_VPS_IP` = `62.72.3.35` in `test` environment
- [ ] `TEST_VPS_ID` = `1296511` in `test` environment
- [ ] `DB_VPS_IP` = unchanged in both environments

### Tailscale

- [ ] `tailscale status` on Boston VPS shows hostname `ds-prod`
- [ ] `tailscale status` on Phoenix VPS shows hostname `ds-test`

### SSH Access

- [ ] SSH via Tailscale works to all 3 VPSs
- [ ] SSH via public IP is blocked on all 3 VPSs

### Read Replica (after Phase 9)

- [ ] Read replica is streaming (`pg_stat_replication` shows `state = streaming` on primary)
- [ ] Replica lag < 1MB (`pg_replication_slots` shows small `lag_bytes`)

### Monitoring (Grafana)

- [ ] Grafana Cloud is receiving metrics from the new production Alloy instance
- [ ] Grafana Cloud is receiving traces from the new production app
- [ ] Verify OTEL_SERVICE_NAME labels are correct (`divestreams-app`, `divestreams-worker`)

### Latency Verification

```bash
# From Boston production VPS, measure DB latency (Boston App via Tailscale):
ssh root@100.112.155.18 "ping -c 5 100.104.105.34"
# Expected: < 1ms (same datacenter)

# From Phoenix test VPS, measure DB latency (Phoenix via Tailscale):
ssh root@100.109.71.112 "ping -c 5 100.104.105.34"
# Expected: 30-60ms (cross-country, acceptable for test)
```

### Resource Usage on New Production (KVM 4)

```bash
# Boston App via Tailscale
ssh root@100.112.155.18 "free -h && echo '---' && docker stats --no-stream"
# Verify memory usage is within KVM 4 limits (16GB total)
# Verify CPU usage is reasonable
```

---

## Files Changed Summary

This section lists every file and system that needs updating, for easy reference.

### Terraform (handles DNS + GitHub vars automatically)

| File | Change |
|------|--------|
| `terraform/terraform.tfvars` | Swap `prod_vps_ip`/`test_vps_ip` values, swap `prod_vps_id`/`test_vps_id` values |

Terraform apply propagates to:
- Cloudflare DNS records (5 records: root, wildcard_prod, test, wildcard_test, www)
- GitHub Actions environment variables (PROD_VPS_IP, PROD_VPS_ID, TEST_VPS_IP, TEST_VPS_ID, DB_VPS_IP in both envs)

### VPS On-Server Changes

| VPS | Change |
|-----|--------|
| Boston (76.13.28.28) | Create `/docker/divestreams-prod/`, copy prod .env, prod compose, prod Caddyfile, alloy config. Remove `/docker/divestreams-test/` after verification. |
| Phoenix (62.72.3.35) | Create `/docker/divestreams-test/`, copy test .env, test compose, test Caddyfile, alloy config. Remove `/docker/divestreams-prod/` after verification. |
| Both | Update Tailscale hostname |

### Docker Compose Adjustment (for KVM 4 production)

| Setting | KVM 8 Value | KVM 4 Value |
|---------|-------------|-------------|
| app replicas | 2 | 1 |
| worker CPU | 1.0 | 0.5 |
| worker memory | 1024M | 512M |
| redis memory | 2048M | 1024M |
| redis maxmemory | 1536mb | 768mb |

### Repository Documentation Updates

| File | Change |
|------|--------|
| `CLAUDE.md` | Update VPS table (roles, IPs, VPS IDs), update SSH commands, update "Check VPS Status" section |
| `scripts/infra/backup-db.sh` | Update default `PROD_VPS_IP` from `72.62.166.128` to `100.112.155.18` (Tailscale IP) |

### External Systems (No File Changes Needed)

| System | Why No Change |
|--------|--------------|
| Stripe webhooks | URL-based (`divestreams.com`), not IP-based. DNS handles routing. |
| Caddy/SSL certificates | Caddy auto-provisions certs. New VPSs will get fresh certs on first request. |
| GHCR Docker auth | Already authenticated on both VPSs (verified in pre-flight). |
| Database VPS | No changes. Both `divestreams` and `divestreams_test` DBs stay on the same server. |
| GitHub Actions workflows | No file changes. They use environment variables (`vars.PROD_VPS_IP`, etc.) which Terraform updates. |
| Cloudflare proxy settings | Terraform handles this. Proxied/unproxied settings stay the same. |
| Grafana Alloy config | Same `config/alloy/config.alloy` file on both VPSs. Environment names come from `OTEL_SERVICE_NAME` in docker-compose, which is the same regardless of VPS. |

---

## Timing Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Pre-flight checks | 10 min | 10 min |
| Phase 1: Prepare Boston for prod | 15 min | 25 min |
| Phase 2: Prepare Phoenix for test | 10 min | 35 min |
| Phase 3: DNS cutover | 5-10 min | 40-45 min |
| Phase 4: Start test on Phoenix | 5 min | 45-50 min |
| Phase 5: Clean up old projects | 5 min | 50-55 min |
| Phase 6: Tailscale hostnames | 2 min | 52-57 min |
| Phase 7: Stripe verification | 5 min | 57-62 min |
| Phase 8.5: SSH hardening | 10 min | 67-72 min |
| Phase 9: Read replica setup | 30 min | 97-102 min |
| Post-swap verification | 15 min | ~120 min |

**Total: ~120 minutes (including SSH hardening and replica setup), with ~5-10 minutes of production downtime (Phase 3 only).**

To minimize downtime, complete Phases 1-2 ahead of time (even hours before). The actual cutover (Phase 3) is the only part that causes downtime.

---

## Phase 9: Set Up PostgreSQL Read Replica on Phoenix (DR Site)

After the swap is verified and stable, set up a streaming read replica on the Phoenix VPS. This gives you a proper disaster recovery site:

- **Boston**: Production app + Primary DB (low latency)
- **Phoenix**: Test app + DB read replica (hot standby for DR)

If the Boston DB VPS goes down, you can promote the Phoenix replica and point the Phoenix test app at it to restore production.

### Architecture

```
Boston DB VPS (100.104.105.34)              Phoenix VPS (100.109.71.112)
┌──────────────────────────┐               ┌──────────────────────────┐
│  PostgreSQL 16 (Primary) │──WAL stream──▶│  PostgreSQL 16 (Replica) │
│  divestreams             │  Tailscale    │  Hot standby / read-only │
│  divestreams_test        │  encrypted    │  --network host          │
│  Port 5432               │               │  Port 5433               │
└──────────────────────────┘               │                          │
                                           │  Test App Containers     │
                                           │  Port 3000               │
                                           └──────────────────────────┘
```

**Important: Docker containers and Tailscale networking.** Docker containers on a bridge network cannot reach Tailscale IPs. The replica container must use `network_mode: host` so it can reach the primary DB via the host's Tailscale interface (`100.104.105.34`). Similarly, the `pg_basebackup` command must run with `--network host`.

### 9.1 Configure the Primary (Boston DB VPS)

SSH into the DB VPS and configure PostgreSQL for streaming replication:

```bash
ssh root@100.104.105.34  # Boston DB via Tailscale
```

#### Generate and store the replication password

Create a strong password and store it in Vault before proceeding. This password must be a real, secure value -- never use a placeholder in production.

```bash
# Generate a strong password
REPL_PASSWORD=$(openssl rand -base64 32)
echo "Replication password: $REPL_PASSWORD"

# Store in Vault at secret/divestreams/db key replication_password
vault kv put secret/divestreams/db replication_password="$REPL_PASSWORD"

# Verify it was stored
vault kv get -field=replication_password secret/divestreams/db
```

#### Create replication user

```bash
# Retrieve the password from Vault
REPL_PASSWORD=$(vault kv get -field=replication_password secret/divestreams/db)

docker exec -it divestreams-db psql -U divestreams -d divestreams -c \
  "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '$REPL_PASSWORD';"
```

#### Update `pg_hba.conf` to allow replication from Phoenix Tailscale IP

```bash
docker exec -it divestreams-db bash -c \
  'echo "host replication replicator 100.109.71.112/32 md5" >> /var/lib/postgresql/data/pg_hba.conf'
```

#### Update `postgresql.conf` for WAL streaming

```bash
docker exec -it divestreams-db bash -c 'cat >> /var/lib/postgresql/data/postgresql.conf << EOF

# Streaming Replication (Primary)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 1024   # Keep 1GB of WAL segments
max_replication_slots = 3
EOF'
```

#### Create a replication slot

```bash
docker exec -it divestreams-db psql -U divestreams -d divestreams -c \
  "SELECT pg_create_physical_replication_slot('phoenix_replica');"
```

#### Restart PostgreSQL to apply config

```bash
docker exec -it divestreams-db pg_ctl reload -D /var/lib/postgresql/data
# If reload isn't sufficient (wal_level change requires restart):
cd /docker/divestreams-db && docker compose restart postgres
```

### 9.2 Take a Base Backup for the Replica

From the Phoenix VPS, take a base backup of the primary:

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
mkdir -p /docker/divestreams-replica/data
```

```bash
# Run pg_basebackup with --network host so it can reach the primary via Tailscale
docker run --rm \
  --network host \
  -v /docker/divestreams-replica/data:/var/lib/postgresql/data \
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
# When prompted, enter the replication password
# --network host is required because Tailscale IPs are only reachable from the host network
```

The `-R` flag automatically creates `standby.signal` and configures `primary_conninfo` in `postgresql.auto.conf`.

### 9.3 Create docker-compose.replica.yml on Phoenix

```bash
cat > /docker/divestreams-replica/docker-compose.yml << 'EOF'
services:
  postgres-replica:
    image: postgres:16-alpine
    container_name: divestreams-replica
    restart: unless-stopped
    network_mode: host  # REQUIRED: must use host network to reach primary DB via Tailscale
    volumes:
      - /docker/divestreams-replica/data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: divestreams
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set}
      PGPORT: "5433"  # Listen on 5433 to avoid conflict with any local PostgreSQL
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U divestreams -p 5433"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4096M
EOF
```

Create the `.env` file:

```bash
cat > /docker/divestreams-replica/.env << 'EOF'
DB_PASSWORD=SAME_PASSWORD_AS_PRIMARY
EOF
```

### 9.4 Start the Replica

```bash
cd /docker/divestreams-replica
docker compose up -d
```

### 9.5 Lock Replica Port to Tailscale Only

The replica uses `network_mode: host`, so it listens directly on the host network (not behind Docker's network stack). Use the INPUT chain (not DOCKER-USER) to restrict access:

```bash
# On Phoenix VPS -- lock replica port 5433 to Tailscale only
ssh root@100.109.71.112
iptables -I INPUT -p tcp --dport 5433 -s 100.64.0.0/10 -j ACCEPT
iptables -I INPUT -p tcp --dport 5433 -s 127.0.0.0/8 -j ACCEPT
iptables -I INPUT -p tcp --dport 5433 -j DROP
iptables-save > /etc/iptables/rules.v4
```

Verify:
```bash
# From another Tailscale host, this should connect:
psql -h 100.109.71.112 -p 5433 -U divestreams -c "SELECT 1;"
# From a public IP, this should timeout/be refused
```

### 9.6 Verify Replication is Working

#### On the primary (Boston DB VPS):

```bash
docker exec -it divestreams-db psql -U divestreams -d divestreams -c \
  "SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn
   FROM pg_stat_replication;"
```

Expected output: One row showing the Phoenix Tailscale IP with `state = streaming`.

#### On the replica (Phoenix VPS):

```bash
docker exec -it divestreams-replica psql -U divestreams -d divestreams -c \
  "SELECT pg_is_in_recovery();"
# Expected: t (true — it's a standby)

docker exec -it divestreams-replica psql -U divestreams -d divestreams -c \
  "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(), pg_last_xact_replay_timestamp();"
```

#### Check replication lag:

```bash
# On primary:
docker exec -it divestreams-db psql -U divestreams -d divestreams -c \
  "SELECT slot_name, active,
          pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes
   FROM pg_replication_slots
   WHERE slot_name = 'phoenix_replica';"
# lag_bytes should be small (< 1MB in normal operation)
```

### 9.7 Add Replication Lag Monitoring to Grafana

Create a script on the DB VPS that exposes replica lag as a metric:

```bash
cat > /docker/divestreams-db/check-replica-lag.sh << 'SCRIPT'
#!/bin/bash
LAG=$(docker exec divestreams-db psql -U divestreams -d divestreams -t -c \
  "SELECT COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn), 0)
   FROM pg_replication_slots WHERE slot_name = 'phoenix_replica';" 2>/dev/null | tr -d ' ')
echo "replica_lag_bytes ${LAG:-0}"
SCRIPT
chmod +x /docker/divestreams-db/check-replica-lag.sh
```

Add a cron job to log the lag (Alloy will pick it up):

```bash
# Add to crontab on DB VPS:
*/5 * * * * /docker/divestreams-db/check-replica-lag.sh >> /var/log/replica-lag.log 2>&1
```

---

## Phase 10: DR Failover Procedure

If the Boston DB VPS becomes unavailable, follow this procedure to promote the Phoenix replica:

### 10.1 Confirm the Primary is Down

```bash
# From Phoenix VPS:
ping -c 3 100.104.105.34
# If unreachable, proceed with failover

# Check replica status:
docker exec -it divestreams-replica psql -U divestreams -d divestreams -c \
  "SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp();"
# Note the last replay timestamp — this is your Recovery Point
```

### 10.2 Promote the Replica to Primary

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
docker exec -it divestreams-replica psql -U divestreams -d divestreams -c \
  "SELECT pg_promote();"
# Wait a few seconds, then verify:
docker exec -it divestreams-replica psql -U divestreams -d divestreams -c \
  "SELECT pg_is_in_recovery();"
# Expected: f (false — it's now a primary)
```

### 10.3 Point the Test App at the Local Replica

Update the test app's `.env` to use the local replica instead of the Boston DB.

Since the replica runs with `network_mode: host` (listening on the host's port 5433), app containers on Docker bridge network must use the **host's Tailscale IP** (not `localhost`) to reach it:

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
cd /docker/divestreams-test

# Change DATABASE_URL to point to Phoenix's own Tailscale IP:5433 (the promoted replica)
# App containers on bridge network can reach the host via its Tailscale IP
sed -i 's|postgresql://divestreams:.*@100.104.105.34:5432/divestreams_test|postgresql://divestreams:DB_PASSWORD@100.109.71.112:5433/divestreams_test|' .env

# Restart app containers
docker compose down && docker compose up -d
```

**Why `100.109.71.112` instead of `localhost`?** The app containers run on Docker's bridge network. From inside a bridge container, `localhost` refers to the container itself, not the host. Using the host's Tailscale IP (`100.109.71.112`) routes traffic through Docker's network stack to the host where the replica listens on port 5433.

### 10.4 Update DNS to Point Production to Phoenix

Since the Boston production VPS may also be affected, point production DNS to Phoenix:

```bash
cd terraform
# Update terraform.tfvars:
# prod_vps_ip = "62.72.3.35"  # Phoenix (emergency)
terraform apply
```

Then start production containers on Phoenix pointing at the promoted replica:

```bash
ssh root@100.109.71.112  # Phoenix via Tailscale
cd /docker/divestreams-prod  # May need to recreate from backup

# Update DATABASE_URL to point to the promoted replica via Tailscale loopback
# Use Phoenix's own Tailscale IP so bridge-network containers can reach host port 5433
sed -i 's|postgresql://divestreams:.*@100.104.105.34:5432/divestreams|postgresql://divestreams:DB_PASSWORD@100.109.71.112:5433/divestreams|' .env

docker compose up -d
```

### 10.5 After Primary is Restored

Once the Boston DB VPS is back:

1. Stop the temporary production on Phoenix
2. Resync the Boston DB from the Phoenix primary (now the source of truth)
3. Reconfigure streaming replication (Boston = primary, Phoenix = replica again)
4. Revert DNS via Terraform
5. Restart normal operations

**Important:** After a failover, data written to the promoted replica is the canonical source. Do NOT simply restart the old primary — it will have stale data. You must rebuild replication from the new primary.

---

## Updated Resource Budget (Phoenix VPS After Swap — KVM 8)

With the test app AND the DB replica running on Phoenix:

| Service | CPU | Memory |
|---------|-----|--------|
| Test App (x1) | 3.0 | 8192M |
| Test Worker | 0.5 | 512M |
| Test Zapier Worker | 0.25 | 256M |
| Test Redis | 0.5 | 1024M |
| Test Caddy | 0.25 | 256M |
| Test Alloy | 0.5 | 384M |
| **Test DB** | **1.0** | **2048M** |
| **DR Replica** | **2.0** | **4096M** |
| **Total** | **8.0** | **16768M** |

This fits within KVM 8 (8 CPU, 32GB RAM) with RAM headroom for spikes. CPU is at capacity but burstable.
