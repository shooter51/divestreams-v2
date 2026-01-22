# 90% Unit Test Coverage Strategy Design

**Date:** 2026-01-22
**Current Coverage:** 12.5% overall
**Target Coverage:** 90% overall
**Approach:** Comprehensive testing with systematic execution

## 1. Architecture & Testing Stack

### Testing Stack
- **Framework:** Vitest (already configured)
- **React Testing:** @testing-library/react + @testing-library/user-event
- **Router Testing:** Custom React Router v7 test harness
- **Mocking Strategy:** Mock at loader/action boundary (not service layer)

### Architectural Decision: Loader-Level Mocking

We'll mock at the loader/action boundary rather than the service layer. This approach:
- Decouples tests from implementation details
- Matches React Router v7 architecture (components use `useLoaderData()`)
- Makes tests resilient to refactoring
- Reduces coupling between tests and business logic

### Coverage Distribution Strategy

```
Routes (0% → 85%): ~100 files × 90% = +40% overall coverage
Components (0% → 85%): ~50 files × 85% = +15% overall coverage
lib/auth: 39% → 95% = +8% overall
lib/jobs: 10% → 90% = +12% overall
lib/middleware: 2% → 90% = +5% overall
lib/training: 0% → 85% = +3% overall
lib/db: 57% → 90% = +7% overall

Total: 12.5% → 90%+ ✓
```

## 2. React Router Test Harness Implementation

### Core Test Utility (`tests/utils/route-test-helpers.ts`)

```typescript
import { createMemoryRouter, RouterProvider } from "react-router";
import { render } from "@testing-library/react";

export function renderRoute(
  component: React.ComponentType,
  options: {
    loader?: () => Promise<any> | any;
    action?: (args: any) => Promise<any> | any;
    initialPath?: string;
    loaderData?: any;
  } = {}
) {
  const { loader, action, initialPath = "/", loaderData } = options;

  const routes = [{
    path: initialPath,
    Component: component,
    loader: loader || (() => loaderData || null),
    action: action || undefined,
  }];

  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}
```

### Key Features
- **Loader Mocking:** Pass either a loader function or pre-computed loaderData
- **Action Testing:** Optional action function for form submissions
- **Path Control:** Set initial route path for nested routes
- **React Router Context:** Full router context available (useNavigate, useLoaderData work correctly)

### Usage Pattern
```typescript
// Test a dashboard route
const { getByText } = renderRoute(DashboardIndex, {
  loaderData: { stats: { bookings: 42, revenue: 10000 } }
});

expect(getByText("42 bookings")).toBeInTheDocument();
```

## 3. Systematic Route Testing Strategy

### Alphabetical Sweep Approach

Starting with `app/routes/_.dashboard.tsx`, work through every route file alphabetically. Each route gets a test file in `tests/unit/routes/` mirroring the route structure.

### Comprehensive Test Template (Per Route)

```typescript
describe("Route: _.dashboard.tsx", () => {
  describe("Loader", () => {
    it("should load dashboard stats successfully", async () => { });
    it("should handle database errors gracefully", async () => { });
    it("should enforce authentication", async () => { });
  });

  describe("Component Rendering", () => {
    it("should render stats cards with correct data", async () => { });
    it("should display loading state", async () => { });
    it("should show error message on load failure", async () => { });
  });

  describe("User Interactions", () => {
    it("should navigate to bookings on card click", async () => { });
    it("should refresh data on manual refresh", async () => { });
  });

  describe("Edge Cases", () => {
    it("should handle empty data gracefully", async () => { });
    it("should display correct number formatting", async () => { });
  });
});
```

### Coverage Target Per Route

Achieve 90%+ coverage by testing:
- Loader success/failure paths
- All conditional rendering branches
- User interactions (clicks, form submissions)
- Error boundaries
- Loading states
- Edge cases (empty data, null values, extreme values)

### Execution Order
1. Create test file structure for first 10 routes
2. Implement comprehensive tests for each
3. Verify 90%+ coverage per file
4. Move to next batch

## 4. Business Logic Testing Improvements (Parallel Track)

While route testing progresses, simultaneously improve business logic coverage in `lib/` directories.

### Priority Areas with Current → Target

**1. lib/auth (39% → 95%)**
- Auth middleware edge cases (expired tokens, malformed headers)
- Session management (creation, validation, refresh)
- Permission checks (role-based access, org isolation)
- Password hashing/validation edge cases

