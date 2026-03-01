# API Testing & Contract Testing Plan

## Current State

### Existing API Routes (15 endpoints)
1. **Health & Auth**
   - `GET /api/health` - Health check (DB + Redis)
   - `/api/auth.$` - Auth.js routes

2. **Webhooks**
   - `POST /api/stripe-webhook` - Stripe payment events

3. **Zapier Integration** (5 endpoints)
   - `POST /api/zapier/test` - Connection test
   - `POST /api/zapier/subscribe` - Webhook subscription
   - `GET /api/zapier/triggers` - List available triggers
   - `POST /api/zapier/actions/create-booking` - Create booking
   - `POST /api/zapier/actions/update-customer` - Update customer

4. **OAuth Callbacks** (7 endpoints)
   - `GET /api/integrations/google/connect`
   - `GET /api/integrations/google/callback`
   - `POST /api/integrations/google/sync`
   - `GET /api/integrations/mailchimp/callback`
   - `GET /api/integrations/quickbooks/connect`
   - `GET /api/integrations/quickbooks/callback`
   - `GET /api/integrations/xero/callback`

### Skipped Tests
- `tests/integration/routes/api/bookings.test.ts` - Skeleton only, `describe.skip`
- `tests/integration/routes/api/customers.test.ts` - Skeleton only, `describe.skip`

### Existing Tools
- **MSW** (Mock Service Worker) - Already installed for HTTP mocking
- **Vitest** - Unit/integration testing
- **Playwright** - E2E testing

---

## Plan: Pact Contract Testing + 100% API Coverage

### Phase 1: Install Pact & Setup Infrastructure

**Install dependencies:**
```bash
npm install --save-dev @pact-foundation/pact @pact-foundation/pact-node
```

**Create Pact broker directory structure:**
```
pacts/
  ├── consumer/           # Frontend consumer contracts
  ├── provider/           # Backend provider tests
  └── contracts/          # Generated .json pact files
```

**Configure Pact Broker:**
- Use Pactflow (free tier) or self-hosted Pact Broker
- Store broker URL + token in GitHub Secrets
- Add `pact:publish` script to package.json

---

### Phase 2: Consumer Contracts (Frontend → Backend API)

**Consumer tests for internal APIs:**

1. **Health API** (`/api/health`)
   - Contract: `DiveStreamsFrontend_DiveStreamsAPI_health.json`
   - Test: Frontend expects `{ status, timestamp, version, checks }`

2. **Zapier Actions** (if frontend triggers them)
   - Contract: `DiveStreamsFrontend_DiveStreamsAPI_zapier.json`
   - Test: Create booking, update customer payloads

**Location:** `tests/pact/consumer/frontend-api.pact.test.ts`

---

### Phase 3: Provider Contracts (External → Backend Webhooks)

**Provider tests for webhooks from external services:**

1. **Stripe Webhooks** (`/api/stripe-webhook`)
   - Contract: `Stripe_DiveStreamsWebhooks_stripe.json`
   - Test: Verify we handle all Stripe webhook events correctly
   - Events: `checkout.session.completed`, `customer.subscription.updated`, etc.

2. **Google Calendar Sync** (`/api/integrations/google/sync`)
   - Contract: `Google_DiveStreamsAPI_calendar.json`
   - Test: Verify sync payload structure

3. **Zapier Triggers** (`/api/zapier/triggers`, `/api/zapier/subscribe`)
   - Contract: `Zapier_DiveStreamsAPI_triggers.json`
   - Test: Verify Zapier's expected payload format

**Location:** `tests/pact/provider/webhooks.pact.test.ts`

---

### Phase 4: Un-skip & Complete API Route Tests

**1. Un-skip existing tests:**
- Remove `describe.skip` from `api/bookings.test.ts`
- Remove `describe.skip` from `api/customers.test.ts`
- Implement actual HTTP request tests (not direct function calls)

**2. Write missing API tests** (15 endpoints total):

