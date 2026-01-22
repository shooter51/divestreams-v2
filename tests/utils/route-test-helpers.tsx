/**
 * React Router v7 Test Harness
 *
 * Provides utilities for testing React Router components with loader/action mocking.
 * Mock at the loader/action boundary rather than service layer for decoupling.
 */

import * as React from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render, type RenderResult } from "@testing-library/react";
import type { ComponentType } from "react";

export interface RenderRouteOptions {
  /**
   * Loader function to provide data to the route.
   * If not provided, loaderData will be used.
   */
  loader?: () => Promise<any> | any;

  /**
   * Action function for form submissions.
   */
  action?: (args: any) => Promise<any> | any;

  /**
   * Initial path for the route.
   * @default "/"
   */
  initialPath?: string;

  /**
   * Pre-computed loader data (alternative to loader function).
   * If loader is provided, this is ignored.
   */
  loaderData?: any;
}

/**
 * Renders a React Router route component with full router context.
 *
 * This utility creates a memory router with the specified component and
 * provides loader/action mocking capabilities. This allows testing route
 * components in isolation without coupling tests to implementation details.
 *
 * @example
 * ```typescript
 * // Test a dashboard route with mocked loader data
 * const { getByText } = renderRoute(DashboardIndex, {
 *   loaderData: { stats: { bookings: 42, revenue: 10000 } }
 * });
 *
 * expect(getByText("42 bookings")).toBeInTheDocument();
 * ```
 *
 * @example
 * ```typescript
 * // Test with custom loader function
 * const { getByText } = renderRoute(BookingsPage, {
 *   loader: async () => {
 *     return { bookings: [], total: 0 };
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Test form submission with action
 * const { getByRole } = renderRoute(CreateCustomerPage, {
 *   action: async ({ request }) => {
 *     const formData = await request.formData();
 *     return { success: true };
 *   }
 * });
 * ```
 */
export function renderRoute(
  component: ComponentType,
  options: RenderRouteOptions = {}
): RenderResult {
  const { loader, action, initialPath = "/", loaderData } = options;

  const routes = [
    {
      path: initialPath,
      Component: component,
      loader: loader || (() => loaderData || null),
      action: action || undefined,
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}

/**
 * Creates a mock Request object for testing loaders and actions.
 *
 * @example
 * ```typescript
 * const request = createMockRequest("http://localhost/customers", {
 *   method: "POST",
 *   body: { name: "John Doe" }
 * });
 * ```
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Request {
  const { method = "GET", headers = {}, body } = options;

  const init: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body) {
    if (body instanceof FormData) {
      init.body = body;
    } else if (typeof body === "object") {
      init.body = JSON.stringify(body);
      init.headers = new Headers({
        ...headers,
        "Content-Type": "application/json",
      });
    } else {
      init.body = body;
    }
  }

  return new Request(url, init);
}

/**
 * Creates a mock form data object for testing form submissions.
 *
 * @example
 * ```typescript
 * const formData = createMockFormData({
 *   email: "test@example.com",
 *   password: "secret123"
 * });
 * ```
 */
export function createMockFormData(
  data: Record<string, string | Blob>
): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}
