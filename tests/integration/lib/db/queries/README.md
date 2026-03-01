# Database Queries Integration Tests

## Status: Not Yet Implemented

Integration tests for `lib/db/queries` are planned but not yet functional.

### Blocker

Query functions (e.g., `getAllBoats`, `createBooking`) import the global `db` singleton from `lib/db/index`. There is currently no way to inject a test database connection. Until the query layer supports dependency injection or a `db` override mechanism, integration tests cannot wire testcontainer databases to the query functions.

### Proposed Solutions

1. **Dependency injection**: Refactor query functions to accept `db` as a parameter
2. **Module mock**: Use `vi.mock("../../../lib/db/index")` to replace the global `db` export with the testcontainer connection
3. **Environment override**: Set `DATABASE_URL` before importing query modules (requires dynamic imports)

### When Ready

Tests should cover:
- CRUD operations per entity (boats, customers, bookings, etc.)
- Multi-tenant isolation via `organization_id` filtering
- Database constraints (unique, foreign key, cascade deletes)
- Complex joins and aggregate queries
