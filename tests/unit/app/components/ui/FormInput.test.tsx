/**
 * FormInput Component Unit Tests
 *
 * Tests the FormInput component including:
 * - Label and input rendering with correct id/name linking
 * - Required asterisk display
 * - Error message with role="alert" and aria-invalid
 * - aria-describedby linking to error element
 * - Disabled state
 * - Placeholder rendering
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormInput } from "../../../../../app/components/ui/FormInput";

describe("FormInput Component", () => {
  describe("Label and Input Rendering", () => {
    it("renders the label text", () => {
      render(<FormInput label="Email Address" name="email" />);
      expect(screen.getByText("Email Address")).toBeInTheDocument();
    });

    it("renders a label element linked to input via htmlFor and id", () => {
      render(<FormInput label="Email" name="email" />);
      const label = screen.getByText("Email");
      const input = screen.getByRole("textbox");
      // The id is set to the name prop
      expect(label).toHaveAttribute("for", "email");
      expect(input).toHaveAttribute("id", "email");
    });

    it("renders input with the correct name attribute", () => {
      render(<FormInput label="Phone" name="phone_number" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("name", "phone_number");
    });

    it("renders a text input by default", () => {
      render(<FormInput label="Username" name="username" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "text");
    });

    it("renders an email input when type='email'", () => {
      render(<FormInput label="Email" name="email" type="email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });

    it("renders a password input when type='password'", () => {
      render(<FormInput label="Password" name="password" type="password" />);
      // Password inputs are not in a role
      const { container } = render(<FormInput label="Password2" name="password2" type="password" />);
      const input = container.querySelector("input[type='password']");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Required Asterisk", () => {
    it("renders an asterisk when required is true", () => {
      render(<FormInput label="Email" name="email" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("does not render an asterisk when required is false", () => {
      render(<FormInput label="Email" name="email" required={false} />);
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    it("does not render an asterisk when required is not specified", () => {
      render(<FormInput label="Email" name="email" />);
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    it("sets required attribute on input when required is true", () => {
      render(<FormInput label="Email" name="email" required />);
      const input = screen.getByRole("textbox");
      expect(input).toBeRequired();
    });
  });

  describe("Error Message", () => {
    it("renders the error message text when error is provided", () => {
      render(<FormInput label="Email" name="email" error="Invalid email address" />);
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });

    it("renders error message with role='alert'", () => {
      render(<FormInput label="Email" name="email" error="Email is required" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
    });

    it("sets aria-invalid='true' on input when error is present", () => {
      render(<FormInput label="Email" name="email" error="Invalid" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("does not set aria-invalid when no error", () => {
      render(<FormInput label="Email" name="email" />);
      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("aria-invalid");
    });

    it("does not render error when error is null", () => {
      const { container } = render(<FormInput label="Email" name="email" error={null} />);
      const alerts = container.querySelectorAll("[role='alert']");
      expect(alerts.length).toBe(0);
    });
  });

  describe("aria-describedby Linking", () => {
    it("sets aria-describedby on input pointing to error element when error exists", () => {
      render(<FormInput label="Email" name="email" error="Error msg" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-describedby", "email-error");
    });

    it("error paragraph has the correct id matching aria-describedby", () => {
      render(<FormInput label="Email" name="email" error="Error msg" />);
      const errorParagraph = screen.getByRole("alert");
      expect(errorParagraph).toHaveAttribute("id", "email-error");
    });

    it("does not set aria-describedby when no error", () => {
      render(<FormInput label="Email" name="email" />);
      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("aria-describedby");
    });
  });

  describe("Disabled State", () => {
    it("renders the input as disabled when disabled is true", () => {
      render(<FormInput label="Email" name="email" disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("is not disabled by default", () => {
      render(<FormInput label="Email" name="email" />);
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    it("applies opacity class when disabled", () => {
      render(<FormInput label="Email" name="email" disabled />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("opacity-50");
      expect(input).toHaveClass("cursor-not-allowed");
    });
  });

  describe("Placeholder", () => {
    it("renders with placeholder text when provided", () => {
      render(<FormInput label="Email" name="email" placeholder="Enter your email" />);
      const input = screen.getByPlaceholderText("Enter your email");
      expect(input).toBeInTheDocument();
    });

    it("does not set placeholder when not provided", () => {
      render(<FormInput label="Email" name="email" />);
      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("placeholder");
    });
  });

  describe("Default Value", () => {
    it("renders with defaultValue when provided", () => {
      render(<FormInput label="Username" name="username" defaultValue="johndoe" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("johndoe");
    });
  });
});
