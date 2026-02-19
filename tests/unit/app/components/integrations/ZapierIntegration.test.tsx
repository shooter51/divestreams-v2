import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ZapierIntegration } from "../../../../../app/components/integrations/ZapierIntegration";
import type { ZapierSettings } from "../../../../../app/components/integrations/types";

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

const zapierTriggers = [
  "booking.created",
  "booking.cancelled",
  "customer.created",
  "payment.received",
];

const zapierTriggerDescriptions: Record<string, string> = {
  "booking.created": "Triggered when a booking is created",
  "booking.cancelled": "Triggered when a booking is cancelled",
  "customer.created": "Triggered when a customer is created",
  "payment.received": "Triggered when a payment is received",
};

const zapierWebhookUrl = "https://app.example.com/api/integrations/zapier/webhook/abc123";

const zapierSettings: ZapierSettings = {
  webhookUrl: "https://hooks.zapier.com/hooks/catch/123456/abcdef",
  enabledTriggers: ["booking.created", "payment.received"],
};

describe("ZapierIntegration", () => {
  const onNotification = vi.fn();

  it("renders 'Configure' button when connected", () => {
    render(
      <ZapierIntegration
        isConnected={true}
        zapierTriggers={zapierTriggers}
        zapierTriggerDescriptions={zapierTriggerDescriptions}
        zapierWebhookUrl={zapierWebhookUrl}
        zapierSettings={zapierSettings}
        onNotification={onNotification}
      />
    );
    expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument();
  });

  it("does not render configure button when not connected", () => {
    render(
      <ZapierIntegration
        isConnected={false}
        zapierTriggers={zapierTriggers}
        zapierTriggerDescriptions={zapierTriggerDescriptions}
        zapierWebhookUrl={zapierWebhookUrl}
        zapierSettings={null}
        onNotification={onNotification}
      />
    );
    expect(screen.queryByRole("button", { name: /configure/i })).not.toBeInTheDocument();
  });
});
