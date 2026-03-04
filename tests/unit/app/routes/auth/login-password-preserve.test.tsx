/**
 * Unit tests for DS-ezbr: Login page should preserve password on failed login
 *
 * Tests that the tenant admin login form preserves the password field value
 * when a login attempt fails, instead of clearing it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock react-router hooks
const mockActionData = vi.fn();
const mockLoaderData = vi.fn();
const mockNavigation = vi.fn();

vi.mock("react-router", () => ({
  useActionData: () => mockActionData(),
  useLoaderData: () => mockLoaderData(),
  useNavigation: () => mockNavigation(),
  redirect: vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock CSRF
vi.mock("../../../../../lib/security/csrf.server", () => ({
  generateAnonCsrfToken: () => "test-csrf-token",
  validateAnonCsrfToken: () => true,
  CSRF_FIELD_NAME: "_csrf",
}));

vi.mock("../../../../components/CsrfInput", () => ({
  CsrfTokenInput: ({ token }: { token: string }) => (
    <input type="hidden" name="_csrf" value={token} />
  ),
}));

vi.mock("../../../../../app/components/CsrfInput", () => ({
  CsrfTokenInput: ({ token }: { token: string }) => (
    <input type="hidden" name="_csrf" value={token} />
  ),
}));

// Need to import after mocks
import LoginPage from "../../../../../app/routes/auth/login";

describe("DS-ezbr: Login page password preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigation.mockReturnValue({ state: "idle" });
  });

  it("should preserve password field value after failed login", () => {
    // First render: tenant login mode with no errors
    mockLoaderData.mockReturnValue({
      mode: "tenant",
      tenantName: "Test Dive Shop",
      noAccessError: null,
      mainSiteUrl: "https://divestreams.com",
      csrfToken: "test-csrf",
    });
    mockActionData.mockReturnValue(null);

    const { rerender } = render(<LoginPage />);

    // User types password
    const passwordInput = screen.getByLabelText(/password/i, { selector: "input" });
    fireEvent.change(passwordInput, { target: { value: "MySecret123" } });
    expect(passwordInput).toHaveValue("MySecret123");

    // Simulate failed login - actionData returns error
    mockActionData.mockReturnValue({
      errors: { form: "Invalid email or password" },
      email: "user@test.com",
    });

    rerender(<LoginPage />);

    // Password should still have the value (controlled input)
    const passwordAfterError = screen.getByLabelText(/password/i, { selector: "input" });
    expect(passwordAfterError).toHaveValue("MySecret123");
  });

  it("should show error message on failed login", () => {
    mockLoaderData.mockReturnValue({
      mode: "tenant",
      tenantName: "Test Dive Shop",
      noAccessError: null,
      mainSiteUrl: "https://divestreams.com",
      csrfToken: "test-csrf",
    });
    mockActionData.mockReturnValue({
      errors: { form: "Invalid email or password" },
      email: "user@test.com",
    });

    render(<LoginPage />);

    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });

  it("should preserve email defaultValue after failed login", () => {
    mockLoaderData.mockReturnValue({
      mode: "tenant",
      tenantName: "Test Dive Shop",
      noAccessError: null,
      mainSiteUrl: "https://divestreams.com",
      csrfToken: "test-csrf",
    });
    mockActionData.mockReturnValue({
      errors: { form: "Invalid email or password" },
      email: "user@test.com",
    });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveValue("user@test.com");
  });
});
