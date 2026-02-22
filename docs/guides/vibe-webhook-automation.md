# Vibe Kanban Webhook Automation - Zero-Touch Workflow

## Overview

**Complete automation:** Just drag a task to "In Progress" in Vibe Kanban and everything happens automatically - no commands, no scripts, nothing manual.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Drag task to "In Progress" in Vibe Kanban                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (webhook triggered)
┌─────────────────────────────────────────────────────────────────┐
│ 2. Webhook Handler Receives Event                              │
│    ✅ Validates webhook signature                               │
│    ✅ Parses event data                                         │
│    ✅ Triggers workspace automation                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (runs vibe:auto script)
┌─────────────────────────────────────────────────────────────────┐
│ 3. Workspace Auto-Created                                       │
│    ✅ Feature branch created (vk/844e-defect-integrati)        │
│    ✅ Git hooks installed (auto-push)                          │
│    ✅ Workspace linked to issue                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Developer Makes Changes                                      │
│    ✅ Write code                                               │
│    ✅ git commit (auto-push via hook)                          │
│    ✅ CI/CD triggers automatically                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Auto-Deploy Through Environments                            │
│    ✅ develop → Dev VPS → "In Development"                     │
│    ✅ PR to staging → "In Review"                              │
│    ✅ staging → Test VPS → "QA Testing"                        │
│    ✅ main → Production → "Done"                               │
└─────────────────────────────────────────────────────────────────┘
```

**Result:** Zero manual steps from task creation to production deployment!

## Setup

### 1. Deploy Webhook Handler

The webhook handler is a lightweight Node.js server that listens for Vibe Kanban events.

**Option A: Local Development**
```bash
# Run locally for testing
npm run vibe:webhook

# With custom port
PORT=3001 npm run vibe:webhook
```

**Option B: Production Server (Recommended)**
```bash
# On your server (Ubuntu/Debian)
sudo ./deployment/setup-webhook-server.sh

# This installs as a systemd service:
# - Auto-starts on boot
# - Auto-restarts on failure
# - Logs to journalctl
```

### 2. Configure Environment Variables

Edit `/opt/divestreams-automation/.env` (or local `.env`):

```bash
# Server configuration
PORT=3000

# Security - IMPORTANT: Use a strong secret!
WEBHOOK_SECRET=your-super-secure-random-string-here

# Vibe Kanban API
VK_API_URL=https://api.vibe-kanban.com/v1
VK_API_TOKEN=your-vibe-kanban-api-token

# Git repository path
GIT_REPO_PATH=/path/to/divestreams-v2
```

### 3. Configure Vibe Kanban Webhook

In Vibe Kanban settings:

1. Navigate to **Project Settings → Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **URL:** `http://your-server:3000/webhook/vibe-kanban`
   - **Secret:** (same as `WEBHOOK_SECRET` in .env)
   - **Events:** Select `issue.status_changed`
   - **Active:** ✅ Enabled

4. Test webhook:
   - Drag a test task to "In Progress"
   - Check webhook handler logs: `journalctl -u vibe-webhook -f`

### 4. Expose Webhook Endpoint (Production)

**Option A: Nginx Reverse Proxy**
```nginx
# /etc/nginx/sites-available/vibe-webhook
server {
    listen 80;
    server_name webhook.yourdomain.com;

    location /webhook/vibe-kanban {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Option B: Caddy (Automatic HTTPS)**
```
webhook.yourdomain.com {
    reverse_proxy /webhook/vibe-kanban localhost:3000
}
```

**Option C: Cloudflare Tunnel (No port forwarding needed)**
```bash
cloudflared tunnel --url http://localhost:3000
```

## Webhook Event Format

The webhook handler expects events in this format:

```json
{
  "event_type": "issue.status_changed",
  "timestamp": "2026-02-16T20:00:00Z",
  "issue": {
    "id": "f45fc8e5-9d16-4ef8-aaf7-b3c87322fa8d",
    "title": "[DEFECT] Integration tests failing",
    "description": "..."
  },
  "previous_status": "Todo",
  "new_status": "In Progress",
  "workspace_id": "844ecd18-1bed-4fd1-9a8f-ec21fd458d3a",
  "project_id": "500e93c8-662d-4f9e-8745-ac4c259ead3c"
}
```

## Security

### Webhook Signature Verification

The webhook handler verifies requests using HMAC SHA-256:

```javascript
// Vibe Kanban signs webhooks with:
signature = 'sha256=' + hmac_sha256(body, WEBHOOK_SECRET)

// Sent in header:
X-Vibe-Signature: sha256=<hash>
```

**Important:** Always use a strong, random `WEBHOOK_SECRET` in production!

### Generate Secure Secret

```bash
# Generate a secure random secret
openssl rand -base64 32

# Or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Monitoring & Troubleshooting

### Check Service Status
```bash
# Service status
sudo systemctl status vibe-webhook

# View logs (follow mode)
sudo journalctl -u vibe-webhook -f

# View recent logs
sudo journalctl -u vibe-webhook -n 100

# Restart service
sudo systemctl restart vibe-webhook
```

