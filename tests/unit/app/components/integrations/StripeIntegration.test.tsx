import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StripeIntegration } from "../../../../../app/components/integrations/StripeIntegration";
import type { ConnectedIntegration, StripeSettings } from "../../../../../app/components/integrations/types";

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

const mockConnection: ConnectedIntegration = {
  id: "conn-1",
  accountName: "Test Account",
  accountEmail: "test@example.com",
  lastSync: new Date().toISOString(),
  lastSyncError: null,
  connectedAt: new Date(),
  settings: {},
  integrationId: "stripe",
};

const mockStripeSettings: StripeSettings = {
  liveMode: false,
  webhookConfigured: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  accountId: "acct_test123",
  accountName: "Test Business",
  publishableKeyPrefix: "pk_test_",
};

describe("StripeIntegration", () => {
  const onNotification = vi.fn();

  it("renders 'View Settings' button when connection and stripeSettings exist", () => {
    render(
      <StripeIntegration
        connection={mockConnection}
        stripeSettings={mockStripeSettings}
        onNotification={onNotification}
      />
    );
    expect(screen.getByRole("button", { name: /view settings/i })).toBeInTheDocument();
  });

  it("does not render button when no connection", () => {
    render(
      <StripeIntegration
        connection={null}
        stripeSettings={mockStripeSettings}
        onNotification={onNotification}
      />
    );
    expect(screen.queryByRole("button", { name: /view settings/i })).not.toBeInTheDocument();
  });

  it("does not render button when no stripeSettings", () => {
    render(
      <StripeIntegration
        connection={mockConnection}
        stripeSettings={null}
        onNotification={onNotification}
      />
    );
    expect(screen.queryByRole("button", { name: /view settings/i })).not.toBeInTheDocument();
  });

  it("clicking 'View Settings' should work (basic interaction)", () => {
    render(
      <StripeIntegration
        connection={mockConnection}
        stripeSettings={mockStripeSettings}
        onNotification={onNotification}
      />
    );
    const button = screen.getByRole("button", { name: /view settings/i });
    // Should not throw when clicked
    fireEvent.click(button);
    // After click the settings modal would show — verify button still accessible (component didn't crash)
    expect(button).toBeInTheDocument();
  });
});
