# Staging VPS SSH Key Setup

## Overview

The CI/CD pipeline needs SSH access to the staging VPS (76.13.28.28) to update environment variables before deployment.

## Setup Steps

### 1. Generate SSH Key Pair (if not already done)

On your local machine:

```bash
# Generate SSH key for CI/CD
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/staging_vps_deploy -N ""

# This creates:
# - ~/.ssh/staging_vps_deploy (private key - goes to GitHub Secrets)
# - ~/.ssh/staging_vps_deploy.pub (public key - goes to VPS)
```

### 2. Add Public Key to Staging VPS

```bash
# Copy public key to staging VPS
ssh-copy-id -i ~/.ssh/staging_vps_deploy.pub root@76.13.28.28

# Or manually:
ssh root@76.13.28.28
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Paste contents of staging_vps_deploy.pub into ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

### 3. Add Private Key to GitHub Secrets

```bash
# Copy private key contents
cat ~/.ssh/staging_vps_deploy

# Add to GitHub Secrets
gh secret set STAGING_VPS_SSH_KEY -R shooter51/divestreams-v2 < ~/.ssh/staging_vps_deploy

# Or via GitHub web UI:
# 1. Go to: https://github.com/shooter51/divestreams-v2/settings/secrets/actions
# 2. Click "New repository secret"
# 3. Name: STAGING_VPS_SSH_KEY
# 4. Value: (paste entire private key including header/footer)
# 5. Click "Add secret"
```

### 4. Test SSH Connection

```bash
# Test that SSH works
ssh -i ~/.ssh/staging_vps_deploy root@76.13.28.28 'echo "SSH connection successful"'

# Expected output: "SSH connection successful"
```

### 5. Verify Workflow

After adding the secret, push to staging to trigger deployment:

```bash
git push origin staging
```

Watch the workflow run:
- "Setup SSH key for staging VPS" should succeed
- "Update B2 configuration on staging VPS" should update .env file
- "Deploy to staging VPS" should pull new image and restart
- "Verify B2 storage configuration" should pass (no "B2 storage not configured" errors)

## Security Notes

- ✅ Private key stored encrypted in GitHub Secrets
- ✅ Key is single-purpose (only for staging VPS CI/CD access)
- ✅ Key is removed from runner after workflow completes
- ✅ SSH connection uses host key verification
- ⚠️ Key has root access to staging VPS - keep GitHub repo access restricted

## Troubleshooting

### Workflow fails with "Permission denied (publickey)"

**Cause:** Public key not added to VPS or wrong private key in secret

**Fix:**
1. SSH into VPS: `ssh root@76.13.28.28`
2. Check `~/.ssh/authorized_keys` contains the public key
3. Verify secret name is exactly `STAGING_VPS_SSH_KEY`

### Workflow fails with "Host key verification failed"

**Cause:** VPS host key not in known_hosts (shouldn't happen - workflow runs `ssh-keyscan`)

**Fix:** Check workflow step "Setup SSH key for staging VPS" completed successfully

### B2 configuration check still fails after deployment

**Cause:** .env file updated but containers not restarted, or B2 secrets not in GitHub

**Fix:**
1. Verify all 6 B2 secrets exist: `gh secret list -R shooter51/divestreams-v2 | grep B2`
2. SSH into VPS: `ssh root@76.13.28.28`
3. Check .env file: `grep B2 /docker/divestreams-staging/.env`
4. Manually restart: `cd /docker/divestreams-staging && docker compose down && docker compose up -d`

## Maintenance

**Rotating SSH Keys:**

If you need to rotate the SSH key:

1. Generate new key pair
2. Add new public key to VPS (don't remove old one yet)
3. Update GitHub Secret with new private key
4. Test workflow runs successfully
5. Remove old public key from VPS `authorized_keys`

## Alternative: Manual B2 Configuration

If you prefer not to automate this via CI/CD, you can manually configure B2 variables:

```bash
# SSH into staging VPS
ssh root@76.13.28.28

# Navigate to project
cd /docker/divestreams-staging

# Backup .env
cp .env .env.backup-$(date +%Y%m%d)

# Add B2 variables (get values from GitHub Secrets)
cat >> .env << 'EOF'

# B2 Storage Configuration
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=7052cb0a45260d5993cc0910
B2_KEY_ID=00002ba56d93c900000000007
B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
EOF

# Restart containers
docker compose down
docker compose up -d

# Verify
docker compose logs app | grep -i "b2\|storage"
```

---

**Status:** Pending SSH key setup
**Required Secret:** `STAGING_VPS_SSH_KEY`
**VPS:** 76.13.28.28 (VPS ID: 1271895)
**Date:** 2026-01-28
