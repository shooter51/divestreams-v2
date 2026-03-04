/**
 * Unit tests for DS-mkrf, DS-rmih: Signup form password validation UX
 *
 * DS-mkrf: Signup form should clear 'Passwords do not match' error when
 *          user corrects either password field (not just confirmPassword)
 * DS-rmih: Signup form should preserve password field values on validation failure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock react-router hooks
const mockActionData = vi.fn();
const mockRouteLoaderData = vi.fn();
const mockNavigation = vi.fn();

vi.mock("react-router", () => ({
  useActionData: () => mockActionData(),
  useRouteLoaderData: () => mockRouteLoaderData(),
  useNavigation: () => mockNavigation(),
  redirect: vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
  Form: ({ children, ...props }: { children: React.ReactNode; method?: string }) => (
    <form {...props}>{children}</form>
  ),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  registerCustomer: vi.fn(),
  loginCustomer: vi.fn(),
}));

vi.mock("../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

import SiteRegisterPage from "../../../../../app/routes/site/register";

describe("DS-mkrf: Signup form stale password mismatch error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigation.mockReturnValue({ state: "idle" });
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

  it("should clear confirmPassword error when user types in password field", () => {
    // Simulate server returning 'Passwords do not match' error
    mockActionData.mockReturnValue({
      success: false,
      errors: { confirmPassword: "Passwords do not match" },
    });

    render(<SiteRegisterPage />);

    // Error should be visible initially
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // User types in the PASSWORD field (not confirmPassword) to fix the mismatch
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "NewMatch123" } });

    // The confirmPassword error should now be hidden
    expect(screen.queryByText("Passwords do not match")).not.toBeInTheDocument();
  });

  it("should clear confirmPassword error when user types in confirmPassword field", () => {
    mockActionData.mockReturnValue({
      success: false,
      errors: { confirmPassword: "Passwords do not match" },
    });

    render(<SiteRegisterPage />);

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // User types in confirmPassword field
    const confirmInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(confirmInput, { target: { value: "NewMatch123" } });

    // Error should be hidden
    expect(screen.queryByText("Passwords do not match")).not.toBeInTheDocument();
  });
});

describe("DS-rmih: Signup form password preservation on validation failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigation.mockReturnValue({ state: "idle" });
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

  it("should preserve password values when other field has validation error", () => {
    // First render without errors
    mockActionData.mockReturnValue(null);

    const { rerender } = render(<SiteRegisterPage />);

    // User types passwords
    const passwordInput = screen.getByLabelText("Password");
    const confirmInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(passwordInput, { target: { value: "StrongPass1" } });
    fireEvent.change(confirmInput, { target: { value: "StrongPass1" } });

    expect(passwordInput).toHaveValue("StrongPass1");
    expect(confirmInput).toHaveValue("StrongPass1");

    // Simulate validation error on a different field (e.g., terms not accepted)
    mockActionData.mockReturnValue({
      success: false,
      errors: { terms: "You must accept the Terms of Service" },
    });

    rerender(<SiteRegisterPage />);

    // Password fields should still have their values (controlled inputs)
    expect(screen.getByLabelText("Password")).toHaveValue("StrongPass1");
    expect(screen.getByLabelText(/confirm password/i)).toHaveValue("StrongPass1");
  });

  it("should preserve password values after password-specific validation error", () => {
    mockActionData.mockReturnValue(null);

    const { rerender } = render(<SiteRegisterPage />);

    // User types a weak password
    const passwordInput = screen.getByLabelText("Password");
    const confirmInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(passwordInput, { target: { value: "weak" } });
    fireEvent.change(confirmInput, { target: { value: "weak" } });

    // Server returns password validation error
    mockActionData.mockReturnValue({
      success: false,
      errors: { password: "Password must contain at least 8 characters" },
    });

    rerender(<SiteRegisterPage />);

    // Both password fields should retain their values
    expect(screen.getByLabelText("Password")).toHaveValue("weak");
    expect(screen.getByLabelText(/confirm password/i)).toHaveValue("weak");
  });
});
