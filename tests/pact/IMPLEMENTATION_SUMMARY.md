# Pact Contract Testing - Complete Implementation Summary

## Overview

DiveStreams v2 now has full Pact contract testing implementation covering all major API integrations. This document provides a comprehensive overview of the implementation.

## Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│   Consumer      │                    │    Provider      │
│   Tests         │                    │   Verification   │
│                 │                    │                  │
│ • Frontend      │    Generate        │ • DiveStreamsAPI │
│ • Zapier        │   Contracts        │                  │
│ • OAuth         │ =============>     │   Verify         │
│ • Stripe        │                    │   Against        │
│                 │     pacts/         │   Live API       │
│                 │   contracts/       │                  │
└─────────────────┘                    └──────────────────┘
                           |
                           v
                    ┌──────────────┐
                    │ Pact Broker  │
                    │              │
                    │ • Store      │
                    │ • Version    │
                    │ • Track      │
                    └──────────────┘
```

## Consumer Tests

### Locations
- `tests/pact/consumer/frontend.pact.test.ts` - Frontend health monitoring (3 tests)
- `tests/pact/consumer/zapier.pact.test.ts` - Zapier integration (5 tests)
- `tests/pact/consumer/oauth.pact.test.ts` - OAuth callbacks (9 tests)
- `tests/pact/consumer/stripe.pact.test.ts` - Stripe webhooks (5 tests)

### Total Coverage
- **22 contract interactions** across 4 consumers
- **4 contract files** generated in `pacts/contracts/`

### Consumer: Frontend (DiveStreamsFrontend)

Tests health monitoring endpoints used by the frontend.

**Interactions:**
1. Health check - all services healthy (200 OK)
2. Health check - database unavailable (503 degraded)
3. Health check - Redis unavailable (503 degraded)

**Contract File:** `DiveStreamsFrontend-DiveStreamsAPI.json`

### Consumer: Zapier

Tests REST API endpoints that Zapier uses to integrate with DiveStreams.

**Interactions:**
1. GET `/api/zapier/test` - Test API connection with valid key (200 OK)
2. GET `/api/zapier/test` - Test API connection with invalid key (401 unauthorized)
3. GET `/api/zapier/triggers` - List available triggers (200 OK)
4. POST `/api/zapier/subscribe` - Subscribe to trigger webhook (200 OK)
5. POST `/api/zapier/actions/create-booking` - Create booking via Zapier (200 OK)

**Contract File:** `Zapier-DiveStreamsAPI.json`

### Consumer: OAuth Providers

Tests OAuth callback handlers for third-party integrations.

**Interactions:**

**Google Calendar (3 interactions):**
1. GET `/api/integrations/google/callback` - Valid OAuth flow (302 redirect)
2. GET `/api/integrations/google/callback` - OAuth error (302 redirect to error)
3. GET `/api/integrations/google/callback` - Missing code parameter (302 redirect to error)

**QuickBooks (2 interactions):**
4. GET `/api/integrations/quickbooks/callback` - Valid OAuth flow (302 redirect)
5. GET `/api/integrations/quickbooks/callback` - Missing realmId (302 redirect to error)

**Xero (2 interactions):**
6. GET `/api/integrations/xero/callback` - Valid OAuth flow (302 redirect)
7. GET `/api/integrations/xero/callback` - OAuth error (302 redirect to error)

**Mailchimp (2 interactions):**
8. GET `/api/integrations/mailchimp/callback` - Valid OAuth flow (302 redirect)
9. GET `/api/integrations/mailchimp/callback` - Missing state parameter (302 redirect to error)

**Contract File:** `OAuthProvider-DiveStreamsAPI.json`

### Consumer: Stripe

Tests webhook handlers for Stripe payment events.

**Interactions:**
1. POST `/api/webhooks/stripe` - Subscription created (200 OK)
2. POST `/api/webhooks/stripe` - Subscription updated (200 OK)
3. POST `/api/webhooks/stripe` - Subscription deleted (200 OK)
4. POST `/api/webhooks/stripe` - Invoice payment succeeded (200 OK)
5. POST `/api/webhooks/stripe` - Invalid signature (400 bad request)

**Contract File:** `Stripe-DiveStreamsAPI.json`

## Provider Verification

### Location
`tests/pact/provider/api-provider.pact.test.ts`

### How It Works

1. **Reads contracts** from `pacts/contracts/`
2. **Connects to running server** at http://localhost:5173
3. **Sets up state** before each interaction using state handlers
4. **Replays interactions** against the real DiveStreams API
5. **Verifies responses** match contract expectations

### State Handlers

State handlers prepare test data before each interaction:

**Database Setup:**
- Creates test organization: `org-pact-test`
- Creates API key: `valid-key-123` (SHA-256 hashed)
- Creates sample trip: `trip-123`
- All idempotent (won't create duplicates)

**Implemented States:**
- ✅ All services healthy
- ✅ Database unavailable
- ✅ Redis unavailable
- ✅ Valid API key for organization
- ✅ Invalid API key
- ✅ Valid API key and event type
- ✅ Valid API key and trip exists
- ✅ Valid OAuth states (Google, QuickBooks, Xero, Mailchimp)
- ✅ OAuth error flows
- ✅ Missing parameter flows
- ✅ Valid Stripe signature
- ✅ Invalid Stripe signature

### Running Provider Verification

**Local:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run verification
npm run pact:provider
```

