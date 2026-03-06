# Pact Contract Testing - Quick Start Guide

This guide will get you up and running with Pact contract testing in 5 minutes.

## Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL and Redis
docker-compose up -d postgres redis

# 3. Run migrations
npm run db:migrate
```

## Running Tests

### Option 1: Full Test Suite (Consumer + Provider)

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run all Pact tests
npm run pact:consumer  # Generate contracts (runs in ~5 seconds)
npm run pact:provider  # Verify against provider (runs in ~15 seconds)
```

### Option 2: Consumer Tests Only

```bash
# No server needed - consumer tests are self-contained
npm run pact:consumer
```

This generates 4 contract files in `pacts/contracts/`:
- `DiveStreamsFrontend-DiveStreamsAPI.json` (3 interactions)
- `Zapier-DiveStreamsAPI.json` (5 interactions)
- `OAuthProvider-DiveStreamsAPI.json` (9 interactions)
- `Stripe-DiveStreamsAPI.json` (5 interactions)

### Option 3: Provider Verification Only

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Verify provider
npm run pact:provider
```

This verifies all 22 interactions against the running DiveStreams API.

## Expected Output

### Consumer Tests (Success)

```
 ✓ tests/pact/consumer/frontend.pact.test.ts (3 tests) 1234ms
   ✓ Frontend Consumer - DiveStreams API (3 tests) 1200ms
     ✓ health check with all services healthy
     ✓ health check with database down
     ✓ health check with redis down

 ✓ tests/pact/consumer/zapier.pact.test.ts (5 tests) 2345ms
   ✓ Zapier Consumer - DiveStreams API (5 tests) 2300ms
     ✓ test API connection with valid key
     ✓ test API connection with invalid key
     ✓ get available triggers
     ✓ subscribe to trigger
     ✓ create booking

 ✓ tests/pact/consumer/oauth.pact.test.ts (9 tests) 3456ms
 ✓ tests/pact/consumer/stripe.pact.test.ts (5 tests) 4567ms

Test Files  4 passed (4)
     Tests  22 passed (22)
  Duration  11.60s

[Pact] Writing new pact file for DiveStreamsFrontend to pacts/contracts/
[Pact] Writing new pact file for Zapier to pacts/contracts/
[Pact] Writing new pact file for OAuthProvider to pacts/contracts/
[Pact] Writing new pact file for Stripe to pacts/contracts/
```

### Provider Verification (Success)

```
[PACT] Preparing for provider verification...
[PACT] Waiting for dev server on port 5173
[PACT] Server is ready for verification

[STATE] Setting up: all services healthy
[STATE] Setting up: valid API key for organization
[STATE] Setting up: valid OAuth state and code
...

Verifying a pact between DiveStreamsFrontend and DiveStreamsAPI
  a request for health status
    with provider state "all services are healthy"
      returns a response which
        has status code 200 (OK)
        has a matching body (OK)
  ...

[PACT] ✅ Provider verification complete!

Test Files  1 passed (1)
     Tests  1 passed (1)
  Duration  18.42s
```

## Common Issues

### "Server not ready"

**Problem:** Provider verification can't connect to dev server.

**Solution:**
```bash
# Make sure dev server is running on port 5173
npm run dev
```

### "Database connection failed"

**Problem:** Tests can't connect to PostgreSQL.

**Solution:**
```bash
# Check if postgres is running
docker-compose ps postgres

# Start if not running
docker-compose up -d postgres

# Check DATABASE_URL is set
echo $DATABASE_URL
```

### "Redis connection failed"

**Problem:** Tests can't connect to Redis.

**Solution:**
```bash
# Check if redis is running
docker-compose ps redis

# Start if not running
docker-compose up -d redis

# Check REDIS_URL is set
echo $REDIS_URL
```

### "Cannot find module"

**Problem:** Pact dependencies not installed.

**Solution:**
```bash
# Reinstall dependencies
npm install

# Pact may need native binaries
# If on Apple Silicon (M1/M2), ensure Rosetta is installed
```

## What Gets Created

### After Consumer Tests

```
pacts/
└── contracts/
    ├── DiveStreamsFrontend-DiveStreamsAPI.json  (3 interactions)
    ├── Zapier-DiveStreamsAPI.json               (5 interactions)
    ├── OAuthProvider-DiveStreamsAPI.json        (9 interactions)
    └── Stripe-DiveStreamsAPI.json               (5 interactions)
```

### After Provider Verification

- Verification results logged to console
- Test data created in database:
  - Organization: `org-pact-test`
  - API Key: `valid-key-123`
  - Trip: `trip-123`
  - Tour: Auto-created for trip

## Next Steps

### 1. View Contract Files

```bash
# Pretty-print a contract
cat pacts/contracts/Zapier-DiveStreamsAPI.json | jq
```

### 2. Publish to Pact Broker

```bash
# Set Pact Broker credentials
export PACT_BROKER_BASE_URL=https://divestreams-pact-broker.onrender.com
export PACT_BROKER_USERNAME=pact_admin
export PACT_BROKER_PASSWORD=<password>

# Publish contracts
npm run pact:publish
```

### 3. Check Can-I-Deploy

```bash
# Check if safe to deploy
npm run pact:can-deploy
```

### 4. Run in CI

Push your changes - GitHub Actions will automatically:
1. Run consumer tests
2. Publish contracts to broker
3. Verify provider
4. Check can-i-deploy

## Test Coverage

| Consumer | Endpoint | Interactions |
|----------|----------|--------------|
| **Frontend** | `/api/health` | 3 |
| **Zapier** | `/api/zapier/*` | 5 |
| **OAuth** | `/api/integrations/*/callback` | 9 |
| **Stripe** | `/api/webhooks/stripe` | 5 |
| **Total** | | **22** |

## Performance

- **Consumer tests:** ~10 seconds (all 22 tests)
- **Provider verification:** ~15-20 seconds (with server startup)
- **Total runtime:** ~30 seconds for full suite

Much faster than full E2E tests (80 tests, ~5-10 minutes)!

## Learn More

- **Full Documentation:** `tests/pact/IMPLEMENTATION_SUMMARY.md`
- **Provider Verification:** `tests/pact/provider/README.md`
- **Pact Broker Setup:** `.github/PACT_BROKER_SETUP.md`
- **Pact Official Docs:** https://docs.pact.io

## Quick Reference

```bash
# Consumer tests
npm run pact:consumer

# Provider verification
npm run pact:provider
# or
npm run pact:verify

# Publish contracts
npm run pact:publish

# Check deployment safety
npm run pact:can-deploy
```

That's it! You're now ready to use Pact contract testing in DiveStreams v2. 🚀
