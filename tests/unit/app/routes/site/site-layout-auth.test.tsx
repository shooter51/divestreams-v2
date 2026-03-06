/**
 * Unit tests for DS-npek: Site header should show 'My Account' after customer login
 *
 * Tests that the site layout header correctly renders auth state based on
 * customer session data from the loader.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-router hooks
const mockLoaderData = vi.fn();
const mockLocation = vi.fn();

vi.mock("react-router", () => ({
  useLoaderData: () => mockLoaderData(),
  useLocation: () => mockLocation(),
  useRouteError: vi.fn(),
  isRouteErrorResponse: vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
  Form: ({ children, ...props }: { children: React.ReactNode; method?: string; action?: string }) => (
    <form {...props}>{children}</form>
  ),
  Outlet: () => <div data-testid="outlet" />,
  redirect: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({ db: {} }));
vi.mock("../../../../../lib/db/schema/auth", () => ({ organization: {} }));
vi.mock("../../../../../lib/themes/public-site-themes", () => ({
  getTheme: vi.fn(),
  getThemeStyleBlock: vi.fn(() => ""),
}));
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));
vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn(),
}));

import SiteLayout from "../../../../../app/routes/site/_layout";

const baseLoaderData = {
  organization: { id: "org1", name: "Test Dive Shop", slug: "test", logo: null },
  settings: {
    enabled: true,
    theme: "ocean",
    primaryColor: "",
    secondaryColor: "",
    logoUrl: null,
    heroImageUrl: null,
    heroVideoUrl: null,
    fontFamily: "inter",
    pages: { home: true, about: true, trips: true, courses: true, equipment: false, contact: true, gallery: false },
    aboutContent: null,
    contactInfo: null,
  },
  themeVars: { fontFamily: "'Inter', system-ui, sans-serif" },
  darkCSS: "",
  enabledPages: { home: true, about: true, trips: true, courses: true, equipment: false, contact: true, gallery: false },
  contactInfo: null,
};

describe("DS-npek: Site header auth state display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.mockReturnValue({ pathname: "/site" });
  });

  it("should show 'My Account' link in header when customer is logged in", () => {
    mockLoaderData.mockReturnValue({
      ...baseLoaderData,
      customer: {
        id: "cust1",
        email: "customer@test.com",
        firstName: "Jane",
        lastName: "Doe",
      },
    });

    render(<SiteLayout />);

    // "My Account" appears in both header and footer when logged in
    const myAccountLinks = screen.getAllByText("My Account");
    expect(myAccountLinks.length).toBe(2); // header + footer
    expect(screen.queryByText("Log In")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();
  });

  it("should show 'Log In' and 'Sign Up' when no customer session", () => {
    mockLoaderData.mockReturnValue({
      ...baseLoaderData,
      customer: null,
    });

    render(<SiteLayout />);

    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Sign Up")).toBeInTheDocument();
    // "My Account" only in footer when not logged in
    const myAccountLinks = screen.getAllByText("My Account");
    expect(myAccountLinks.length).toBe(1); // Only footer
  });

  it("should show 'Log Out' button when customer is logged in", () => {
    mockLoaderData.mockReturnValue({
      ...baseLoaderData,
      customer: {
        id: "cust1",
        email: "customer@test.com",
        firstName: "Jane",
        lastName: "Doe",
      },
    });

    render(<SiteLayout />);

    expect(screen.getByText("Log Out")).toBeInTheDocument();
  });

  it("should link My Account to /site/account", () => {
    mockLoaderData.mockReturnValue({
      ...baseLoaderData,
      customer: {
        id: "cust1",
        email: "customer@test.com",
        firstName: "Jane",
        lastName: "Doe",
      },
    });

    render(<SiteLayout />);

    const myAccountLink = screen.getAllByText("My Account")[0];
    expect(myAccountLink.closest("a")).toHaveAttribute("href", "/site/account");
  });
});
