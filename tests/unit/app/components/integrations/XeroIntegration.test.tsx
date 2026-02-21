import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { XeroIntegration } from "../../../../../app/components/integrations/XeroIntegration";
import type { XeroSettings } from "../../../../../app/components/integrations/types";

vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
    Form: ({ children, ...props }: Record<string, unknown>) => <form {...props}>{children}</form>,
  }),
  Link: ({ to, children, ...props }: Record<string, unknown>) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../../../../../app/components/integrations/Icons", () => ({
  Icons: new Proxy({}, {
    get: () => ({ className }: { className?: string }) => <span data-testid="icon" className={className} />,
  }),
}));

const mockXeroSettings: XeroSettings = {
  tenantId: "tenant-123",
  tenantName: "Test Org",
  syncInvoices: true,
  syncPayments: false,
  syncContacts: false,
  defaultRevenueAccountCode: "200",
  defaultTaxType: "OUTPUT",
  invoicePrefix: "DS-",
};

describe("XeroIntegration", () => {
  const onNotification = vi.fn();

  it("renders Configure button (as form submit) when connected", () => {
    render(
      <XeroIntegration
        isConnected={true}
        xeroSettings={mockXeroSettings}
        onNotification={onNotification}
      />
    );
    expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument();
  });

  it("configure button is a submit button inside a form with intent 'configureXero'", () => {
    render(
      <XeroIntegration
        isConnected={true}
        xeroSettings={mockXeroSettings}
        onNotification={onNotification}
      />
    );
    const button = screen.getByRole("button", { name: /configure/i });
    expect(button).toHaveAttribute("type", "submit");

    const hiddenInput = document.querySelector('input[name="intent"]') as HTMLInputElement;
    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput.value).toBe("configureXero");
  });

  it("does not render configure button when not connected", () => {
    render(
      <XeroIntegration
        isConnected={false}
        xeroSettings={null}
        onNotification={onNotification}
      />
    );
    expect(screen.queryByRole("button", { name: /configure/i })).not.toBeInTheDocument();
  });
});
