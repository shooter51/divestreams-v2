/**
 * Unit tests for DS-ezbr: Site login page should preserve password on failed login
 *
 * Tests that the customer site login form preserves the password field value
 * when a login attempt fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock react-router hooks
const mockActionData = vi.fn();
const mockRouteLoaderData = vi.fn();
const mockNavigation = vi.fn();
const mockSearchParams = vi.fn();

const mockLoaderData = vi.fn();

vi.mock("react-router", () => ({
  useActionData: () => mockActionData(),
  useLoaderData: () => mockLoaderData(),
  useRouteLoaderData: () => mockRouteLoaderData(),
  useNavigation: () => mockNavigation(),
  useSearchParams: () => [mockSearchParams()],
  redirect: vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
  Form: ({ children, ...props }: { children: React.ReactNode; method?: string }) => (
    <form {...props}>{children}</form>
  ),
}));

import SiteLoginPage from "../../../../../app/routes/site/login";

describe("DS-ezbr: Site login page password preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigation.mockReturnValue({ state: "idle" });
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockLoaderData.mockReturnValue({ organizationId: "org-1", csrfToken: "mock-csrf-token" });
    mockRouteLoaderData.mockReturnValue({
      organization: { id: "org1", name: "Test Dive Shop", slug: "test", logo: null },
      settings: {},
      themeVars: { fontFamily: "Inter" },
      darkCSS: "",
      enabledPages: {},
      contactInfo: null,
      customer: null,
    });
  });

  it("should preserve password field value after failed login", () => {
    mockActionData.mockReturnValue(null);

    const { rerender } = render(<SiteLoginPage />);

    // User types password
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    fireEvent.change(passwordInput, { target: { value: "MySecret123" } });
    expect(passwordInput).toHaveValue("MySecret123");

    // Simulate failed login
    mockActionData.mockReturnValue({
      errors: { form: "Invalid email or password" },
      email: "user@test.com",
    });

    rerender(<SiteLoginPage />);

    // Password should still have the value
    const passwordAfterError = screen.getByPlaceholderText("Enter your password");
    expect(passwordAfterError).toHaveValue("MySecret123");
  });

  it("should show form error on failed login", () => {
    mockActionData.mockReturnValue({
      errors: { form: "Invalid email or password" },
      email: "user@test.com",
    });

    render(<SiteLoginPage />);

    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });
});