**CI:**
```bash
npm run dev &
sleep 10
npm run pact:provider
```

## Pact Broker Integration

### Self-Hosted Broker

DiveStreams uses a self-hosted Pact Broker deployed on Render.com:

**URL:** https://divestreams-pact-broker.onrender.com

**Credentials:**
- Username: `pact_admin`
- Password: Stored in GitHub Secrets as `PACT_BROKER_PASSWORD`

### Deployment

The Pact Broker is deployed via Docker Compose on Render.com. See `.github/PACT_BROKER_SETUP.md` for full deployment details.

**Services:**
- **Pact Broker** - Web UI and API (port 9292)
- **PostgreSQL** - Contract storage (port 5432)

### Publishing Contracts

Contracts are published after consumer tests:

```bash
npm run pact:consumer  # Generate contracts
npm run pact:publish   # Publish to broker
```

**Publish Script** (`scripts/publish-pacts.mjs`):
- Uploads all contracts from `pacts/contracts/`
- Tags with git branch name
- Tags with `latest` for main branch
- Includes consumer version (git commit SHA)

### Publishing Verification Results

Provider verification results are published in CI:

```bash
CI=true \
GITHUB_SHA=abc123 \
GITHUB_REF_NAME=main \
npm run pact:provider
```

The Pact Verifier automatically publishes results when:
- `publishVerificationResult: true`
- `PACT_BROKER_BASE_URL` env var is set
- `PACT_BROKER_TOKEN` or `PACT_BROKER_USERNAME/PASSWORD` is set

## CI/CD Integration

### GitHub Workflow

**File:** `.github/workflows/pact-tests.yml`

**Workflow:**
```
┌─────────────┐
│ Run Unit    │
│ Tests       │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Generate    │
│ Consumer    │
│ Contracts   │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Publish     │
│ Contracts   │
│ to Broker   │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Start       │
│ Dev Server  │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Verify      │
│ Provider    │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Can I       │
│ Deploy?     │
│ Check       │
└─────────────┘
```

**Triggers:**
- Push to main/develop/staging
- Pull requests
- Manual workflow dispatch

**Environment Variables:**
- `PACT_BROKER_BASE_URL` - Pact Broker URL
- `PACT_BROKER_USERNAME` - Username for auth
- `PACT_BROKER_PASSWORD` - Password (from secrets)

### Can-I-Deploy Check

Before deploying, CI checks if the provider is compatible with all deployed consumers:

```bash
npm run pact:can-deploy
```

This queries the Pact Broker to verify:
- All consumer contracts are satisfied
- No breaking changes introduced
- Safe to deploy to production

## Matcher Patterns

### Important: PactV3 Matchers

**✅ Correct (V3):**
```typescript
import { MatchersV3 as Matchers } from "@pact-foundation/pact";

Matchers.datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z")
```

**❌ Incorrect (V2):**
```typescript
Matchers.iso8601DateTime()  // Don't use - deprecated in V3
```

### Common Matchers

```typescript
import { MatchersV3 as Matchers } from "@pact-foundation/pact";

// Type matching
Matchers.like("example value")

// Array matching (min 1 item)
Matchers.eachLike({ id: 1, name: "example" })

// Datetime matching
Matchers.datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z")

// Integer matching
Matchers.integer(123)

// Boolean matching
Matchers.boolean(true)
```

## Testing Strategy

### What We Test

**✅ API Contracts:**
- Request/response structure
- HTTP methods and status codes
- Headers (Content-Type, authentication)
- Error responses
- Redirects (OAuth flows)

