# Pact Contract Testing Implementation

## Overview

This document describes the Pact contract testing implementation for DiveStreams v2. We use consumer-driven contract testing to ensure API compatibility between our frontend, external integrations (Zapier, Stripe), and OAuth providers.

## What is Pact?

Pact is a consumer-driven contract testing framework that:
- **Defines contracts from the consumer's perspective** - Consumers specify what they expect from the provider
- **Generates contract files** - These contracts are shared between teams/services
- **Verifies provider compliance** - Providers verify they meet the contracts
- **Prevents breaking changes** - Can-I-Deploy checks prevent incompatible deployments

## Our Pact Architecture

```
┌─────────────────────┐
│ DiveStreamsFrontend │ (Consumer)
└──────────┬──────────┘
           │
           │ Contract: DiveStreamsFrontend-DiveStreamsAPI.json
           v
┌──────────────────────┐
│   DiveStreamsAPI     │ (Provider)
└──────────┬───────────┘
           │
           ├─ Contract: Zapier-DiveStreamsAPI.json
           ├─ Contract: Stripe-DiveStreamsAPI.json
           └─ Contract: OAuthProvider-DiveStreamsAPI.json
```

## Consumers and Contracts

### 1. DiveStreamsFrontend → DiveStreamsAPI

**Contract:** `DiveStreamsFrontend-DiveStreamsAPI.json`

**Consumer Tests:** `tests/pact/consumer/health-api.pact.test.ts`

**Endpoints Covered:**
- `GET /api/health` - Health check endpoint with database and Redis status

**Tests:**
- ✅ Returns health status when all services are healthy (200)
- ✅ Returns degraded status when database is down (503)
- ✅ Returns degraded status when Redis is down (503)

**Total Tests:** 3

---

### 2. Zapier → DiveStreamsAPI

**Contract:** `Zapier-DiveStreamsAPI.json`

**Consumer Tests:** `tests/pact/consumer/zapier-api.pact.test.ts`

**Endpoints Covered:**
- `GET /api/zapier/test` - API key validation
- `GET /api/zapier/triggers` - List available triggers
- `POST /api/zapier/subscribe` - Create webhook subscription
- `POST /api/zapier/actions/create-booking` - Create booking action

**Tests:**
- ✅ Validates API key and returns organization details
- ✅ Returns 401 when API key is invalid
- ✅ Returns list of available triggers
- ✅ Creates webhook subscription
- ✅ Creates a new booking

**Total Tests:** 5

---

### 3. OAuth Providers → DiveStreamsAPI

**Contract:** `OAuthProvider-DiveStreamsAPI.json`

**Consumer Tests:** `tests/pact/consumer/oauth-callbacks.pact.test.ts`

**Endpoints Covered:**
- `GET /api/integrations/google/callback` - Google OAuth callback
- `GET /api/integrations/quickbooks/callback` - QuickBooks OAuth callback
- `GET /api/integrations/xero/callback` - Xero OAuth callback
- `GET /api/integrations/mailchimp/callback` - Mailchimp OAuth callback

**Tests:**
- ✅ Google: Handles successful OAuth callback
- ✅ Google: Handles OAuth error
- ✅ Google: Handles missing code parameter
- ✅ QuickBooks: Handles successful OAuth callback
- ✅ QuickBooks: Handles missing realmId parameter
- ✅ Xero: Handles successful OAuth callback
- ✅ Xero: Handles OAuth error
- ✅ Mailchimp: Handles successful OAuth callback
- ✅ Mailchimp: Handles missing state parameter

**Total Tests:** 9

---

### 4. Stripe → DiveStreamsAPI

**Contract:** `Stripe-DiveStreamsAPI.json`

**Consumer Tests:** `tests/pact/consumer/stripe-webhook.pact.test.ts`

**Endpoints Covered:**
- `POST /api/webhooks/stripe` - Stripe webhook handler

**Tests:**
- ✅ Handles customer.subscription.created event
- ✅ Handles customer.subscription.updated event
- ✅ Handles customer.subscription.deleted event
- ✅ Returns 400 when signature is invalid
- ✅ Handles invoice.payment_succeeded event

**Total Tests:** 5

---

## Summary

**Total Consumer Tests:** 22
**Total Contracts Generated:** 4
**Contract Files Location:** `pacts/contracts/`

## NPM Scripts

```bash
# Run consumer tests (generates contracts)
npm run pact:consumer

# Run provider verification (validates contracts)
npm run pact:provider

# Publish contracts to Pact Broker
npm run pact:publish

# Verify provider against contracts
npm run pact:verify

# Check if safe to deploy
npm run pact:can-deploy
```

## Pact Broker Setup

### Option 1: Pactflow (Recommended)

1. Sign up at https://pactflow.io (free tier available)
2. Create application
3. Set environment variables:
   ```bash
   export PACT_BROKER_BASE_URL=https://your-org.pactflow.io
   export PACT_BROKER_TOKEN=your-token-here
   ```
