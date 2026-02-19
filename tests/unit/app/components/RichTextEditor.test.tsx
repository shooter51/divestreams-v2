/**
 * RichTextEditor Component Unit Tests
 *
 * Tests toolbar rendering, format dropdown options, editor content area,
 * hidden input for form submission, and toolbar ARIA attributes.
 * TipTap and its extensions are fully mocked.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichTextEditor } from "../../../../app/components/RichTextEditor";

vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleUnderline: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        setParagraph: () => ({ run: vi.fn() }),
        toggleHeading: () => ({ run: vi.fn() }),
        setTextAlign: () => ({ run: vi.fn() }),
        setLink: () => ({ run: vi.fn() }),
        unsetLink: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: () => false,
    getHTML: () => "<p></p>",
  }),
  EditorContent: ({ editor }: any) => (
    <div data-testid="editor-content" />
  ),
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-link", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-text-align", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-underline", () => ({
  default: {},
}));

const defaultProps = {
  value: "",
  onChange: vi.fn(),
};

describe("RichTextEditor", () => {
  describe("toolbar", () => {
    it("renders the toolbar element", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("toolbar")).toBeInTheDocument();
    });

    it("toolbar has aria-label 'Text formatting'", () => {
      render(<RichTextEditor {...defaultProps} />);

      const toolbar = screen.getByRole("toolbar");
      expect(toolbar).toHaveAttribute("aria-label", "Text formatting");
    });

    it("renders Bold button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("button", { name: /bold/i })).toBeInTheDocument();
    });

    it("renders Italic button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("button", { name: /italic/i })).toBeInTheDocument();
    });

    it("renders Underline button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("button", { name: /underline/i })).toBeInTheDocument();
    });

    it("renders Bullet List button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /bullet list/i }),
      ).toBeInTheDocument();
    });

    it("renders Numbered List button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /numbered list/i }),
      ).toBeInTheDocument();
    });

    it("renders Insert Link button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /insert link/i }),
      ).toBeInTheDocument();
    });

    it("renders Align Left button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /align left/i }),
      ).toBeInTheDocument();
    });

    it("renders Align Center button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /align center/i }),
      ).toBeInTheDocument();
    });

    it("renders Align Right button", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /align right/i }),
      ).toBeInTheDocument();
    });
  });

  describe("format dropdown", () => {
    it("renders the format select dropdown", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("combobox", { name: /text format/i })).toBeInTheDocument();
    });

    it("has 'Normal' option in format dropdown", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("option", { name: "Normal" })).toBeInTheDocument();
    });

    it("has 'Heading 2' option in format dropdown", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("option", { name: "Heading 2" })).toBeInTheDocument();
    });

    it("has 'Heading 3' option in format dropdown", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("option", { name: "Heading 3" })).toBeInTheDocument();
    });

    it("has 'Heading 4' option in format dropdown", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByRole("option", { name: "Heading 4" })).toBeInTheDocument();
    });

    it("has exactly 4 options (Normal + H2 + H3 + H4)", () => {
      render(<RichTextEditor {...defaultProps} />);

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(4);
    });
  });

  describe("editor content area", () => {
    it("renders the EditorContent component", () => {
      render(<RichTextEditor {...defaultProps} />);

      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("hidden input for form submission", () => {
    it("does NOT render a hidden input when name prop is omitted", () => {
      const { container } = render(<RichTextEditor {...defaultProps} />);

      const hiddenInput = container.querySelector('input[type="hidden"]');
      expect(hiddenInput).not.toBeInTheDocument();
    });

    it("renders a hidden input with the given name when name prop is provided", () => {
      const { container } = render(
        <RichTextEditor {...defaultProps} name="description" value="<p>Hello</p>" />,
      );

      const hiddenInput = container.querySelector(
        'input[type="hidden"][name="description"]',
      ) as HTMLInputElement | null;

      expect(hiddenInput).toBeInTheDocument();
      expect(hiddenInput?.value).toBe("<p>Hello</p>");
    });

    it("hidden input value reflects the value prop", () => {
      const { container } = render(
        <RichTextEditor
          {...defaultProps}
          name="body"
          value="<p>Some <strong>rich</strong> text</p>"
        />,
      );

      const hiddenInput = container.querySelector(
        'input[type="hidden"]',
      ) as HTMLInputElement | null;

      expect(hiddenInput?.value).toBe("<p>Some <strong>rich</strong> text</p>");
    });
  });
});
