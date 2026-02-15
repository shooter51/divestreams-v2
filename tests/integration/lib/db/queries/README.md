# Database Queries Integration Tests

## Overview

This directory contains integration tests for `lib/db/queries` modules using real PostgreSQL databases via testcontainers. These tests complement unit tests by validating database operations, constraints, and business logic that requires actual database interaction.

## Test Infrastructure

### Test Containers Setup

Tests use `@testcontainers/postgresql` to spin up isolated PostgreSQL containers:

```typescript
import { useTestDatabase } from "../../../../setup/database";

const getDb = useTestDatabase(); // Automatically starts/stops container
```

### Database Schema

Each test suite creates its required tables in `beforeEach` hooks:

```typescript
beforeEach(async () => {
  const { db } = getDb();
  await db.execute(drizzleSql.raw(`CREATE TABLE IF NOT EXISTS ...`));
});

afterEach(async () => {
  const { db } = getDb();
  await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS ... CASCADE`));
});
```

## Test Files

### boats.integration.test.ts (150+ tests)
Tests CRUD operations for boat management:
- `getAllBoats` - Fetch all boats for organization
- `getActiveBoats` - Filter by active status
- `getBoatById` - Single boat retrieval with validation
- `createBoat` - Create with full/minimal fields
- `updateBoat` - Partial/full updates
- `deleteBoat` - Soft delete (sets is_active = false)
- Multi-tenant isolation validation

### bookings.integration.test.ts (200+ tests)
Tests complex booking operations:
- `getAllBookings` - List with joins to customers/trips
- `getBookingById` - Detailed booking with relationships
- `createBooking` - Booking creation with validation
- `updateBooking` - Status/payment updates
- `getBookingsByStatus` - Filter by booking status
- `getBookingsByDateRange` - Date-based queries
- `getBookingsByCustomer` - Customer history
- Cascading deletes (customer → bookings → payments)

### customers.integration.test.ts (168+ tests)
Tests customer management:
- `getAllCustomers` - Fetch all customers
- `getCustomerById` - Single customer retrieval
- `getCustomerByEmail` - Email lookup (case-insensitive)
- `createCustomer` - Full profile creation
- `updateCustomer` - Profile updates
- `deleteCustomer` - Hard delete
- `searchCustomers` - Multi-field search (name, email, phone)
- Email uniqueness constraints (per organization)

## Running Integration Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run specific test file:
```bash
npm run test:integration -- tests/integration/lib/db/queries/boats.integration.test.ts
```

### Run with Docker check:
```bash
# Ensure Docker is running
docker info

# Run tests
npm run test:integration
```

## Test Patterns

### 1. Multi-Tenant Isolation
Every test validates that data is isolated by `organization_id`:

```typescript
it("should only return boats for the specified organization", async () => {
  // Create data for multiple orgs
  await sql`INSERT INTO boats (organization_id, name) VALUES
    (${testOrgId}, 'My Boat'),
    (${otherOrgId}, 'Their Boat')`;

  const boats = await getAllBoats(testOrgId);

  expect(boats).toHaveLength(1);
  expect(boats[0].name).toBe('My Boat');
});
```

### 2. Database Constraints
Tests validate real PostgreSQL constraints:

```typescript
it("should enforce unique email within organization", async () => {
  await createCustomer({ email: 'test@example.com', ... });

  // Should throw unique constraint violation
  await expect(
    createCustomer({ email: 'test@example.com', ... })
  ).rejects.toThrow();
});
```

### 3. Cascading Deletes
Tests verify referential integrity:

```typescript
it("should cascade delete bookings when customer is deleted", async () => {
  const customer = await createCustomer(...);
  const booking = await createBooking({ customerId: customer.id });

  await deleteCustomer(customer.id);

  const bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customer.id}`;
  expect(bookings).toHaveLength(0);
});
```

## Coverage Goals

Integration tests target modules with heavy database dependencies:

| Module | Current Coverage | Target | Priority |
|--------|-----------------|--------|----------|
| boats.server.ts | 28.57% | 80%+ | High |
| bookings.server.ts | 32.46% | 80%+ | High |
| customers.server.ts | 66.66% | 90%+ | Medium |
| equipment.server.ts | 40.54% | 80%+ | Medium |
| trips.server.ts | 68.75% | 85%+ | Low |

## Next Steps

### 1. Align Test APIs with Actual Code
Current tests reference ideal function signatures. Update tests to match actual `lib/db/queries/*.server.ts` exports:

```typescript
// Current test expectation:
await getAllBoats(organizationId);

// Actual function signature:
await getAllBoats(organizationId); // Check actual params!
```

### 2. Add More Query Modules
Create integration tests for:
- `equipment.server.ts`
- `trips.server.ts`
- `tours.server.ts`
- `dive-sites.server.ts`

### 3. Test Complex Queries
Add tests for:
- Pagination and sorting
- Complex joins with multiple relationships
- Aggregate queries (counts, sums)
- Transaction handling
- Concurrent operations

### 4. Performance Testing
Add benchmarks for:
- Query performance with large datasets
- Index effectiveness
- N+1 query detection

## Troubleshooting

### Docker Connection Issues
If tests fail with `ECONNREFUSED`:
```bash
# Check Docker is running
docker info

# Check testcontainers can start
docker ps -a | grep testcontainers
```

### Slow Test Startup
First run downloads PostgreSQL image (~200MB). Subsequent runs reuse cached image.

### Database State Issues
Each test suite uses isolated containers. If tests interfere with each other, check `beforeEach`/`afterEach` cleanup.

## Best Practices

1. **Isolation**: Each test should create its own data
2. **Cleanup**: Always clean up in `afterEach`
3. **Real Constraints**: Test actual database behavior, not mocked
4. **Multi-Tenant**: Always validate organization-level isolation
5. **Error Cases**: Test constraint violations, not just happy paths

## Resources

- [Testcontainers Docs](https://node.testcontainers.org/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
