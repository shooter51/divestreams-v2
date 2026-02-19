/**
 * ContentBlockRenderer Component Unit Tests
 *
 * Tests rendering of all supported content block types:
 * heading, paragraph, image, spacer, divider, cta, and unknown.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentBlockRenderer } from "../../../../app/components/ContentBlockRenderer";

vi.mock("isomorphic-dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

vi.mock("../../../../lib/security/sanitize", () => ({
  sanitizeUrl: (url: string) => url,
}));

// Inline type definitions matching the schema shape used by the component
type HeadingBlock = {
  id: string;
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
};

type ParagraphBlock = {
  id: string;
  type: "paragraph";
  content: string;
};

type ImageBlock = {
  id: string;
  type: "image";
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};

type SpacerBlock = {
  id: string;
  type: "spacer";
  height: number;
};

type DividerBlock = {
  id: string;
  type: "divider";
  style?: "solid" | "dashed" | "dotted";
};

type CtaBlock = {
  id: string;
  type: "cta";
  title: string;
  buttonText: string;
  buttonUrl: string;
  description?: string;
  backgroundColor?: string;
};

type UnknownBlock = {
  id: string;
  type: "unknown-type";
};

type AnyBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | SpacerBlock
  | DividerBlock
  | CtaBlock
  | UnknownBlock;

describe("ContentBlockRenderer", () => {
  describe("renders empty when blocks array is empty", () => {
    it("renders a container with no child block content", () => {
      const { container } = render(
        <ContentBlockRenderer blocks={[] as any} />,
      );
      // The outer div is rendered but has no meaningful children
      expect(container.firstChild).toBeInTheDocument();
      expect(container.firstChild?.childNodes.length).toBe(0);
    });
  });

  describe("heading blocks", () => {
    it.each([1, 2, 3, 4, 5, 6] as const)(
      "renders h%i with correct text and classes",
      (level) => {
        const block: HeadingBlock = {
          id: `h${level}`,
          type: "heading",
          level,
          content: `Heading Level ${level}`,
        };

        render(<ContentBlockRenderer blocks={[block] as any} />);

        const heading = screen.getByRole("heading", {
          level,
          name: `Heading Level ${level}`,
        });
        expect(heading).toBeInTheDocument();
        expect(heading.tagName.toLowerCase()).toBe(`h${level}`);
        expect(heading).toHaveClass("font-bold", "mb-6");
      },
    );

    it("applies the correct size class for h1", () => {
      const block: HeadingBlock = {
        id: "h1",
        type: "heading",
        level: 1,
        content: "Big Heading",
      };
      render(<ContentBlockRenderer blocks={[block] as any} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("text-4xl");
    });

    it("applies the correct size class for h3", () => {
      const block: HeadingBlock = {
        id: "h3",
        type: "heading",
        level: 3,
        content: "Mid Heading",
      };
      render(<ContentBlockRenderer blocks={[block] as any} />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveClass("text-2xl");
    });
  });

  describe("paragraph blocks", () => {
    it("renders paragraph block with dangerouslySetInnerHTML", () => {
      const block: ParagraphBlock = {
        id: "p1",
        type: "paragraph",
        content: "<p>Hello <strong>world</strong></p>",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const prose = container.querySelector(".prose");
      expect(prose).toBeInTheDocument();
      expect(prose?.innerHTML).toBe("<p>Hello <strong>world</strong></p>");
    });

    it("applies prose classes to paragraph block", () => {
      const block: ParagraphBlock = {
        id: "p2",
        type: "paragraph",
        content: "<p>Text</p>",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const el = container.querySelector(".prose");
      expect(el).toHaveClass("prose-lg", "max-w-none", "mb-6");
    });
  });

  describe("image blocks", () => {
    it("renders image with src and alt", () => {
      const block: ImageBlock = {
        id: "img1",
        type: "image",
        url: "https://example.com/photo.jpg",
        alt: "A beautiful dive site",
      };

      render(<ContentBlockRenderer blocks={[block] as any} />);

      const img = screen.getByRole("img", { name: "A beautiful dive site" });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    });

    it("renders caption when provided", () => {
      const block: ImageBlock = {
        id: "img2",
        type: "image",
        url: "https://example.com/coral.jpg",
        alt: "Coral reef",
        caption: "Great Barrier Reef",
      };

      render(<ContentBlockRenderer blocks={[block] as any} />);

      expect(screen.getByText("Great Barrier Reef")).toBeInTheDocument();
    });

    it("does not render caption element when not provided", () => {
      const block: ImageBlock = {
        id: "img3",
        type: "image",
        url: "https://example.com/fish.jpg",
        alt: "Clownfish",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      expect(container.querySelector("figcaption")).not.toBeInTheDocument();
    });
  });

  describe("spacer blocks", () => {
    it("renders a div with correct inline height style", () => {
      const block: SpacerBlock = {
        id: "spacer1",
        type: "spacer",
        height: 48,
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      // The spacer is an unstyled div with only inline style
      const spacerDiv = container.querySelector(
        'div[style="height: 48px;"]',
      ) as HTMLElement | null;
      expect(spacerDiv).toBeInTheDocument();
    });

    it("respects different heights", () => {
      const block: SpacerBlock = {
        id: "spacer2",
        type: "spacer",
        height: 120,
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const spacerDiv = container.querySelector(
        'div[style="height: 120px;"]',
      ) as HTMLElement | null;
      expect(spacerDiv).toBeInTheDocument();
    });
  });

  describe("divider blocks", () => {
    it("renders an hr element", () => {
      const block: DividerBlock = {
        id: "divider1",
        type: "divider",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const hr = container.querySelector("hr");
      expect(hr).toBeInTheDocument();
    });

    it("renders hr with solid border class by default", () => {
      const block: DividerBlock = {
        id: "divider2",
        type: "divider",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const hr = container.querySelector("hr");
      expect(hr).toHaveClass("border-solid");
    });

    it("renders hr with dashed border class when style is dashed", () => {
      const block: DividerBlock = {
        id: "divider3",
        type: "divider",
        style: "dashed",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const hr = container.querySelector("hr");
      expect(hr).toHaveClass("border-dashed");
    });

    it("renders hr with dotted border class when style is dotted", () => {
      const block: DividerBlock = {
        id: "divider4",
        type: "divider",
        style: "dotted",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      const hr = container.querySelector("hr");
      expect(hr).toHaveClass("border-dotted");
    });
  });

  describe("CTA blocks", () => {
    it("renders title text", () => {
      const block: CtaBlock = {
        id: "cta1",
        type: "cta",
        title: "Join Us Today",
        buttonText: "Get Started",
        buttonUrl: "https://example.com/signup",
      };

      render(<ContentBlockRenderer blocks={[block] as any} />);

      expect(screen.getByText("Join Us Today")).toBeInTheDocument();
    });

    it("renders button text as an anchor link", () => {
      const block: CtaBlock = {
        id: "cta2",
        type: "cta",
        title: "Book Now",
        buttonText: "Reserve Your Spot",
        buttonUrl: "https://example.com/book",
      };

      render(<ContentBlockRenderer blocks={[block] as any} />);

      const link = screen.getByRole("link", { name: "Reserve Your Spot" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://example.com/book");
    });

    it("renders optional description", () => {
      const block: CtaBlock = {
        id: "cta3",
        type: "cta",
        title: "Learn to Dive",
        buttonText: "Start Now",
        buttonUrl: "/start",
        description: "Beginner-friendly courses available",
      };

      render(<ContentBlockRenderer blocks={[block] as any} />);

      expect(
        screen.getByText("Beginner-friendly courses available"),
      ).toBeInTheDocument();
    });
  });

  describe("unknown block types", () => {
    it("renders nothing for an unrecognised block type", () => {
      const block: UnknownBlock = {
        id: "unknown1",
        type: "unknown-type",
      };

      const { container } = render(
        <ContentBlockRenderer blocks={[block] as any} />,
      );

      // Outer wrapper div is present but contains no rendered output
      expect(container.firstChild?.childNodes.length).toBe(0);
    });
  });

  describe("multiple blocks", () => {
    it("renders multiple blocks in order", () => {
      const blocks: AnyBlock[] = [
        { id: "h1", type: "heading", level: 1, content: "Title" },
        { id: "p1", type: "paragraph", content: "<p>Body text</p>" },
        {
          id: "img1",
          type: "image",
          url: "https://example.com/img.jpg",
          alt: "Photo",
        },
      ];

      render(<ContentBlockRenderer blocks={blocks as any} />);

      expect(
        screen.getByRole("heading", { level: 1, name: "Title" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Photo" })).toBeInTheDocument();
    });
  });
});
