/**
 * DS-lx18: Terms/Privacy "Back to Home" links to /site (tenant site home)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-router
vi.mock("react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useLoaderData: vi.fn(() => ({ orgName: null })),
}));

describe("DS-lx18: Back to Home link href", () => {
  it("terms page Back to Home link points to /site not /", async () => {
    const { default: TermsPage } = await import("../../../../app/routes/marketing/terms");
    render(<TermsPage />);
    const link = screen.getByText("← Back to Home");
    expect(link.closest("a")?.getAttribute("href")).toBe("/site");
  });

  it("privacy page Back to Home link points to /site not /", async () => {
    const { default: PrivacyPage } = await import("../../../../app/routes/marketing/privacy");
    render(<PrivacyPage />);
    const link = screen.getByText("← Back to Home");
    expect(link.closest("a")?.getAttribute("href")).toBe("/site");
  });
});
