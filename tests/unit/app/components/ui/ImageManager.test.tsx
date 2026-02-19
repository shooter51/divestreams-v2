/**
 * ImageManager Component Unit Tests
 *
 * Tests the image manager's empty state, image count label,
 * Add Image button visibility, image grid rendering, Primary badge,
 * and the presence of delete / set-primary action buttons in the DOM.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageManager } from "../../../../../app/components/ui/ImageManager";
import type { Image } from "../../../../../app/components/ui/ImageManager";

vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
    Form: "form",
  }),
}));

vi.mock("../../../../../app/components/ui/Button", () => ({
  Button: ({ children, onClick, loading, type, ...rest }: any) => (
    <button type={type || "button"} onClick={onClick} disabled={loading} {...rest}>
      {children}
    </button>
  ),
}));

global.fetch = vi.fn();

const baseProps = {
  entityType: "product" as const,
  entityId: "ent-1",
};

function makeImage(overrides: Partial<Image> & { id: string }): Image {
  return {
    url: "https://example.com/image.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    filename: "image.jpg",
    sortOrder: 0,
    isPrimary: false,
    ...overrides,
  };
}

describe("ImageManager", () => {
  describe("empty state", () => {
    it("renders 'No images yet' text when images array is empty", () => {
      render(<ImageManager {...baseProps} images={[]} />);

      expect(screen.getByText("No images yet")).toBeInTheDocument();
    });

    it("renders 'Upload your first image' button in empty state", () => {
      render(<ImageManager {...baseProps} images={[]} />);

      expect(
        screen.getByRole("button", { name: /upload your first image/i }),
      ).toBeInTheDocument();
    });
  });

  describe("image count label", () => {
    it("renders 'Images (0/5)' when empty and maxImages is default", () => {
      render(<ImageManager {...baseProps} images={[]} />);

      expect(screen.getByText("Images (0/5)")).toBeInTheDocument();
    });

    it("renders correct count when some images are present", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),
        makeImage({ id: "img-2", sortOrder: 1 }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      expect(screen.getByText("Images (2/5)")).toBeInTheDocument();
    });

    it("reflects custom maxImages in the label", () => {
      render(<ImageManager {...baseProps} images={[]} maxImages={10} />);

      expect(screen.getByText("Images (0/10)")).toBeInTheDocument();
    });
  });

  describe("Add Image button", () => {
    it("renders 'Add Image' button when image count is below max", () => {
      render(<ImageManager {...baseProps} images={[]} />);

      // Button in header area (distinct from the "Upload your first image" button)
      expect(screen.getByRole("button", { name: /add image/i })).toBeInTheDocument();
    });

    it("hides 'Add Image' button when at max capacity", () => {
      const images = Array.from({ length: 5 }, (_, i) =>
        makeImage({ id: `img-${i}`, sortOrder: i, isPrimary: i === 0 }),
      );

      render(<ImageManager {...baseProps} images={images} maxImages={5} />);

      expect(
        screen.queryByRole("button", { name: /add image/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("image grid", () => {
    it("renders img elements for each image in the list", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true, thumbnailUrl: "https://example.com/t1.jpg", url: "https://example.com/u1.jpg", filename: "first.jpg" }),
        makeImage({ id: "img-2", sortOrder: 1, thumbnailUrl: "https://example.com/t2.jpg", url: "https://example.com/u2.jpg", filename: "second.jpg" }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      const imgs = screen.getAllByRole("img");
      expect(imgs).toHaveLength(2);
    });

    it("renders image with correct src from thumbnailUrl", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true, thumbnailUrl: "https://cdn.example.com/thumb.jpg" }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://cdn.example.com/thumb.jpg");
    });
  });

  describe("Primary badge", () => {
    it("shows 'Primary' badge on the primary image", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),
        makeImage({ id: "img-2", sortOrder: 1 }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      expect(screen.getByText("Primary")).toBeInTheDocument();
    });

    it("does not show 'Primary' badge when no image is primary", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: false }),
        makeImage({ id: "img-2", sortOrder: 1, isPrimary: false }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      expect(screen.queryByText("Primary")).not.toBeInTheDocument();
    });

    it("shows exactly one 'Primary' badge even with multiple images", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),
        makeImage({ id: "img-2", sortOrder: 1 }),
        makeImage({ id: "img-3", sortOrder: 2 }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      expect(screen.getAllByText("Primary")).toHaveLength(1);
    });
  });

  describe("action buttons in DOM", () => {
    it("renders a delete button (title='Delete image') for each image", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),
        makeImage({ id: "img-2", sortOrder: 1 }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      const deleteButtons = screen.getAllByTitle("Delete image");
      expect(deleteButtons).toHaveLength(2);
    });

    it("renders 'Set as primary' button only for non-primary images", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),   // no set-primary button
        makeImage({ id: "img-2", sortOrder: 1 }),       // has set-primary button
        makeImage({ id: "img-3", sortOrder: 2 }),       // has set-primary button
      ];

      render(<ImageManager {...baseProps} images={images} />);

      const primaryButtons = screen.getAllByTitle("Set as primary");
      expect(primaryButtons).toHaveLength(2);
    });

    it("does not render 'Set as primary' button for the primary image", () => {
      const images = [
        makeImage({ id: "img-1", isPrimary: true }),
      ];

      render(<ImageManager {...baseProps} images={images} />);

      expect(screen.queryByTitle("Set as primary")).not.toBeInTheDocument();
    });
  });
});