| Endpoint | Test File | Coverage Target |
|----------|-----------|-----------------|
| `/api/health` | `tests/integration/routes/api/health.test.ts` | 100% |
| `/api/stripe-webhook` | `tests/integration/routes/api/stripe-webhook.test.ts` | 100% (all events) |
| `/api/zapier/test` | `tests/integration/routes/api/zapier/test.test.ts` | 100% |
| `/api/zapier/subscribe` | `tests/integration/routes/api/zapier/subscribe.test.ts` | 100% |
| `/api/zapier/triggers` | `tests/integration/routes/api/zapier/triggers.test.ts` | 100% |
| `/api/zapier/actions/create-booking` | `tests/integration/routes/api/zapier/create-booking.test.ts` | 100% |
| `/api/zapier/actions/update-customer` | `tests/integration/routes/api/zapier/update-customer.test.ts` | 100% |
| OAuth callbacks | `tests/integration/routes/api/integrations/*.test.ts` | 100% |

**Testing approach:**
- Use actual HTTP requests (via `fetch` or `supertest`)
- Mock external services (Stripe, Zapier) with MSW
- Test auth (API keys, OAuth tokens)
- Test validation (missing fields, invalid data)
- Test error cases (404, 401, 403, 500)

---

### Phase 5: Pact Broker Integration in CI

**GitHub Actions workflow updates:**

```yaml
# .github/workflows/pact-tests.yml
name: Pact Contract Tests

on:
  pull_request:
    branches: [develop, staging, main]
  push:
    branches: [develop, staging, main]

jobs:
  consumer-tests:
    runs-on: [self-hosted, linux, divestreams]
    steps:
      - uses: actions/checkout@v4
      - name: Run consumer contract tests
        run: npm run pact:consumer
      - name: Publish contracts to broker
        run: npm run pact:publish
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  provider-tests:
    runs-on: [self-hosted, linux, divestreams]
    needs: consumer-tests
    steps:
      - uses: actions/checkout@v4
      - name: Run provider verification
        run: npm run pact:verify
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

**Add to deploy.yml:**
- `pact:verify` as a required check on `staging` and `main` branches
- Ensures breaking contract changes are caught before deploy

---

### Phase 6: Coverage Enforcement

**Update package.json:**
```json
{
  "scripts": {
    "test:api": "vitest run tests/integration/routes/api --coverage",
    "test:api:watch": "vitest tests/integration/routes/api",
    "pact:consumer": "vitest run tests/pact/consumer",
    "pact:provider": "vitest run tests/pact/provider",
    "pact:verify": "npm run pact:consumer && npm run pact:provider",
    "pact:publish": "pact-broker publish ./pacts/contracts --consumer-app-version=$GITHUB_SHA --broker-base-url=$PACT_BROKER_URL --broker-token=$PACT_BROKER_TOKEN"
  }
}
```

**Coverage thresholds (vitest.config.ts):**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['app/routes/api/**/*.{ts,tsx}'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
})
```

---

## Implementation Order

1. ✅ **Install Pact dependencies** (~5 min)
2. ✅ **Write health API test** (warmup, ~15 min)
3. ✅ **Write Stripe webhook contract test** (~30 min)
4. ✅ **Write Zapier action tests** (~1 hour)
5. ✅ **Un-skip & complete bookings/customers tests** (~1 hour)
6. ✅ **Write OAuth callback tests** (~30 min)
7. ✅ **Set up Pact Broker** (~30 min)
8. ✅ **Add Pact CI workflow** (~15 min)
9. ✅ **Verify 100% coverage** (~15 min)

**Total estimated time:** ~4-5 hours

---

## Questions for Approval

1. **Pact Broker:** Use Pactflow (free tier, cloud) or self-host?
2. **Coverage scope:** Just `/api/**` routes or also include `/webhooks/**`?
3. **Stripe events:** Which Stripe webhook events should we contract test? (e.g., `checkout.session.completed`, `customer.subscription.updated`, `payment_intent.succeeded`)
4. **Priority:** Start with internal API tests (Zapier, health) or external webhooks (Stripe)?

---

## Success Criteria

- ✅ All 15 API endpoints have integration tests
- ✅ 100% code coverage on `app/routes/api/**`
- ✅ Pact contracts generated for frontend → backend
- ✅ Pact contracts generated for Stripe → backend
- ✅ Pact contracts generated for Zapier → backend
- ✅ Contracts published to Pact Broker
- ✅ CI enforces contract verification before deploy
- ✅ No `describe.skip` in API test files