### Common Issues

**Webhook not triggering automation:**
1. Check webhook handler logs: `journalctl -u vibe-webhook -f`
2. Verify webhook is configured in Vibe Kanban
3. Check webhook secret matches
4. Test webhook manually: `curl -X POST http://localhost:3000/webhook/vibe-kanban -d '...'`

**Automation script fails:**
1. Check git hooks installed: `ls -la /path/to/repo/.git/hooks/`
2. Verify npm dependencies: `npm install` in workspace
3. Check environment variables in .env
4. Run manually: `npm run vibe:auto -- --issue-id=<id>`

**Port already in use:**
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill <PID>

# Or change port in .env
PORT=3001
```

## Architecture

### Components

1. **Webhook Handler** (`scripts/vibe-webhook-handler.mjs`)
   - HTTP server listening on PORT
   - Receives webhooks from Vibe Kanban
   - Verifies signatures
   - Triggers automation

2. **Workspace Automation** (`scripts/vibe-auto-workspace.ts`)
   - Creates feature branch
   - Installs git hooks
   - Links workspace to issue
   - Called by webhook handler

3. **Git Hooks** (`scripts/post-commit-push.sh`)
   - Auto-push on commit
   - Triggers CI/CD
   - Installed during workspace setup

4. **CI/CD Pipeline** (`.github/workflows/vibe-sync.yml`)
   - Tests, builds, deploys
   - Updates Vibe status automatically
   - Triggered by git push

### Data Flow

```
Vibe Kanban → Webhook → Handler → vibe:auto → Git Hooks → CI/CD → Deployments
                ↓                                              ↓
          Signature                                      Status Updates
          Verification                                   Back to Vibe
```

## Testing

### Test Locally

```bash
# 1. Start webhook handler
npm run vibe:webhook

# 2. In another terminal, send test webhook
curl -X POST http://localhost:3000/webhook/vibe-kanban \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "issue.status_changed",
    "issue": {
      "id": "f45fc8e5-9d16-4ef8-aaf7-b3c87322fa8d",
      "title": "Test Issue"
    },
    "previous_status": "Todo",
    "new_status": "In Progress",
    "workspace_id": "test-workspace",
    "project_id": "test-project"
  }'

# 3. Check logs for automation trigger
```

### Test Production Webhook

```bash
# Send test event from Vibe Kanban UI
# Or use curl with production URL:
curl -X POST https://webhook.yourdomain.com/webhook/vibe-kanban \
  -H "Content-Type: application/json" \
  -H "X-Vibe-Signature: sha256=<valid-signature>" \
  -d '{ ... }'
```

## Performance

- **Webhook Response Time:** < 50ms (webhook acknowledged immediately)
- **Automation Setup Time:** 2-5 seconds (branch creation, hook installation)
- **Memory Usage:** ~50MB per instance
- **CPU Usage:** Minimal (idle most of the time)

## Scaling

For high-volume setups:

1. **Multiple Webhook Handlers:** Run multiple instances behind load balancer
2. **Queue System:** Add Redis queue for async processing
3. **Worker Pool:** Process automations in parallel

```bash
# Run multiple instances
PORT=3000 npm run vibe:webhook &
PORT=3001 npm run vibe:webhook &
PORT=3002 npm run vibe:webhook &

# Then load balance with Nginx/HAProxy
```

## Deployment Checklist

- [ ] Webhook handler deployed and running
- [ ] Environment variables configured
- [ ] Webhook secret generated (strong, random)
- [ ] Vibe Kanban webhook configured
- [ ] Webhook URL accessible from Vibe Kanban
- [ ] Signature verification enabled
- [ ] Git repository accessible
- [ ] npm dependencies installed
- [ ] Systemd service enabled (auto-start on boot)
- [ ] Logs monitored (journalctl setup)
- [ ] Test webhook sent successfully
- [ ] Automation triggered on test task

## Benefits

✅ **Zero manual commands** - just drag and drop in Vibe Kanban
✅ **Instant automation** - workspace created in seconds
✅ **Secure** - HMAC signature verification
✅ **Reliable** - systemd auto-restart on failure
✅ **Scalable** - can handle multiple simultaneous webhooks
✅ **Monitored** - full logging via journalctl
✅ **Fast** - webhook acknowledged immediately, automation runs async

## Files

| File | Purpose |
|------|---------|
| `scripts/vibe-webhook-handler.mjs` | Webhook HTTP server |
| `deployment/vibe-webhook.service` | systemd service definition |
| `deployment/setup-webhook-server.sh` | Automated deployment script |
| `scripts/vibe-auto-workspace.ts` | Workspace automation (called by webhook) |
| `.env` | Configuration (webhook secret, API tokens) |

---

🎉 **You now have the ultimate zero-touch automation!** Just drag tasks to "In Progress" and everything happens automatically all the way to production!
