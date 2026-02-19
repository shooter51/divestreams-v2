import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickBooksIntegration } from "../../../../../app/components/integrations/QuickBooksIntegration";

vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  }),
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../../../../../app/components/integrations/Icons", () => ({
  Icons: new Proxy({}, {
    get: () => ({ className }: { className?: string }) => <span data-testid="icon" className={className} />,
  }),
}));

describe("QuickBooksIntegration", () => {
  const onNotification = vi.fn();

  it("renders 'Manage Settings' link when connected", () => {
    render(<QuickBooksIntegration isConnected={true} onNotification={onNotification} />);
    expect(screen.getByRole("link", { name: /manage settings/i })).toBeInTheDocument();
  });

  it("link points to /tenant/settings/integrations/quickbooks", () => {
    render(<QuickBooksIntegration isConnected={true} onNotification={onNotification} />);
    const link = screen.getByRole("link", { name: /manage settings/i });
    expect(link).toHaveAttribute("href", "/tenant/settings/integrations/quickbooks");
  });

  it("does not render link when not connected", () => {
    render(<QuickBooksIntegration isConnected={false} onNotification={onNotification} />);
    expect(screen.queryByRole("link", { name: /manage settings/i })).not.toBeInTheDocument();
  });
});
