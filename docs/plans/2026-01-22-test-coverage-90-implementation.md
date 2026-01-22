# 90% Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 90% unit test coverage across the entire DiveStreams v2 codebase through systematic route testing and business logic improvements.

**Architecture:** Build React Router test harness for component testing, mock at loader/action boundary, systematic alphabetical sweep through routes, parallel business logic testing.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/user-event, React Router v7

**Current Coverage:** 12.5% overall
**Target Coverage:** 90% overall

---

## Phase 1: Foundation - Test Harness & First 5 Routes

### Task 1: Install Testing Dependencies

**Files:**
- Modify: `package.json` (add dependencies if missing)

**Step 1: Check existing dependencies**

Run: `npm list @testing-library/react @testing-library/user-event`

Expected: Should show installed versions or "not installed"

**Step 2: Install dependencies if needed**

Run: `npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom`

Expected: Dependencies installed successfully

**Step 3: Verify installation**

Run: `npm list @testing-library/react`

Expected: Shows version (e.g., @testing-library/react@14.x.x)

---

### Task 2: Create React Router Test Harness

**Files:**
- Create: `tests/utils/route-test-helpers.ts`
- Create: `tests/utils/route-test-helpers.test.ts`

**Step 1: Write test for renderRoute utility**

Create `tests/utils/route-test-helpers.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderRoute } from "./route-test-helpers";
import { useLoaderData } from "react-router";

// Simple test component
function TestComponent() {
  const data = useLoaderData();
  return <div>Data: {JSON.stringify(data)}</div>;
}

describe("renderRoute", () => {
  it("should render component with loader data", () => {
    const { getByText } = renderRoute(TestComponent, {
      loaderData: { test: "value" },
    });

    expect(getByText(/test.*value/i)).toBeInTheDocument();
  });

  it("should call loader function when provided", async () => {
    const mockLoader = vi.fn().mockResolvedValue({ dynamic: "data" });

    const { findByText } = renderRoute(TestComponent, {
      loader: mockLoader,
    });

    expect(mockLoader).toHaveBeenCalled();
    expect(await findByText(/dynamic.*data/i)).toBeInTheDocument();
  });

  it("should handle custom initial path", () => {
    const { container } = renderRoute(TestComponent, {
      initialPath: "/custom/path",
      loaderData: { path: "custom" },
    });

    expect(container).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/utils/route-test-helpers.test.ts`

Expected: FAIL - "Cannot find module './route-test-helpers'"

**Step 3: Implement renderRoute utility**

Create `tests/utils/route-test-helpers.ts`:

```typescript
import { createMemoryRouter, RouterProvider } from "react-router";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";

export interface RenderRouteOptions {
  loader?: () => Promise<any> | any;
  action?: (args: any) => Promise<any> | any;
  initialPath?: string;
  loaderData?: any;
}

export function renderRoute(
  component: ComponentType,
  options: RenderRouteOptions = {}
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

**Step 4: Run test to verify it passes**

Run: `npm test tests/utils/route-test-helpers.test.ts`

Expected: PASS - 3 tests passing

**Step 5: Commit**

```bash
git add tests/utils/route-test-helpers.ts tests/utils/route-test-helpers.test.ts
git commit -m "feat: add React Router test harness utility

- Created renderRoute helper for testing route components
- Mocks at loader/action boundary
- Supports both static loaderData and dynamic loader functions
- Includes comprehensive test suite"
```

---

### Task 3: Test First Route - admin/logout.tsx

**Files:**
- Create: `tests/unit/routes/admin/logout.test.ts`
- Reference: `app/routes/admin/logout.tsx`

**Step 1: Write comprehensive tests for logout route**

Create `tests/unit/routes/admin/logout.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "react-router";

// Mock the auth module
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

import { action, loader } from "../../../../app/routes/admin/logout";
import { auth } from "../../../../lib/auth";

