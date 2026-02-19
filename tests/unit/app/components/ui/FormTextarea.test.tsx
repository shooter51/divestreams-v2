/**
 * FormTextarea Component Unit Tests
 *
 * Tests the FormTextarea component including:
 * - Label and textarea rendering with correct id/name linking
 * - Error message with aria attributes
 * - maxLength character counter
 * - Disabled state
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormTextarea } from "../../../../../app/components/ui/FormTextarea";

describe("FormTextarea Component", () => {
  describe("Label and Textarea Rendering", () => {
    it("renders the label text", () => {
      render(<FormTextarea label="Description" name="description" />);
      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("renders a textarea element", () => {
      render(<FormTextarea label="Notes" name="notes" />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("links label to textarea via htmlFor and id matching the name prop", () => {
      render(<FormTextarea label="Comments" name="comments" />);
      const label = screen.getByText("Comments");
      const textarea = screen.getByRole("textbox");
      expect(label).toHaveAttribute("for", "comments");
      expect(textarea).toHaveAttribute("id", "comments");
    });

    it("sets the name attribute on the textarea element", () => {
      render(<FormTextarea label="Bio" name="user_bio" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("name", "user_bio");
    });

    it("renders with 4 rows by default", () => {
      render(<FormTextarea label="Notes" name="notes" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("rows", "4");
    });

    it("renders with custom rows when specified", () => {
      render(<FormTextarea label="Notes" name="notes" rows={8} />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("rows", "8");
    });
  });

  describe("Required Asterisk", () => {
    it("renders an asterisk when required is true", () => {
      render(<FormTextarea label="Description" name="desc" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("does not render an asterisk when required is false", () => {
      render(<FormTextarea label="Description" name="desc" required={false} />);
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    it("sets required attribute on textarea when required is true", () => {
      render(<FormTextarea label="Description" name="desc" required />);
      expect(screen.getByRole("textbox")).toBeRequired();
    });
  });

  describe("Error Message with ARIA", () => {
    it("renders the error message text when error is provided", () => {
      render(
        <FormTextarea label="Description" name="description" error="Description is required" />
      );
      expect(screen.getByText("Description is required")).toBeInTheDocument();
    });

    it("renders error message with role='alert'", () => {
      render(<FormTextarea label="Notes" name="notes" error="Notes cannot be blank" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("sets aria-invalid='true' on textarea when error is present", () => {
      render(<FormTextarea label="Notes" name="notes" error="Required" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });

    it("does not set aria-invalid when no error", () => {
      render(<FormTextarea label="Notes" name="notes" />);
      expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
    });

    it("sets aria-describedby linking to error element when error exists", () => {
      render(<FormTextarea label="Notes" name="notes" error="Error message" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("aria-describedby", "notes-error");
    });

    it("error element has the correct id", () => {
      render(<FormTextarea label="Notes" name="notes" error="Error" />);
      const errorElement = screen.getByRole("alert");
      expect(errorElement).toHaveAttribute("id", "notes-error");
    });

    it("does not set aria-describedby when no error", () => {
      render(<FormTextarea label="Notes" name="notes" />);
      expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
    });

    it("does not render error when error is null", () => {
      const { container } = render(
        <FormTextarea label="Notes" name="notes" error={null} />
      );
      expect(container.querySelectorAll("[role='alert']")).toHaveLength(0);
    });
  });

  describe("maxLength Character Counter", () => {
    it("renders character counter when maxLength is provided", () => {
      render(<FormTextarea label="Bio" name="bio" maxLength={200} />);
      expect(screen.getByText("0 / 200")).toBeInTheDocument();
    });

    it("does not render character counter when maxLength is not provided", () => {
      render(<FormTextarea label="Bio" name="bio" />);
      expect(screen.queryByText(/\/ /)).not.toBeInTheDocument();
    });

    it("updates character count when text is typed", () => {
      render(<FormTextarea label="Bio" name="bio" maxLength={100} />);
      const textarea = screen.getByRole("textbox");
      fireEvent.input(textarea, { target: { value: "Hello world" } });
      expect(screen.getByText("11 / 100")).toBeInTheDocument();
    });

    it("shows initial char count from defaultValue", () => {
      render(
        <FormTextarea label="Bio" name="bio" maxLength={100} defaultValue="Initial text" />
      );
      // defaultValue is 12 chars
      expect(screen.getByText("12 / 100")).toBeInTheDocument();
    });

    it("sets maxLength attribute on textarea", () => {
      render(<FormTextarea label="Bio" name="bio" maxLength={500} />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("maxLength", "500");
    });
  });

  describe("Disabled State", () => {
    it("renders the textarea as disabled when disabled is true", () => {
      render(<FormTextarea label="Notes" name="notes" disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("is not disabled by default", () => {
      render(<FormTextarea label="Notes" name="notes" />);
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    it("applies opacity and cursor classes when disabled", () => {
      render(<FormTextarea label="Notes" name="notes" disabled />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("opacity-50");
      expect(textarea).toHaveClass("cursor-not-allowed");
    });
  });

  describe("Placeholder", () => {
    it("renders with placeholder text when provided", () => {
      render(
        <FormTextarea label="Notes" name="notes" placeholder="Enter your notes here..." />
      );
      expect(screen.getByPlaceholderText("Enter your notes here...")).toBeInTheDocument();
    });
  });

  describe("Default Value", () => {
    it("renders with defaultValue text", () => {
      render(
        <FormTextarea label="Bio" name="bio" defaultValue="Initial content" />
      );
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Initial content");
    });
  });
});
