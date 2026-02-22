# DiveStreams - Claude Code Configuration

## Project Overview

Multi-tenant dive shop management SaaS application built with Next.js 16, deployed via PM2 standalone server on the Hostinger VPS.

## VPS Deployment Info

| Property | Value |
|----------|-------|
| **Server** | srv1239852.hstgr.cloud (72.62.166.128) |
| **Tailscale IP** | 100.76.7.28 |
| **Location** | `/var/www/divestreams.com` |
| **Port** | 3001 (PM2 standalone server) |
| **Database** | Neon PostgreSQL (cloud) |
| **Process Manager** | PM2 |

## Domains

| Domain | Tenant |
|--------|--------|
| divestreams.com | default |
| elite.divestreams.com | elite |
| demo.divestreams.com | demo |
| zotz.divestreams.com | zotz |

Tenants are identified via `X-Tenant-Subdomain` header set by Caddy.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack)
- **Database**: Neon PostgreSQL (cloud)
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS + shadcn/ui
- **Payments**: Stripe
- **Offline Sync**: PowerSync (not yet configured)

## Deployment Commands

```bash
# SSH to server
ssh root@72.62.166.128

# Navigate to project
cd /var/www/divestreams.com

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build Next.js standalone
npm run build

# Restart PM2 process
pm2 restart divestreams

# View logs
pm2 logs divestreams

# If PM2 process doesn't exist, start it:
PORT=3001 pm2 start .next/standalone/server.js --name divestreams
pm2 save
```

## Backup Configuration

Backups run daily at 3 AM UTC to the Synology NAS via Tailscale.

| Property | Value |
|----------|-------|
| **NAS IP** | 100.104.114.79 (Tailscale) |
| **NAS User** | tom |
| **Backup Path** | /volume1/NetBackup/vps-divestreams |
| **Script** | /usr/local/bin/backup-divestreams.sh |
| **Log** | /var/log/divestreams-backup.log |
| **Retention** | 7 days |

### Manual Backup
```bash
# Run backup manually
/usr/local/bin/backup-divestreams.sh

# Check backup log
tail -50 /var/log/divestreams-backup.log

# List backups on NAS
ssh tom@100.104.114.79 'ls -lah /volume1/NetBackup/vps-divestreams/'
```

### Backup Contents
- Application files (excluding node_modules)
- Caddy configuration
- PM2 configuration
- Service status snapshot

Note: Database is hosted on Neon (cloud) with its own backup system.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Environment Variables

Required in `.env`:
```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Auth
AUTH_SECRET=<secret>
AUTH_URL=https://divestreams.com

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://divestreams.com
NODE_ENV=production
```

## Service Management

```bash
# PM2 commands
pm2 list                    # List all processes
pm2 logs divestreams        # View logs
pm2 restart divestreams     # Restart app
pm2 stop divestreams        # Stop app
pm2 delete divestreams      # Remove from PM2

# Start fresh
PORT=3001 pm2 start .next/standalone/server.js --name divestreams
pm2 save && pm2 startup     # Save and enable on boot

# Caddy
sudo systemctl status caddy
sudo systemctl reload caddy
```

## Troubleshooting

### App Won't Start
```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs divestreams --lines 100

# Check if port is in use
ss -tlnp | grep 3001

# Restart app
pm2 restart divestreams
```

### 502 Bad Gateway
```bash
# Check if app is running
pm2 list

# Check Caddy config
cat /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy
```

### Build Issues
```bash
# Check for TypeScript errors
npm run typecheck

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## File Structure

```
/var/www/divestreams.com/
├── src/
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/
│   │   ├── db/        # Drizzle schema & queries
│   │   └── auth/      # NextAuth configuration
│   └── styles/        # Global styles
├── drizzle/           # Database migrations
├── .next/
│   └── standalone/    # Standalone server output
├── .env
└── package.json
```

## Notes

- App runs via PM2 standalone server (NOT Docker)
- Database hosted on Neon PostgreSQL (cloud)
- Caddy handles SSL automatically via Let's Encrypt
- Multi-tenant routing uses X-Tenant-Subdomain header
- Backups go to Synology NAS via Tailscale VPN
- PowerSync offline sync is not yet configured