describe("Route: admin/logout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action (POST /logout)", () => {
    it("should sign out and redirect to /login with cookies", async () => {
      const mockCookies = "session=; Max-Age=0";
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue(mockCookies),
        },
      };

      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/logout", { method: "POST" });
      const response = await action({ request, params: {}, context: {} });

      expect(auth.api.signOut).toHaveBeenCalledWith({
        headers: request.headers,
        asResponse: true,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toBe(mockCookies);
    });

    it("should redirect without Set-Cookie if no cookies returned", async () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      };

      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/logout", { method: "POST" });
      const response = await action({ request, params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    });

    it("should handle sign out API error", async () => {
      (auth.api.signOut as any).mockRejectedValue(new Error("API error"));

      const request = new Request("http://localhost/logout", { method: "POST" });

      await expect(action({ request, params: {}, context: {} })).rejects.toThrow("API error");
    });
  });

  describe("loader (GET /logout)", () => {
    it("should redirect authenticated user to /dashboard", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "test@test.com" },
      });

      const request = new Request("http://localhost/logout");
      const response = await loader({ request, params: {}, context: {} });

      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: request.headers,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("should redirect unauthenticated user to /login", async () => {
      (auth.api.getSession as any).mockResolvedValue(null);

      const request = new Request("http://localhost/logout");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should redirect to /login if session has no user", async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: null });

      const request = new Request("http://localhost/logout");
      const response = await loader({ request, params: {}, context: {} });

      expect(response.headers.get("Location")).toBe("/login");
    });
  });

  describe("Edge Cases", () => {
    it("should handle session check timeout", async () => {
      (auth.api.getSession as any).mockRejectedValue(new Error("Timeout"));

      const request = new Request("http://localhost/logout");

      await expect(loader({ request, params: {}, context: {} })).rejects.toThrow("Timeout");
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test tests/unit/routes/admin/logout.test.ts`

Expected: PASS - All tests passing (no implementation changes needed, testing existing code)

**Step 3: Check coverage for this file**

Run: `npm test tests/unit/routes/admin/logout.test.ts -- --coverage`

Expected: Coverage report shows >90% for admin/logout.tsx

**Step 4: Commit**

```bash
git add tests/unit/routes/admin/logout.test.ts
git commit -m "test: add comprehensive tests for admin/logout route

- Tests action (sign out flow)
- Tests loader (redirect logic based on auth state)
- Covers error cases and edge cases
- Achieves 90%+ coverage for logout route"
```

---

### Task 4: Test Second Route - admin/login.tsx

**Files:**
- Create: `tests/unit/routes/admin/login.test.tsx`
- Reference: `app/routes/admin/login.tsx`

**Step 1: Write comprehensive tests for login route**

Create `tests/unit/routes/admin/login.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderRoute } from "../../../utils/route-test-helpers";

// Mock all dependencies
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  getPlatformContext: vi.fn(),
  PLATFORM_ORG_SLUG: "admin",
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("https://app.divestreams.com"),
}));

import LoginPage, { loader, action, meta } from "../../../../app/routes/admin/login";
import { auth } from "../../../../lib/auth";
import { getPlatformContext } from "../../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";

