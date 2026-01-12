# Nitrox API - Claude Code Configuration

## Project Overview

Simple REST API for tracking scuba tank oxygen content analysis. Used by dive shops to log nitrox fills and generate reports.

## VPS Deployment Info

| Property | Value |
|----------|-------|
| **Server** | srv1239852.hstgr.cloud (72.62.166.128) |
| **Location** | `/docker/nitrox-api` |
| **URL** | https://nitrox.divestreams.com |
| **Port** | 8080 (Docker maps 8080→3000) |
| **Database** | Docker PostgreSQL (nitrox-api-db-1) |

## Tech Stack

- **Runtime**: Node.js 20 (Alpine)
- **Framework**: Express.js
- **Database**: PostgreSQL 16 (Docker)
- **ORM**: pg (node-postgres)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/bottles` | List all bottle records |
| POST | `/bottles` | Create new bottle record |

### POST /bottles Request Body
```json
{
  "tank_id": "string",
  "o2": 32.5,
  "analyst": "string",
  "diver": "string",
  "mod": 33.8,
  "notes": "string",
  "sig": "base64-signature",
  "nfc": "nfc-tag-id"
}
```

## Docker Compose

Location: `/docker/nitrox-api/docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nitrox
      POSTGRES_PASSWORD: nitrox2026
      POSTGRES_DB: nitrox

  api:
    image: node:20-alpine
    environment:
      DATABASE_URL: postgresql://nitrox:nitrox2026@db:5432/nitrox
    ports:
      - "8080:3000"
```

## Deployment Commands

```bash
# SSH to server
ssh root@72.62.166.128

# Navigate to project
cd /docker/nitrox-api

# Restart services
docker compose restart

# View logs
docker compose logs -f

# Rebuild (if docker-compose.yml changed)
docker compose down && docker compose up -d
```

## Database Schema

```sql
CREATE TABLE bottles (
  id SERIAL PRIMARY KEY,
  tank_id VARCHAR(100) UNIQUE,
  o2 DECIMAL(5,2),
  analyst VARCHAR(255),
  diver VARCHAR(255),
  mod DECIMAL(6,2),
  notes TEXT,
  sig TEXT,
  nfc VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Database Access

```bash
# Connect to database
docker exec -it nitrox-api-db-1 psql -U nitrox -d nitrox

# View recent entries
docker exec -it nitrox-api-db-1 psql -U nitrox -d nitrox -c "SELECT * FROM bottles ORDER BY created_at DESC LIMIT 10;"
```

## Testing

```bash
# Health check
curl https://nitrox.divestreams.com/health

# Get all bottles
curl https://nitrox.divestreams.com/bottles

# Create bottle record
curl -X POST https://nitrox.divestreams.com/bottles \
  -H "Content-Type: application/json" \
  -d '{"tank_id":"AL80-001","o2":32,"analyst":"John","diver":"Jane","mod":33.8}'
```

## Notes

- API is inline in docker-compose.yml (no separate source files)
- Database credentials are in docker-compose.yml
- No authentication currently implemented
- Consider adding API key auth for production
