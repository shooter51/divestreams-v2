/**
 * FormSelect Component Unit Tests
 *
 * Tests the FormSelect component including:
 * - Label and select rendering with correct htmlFor/id linking
 * - Options rendering
 * - Placeholder option rendering
 * - Error message with aria attributes
 * - Disabled state
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSelect } from "../../../../../app/components/ui/FormSelect";

const testOptions = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "gb", label: "United Kingdom" },
];

describe("FormSelect Component", () => {
  describe("Label and Select Rendering", () => {
    it("renders the label text", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByText("Country")).toBeInTheDocument();
    });

    it("renders a select element", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("links label to select via htmlFor and id matching the name prop", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      const label = screen.getByText("Country");
      const select = screen.getByRole("combobox");
      expect(label).toHaveAttribute("for", "country");
      expect(select).toHaveAttribute("id", "country");
    });

    it("sets the name attribute on the select element", () => {
      render(<FormSelect label="Status" name="booking_status" options={testOptions} />);
      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("name", "booking_status");
    });
  });

  describe("Options Rendering", () => {
    it("renders all provided options", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("option", { name: "United States" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Canada" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "United Kingdom" })).toBeInTheDocument();
    });

    it("renders options with correct values", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("option", { name: "United States" })).toHaveValue("us");
      expect(screen.getByRole("option", { name: "Canada" })).toHaveValue("ca");
    });

    it("renders disabled options correctly", () => {
      const optionsWithDisabled = [
        { value: "a", label: "Active Option" },
        { value: "b", label: "Disabled Option", disabled: true },
      ];
      render(<FormSelect label="Status" name="status" options={optionsWithDisabled} />);
      const disabledOption = screen.getByRole("option", { name: "Disabled Option" });
      expect(disabledOption).toBeDisabled();
    });

    it("renders an empty options list without error", () => {
      render(<FormSelect label="Empty" name="empty" options={[]} />);
      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });
  });

  describe("Placeholder Option", () => {
    it("renders a placeholder option when placeholder is provided", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          placeholder="Select a country..."
        />
      );
      expect(screen.getByRole("option", { name: "Select a country..." })).toBeInTheDocument();
    });

    it("placeholder option has an empty value", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          placeholder="Choose..."
        />
      );
      const placeholderOption = screen.getByRole("option", { name: "Choose..." });
      expect(placeholderOption).toHaveValue("");
    });

    it("placeholder option is disabled", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          placeholder="Choose..."
        />
      );
      const placeholderOption = screen.getByRole("option", { name: "Choose..." });
      expect(placeholderOption).toBeDisabled();
    });

    it("does not render placeholder when not provided", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(testOptions.length);
    });
  });

  describe("Required Asterisk", () => {
    it("renders an asterisk when required is true", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("does not render asterisk when required is false", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} required={false} />);
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    it("sets required attribute on select when required is true", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} required />);
      expect(screen.getByRole("combobox")).toBeRequired();
    });
  });

  describe("Error Message with ARIA", () => {
    it("renders the error message text when error is provided", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          error="Please select a country"
        />
      );
      expect(screen.getByText("Please select a country")).toBeInTheDocument();
    });

    it("renders error message with role='alert'", () => {
      render(
        <FormSelect label="Country" name="country" options={testOptions} error="Required field" />
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("sets aria-invalid='true' on select when error is present", () => {
      render(
        <FormSelect label="Country" name="country" options={testOptions} error="Invalid" />
      );
      expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    });

    it("does not set aria-invalid when no error", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-invalid");
    });

    it("sets aria-describedby linking to error element id", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          error="Error message"
        />
      );
      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("aria-describedby", "country-error");
    });

    it("error element has the correct id", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          error="Error"
        />
      );
      const errorElement = screen.getByRole("alert");
      expect(errorElement).toHaveAttribute("id", "country-error");
    });

    it("does not set aria-describedby when no error", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-describedby");
    });
  });

  describe("Disabled State", () => {
    it("renders the select as disabled when disabled is true", () => {
      render(
        <FormSelect label="Country" name="country" options={testOptions} disabled />
      );
      expect(screen.getByRole("combobox")).toBeDisabled();
    });

    it("is not disabled by default", () => {
      render(<FormSelect label="Country" name="country" options={testOptions} />);
      expect(screen.getByRole("combobox")).not.toBeDisabled();
    });

    it("applies opacity class when disabled", () => {
      render(
        <FormSelect label="Country" name="country" options={testOptions} disabled />
      );
      expect(screen.getByRole("combobox")).toHaveClass("opacity-50");
      expect(screen.getByRole("combobox")).toHaveClass("cursor-not-allowed");
    });
  });

  describe("Default Value", () => {
    it("pre-selects the option matching defaultValue", () => {
      render(
        <FormSelect
          label="Country"
          name="country"
          options={testOptions}
          defaultValue="ca"
        />
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("ca");
    });
  });
});