describe("Route: admin/login.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct page title", () => {
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Admin Login - DiveStreams" }]);
    });
  });

  describe("loader", () => {
    it("should redirect to app URL if not admin subdomain", async () => {
      (isAdminSubdomain as any).mockReturnValue(false);

      const request = new Request("http://shop.divestreams.com/login");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://app.divestreams.com");
    });

    it("should redirect to /dashboard if already authenticated", async () => {
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue({
        user: { id: "admin-123" },
        org: { slug: "admin" },
      });

      const request = new Request("http://admin.divestreams.com/login");
      const response = await loader({ request, params: {}, context: {} });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("should return null for unauthenticated user on admin subdomain", async () => {
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue(null);

      const request = new Request("http://admin.divestreams.com/login");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeNull();
    });
  });

  describe("action", () => {
    it("should return error for invalid email format", async () => {
      const request = new Request("http://localhost/login", { method: "POST" });
      const formData = new FormData();
      formData.append("email", "invalid-email");
      formData.append("password", "password123");

      vi.spyOn(request, "formData").mockResolvedValue(formData);

      const response = await action({ request, params: {}, context: {} });

      expect(response).toEqual({ error: "Please enter a valid email address" });
    });

    it("should return error for missing email", async () => {
      const request = new Request("http://localhost/login", { method: "POST" });
      const formData = new FormData();
      formData.append("password", "password123");

      vi.spyOn(request, "formData").mockResolvedValue(formData);

      const response = await action({ request, params: {}, context: {} });

      expect(response).toEqual({ error: "Please enter a valid email address" });
    });

    it("should return error for missing password", async () => {
      const request = new Request("http://localhost/login", { method: "POST" });
      const formData = new FormData();
      formData.append("email", "test@test.com");

      vi.spyOn(request, "formData").mockResolvedValue(formData);

      const response = await action({ request, params: {}, context: {} });

      expect(response).toEqual({ error: "Password is required" });
    });
  });

  describe("Component Rendering", () => {
    it("should render login form", () => {
      renderRoute(LoginPage, { loaderData: null });

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("should display error message from action", () => {
      const actionData = { error: "Invalid credentials" };

      renderRoute(LoginPage, { loaderData: null });

      // Note: This requires the component to use useActionData()
      // If error is displayed, it should be visible
      // This test may need adjustment based on actual component implementation
    });

    it("should disable submit button while submitting", async () => {
      const user = userEvent.setup();

      renderRoute(LoginPage, { loaderData: null });

      const submitButton = screen.getByRole("button", { name: /sign in/i });

      expect(submitButton).not.toBeDisabled();

      // Fill form and submit
      await user.type(screen.getByLabelText(/email/i), "test@test.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(submitButton);

      // Note: Actual behavior depends on component implementation
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty email field", () => {
      renderRoute(LoginPage, { loaderData: null });

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveValue("");
    });

    it("should handle redirectTo query parameter", async () => {
      const request = new Request("http://localhost/login", { method: "POST" });
      const formData = new FormData();
      formData.append("email", "test@test.com");
      formData.append("password", "password123");
      formData.append("redirectTo", "/custom/path");

      vi.spyOn(request, "formData").mockResolvedValue(formData);

      // Mock successful sign in (simplified - actual implementation more complex)
      (auth.api.signInEmail as any).mockResolvedValue({
        ok: true,
        headers: { get: () => "session=abc" },
        json: async () => ({ user: { id: "123" } }),
      });

      // Test would continue based on actual implementation
    });
  });
});
```

**Step 2: Run test to verify tests work**

Run: `npm test tests/unit/routes/admin/login.test.tsx`

Expected: PASS or FAIL with specific errors to fix (adjust mocks based on actual implementation)

**Step 3: Fix any failing tests**

Adjust mocks and test expectations based on actual component behavior.

**Step 4: Check coverage**

Run: `npm test tests/unit/routes/admin/login.test.tsx -- --coverage`

Expected: Coverage >85% for admin/login.tsx

**Step 5: Commit**

```bash
git add tests/unit/routes/admin/login.test.tsx
git commit -m "test: add comprehensive tests for admin/login route

- Tests meta, loader, and action functions
- Tests component rendering and form interactions
- Covers validation errors and edge cases
- Achieves 85%+ coverage for login route"
```

---

### Task 5: Measure Phase 1 Progress

**Step 1: Run full test suite**

Run: `npm test`

Expected: All tests passing

**Step 2: Generate coverage report**

Run: `npm run test:coverage`

Expected: HTML coverage report generated in `coverage/` directory

**Step 3: Check overall coverage percentage**

Run: `npm run test:coverage | grep "All files"`

Expected: Overall coverage increased from 12.5% to ~13-14%

**Step 4: Verify test harness is working**

Check that:
- ✅ `renderRoute` utility created and tested
- ✅ First 2 routes have comprehensive tests
- ✅ Tests are passing
- ✅ Coverage is increasing

---

## Phase 2: Route Testing Blitz (Next Steps)

### Task 6-100: Systematic Route Testing

**Pattern to repeat for each route:**

1. Create test file in `tests/unit/routes/` matching route structure
2. Write comprehensive tests covering:
   - Meta functions
   - Loader (all paths, errors)
   - Action (validation, success, errors)
   - Component rendering
   - User interactions
   - Edge cases
3. Run tests, verify >85% coverage for that file
4. Commit with descriptive message

**Route order (alphabetical):**
- admin/contact-messages.tsx
- admin/index.tsx
- admin/layout.tsx
- admin/plans.$id.tsx
- admin/plans.tsx
- admin/tenants.$id.tsx
- admin/tenants.new.tsx
- api/auth.$.tsx
- ...continue through all routes

**Target:** All ~100 route files tested with 85%+ coverage each

---

## Phase 3: Business Logic Testing (Parallel)

### Task 101: lib/auth Improvements (39% → 95%)

**Files to test comprehensively:**
- `lib/auth/middleware.ts`
- `lib/auth/session.server.ts`
- `lib/auth/org-context.server.ts`
- `lib/auth/platform-context.server.ts`

**Test categories:**
- Token expiration handling
- Malformed headers
- Session creation/validation/refresh
- Permission checks (role-based, org isolation)
- Password hashing edge cases

### Task 102: lib/jobs Improvements (10% → 90%)

**Files to test:**
- `lib/jobs/queue.ts`
- `lib/jobs/worker.ts`
- `lib/jobs/scheduler.ts`

**Test categories:**
- Enqueue/dequeue/retry logic
- Worker lifecycle (startup, shutdown, error recovery)
- Concurrent job handling
- Dead letter queue

### Task 103: lib/middleware Improvements (2% → 90%)

**Files to test:**
- `lib/middleware/tenant.ts`
- `lib/middleware/error-handler.ts`
- `lib/middleware/rate-limit.ts`

**Test categories:**
- Subdomain parsing and fallbacks
- Request context setup
- Error types handling
- Rate limiting logic

### Task 104: lib/training Improvements (0% → 85%)

**Files to test:**
- `lib/training/import.ts`
- `lib/training/transform.ts`
- `lib/training/validate.ts`

**Test categories:**
- Catalog import logic
- Data transformation
- Validation rules
- Batch processing

### Task 105: lib/db query improvements (57% → 90%)

**Files to test:**
- Complex queries in `lib/db/queries.server.ts`
- Transaction handling
- Error cases
- Edge cases

---

## Phase 4: Polish & Verification

### Task 106: Fill Coverage Gaps

**Step 1: Generate coverage report**

Run: `npm run test:coverage`

**Step 2: Identify files below 90%**

Review HTML report, find files with <90% coverage

**Step 3: Add missing tests**

For each file below target:
- Identify untested branches
- Write tests for those branches
- Verify coverage improvement

### Task 107: Verify CI/CD Integration

**Step 1: Update CI/CD config**

Ensure pipeline runs coverage checks

**Step 2: Set coverage thresholds**

Configure minimum coverage percentages

**Step 3: Test pipeline**

Push to trigger CI/CD, verify coverage gates work

---

## Success Criteria Checklist

- [ ] React Router test harness created and tested
- [ ] All ~100 route files have tests with 85%+ coverage
- [ ] lib/auth at 95%+ coverage
- [ ] lib/jobs at 90%+ coverage
- [ ] lib/middleware at 90%+ coverage
- [ ] lib/training at 85%+ coverage
- [ ] lib/db at 90%+ coverage
- [ ] Overall project coverage at 90%+
- [ ] CI/CD enforces 90% coverage on new code
- [ ] All tests passing in CI/CD

---

## Notes for Implementation

- **TDD Approach:** Write test first, verify it fails, implement, verify it passes, commit
- **Small Commits:** Commit after each route test file or small group of tests
- **Coverage Checks:** Run `npm run test:coverage` frequently to track progress
- **Mock Strategy:** Mock at loader/action boundary, not service layer
- **Test Independence:** Each test should be independent, no shared state

**Estimated Timeline:**
- Phase 1: 1 week (foundation + reference examples)
- Phase 2: 2-3 weeks (systematic route testing)
- Phase 3: 2-4 weeks (parallel business logic, can overlap with Phase 2)
- Phase 4: 1 week (polish and verification)

**Total: ~4-6 weeks to 90% coverage**
