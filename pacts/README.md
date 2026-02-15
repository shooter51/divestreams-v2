# Pact Contract Testing

This directory contains Pact contract testing infrastructure for DiveStreams v2.

## Overview

Pact is a consumer-driven contract testing framework that ensures API providers and consumers stay in sync. We use it to test contracts between:

- **Frontend ↔ Backend API** (DiveStreamsFrontend → DiveStreamsAPI)
- **Zapier ↔ Backend API** (Zapier → DiveStreamsAPI)
- **OAuth Providers ↔ Backend API** (Google/QuickBooks/Xero/Mailchimp → DiveStreamsAPI)
- **Stripe ↔ Backend API** (Stripe → DiveStreamsAPI)

## Directory Structure

```
pacts/
├── contracts/        # Generated Pact contract JSON files
├── logs/            # Pact logs (gitignored)
└── README.md        # This file
```

## Running Pact Tests

### Consumer Tests

Consumer tests define the contract expectations from the consumer's perspective.

```bash
# Run all consumer tests
npm run pact:consumer

# Run specific consumer tests
npm run pact:consumer -- health-api
npm run pact:consumer -- zapier-api
```

Consumer tests generate contract JSON files in `pacts/contracts/`.

### Provider Tests

Provider tests verify that the API provider honors the contracts.

```bash
# Run provider verification
npm run pact:provider
```

Provider verification reads the contract files and validates the actual API responses.

### Publishing Contracts

Publish contracts to the self-hosted Pact Broker:

```bash
# Self-hosted broker (no authentication)
export PACT_BROKER_BASE_URL=http://62.72.3.35:9292
npm run pact:publish

# Or with Pactflow (requires token)
export PACT_BROKER_BASE_URL=https://your-org.pactflow.io
export PACT_BROKER_TOKEN=your-token-here
npm run pact:publish
```

The publish script uses direct HTTP API calls to publish all 4 contracts:
- DiveStreamsFrontend → DiveStreamsAPI
- OAuthProvider → DiveStreamsAPI
- Stripe → DiveStreamsAPI
- Zapier → DiveStreamsAPI

Contracts are automatically tagged with the branch name (`develop`, `staging`, `main`) and environment tag (`development` or `production`).

### Can-I-Deploy

Check if it's safe to deploy based on contract verification:

```bash
npm run pact:can-deploy
```

## Pact Broker Setup

We use a **self-hosted Pact Broker** running on the Dev VPS:

- **URL:** http://62.72.3.35:9292
- **Web UI:** http://pact.dev.divestreams.com (via Caddy reverse proxy)
- **Authentication:** None (internal use only)

The broker is deployed using `docker-compose.pact-broker.yml` and runs alongside the Dev environment.

### Accessing the Broker

View published contracts in the web UI:
```bash
open http://pact.dev.divestreams.com
```

Or query via API:
```bash
# List all pacticipants
curl http://62.72.3.35:9292/pacticipants

# List latest pacts
curl http://62.72.3.35:9292/pacts/latest
```

### Alternative: Pactflow (Cloud-Hosted)

For production use, consider migrating to Pactflow:

1. Sign up at https://pactflow.io (free tier available)
2. Get your broker URL and token
3. Update CI/CD environment variables:
   ```bash
   PACT_BROKER_BASE_URL=https://your-org.pactflow.io
   PACT_BROKER_TOKEN=your-token-here
   ```

## Consumer Test Files

Located in `tests/pact/consumer/`:

- `health-api.pact.test.ts` - Health check endpoint contracts
- `zapier-api.pact.test.ts` - Zapier integration contracts
- `oauth-callbacks.pact.test.ts` - OAuth callback contracts (Google, QuickBooks, Xero, Mailchimp)
- `stripe-webhook.pact.test.ts` - Stripe webhook contracts

## Provider Test Files

Located in `tests/pact/provider/`:

- `api-provider.pact.test.ts` - Provider verification for all consumer contracts

## Writing Consumer Contracts

Consumer contracts use PactV3 and MatchersV3:

```typescript
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const { like, eachLike, iso8601DateTime } = MatchersV3;

const provider = new PactV3({
  consumer: "DiveStreamsFrontend",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

it("returns health status", () => {
  return provider
    .given("all services are healthy")
    .uponReceiving("a request for health status")
    .withRequest({
      method: "GET",
      path: "/api/health",
    })
    .willRespondWith({
      status: 200,
      body: {
        status: like("ok"),
        timestamp: iso8601DateTime(),
      },
    })
    .executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/health`);
      expect(response.status).toBe(200);
    });
});
```

## Provider Verification

Provider tests verify contracts against the actual API:

```typescript
import { Verifier } from "@pact-foundation/pact";

const opts = {
  provider: "DiveStreamsAPI",
  providerBaseUrl: "http://localhost:3001",
  pactUrls: ["pacts/contracts/DiveStreamsFrontend-DiveStreamsAPI.json"],
  stateHandlers: {
    "all services are healthy": async () => {
      // Setup test state
      return Promise.resolve();
    },
  },
};

await new Verifier(opts).verifyProvider();
```

## CI/CD Integration

Pact tests should be integrated into your CI/CD pipeline:

1. **On Feature Branch:**
   - Run consumer tests: `npm run pact:consumer`
   - Publish contracts: `npm run pact:publish`

2. **On Provider Changes:**
   - Run provider verification: `npm run pact:provider`
   - Check deployment safety: `npm run pact:can-deploy`

3. **Before Deploy:**
   - Verify all contracts pass
   - Check can-i-deploy status

## Troubleshooting

### Consumer tests fail

- Check that mock server is correctly configured
- Verify request/response matchers are correct
- Check contract JSON in `pacts/contracts/`

### Provider verification fails

- Ensure provider is running on correct port
- Check state handlers are properly implemented
- Verify provider actually implements the contract

### Publishing fails

- Check `PACT_BROKER_BASE_URL` and `PACT_BROKER_TOKEN` are set
- Verify network connectivity to Pact Broker
- Check broker authentication

## Resources

- [Pact Documentation](https://docs.pact.io/)
- [Pactflow](https://pactflow.io/)
- [Pact Foundation GitHub](https://github.com/pact-foundation)
- [Consumer-Driven Contract Testing Guide](https://docs.pact.io/getting_started/how_pact_works)
