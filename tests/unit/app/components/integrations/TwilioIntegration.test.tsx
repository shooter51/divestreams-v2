import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TwilioIntegration } from "../../../../../app/components/integrations/TwilioIntegration";

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

describe("TwilioIntegration", () => {
  const onNotification = vi.fn();

  it("renders 'Send Test SMS' button when connected", () => {
    render(<TwilioIntegration isConnected={true} onNotification={onNotification} />);
    expect(screen.getByRole("button", { name: /send test sms/i })).toBeInTheDocument();
  });

  it("does not render button when not connected", () => {
    render(<TwilioIntegration isConnected={false} onNotification={onNotification} />);
    expect(screen.queryByRole("button", { name: /send test sms/i })).not.toBeInTheDocument();
  });
});
