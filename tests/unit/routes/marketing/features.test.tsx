import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import FeaturesPage from "../../../../app/routes/marketing/features";

describe("FeaturesPage", () => {
  it("renders five feature sections", () => {
    render(
      <MemoryRouter>
        <FeaturesPage />
      </MemoryRouter>
    );
    expect(screen.getByText("Booking Management")).toBeDefined();
    expect(screen.getByText("Customer Management")).toBeDefined();
    expect(screen.getByText("Tour & Trip Planning")).toBeDefined();
    expect(screen.getByText("Equipment Tracking")).toBeDefined();
    expect(screen.getByText("Reports & Analytics")).toBeDefined();
  });

  it("renders images for each feature section", () => {
    render(
      <MemoryRouter>
        <FeaturesPage />
      </MemoryRouter>
    );
    const featureImages = screen
      .getAllByRole("img")
      .filter((img) =>
        (img.getAttribute("src") ?? "").includes("/guide/screenshots/")
      );
    expect(featureImages.length).toBe(5);
    for (const img of featureImages) {
      expect(img.getAttribute("src")).not.toBe("");
    }
  });

  it("does not render placeholder text boxes", () => {
    render(
      <MemoryRouter>
        <FeaturesPage />
      </MemoryRouter>
    );
    expect(screen.queryByText("Feature Screenshot")).toBeNull();
  });
});
