import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MailchimpIntegration } from "../../../../../app/components/integrations/MailchimpIntegration";
import type { MailchimpSettings, MailchimpAudience } from "../../../../../app/components/integrations/types";

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

describe("MailchimpIntegration", () => {
  const onNotification = vi.fn();
  const mailchimpAudiences: MailchimpAudience[] = [];
  const mailchimpSettings: MailchimpSettings | null = null;

  it("renders without crashing when not connected", () => {
    const { container } = render(
      <MailchimpIntegration
        isConnected={false}
        mailchimpSettings={mailchimpSettings}
        mailchimpAudiences={mailchimpAudiences}
        onNotification={onNotification}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it("renders nothing visible by default (modals hidden)", () => {
    const { container } = render(
      <MailchimpIntegration
        isConnected={false}
        mailchimpSettings={mailchimpSettings}
        mailchimpAudiences={mailchimpAudiences}
        onNotification={onNotification}
      />
    );
    // OAuth modal and config modal should not be visible initially
    expect(screen.queryByText("Connect Mailchimp")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue to Mailchimp")).not.toBeInTheDocument();
  });
});
