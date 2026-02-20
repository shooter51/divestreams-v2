import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleCalendarIntegration } from "../../../../../app/components/integrations/GoogleCalendarIntegration";

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

describe("GoogleCalendarIntegration", () => {
  const onNotification = vi.fn();

  it("renders sync button when connected", () => {
    render(<GoogleCalendarIntegration isConnected={true} onNotification={onNotification} />);
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
  });

  it("sync button submits form with intent 'sync'", () => {
    render(<GoogleCalendarIntegration isConnected={true} onNotification={onNotification} />);

    const hiddenInput = document.querySelector('input[name="intent"]') as HTMLInputElement;
    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput.value).toBe("sync");
  });

  it("does not render sync button when not connected", () => {
    render(<GoogleCalendarIntegration isConnected={false} onNotification={onNotification} />);
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();
  });
});
