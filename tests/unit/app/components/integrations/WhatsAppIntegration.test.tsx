import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppIntegration } from "../../../../../app/components/integrations/WhatsAppIntegration";

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

describe("WhatsAppIntegration", () => {
  const onNotification = vi.fn();

  it("renders 'Send Test Message' button when connected", () => {
    render(<WhatsAppIntegration isConnected={true} onNotification={onNotification} />);
    expect(screen.getByRole("button", { name: /send test message/i })).toBeInTheDocument();
  });

  it("does not render button when not connected", () => {
    render(<WhatsAppIntegration isConnected={false} onNotification={onNotification} />);
    expect(screen.queryByRole("button", { name: /send test message/i })).not.toBeInTheDocument();
  });
});
