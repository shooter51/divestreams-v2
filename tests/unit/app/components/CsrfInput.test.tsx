/**
 * CsrfInput and CsrfTokenInput Component Unit Tests
 *
 * Tests that both CSRF hidden input components correctly render
 * or suppress output depending on token availability.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CsrfInput, CsrfTokenInput } from "../../../../app/components/CsrfInput";

vi.mock("react-router", () => ({
  useRouteLoaderData: vi.fn(),
}));

vi.mock("../../../../lib/security/csrf-constants", () => ({
  CSRF_FIELD_NAME: "_csrf",
}));

// Import after mocking so we can control the return value
import { useRouteLoaderData } from "react-router";

const mockUseRouteLoaderData = vi.mocked(useRouteLoaderData);

describe("CsrfInput", () => {
  it("renders a hidden input with the CSRF token when loader data has csrfToken", () => {
    mockUseRouteLoaderData.mockReturnValue({ csrfToken: "abc-token-123" });

    render(<CsrfInput />);

    const input = screen.getByDisplayValue("abc-token-123") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("hidden");
    expect(input.name).toBe("_csrf");
  });

  it("renders nothing when loader data has no csrfToken", () => {
    mockUseRouteLoaderData.mockReturnValue({ csrfToken: undefined });

    const { container } = render(<CsrfInput />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when useRouteLoaderData returns undefined", () => {
    mockUseRouteLoaderData.mockReturnValue(undefined);

    const { container } = render(<CsrfInput />);

    expect(container.firstChild).toBeNull();
  });

  it("hidden input has name equal to CSRF_FIELD_NAME (_csrf)", () => {
    mockUseRouteLoaderData.mockReturnValue({ csrfToken: "some-token" });

    render(<CsrfInput />);

    const input = screen.getByDisplayValue("some-token") as HTMLInputElement;
    expect(input.name).toBe("_csrf");
  });
});

describe("CsrfTokenInput", () => {
  it("renders a hidden input with the given token", () => {
    render(<CsrfTokenInput token="direct-token-xyz" />);

    const input = screen.getByDisplayValue("direct-token-xyz") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("hidden");
    expect(input.name).toBe("_csrf");
  });

  it("renders nothing when token prop is undefined", () => {
    const { container } = render(<CsrfTokenInput token={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when token prop is empty string", () => {
    // Empty string is falsy, component should return null
    const { container } = render(<CsrfTokenInput token="" />);

    expect(container.firstChild).toBeNull();
  });

  it("hidden input has name equal to CSRF_FIELD_NAME (_csrf)", () => {
    render(<CsrfTokenInput token="token-abc" />);

    const input = screen.getByDisplayValue("token-abc") as HTMLInputElement;
    expect(input.name).toBe("_csrf");
  });
});
