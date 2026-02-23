# Testing Quick Reference

## Test Database Commands

```bash
# Start test database (runs migrations & seeds)
npm run test:db:start

# Run integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Check database status
npm run test:db:status

# Reset database (clean slate)
npm run test:db:reset

# Stop database
npm run test:db:stop
```

## Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run unit tests with coverage
npm run test:unit -- --coverage

# Run specific test file
npm test path/to/test.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Test Database Info

- **PostgreSQL**: `localhost:5433` (user: `test_user`, db: `divestreams_test`)
- **Redis**: `localhost:6380`
- **Containers**: `divestreams-test-db`, `divestreams-test-redis`
- **Config**: `.env.test`

## Coverage Thresholds

Current target: **80%** for lib/ directory

```
Lines:      64.56% → 80% (need +15.44 points)
Functions:  55.04% → 80% (need +24.96 points)
Branches:   62.86% → 80% (need +17.14 points)
Statements: 64.96% → 80% (need +15.04 points)
```

## Testing Patterns

### Unit Test (Pure Function)
```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Test (Database)
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTenantDb } from "../lib/db/tenant.server";
import { createBoat, getBoatById } from "../lib/db/queries/boats.server";

describe("Boat Queries", () => {
  const testOrgId = `test-org-${Date.now()}`;
  let testBoatId: string;

  afterAll(async () => {
    // Clean up test data
    const db = getTenantDb(testOrgId);
    await db.delete(boats).where(eq(boats.organizationId, testOrgId));
  });

  it("should create and retrieve a boat", async () => {
    const boat = await createBoat(testOrgId, { name: "Test Boat" });
    testBoatId = boat.id;

    const retrieved = await getBoatById(testOrgId, testBoatId);
    expect(retrieved?.name).toBe("Test Boat");
  });
});
```

## Coverage Exclusions

These modules are intentionally excluded from coverage:
- `app/routes/**` - Covered by E2E tests
- `lib/integrations/**` - External API dependencies
- `lib/jobs/**` - Background job processors
- `lib/storage/**` - S3/B2 operations
- `lib/middleware/**` - Request middleware
- `lib/stripe/**` - Payment processing
- `lib/cache/**` - Redis caching
- `lib/training/**` - AI model operations

## Troubleshooting

### "Connection refused" errors
```bash
# Check if database is running
npm run test:db:status

# Restart if needed
npm run test:db:restart
```

### "Port already in use"
```bash
# Stop existing containers
npm run test:db:stop

# Check for other postgres/redis on 5433/6380
lsof -i :5433
lsof -i :6380
```

### Stale test data
```bash
# Reset database to clean state
npm run test:db:reset
```

### Docker not running
```bash
# Check Docker status
docker info

# Start Docker Desktop (macOS)
open -a Docker
```

## Next Priority Tests

To reach 80% coverage, add integration tests for:

1. **Equipment queries** (lib/db/queries/equipment.server.ts)
   - Current: 40.54% → Target: ~70% (+2-3%)

2. **Trip queries** (lib/db/queries/trips.server.ts)
   - Current: 68.75% → Target: ~85% (+2%)

3. **Tour queries** (lib/db/queries/tours.server.ts)
   - Current: 52.54% → Target: ~75% (+2-3%)

4. **Dive site queries** (lib/db/queries/dive-sites.server.ts)
   - Current: 50% → Target: ~75% (+2%)

5. **Org context** (lib/auth/org-context.server.ts)
   - Current: 31.18% → Target: ~65% (+2-3%)

## Documentation

- **Full guide**: `docs/TEST_DATABASE_SETUP.md`
- **Integration testing**: `tests/integration/lib/db/queries/README.md`
- **Coverage summary**: `TESTING_COVERAGE_SUMMARY.md`
- **Session summary**: `../SESSION_SUMMARY.md`