4. Publish contracts: `npm run pact:publish`

### Option 2: Self-Hosted Pact Broker

```bash
# Start self-hosted Pact Broker
docker-compose -f pacts/docker-compose.pact-broker.yml up -d

# Access at http://localhost:9292
# Default credentials: admin / admin
```

## Provider Verification

Provider verification tests are located in `tests/pact/provider/api-provider.pact.test.ts`.

These tests:
1. Start the DiveStreams API server
2. Load contract files from `pacts/contracts/`
3. Replay contract interactions against the real provider
4. Verify responses match the contract expectations

**State Handlers:** Provider verification includes state handlers for setting up test data:
- `all services are healthy` - Ensure DB and Redis are running
- `database is unavailable` - Mock or stop database
- `redis is unavailable` - Mock or stop Redis
- `valid API key exists for organization` - Create test org with API key
- `API key is invalid` - Ensure no matching API key
- `valid OAuth state and code` - Create valid OAuth state in Redis
- `valid Stripe signature` - Configure Stripe webhook secret
- And many more...

## CI/CD Integration

### Workflow

```
Developer → Push Code → CI Pipeline
                            ↓
                    Run Consumer Tests
                            ↓
                    Publish Contracts to Broker
                            ↓
                    Run Provider Verification
                            ↓
                    Check Can-I-Deploy
                            ↓
                    Deploy if Safe
```

### GitHub Actions (Proposed)

```yaml
name: Pact Tests

on: [push, pull_request]

jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run pact:consumer
      - uses: actions/upload-artifact@v3
        with:
          name: pacts
          path: pacts/contracts/

  publish-pacts:
    needs: consumer-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/download-artifact@v3
        with:
          name: pacts
          path: pacts/contracts/
      - run: npm run pact:publish
        env:
          PACT_BROKER_BASE_URL: ${{ secrets.PACT_BROKER_BASE_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  provider-verification:
    needs: publish-pacts
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run pact:provider
        env:
          DATABASE_URL: postgres://...
          REDIS_URL: redis://...
```

## Best Practices

### Consumer Tests

1. **Focus on shape, not data** - Use matchers (`like`, `datetime`, `eachLike`) instead of exact values
2. **Test error cases** - Include 4xx/5xx responses in contracts
3. **Minimal state** - Keep provider states simple and focused
4. **One interaction per test** - Don't combine multiple requests in one test

### Provider Verification

1. **Implement state handlers** - All provider states must be implemented
2. **Use test data** - Don't verify against production data
3. **Isolate tests** - Each state handler should be independent
4. **Fast verification** - Keep state setup lightweight

### Contract Management

1. **Version contracts** - Use semantic versioning for contract changes
2. **Publish on merge** - Publish contracts when merged to main
3. **Tag environments** - Tag contracts with dev/staging/production
4. **Use can-i-deploy** - Always check before deploying

## Troubleshooting

### Consumer tests fail

**Issue:** `TypeError: iso8601DateTime is not a function`

**Solution:** Use `datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z")` instead of `iso8601DateTime()` in PactV3.

---

**Issue:** Contract validation fails

**Solution:** Check that request/response matchers match the actual API behavior. Use `like()` for flexible matching.

---

### Provider verification fails

**Issue:** `ECONNREFUSED` when running provider verification

**Solution:** Ensure the API server is running before verification. The provider verification test should start the server in `beforeAll`.

---

**Issue:** Provider state handler not found

**Solution:** Implement the state handler in `tests/pact/provider/api-provider.pact.test.ts` `stateHandlers` object.

---

### Publishing fails

**Issue:** `PACT_BROKER_BASE_URL environment variable is not set`

**Solution:** Set required environment variables:
```bash
export PACT_BROKER_BASE_URL=https://your-org.pactflow.io
export PACT_BROKER_TOKEN=your-token-here
```

---

## Resources

- [Pact Documentation](https://docs.pact.io/)
- [Pact Foundation GitHub](https://github.com/pact-foundation)
- [Pactflow](https://pactflow.io/)
- [Consumer-Driven Contracts](https://docs.pact.io/getting_started/how_pact_works)
- [Pact v3 Matchers](https://github.com/pact-foundation/pact-js/tree/master/src/v3)

## Next Steps

1. ✅ **Consumer Tests** - Completed (22 tests, 4 contracts)
2. ⏳ **Provider Verification** - Implement state handlers and run verification
3. ⏳ **Pact Broker Setup** - Choose Pactflow or self-hosted and configure
4. ⏳ **CI/CD Integration** - Add Pact tests to GitHub Actions workflow
5. ⏳ **Can-I-Deploy** - Integrate deployment safety checks

---

**Status:** Pact infrastructure and consumer contracts completed ✅
**Date:** 2026-02-15
