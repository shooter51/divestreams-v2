# Dev VPS B2 Setup - Quick Commands

## ⚡ 5-Minute Setup (Copy & Paste)

SSH into the dev VPS and run these commands:

```bash
# Connect to dev VPS
ssh root@62.72.3.35

# Navigate to project
cd /docker/divestreams-dev

# Backup current .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Add B2 configuration (copy entire block)
cat >> .env << 'EOF'

# B2 Storage Configuration (DiveStreamsDev bucket) - Added 2026-01-28
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=7052cb0a45260d5993cc0910
B2_KEY_ID=00002ba56d93c900000000007
B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
EOF

# Verify configuration
echo ""
echo "=== B2 Configuration ==="
grep -E "(B2_|CDN_)" .env
echo ""

# Restart containers
echo "Restarting containers..."
docker compose down
docker compose up -d

# Wait for startup
sleep 15

# Check status
echo ""
echo "=== Container Status ==="
docker compose ps
echo ""

# Test logs
echo "=== Recent App Logs ==="
docker compose logs app | tail -20
```

## ✅ Expected Result

All containers should show status: **Up**

```
NAME                     STATUS
divestreams-app          Up 15 seconds
divestreams-db           Up 15 seconds (healthy)
divestreams-redis        Up 15 seconds (healthy)
divestreams-caddy        Up 15 seconds
divestreams-worker       Up 15 seconds
```

## 🧪 Test Image Upload

1. Visit dev environment: http://62.72.3.35
2. Login to admin panel
3. Go to Tours → Create/Edit Tour
4. Try uploading an image
5. Should work without 500 error ✅

## 🔍 Troubleshooting

**If containers won't start:**
```bash
docker compose logs app | grep -i error
```

**If uploads still fail:**
```bash
# Check environment variables are loaded
docker compose exec app env | grep B2

# Should show:
# B2_ENDPOINT=s3.us-west-000.backblazeb2.com
# B2_REGION=us-west-000
# B2_BUCKET=7052cb0a45260d5993cc0910
# B2_KEY_ID=00002ba56d93c900000000007
# B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
# CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
```

---

**Time Required:** ~5 minutes
**Issues Fixed:** KAN-603, KAN-605 (image upload errors)
