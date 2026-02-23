# Integration Testing Challenges

## Overview

This document describes the technical challenges encountered when attempting to create database integration tests for React Router v7 server-side code.

## The Problem: `.server.ts` Module Import Restrictions

### Background

React Router v7 (formerly Remix) uses a convention where files ending in `.server.ts` or `.server.tsx` are treated as server-only code. These files are:
- Excluded from the client bundle
- Only available in server-side contexts
- Cannot be imported in browser/Vite test environments

### Impact on Testing

When trying to write integration tests for database query functions (`lib/db/queries/*.server.ts`), we encounter:

**Error in happy-dom environment (default for vitest):**
```
Error: Failed to resolve import "../../../../lib/db/tenant.server" from "tests/integration/..."
Does the file exist?
Plugin: vite:import-analysis
```

**Error in node environment:**
```
Error: Cannot find module '../../../../lib/db/tenant.server' imported from '/Users/.../tests/integration/...'
```

### Root Cause

1. **Vite bundling**: Vite (used by React Router's build system) explicitly excludes `.server.ts` files from the client bundle
2. **Module resolution**: Even in Node environment, ESM module resolution doesn't automatically resolve `.server.ts` extensions
3. **Test environment mismatch**: Vitest runs in a Vite-powered environment that inherits these bundling rules

## Attempted Solutions

### 1. Node Environment ❌
```typescript
// vitest.config.ts
test: {
  environment: "node"  // Still can't resolve .server.ts imports
}
```
**Result**: `Cannot find module` errors

### 2. Explicit File Extensions ❌
```typescript
import { getTenantDb } from "../../../../lib/db/tenant.server.ts";
```
**Result**: Still fails - Vite doesn't process `.server.ts` files at all

### 3. Module Resolution Conditions ❌
```typescript
resolve: {
  conditions: ["node"]
}
```
**Result**: No improvement - Vite still blocks `.server.ts` files

### 4. Direct Database Queries ⚠️
```typescript
// Instead of importing query functions, write queries inline
const db = drizzle(postgres(DATABASE_URL));
const equipment = await db.select().from(equipmentTable)...
```
**Result**: Works, but doesn't test the actual query functions - just duplicates the logic

## Working Approaches

### Approach 1: Testcontainers with Direct Queries

**Status**: ✅ Works but limited

```typescript
import { useTestDatabase } from "../../../setup/database";
import { equipment } from "../../../../lib/db/schema";  // Schema imports work
import { eq } from "drizzle-orm";

describe("Equipment Operations", () => {
  const getDb = useTestDatabase();

  it("should create equipment", async () => {
    const { db } = getDb();
    const [created] = await db.insert(equipment).values({...}).returning();
    expect(created).toBeDefined();
  });
});
```

**Pros:**
- Tests actual database operations
- Validates schema, constraints, indexes
- True integration testing

**Cons:**
- Doesn't test the actual query functions in `.server.ts` files
- Duplicates query logic in tests
- Coverage doesn't apply to `lib/db/queries/*.server.ts` files

### Approach 2: Mocked Unit Tests

**Status**: ✅ Currently used in `tests/integration/routes`

```typescript
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/db/queries.server", () => ({
  getAllBoats: vi.fn(),
}));
```

**Pros:**
- Can import `.server.ts` files (mocked)
- Tests route handlers and application logic
- Fast execution

**Cons:**
- Not true integration tests - database is mocked
- Doesn't validate actual database behavior
- No coverage for database query logic

### Approach 3: E2E Tests

**Status**: ✅ Already implemented (80 Playwright tests)

**Pros:**
- Tests full application stack including `.server.ts` code
- Real database operations
- True end-to-end validation

**Cons:**
- Slow execution
- Harder to debug
- Not suitable for unit-level database query testing

## Recommended Solution

### For Database Query Coverage

Given the constraints, the best approach for testing `lib/db/queries/*.server.ts` modules is:

**Option A: Pure Unit Tests with Mocked Database**
- Mock the database connection
- Test query logic, filtering, transformations
- Fast, focused, good for pure functions

**Option B: Manual Integration Testing**
- Use the Docker Compose test database
- Run queries manually via Node scripts
- Validate behavior in development
- Not automated but ensures correctness

**Option C: E2E Test Coverage**
- Rely on existing Playwright tests
- These already exercise database queries through full workflows
- Provides integration coverage indirectly

### For Other Module Coverage

Focus unit test expansion on modules that DON'T require database access:
- `lib/auth/*` - Pure functions, validation logic ✅ (already done)
- `lib/validation/*` - Schema validation ✅ (already done)
- `lib/utils/*` - Helper functions ✅ (already done)
- `lib/email/templates/*` - Template generation ✅ (already done)
- `lib/security/*` - Sanitization, CSRF ✅ (already done)

## Future Improvements

### Potential Solutions to Explore

1. **Separate Test Runner**: Use a different test runner (e.g., plain Node with `tsx`) for server-side integration tests
   - Pro: Direct Node execution, no Vite bundling issues
   - Con: Separate test infrastructure, different tooling

2. **Vitest Workspace**: Configure separate vitest workspaces for client and server tests
   - Pro: Keep Vitest, separate configs
   - Con: Complex setup, may still have issues

3. **Build Step**: Compile `.server.ts` files before testing
   - Pro: Standard Node modules after compilation
   - Con: Adds build complexity, slower test cycles

4. **React Router Plugin**: Wait for official testing utilities from React Router team
   - Pro: Officially supported, designed for framework
   - Con: May not exist yet, waiting on external team

## Test Database Infrastructure

Despite the `.server.ts` import challenges, we have successfully set up:

✅ **Docker Compose test database** (PostgreSQL + Redis)
✅ **Automated migration execution**
✅ **Test data seeding**
✅ **Management scripts** (`npm run test:db:*`)
✅ **Environment configuration** (`.env.test`)

This infrastructure is ready and can be used for:
- Manual integration testing during development
- Future testing approaches that solve the import issue
- E2E test database backend

## Conclusion

The `.server.ts` import restriction in React Router v7/Vite creates a significant barrier to traditional integration testing of server-side database code. While workarounds exist (mocking, direct queries, E2E tests), none provide the ideal combination of:
- Testing actual query functions
- Real database operations
- Fast execution
- Good developer experience

**Current Recommendation**:
- Use **E2E tests** for integration coverage of database queries
- Use **unit tests with mocks** for query logic testing
- Use **Docker Compose test database** for manual validation
- Focus test expansion efforts on **pure function modules** that don't require database access

---

**Last Updated**: 2026-02-15
**Issue Tracker**: Consider filing an issue with React Router team for official testing guidance