**✅ Integration Points:**
- Zapier REST API
- OAuth callbacks (Google, QuickBooks, Xero, Mailchimp)
- Stripe webhooks
- Health monitoring

**❌ Not Tested:**
- Business logic (covered by unit/integration tests)
- Database internals (covered by integration tests)
- UI components (covered by E2E tests)

### Test Pyramid

```
           ┌─────────┐
           │   E2E   │  80 tests (workflow coverage)
           └─────────┘
          ┌───────────┐
          │Integration│  ~50 tests (DB + service layer)
          └───────────┘
         ┌─────────────┐
         │    Unit     │  ~100 tests (pure functions)
         └─────────────┘
        ┌───────────────┐
        │   Pact        │  22 tests (API contracts)
        └───────────────┘
```

Pact tests sit alongside other test types, focusing specifically on API contracts.

## npm Scripts

```bash
# Consumer tests - generate contracts
npm run pact:consumer

# Provider verification - verify contracts
npm run pact:provider
# or
npm run pact:verify  # alias

# Publish contracts to broker
npm run pact:publish

# Check if safe to deploy
npm run pact:can-deploy
```

## Troubleshooting

### Consumer Tests Failing

**"Cannot generate matcher"**
- Check you're using `MatchersV3` not `MatchersV2`
- Use `datetime()` not `iso8601DateTime()`

**"Contract validation failed"**
- Check request body structure matches expected format
- Verify headers are included (Content-Type, X-API-Key, etc.)

### Provider Verification Failing

**"Server not ready"**
```bash
# Start dev server first
npm run dev
```

**"Database connection failed"**
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres
```

**"State handler failed"**
- Check database schema is up to date
- Run migrations: `npm run db:migrate`
- Check for unique constraint violations

**"Response doesn't match contract"**
- Check the interaction in contract file
- Verify provider state handler sets up correct data
- Check server logs for errors

### Pact Broker Issues

**"Failed to publish"**
- Check `PACT_BROKER_BASE_URL` is set
- Verify credentials in `PACT_BROKER_USERNAME/PASSWORD`
- Ensure broker is accessible (not behind firewall)

**"Can-i-deploy failed"**
- Check which consumer versions are deployed
- Verify provider version satisfies all consumer contracts
- Review verification results in Pact Broker UI

## Benefits

### For Developers

- **Catch breaking changes** before deployment
- **Safe refactoring** - contracts ensure compatibility
- **Clear API documentation** - contracts are living docs
- **Faster debugging** - isolated contract failures vs full integration test failures

### For CI/CD

- **Fast feedback** - contract tests run in seconds
- **Parallel development** - frontend and backend can work independently
- **Deployment confidence** - can-i-deploy check prevents breaking changes
- **Version tracking** - broker tracks which versions are compatible

### For Teams

- **Consumer-driven** - API evolves based on actual consumer needs
- **Cross-team collaboration** - shared contract visibility
- **Reduced coordination** - teams can deploy independently
- **Better communication** - contracts clarify expectations

## Future Enhancements

### Potential Additions

1. **More Consumers:**
   - Mobile app contract tests
   - Internal admin API consumers
   - Partner API consumers

2. **More Interactions:**
   - Additional Zapier endpoints (update, delete actions)
   - More OAuth providers (Slack, Microsoft, etc.)
   - Additional Stripe events (payment failures, refunds)

3. **Advanced Scenarios:**
   - Webhook replay verification
   - Rate limiting contract tests
   - API versioning contracts

4. **Broker Features:**
   - Webhooks for contract changes
   - Can-i-deploy in GitHub PR checks
   - Automated contract diff reports

## Resources

- **Pact Documentation:** https://docs.pact.io
- **Pact JS Guide:** https://docs.pact.io/implementation_guides/javascript
- **Pact Broker Setup:** `.github/PACT_BROKER_SETUP.md`
- **Consumer Tests:** `tests/pact/consumer/`
- **Provider Tests:** `tests/pact/provider/`
- **Contract Files:** `pacts/contracts/`

## Summary

DiveStreams v2 now has comprehensive contract testing coverage:

- ✅ 22 contract interactions across 4 consumers
- ✅ Full provider verification with state handlers
- ✅ Self-hosted Pact Broker for contract storage
- ✅ CI/CD integration with can-i-deploy checks
- ✅ Clear documentation and troubleshooting guides

The implementation follows Pact best practices and provides a solid foundation for consumer-driven contract testing in the DiveStreams platform.
