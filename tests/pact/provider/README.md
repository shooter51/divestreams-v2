# Pact Provider Verification

This directory contains provider-side verification tests for the DiveStreams API.

## Overview

Provider verification ensures that the DiveStreams API (`DiveStreamsAPI`) honors all the contracts created by its consumers:

1. **DiveStreamsFrontend** - Frontend health check monitoring
2. **Zapier** - Zapier integration API endpoints
3. **OAuthProvider** - OAuth callback handlers (Google, QuickBooks, Xero, Mailchimp)
4. **Stripe** - Stripe webhook handling

## How It Works

The provider verification test (`api-provider.pact.test.ts`):

1. **Reads contract files** from `pacts/contracts/`
2. **Starts/connects to the DiveStreams API server**
3. **Replays each interaction** from the contracts against the real provider
4. **Sets up provider state** using state handlers before each interaction
5. **Verifies responses** match the contract expectations

## Running Provider Verification

### Prerequisites

- PostgreSQL database running (with DATABASE_URL set)
- Redis running (with REDIS_URL set)
- Contract files generated in `pacts/contracts/`

### Step 1: Start the Development Server

In one terminal, start the dev server:

```bash
npm run dev
```

Wait for the server to be ready on `http://localhost:5173`.

### Step 2: Run Provider Verification

In another terminal, run the provider tests:

```bash
npm run pact:provider
```

This will:
- Connect to the running dev server
- Set up test data as needed for each interaction
- Verify all 22 contract interactions
- Report pass/fail results

## State Handlers

State handlers set up the necessary test data before each interaction. They are implemented in `api-provider.pact.test.ts`:

### Health Check States

| State | Setup |
|-------|-------|
| `all services are healthy` | No setup needed - relies on running DB and Redis |
| `database is unavailable` | No setup - health endpoint handles errors gracefully |
| `redis is unavailable` | No setup - health endpoint handles errors gracefully |

### Zapier API Key States

| State | Setup |
|-------|-------|
| `valid API key exists for organization` | Creates test org with API key `valid-key-123` |
| `API key is invalid` | No setup - invalid key won't match DB records |
| `valid API key and event type` | Creates test org with API key |
| `valid API key and trip exists` | Creates test org, API key, and a sample trip |

### OAuth Callback States

| State | Setup |
|-------|-------|
| `valid OAuth state and code` | Creates test org for OAuth callback |
| `OAuth error occurred` | No setup - error parameter triggers flow |
| `code parameter is missing` | No setup - missing parameter triggers error |
| `valid QuickBooks OAuth parameters` | Creates test org |
| `realmId parameter is missing` | No setup - missing parameter triggers error |
| `valid Xero OAuth parameters` | Creates test org |
| `Xero OAuth error occurred` | No setup - error parameter triggers flow |
| `valid Mailchimp OAuth parameters` | Creates test org |
| `state parameter is missing` | No setup - missing parameter triggers error |

### Stripe Webhook States

| State | Setup |
|-------|-------|
| `valid Stripe signature` | No setup - uses STRIPE_WEBHOOK_SECRET env var |
| `invalid Stripe signature` | No setup - contract sends invalid signature |

## Test Data

The provider verification creates the following test data in the database:

- **Organization**: `org-pact-test` (Test Dive Shop)
- **API Key**: `valid-key-123` (hashed with SHA-256)
- **Trip**: `trip-123` (sample dive trip)
- **Tour**: Automatically created for the trip

This data is idempotent - it won't create duplicates if it already exists.

## CI/CD Integration

### Local Development

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run provider verification
npm run pact:provider
```

### CI Pipeline

The CI pipeline automatically runs provider verification after consumer tests:

```yaml
- name: Generate Consumer Contracts
  run: npm run pact:consumer

- name: Start Server for Provider Verification
  run: npm run dev &

- name: Wait for Server
  run: sleep 10

- name: Verify Provider
  run: npm run pact:provider
```

## Verification Results

When verification completes successfully:

```
[PACT] ✅ Provider verification complete!
```

When verification fails, you'll see:
- Which interaction failed
- Expected vs actual response
- State that was set up

## Publishing Verification Results

When running in CI (with `CI=true`), verification results are published to the Pact Broker:

```bash
CI=true \
GITHUB_SHA=abc123 \
GITHUB_REF_NAME=main \
npm run pact:provider
```

This allows the Pact Broker to track which provider versions satisfy which consumer contracts.

## Troubleshooting

### "Server not ready"

Make sure the dev server is running on port 5173:

```bash
npm run dev
```

### "Database connection failed"

Ensure PostgreSQL is running and DATABASE_URL is set:

```bash
# Check if postgres is running
docker-compose ps postgres

# Restart if needed
docker-compose up -d postgres
```

### "Redis connection failed"

Ensure Redis is running and REDIS_URL is set:

```bash
# Check if redis is running
docker-compose ps redis

# Restart if needed
docker-compose up -d redis
```

### "Contract file not found"

Generate consumer contracts first:

```bash
npm run pact:consumer
```

### State handler failures

State handlers create test data in the database. If they fail:

1. Check database connectivity
2. Ensure the database schema is up to date (run migrations)
3. Check for unique constraint violations (test data may already exist)

## Debugging

To see detailed verification output, set log level to debug in `api-provider.pact.test.ts`:

```typescript
logLevel: "debug"
```

This will show:
- Full HTTP requests and responses
- State handler execution
- Matching rules evaluation
- Detailed error messages

## Further Reading

- [Pact Provider Verification Guide](https://docs.pact.io/implementation_guides/javascript/docs/provider)
- [Pact State Handlers](https://docs.pact.io/getting_started/provider_states)
- [Publishing Verification Results](https://docs.pact.io/pact_broker/publishing_and_retrieving_pacts)
