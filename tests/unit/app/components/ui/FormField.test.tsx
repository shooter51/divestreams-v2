/**
 * FormField Component Unit Tests
 *
 * Tests the FormField, Input, Select, Textarea, Checkbox, and MoneyInput
 * components including:
 * - FormField: label, error, required asterisk, helpText, children
 * - Input: label linked to input via htmlFor/id
 * - Select: options and placeholder rendering
 * - Textarea: renders correctly
 * - Checkbox: label and description
 * - MoneyInput: currency symbol rendering
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  FormField,
  Input,
  Select,
  Textarea,
  Checkbox,
  MoneyInput,
} from "../../../../../app/components/ui/FormField";

describe("FormField Component", () => {
  describe("Label Rendering", () => {
    it("renders the label text", () => {
      render(
        <FormField label="Email Address">
          <input type="email" />
        </FormField>
      );
      expect(screen.getByText("Email Address")).toBeInTheDocument();
    });

    it("renders a label element", () => {
      render(
        <FormField label="My Label">
          <input />
        </FormField>
      );
      expect(screen.getByText("My Label").tagName).toBe("LABEL");
    });

    it("links label to child via htmlFor derived from label text", () => {
      render(
        <FormField label="First Name">
          <input id="field-first-name" />
        </FormField>
      );
      const label = screen.getByText("First Name");
      expect(label).toHaveAttribute("for", "field-first-name");
    });

    it("uses provided id for label htmlFor", () => {
      render(
        <FormField label="Custom Field" id="custom-id">
          <input id="custom-id" />
        </FormField>
      );
      const label = screen.getByText("Custom Field");
      expect(label).toHaveAttribute("for", "custom-id");
    });
  });

  describe("Children Rendering", () => {
    it("renders children inside the field", () => {
      render(
        <FormField label="Test">
          <input data-testid="test-input" />
        </FormField>
      );
      expect(screen.getByTestId("test-input")).toBeInTheDocument();
    });
  });

  describe("Error Rendering", () => {
    it("renders error message when error prop is provided", () => {
      render(
        <FormField label="Name" error="Name is required">
          <input />
        </FormField>
      );
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });

    it("does not render error message when no error", () => {
      render(
        <FormField label="Name">
          <input />
        </FormField>
      );
      // No error text present
      expect(screen.queryByText("is required")).not.toBeInTheDocument();
    });
  });

  describe("Required Asterisk", () => {
    it("renders an asterisk when required is true", () => {
      render(
        <FormField label="Email" required>
          <input />
        </FormField>
      );
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("does not render asterisk when required is false", () => {
      render(
        <FormField label="Email" required={false}>
          <input />
        </FormField>
      );
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });
  });

  describe("HelpText", () => {
    it("renders helpText when no error is present", () => {
      render(
        <FormField label="Password" helpText="Must be at least 8 characters">
          <input />
        </FormField>
      );
      expect(screen.getByText("Must be at least 8 characters")).toBeInTheDocument();
    });

    it("does not render helpText when an error is present", () => {
      render(
        <FormField label="Password" helpText="Must be 8 chars" error="Password too short">
          <input />
        </FormField>
      );
      expect(screen.queryByText("Must be 8 chars")).not.toBeInTheDocument();
      expect(screen.getByText("Password too short")).toBeInTheDocument();
    });
  });
});

describe("Input Component", () => {
  describe("Label and Input Linking", () => {
    it("renders a label element", () => {
      render(<Input label="Username" />);
      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("renders an input element", () => {
      render(<Input label="Username" />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("links label to input via htmlFor/id derived from label", () => {
      render(<Input label="User Name" />);
      const label = screen.getByText("User Name");
      const input = screen.getByRole("textbox");
      const expectedId = "field-user-name";
      expect(label).toHaveAttribute("for", expectedId);
      expect(input).toHaveAttribute("id", expectedId);
    });
  });

  describe("Error State", () => {
    it("renders error message when error is provided", () => {
      render(<Input label="Email" error="Invalid email address" />);
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });

    it("applies error border class when error is present", () => {
      render(<Input label="Email" error="Required" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("border-danger");
    });
  });

  describe("Required Asterisk", () => {
    it("renders asterisk when required is true", () => {
      render(<Input label="Email" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  describe("HelpText", () => {
    it("renders helpText when no error", () => {
      render(<Input label="Username" helpText="Choose a unique username" />);
      expect(screen.getByText("Choose a unique username")).toBeInTheDocument();
    });
  });
});

describe("Select Component", () => {
  const testOptions = [
    { value: "opt1", label: "Option One" },
    { value: "opt2", label: "Option Two" },
    { value: "opt3", label: "Option Three" },
  ];

  describe("Label and Select Rendering", () => {
    it("renders a label element", () => {
      render(<Select label="Choose Option" options={testOptions} />);
      expect(screen.getByText("Choose Option")).toBeInTheDocument();
    });

    it("renders a select element", () => {
      render(<Select label="Choose Option" options={testOptions} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("links label to select via htmlFor/id", () => {
      render(<Select label="My Select" options={testOptions} />);
      const label = screen.getByText("My Select");
      const select = screen.getByRole("combobox");
      const expectedId = "field-my-select";
      expect(label).toHaveAttribute("for", expectedId);
      expect(select).toHaveAttribute("id", expectedId);
    });
  });

  describe("Options Rendering", () => {
    it("renders all provided options", () => {
      render(<Select label="Select" options={testOptions} />);
      expect(screen.getByRole("option", { name: "Option One" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Option Two" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Option Three" })).toBeInTheDocument();
    });

    it("renders options with correct values", () => {
      render(<Select label="Select" options={testOptions} />);
      const optionOne = screen.getByRole("option", { name: "Option One" });
      expect(optionOne).toHaveValue("opt1");
    });
  });

  describe("Placeholder Option", () => {
    it("renders a placeholder option when placeholder is provided", () => {
      render(
        <Select label="Select" options={testOptions} placeholder="-- Choose --" />
      );
      expect(screen.getByRole("option", { name: "-- Choose --" })).toBeInTheDocument();
    });

    it("does not render placeholder option when not provided", () => {
      render(<Select label="Select" options={testOptions} />);
      // Total option count should equal only the provided options
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(testOptions.length);
    });
  });

  describe("Error State", () => {
    it("renders error message when error is provided", () => {
      render(<Select label="Status" options={testOptions} error="Please select an option" />);
      expect(screen.getByText("Please select an option")).toBeInTheDocument();
    });
  });

  describe("Required Asterisk", () => {
    it("renders asterisk when required is true", () => {
      render(<Select label="Status" options={testOptions} required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });
});

describe("Textarea Component", () => {
  describe("Label and Textarea Rendering", () => {
    it("renders a label element", () => {
      render(<Textarea label="Description" />);
      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("renders a textarea element", () => {
      render(<Textarea label="Description" />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("links label to textarea via htmlFor/id", () => {
      render(<Textarea label="My Notes" />);
      const label = screen.getByText("My Notes");
      const textarea = screen.getByRole("textbox");
      const expectedId = "field-my-notes";
      expect(label).toHaveAttribute("for", expectedId);
      expect(textarea).toHaveAttribute("id", expectedId);
    });
  });

  describe("Error State", () => {
    it("renders error message when error is provided", () => {
      render(<Textarea label="Notes" error="Notes cannot be empty" />);
      expect(screen.getByText("Notes cannot be empty")).toBeInTheDocument();
    });
  });

  describe("Required Asterisk", () => {
    it("renders asterisk when required is true", () => {
      render(<Textarea label="Comments" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  describe("HelpText", () => {
    it("renders helpText when no error", () => {
      render(<Textarea label="Bio" helpText="Tell us about yourself" />);
      expect(screen.getByText("Tell us about yourself")).toBeInTheDocument();
    });
  });
});

describe("Checkbox Component", () => {
  describe("Label Rendering", () => {
    it("renders the label text", () => {
      render(<Checkbox label="I agree to the terms" />);
      expect(screen.getByText("I agree to the terms")).toBeInTheDocument();
    });

    it("renders a checkbox input", () => {
      render(<Checkbox label="Accept" />);
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
  });

  describe("Description Rendering", () => {
    it("renders description when provided", () => {
      render(
        <Checkbox
          label="Enable notifications"
          description="Receive email notifications for updates"
        />
      );
      expect(screen.getByText("Receive email notifications for updates")).toBeInTheDocument();
    });

    it("does not render description element when not provided", () => {
      const { container } = render(<Checkbox label="Accept" />);
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(0);
    });
  });

  describe("Checkbox Attributes", () => {
    it("accepts standard checkbox HTML attributes", () => {
      render(<Checkbox label="Check me" defaultChecked />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("can be disabled", () => {
      render(<Checkbox label="Disabled" disabled />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });
  });
});

describe("MoneyInput Component", () => {
  describe("Currency Symbol Rendering", () => {
    it("renders the default dollar sign currency symbol", () => {
      render(<MoneyInput label="Price" />);
      expect(screen.getByText("$")).toBeInTheDocument();
    });

    it("renders a custom currency symbol", () => {
      render(<MoneyInput label="Price" currency="€" />);
      expect(screen.getByText("€")).toBeInTheDocument();
    });

    it("renders GBP currency symbol", () => {
      render(<MoneyInput label="Price" currency="£" />);
      expect(screen.getByText("£")).toBeInTheDocument();
    });
  });

  describe("Label Rendering", () => {
    it("renders the label text", () => {
      render(<MoneyInput label="Booking Fee" />);
      expect(screen.getByText("Booking Fee")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("renders error message when error is provided", () => {
      render(<MoneyInput label="Amount" error="Amount must be positive" />);
      expect(screen.getByText("Amount must be positive")).toBeInTheDocument();
    });
  });

  describe("Required Asterisk", () => {
    it("renders asterisk when required is true", () => {
      render(<MoneyInput label="Price" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  describe("Input Attributes", () => {
    it("renders a number input", () => {
      render(<MoneyInput label="Price" />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("type", "number");
    });

    it("has step='0.01' for currency precision", () => {
      render(<MoneyInput label="Price" />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "0.01");
    });
  });
});
