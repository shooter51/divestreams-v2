/**
 * HelpWidget Component Unit Tests
 *
 * Tests the floating help chat widget: panel open/close, message sending,
 * thinking indicator, error display, Escape key, click-outside, and
 * ARIA dialog attributes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { HelpWidget } from "../../../../../app/components/help/HelpWidget";

// Mock react-router
vi.mock("react-router", () => ({
  useRouteLoaderData: vi.fn(),
}));

// Mock CSRF constants
vi.mock("../../../../../lib/security/csrf-constants", () => ({
  CSRF_FIELD_NAME: "_csrf",
}));

import { useRouteLoaderData } from "react-router";

const mockUseRouteLoaderData = vi.mocked(useRouteLoaderData);

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Provide a stable crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

describe("HelpWidget", () => {
  beforeEach(() => {
    uuidCounter = 0;
    vi.clearAllMocks();
    mockUseRouteLoaderData.mockReturnValue({ csrfToken: "test-csrf-token" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------ helpers
  function openWidget() {
    fireEvent.click(screen.getByRole("button", { name: /open help/i }));
  }

  // ------------------------------------------------------------------ rendering
  describe("initial rendering", () => {
    it("renders the floating open-help button", () => {
      render(<HelpWidget />);
      expect(screen.getByRole("button", { name: /open help/i })).toBeInTheDocument();
    });

    it("does not render the chat panel initially", () => {
      render(<HelpWidget />);
      expect(screen.queryByRole("dialog", { name: /help/i })).toBeNull();
    });
  });

  // ------------------------------------------------------------------ open / close
  describe("open and close", () => {
    it("opens the chat panel when the floating button is clicked", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
    });

    it("shows a close button inside the panel header", () => {
      render(<HelpWidget />);
      openWidget();
      // There are two "Close help" buttons when the panel is open (header + floating btn)
      const closeButtons = screen.getAllByRole("button", { name: /close help/i });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("closes the panel when the header close button is clicked", () => {
      render(<HelpWidget />);
      openWidget();
      // The header close button is inside the dialog
      const dialog = screen.getByRole("dialog");
      const closeBtn = dialog.querySelector('button[aria-label="Close help"]') as HTMLElement;
      fireEvent.click(closeBtn);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("toggles closed when the floating button is clicked again", () => {
      render(<HelpWidget />);
      openWidget();
      // The HelpButton has aria-haspopup="dialog" and aria-expanded; the header
      // close button does not. Use that to select the floating button.
      const allClose = screen.getAllByRole("button", { name: /close help/i });
      const floatingClose = allClose.find((btn) => btn.getAttribute("aria-haspopup") === "dialog")!;
      fireEvent.click(floatingClose);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes the panel on Escape key", () => {
      render(<HelpWidget />);
      openWidget();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("does not close the panel on other keys", () => {
      render(<HelpWidget />);
      openWidget();
      fireEvent.keyDown(document, { key: "Enter" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------ empty state
  describe("empty state", () => {
    it("shows an introductory message when there are no messages", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByText(/how can i help/i)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------ message sending
  describe("sending messages", () => {
    it("renders a text input with placeholder", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    });

    it("renders a send button", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    });

    it("send button is disabled when input is empty", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    });

    it("send button is enabled when input has content", () => {
      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "How do I add a booking?" },
      });
      expect(screen.getByRole("button", { name: /send message/i })).not.toBeDisabled();
    });

    it("appends user message to the conversation on send", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Here is how.", sources: [] }),
      });

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "How do I add a booking?" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      expect(screen.getByText("How do I add a booking?")).toBeInTheDocument();
    });

    it("clears the input after sending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Here is how." }),
      });

      render(<HelpWidget />);
      openWidget();
      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: "How do I add a booking?" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      expect(input).toHaveValue("");
    });

    it("calls fetch with POST method and correct URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Answer here." }),
      });

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "What is a trip?" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      expect(mockFetch).toHaveBeenCalledWith("/api/help", expect.objectContaining({ method: "POST" }));
    });

    it("displays the assistant answer after a successful response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "You can add a booking from the Bookings page." }),
      });

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "How do I add a booking?" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      await waitFor(() =>
        expect(screen.getByText("You can add a booking from the Bookings page.")).toBeInTheDocument()
      );
    });

    it("displays source article titles when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "Here is the answer.",
          sources: [
            { title: "Getting started with bookings", path: "/help/bookings" },
            { title: "Tour management guide", path: "/help/tours" },
          ],
        }),
      });

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "Booking question" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      // Source titles are rendered inside <li> elements with a leading bullet
      expect(screen.getByText(/Getting started with bookings/)).toBeInTheDocument();
      expect(screen.getByText(/Tour management guide/)).toBeInTheDocument();
    });

    it("shows thinking indicator while loading", async () => {
      // Return a never-resolving promise to keep loading state
      let resolve!: (v: unknown) => void;
      mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = r)));

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "Question?" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      expect(screen.getByRole("status", { name: /thinking/i })).toBeInTheDocument();

      // Clean up: resolve the dangling promise
      await act(async () => {
        resolve({ ok: true, json: async () => ({ answer: "Done." }) });
      });
    });

    it("submitting with Enter key sends the message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Sure thing." }),
      });

      render(<HelpWidget />);
      openWidget();
      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: "Help me please" } });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------ error handling
  describe("error handling", () => {
    it("displays an error message when the API returns an error field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Service unavailable" }),
      });

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "Question?" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      await waitFor(() =>
        expect(screen.getByText("Service unavailable")).toBeInTheDocument()
      );
    });

    it("displays a fallback error message when fetch rejects", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<HelpWidget />);
      openWidget();
      fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
        target: { value: "Question?" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
      });

      await waitFor(() =>
        expect(screen.getByText("Network error")).toBeInTheDocument()
      );
    });
  });

  // ------------------------------------------------------------------ ARIA
  describe("ARIA attributes", () => {
    it("chat panel has role='dialog'", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("chat panel has aria-modal='true'", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("chat panel has aria-label='Help'", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("dialog", { name: "Help" })).toBeInTheDocument();
    });

    it("input has aria-label='Your question'", () => {
      render(<HelpWidget />);
      openWidget();
      expect(screen.getByRole("textbox", { name: /your question/i })).toBeInTheDocument();
    });
  });
});