**2. lib/jobs (10% → 90%)**
- Job queue operations (enqueue, dequeue, retry logic)
- Worker lifecycle (startup, shutdown, error recovery)
- Job scheduling edge cases (concurrent jobs, priority)
- Error handling and dead letter queue

**3. lib/middleware (2% → 90%)**
- Tenant resolution (subdomain parsing, fallbacks)
- Request context setup (org, user, schema)
- Error handling middleware (different error types)
- Rate limiting and security middleware

**4. lib/training (0% → 85%)**
- Training catalog import logic
- Data transformation and validation
- Error handling for malformed data
- Batch processing edge cases

**5. lib/db queries (57% → 90%)**
- Complex query functions (multi-table joins)
- Transaction handling (commit, rollback)
- Error cases (constraint violations, deadlocks)
- Edge cases (empty results, null handling)

### Testing Approach
- Focus on business logic, not database integration (use mocks)
- Test all branches and error paths
- Emphasize edge cases and boundary conditions
- Use existing unit test patterns already established

### Execution
2-3 developers can work on business logic tests while route tests progress, achieving parallel speedup.

## 5. Error Handling & Edge Cases Strategy

Achieving 90% coverage requires comprehensive error and edge case testing.

### Error Categories to Test

**1. Network & API Errors**
```typescript
// Test loader with fetch failures
it("should handle network timeout", async () => {
  const loader = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
  renderRoute(BookingsPage, { loader });
  expect(screen.getByText(/connection timeout/i)).toBeInTheDocument();
});
```

**2. Database Errors**
- Constraint violations (unique, foreign key, check)
- Deadlocks and lock timeouts
- Connection pool exhaustion
- Query timeouts

**3. Authentication & Authorization**
- Expired sessions
- Invalid tokens
- Missing permissions
- Cross-tenant access attempts

**4. Data Validation Errors**
- Invalid input formats
- Missing required fields
- Out-of-range values
- Type mismatches

**5. Edge Cases**
- Empty datasets (no bookings, no customers)
- Boundary values (max capacity, min price = 0)
- Null/undefined handling
- Race conditions (concurrent updates)

### Testing Pattern
```typescript
describe("Edge Cases", () => {
  it("should handle empty booking list", () => { });
  it("should handle zero revenue", () => { });
  it("should handle null customer phone", () => { });
  it("should handle max integer participants", () => { });
});
```

### Coverage Impact
Error and edge case tests typically add 15-20% coverage by exercising `catch` blocks, `if` branches, and fallback logic that happy-path tests miss.

## 6. Implementation Phases & Success Metrics

### Phase 1: Foundation (Week 1)
- Build React Router test harness
- Create test utilities and helpers
- Write first 5 route test files as reference examples
- **Target:** Test infrastructure complete, 5 routes at 90%+ coverage

### Phase 2: Route Testing Blitz (Weeks 2-3)
- Systematic sweep through all ~100 route files
- Batches of 10 routes at a time
- Parallel execution by multiple developers
- **Target:** All routes 85%+ coverage, overall coverage 50%+

### Phase 3: Business Logic Deep Dive (Weeks 2-4, parallel)
- lib/auth, lib/jobs, lib/middleware improvements
- lib/training comprehensive coverage
- lib/db query edge cases
- **Target:** All lib/ directories 90%+ coverage

### Phase 4: Polish & Edge Cases (Week 4)
- Fill coverage gaps identified by coverage reports
- Add missing edge case tests
- Error scenario comprehensive testing
- **Target:** 90%+ overall coverage achieved

### Success Metrics

```
Initial:  12.5% overall
Phase 1:  15% (infrastructure + 5 routes)
Phase 2:  55% (all routes complete)
Phase 3:  85% (business logic complete)
Phase 4:  90%+ (polish complete)
```

### Verification
- `npm run test:coverage` after each phase
- Coverage report review (identify gaps)
- CI/CD gates: require 90% on new code

## 7. Key Principles

1. **Comprehensive Coverage:** Test everything, not just business logic
2. **Full Integration Testing:** Use Testing Library for realistic component tests
3. **Mock at Boundaries:** Loader/action level, not service layer
4. **Systematic Execution:** Alphabetical sweep ensures nothing is skipped
5. **Deep Testing:** 90%+ per file with comprehensive scenarios
6. **Parallel Approach:** Routes + business logic simultaneously

## 8. Success Criteria

- Overall coverage: 90%+
- All route files: 85%+ coverage
- All lib/ directories: 90%+ coverage
- CI/CD enforces 90% on new code
- Comprehensive error handling tests
- All edge cases covered
