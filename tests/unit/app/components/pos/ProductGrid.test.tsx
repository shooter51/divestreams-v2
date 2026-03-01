/**
 * ProductGrid Component Unit Tests
 *
 * Tests the POS ProductGrid component including:
 * - Search input rendering with tab-specific placeholders
 * - Product, equipment, and trip card rendering
 * - Empty state messages for each tab
 * - Category filter pill rendering and selection
 * - Search query filtering via onSearchChange callback
 * - Add product / rental / booking interaction flows
 * - Out-of-stock product disabling
 * - SALE badge display for products on sale
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductGrid } from "../../../../../app/components/pos/ProductGrid";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const makeProduct = (overrides: Partial<typeof defaultProduct> = {}) => ({
  ...defaultProduct,
  ...overrides,
});

const defaultProduct = {
  id: "prod-001",
  name: "Dive Mask Pro",
  category: "masks",
  price: "49.99",
  salePrice: null as string | null,
  saleStartDate: null as Date | string | null,
  saleEndDate: null as Date | string | null,
  stockQuantity: 10,
  imageUrl: null as string | null,
};

const makeEquipment = (overrides = {}) => ({
  id: "equip-001",
  name: "BCD Jacket L",
  category: "bcds",
  size: "L",
  rentalPrice: "25.00",
  status: "available",
  ...overrides,
});

const makeTrip = (overrides = {}) => ({
  id: "trip-001",
  date: "2026-02-20",
  startTime: "08:00",
  tour: { id: "tour-001", name: "Morning Reef Dive", price: "120.00" },
  available: 6,
  maxParticipants: 12,
  ...overrides,
});

const baseProps = {
  tab: "retail" as const,
  products: [],
  equipment: [],
  trips: [],
  selectedCategory: null,
  onSelectCategory: vi.fn(),
  onAddProduct: vi.fn(),
  onAddRental: vi.fn(),
  onAddBooking: vi.fn(),
  searchQuery: "",
  onSearchChange: vi.fn(),
};

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Search input
  // ---------------------------------------------------------------------------
  describe("search input", () => {
    it("renders a search input with 'retail' in the placeholder on the retail tab", () => {
      render(<ProductGrid {...baseProps} tab="retail" />);
      expect(screen.getByPlaceholderText("Search retail...")).toBeInTheDocument();
    });

    it("renders a search input with 'rentals' in the placeholder on the rentals tab", () => {
      render(<ProductGrid {...baseProps} tab="rentals" />);
      expect(screen.getByPlaceholderText("Search rentals...")).toBeInTheDocument();
    });

    it("renders a search input with 'trips' in the placeholder on the trips tab", () => {
      render(<ProductGrid {...baseProps} tab="trips" />);
      expect(screen.getByPlaceholderText("Search trips...")).toBeInTheDocument();
    });

    it("calls onSearchChange with the typed value", () => {
      const onSearchChange = vi.fn();
      render(<ProductGrid {...baseProps} onSearchChange={onSearchChange} />);
      fireEvent.change(screen.getByPlaceholderText("Search retail..."), {
        target: { value: "mask" },
      });
      expect(onSearchChange).toHaveBeenCalledWith("mask");
    });

    it("displays the current searchQuery value in the input", () => {
      render(<ProductGrid {...baseProps} searchQuery="fins" />);
      expect(screen.getByDisplayValue("fins")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Retail tab – product cards
  // ---------------------------------------------------------------------------
  describe("retail tab – product cards", () => {
    it("renders a product card with the product name", () => {
      render(<ProductGrid {...baseProps} tab="retail" products={[defaultProduct]} />);
      expect(screen.getByText("Dive Mask Pro")).toBeInTheDocument();
    });

    it("renders the product price", () => {
      render(<ProductGrid {...baseProps} tab="retail" products={[defaultProduct]} />);
      expect(screen.getByText("$49.99")).toBeInTheDocument();
    });

    it("renders stock quantity text", () => {
      render(<ProductGrid {...baseProps} tab="retail" products={[defaultProduct]} />);
      expect(screen.getByText("10 in stock")).toBeInTheDocument();
    });

    it("calls onAddProduct when a product card is clicked", () => {
      const onAddProduct = vi.fn();
      render(
        <ProductGrid {...baseProps} tab="retail" products={[defaultProduct]} onAddProduct={onAddProduct} />
      );
      fireEvent.click(screen.getByText("Dive Mask Pro"));
      expect(onAddProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: "prod-001", name: "Dive Mask Pro" })
      );
    });

    it("shows 'No products found' when filtered list is empty", () => {
      render(<ProductGrid {...baseProps} tab="retail" products={[]} />);
      expect(screen.getByText("No products found")).toBeInTheDocument();
    });

    it("shows 'No products found' when search query matches nothing", () => {
      render(
        <ProductGrid
          {...baseProps}
          tab="retail"
          products={[defaultProduct]}
          searchQuery="xyznotfound"
        />
      );
      expect(screen.getByText("No products found")).toBeInTheDocument();
    });

    it("disables out-of-stock products", () => {
      const outOfStock = makeProduct({ stockQuantity: 0 });
      render(<ProductGrid {...baseProps} tab="retail" products={[outOfStock]} />);
      // The product button should be disabled
      const btn = screen.getByRole("button", { name: /Dive Mask Pro/i });
      expect(btn).toBeDisabled();
    });

    it("shows 'SALE' badge for a product currently on sale", async () => {
      // salePrice set with dates spanning now (2026-02-19)
      const saleProduct = makeProduct({
        id: "prod-sale",
        name: "Sale Item",
        salePrice: "29.99",
        saleStartDate: new Date("2026-01-01"),
        saleEndDate: new Date("2026-12-31"),
      });
      render(<ProductGrid {...baseProps} tab="retail" products={[saleProduct]} />);
      // The SALE badge is rendered after useEffect runs – it may need a tick
      // Use findByText which retries
      expect(await screen.findByText("SALE")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Retail tab – category pills
  // ---------------------------------------------------------------------------
  describe("category filter pills", () => {
    it("renders 'All' pill and a pill per unique category", () => {
      const fins = makeProduct({ id: "prod-002", name: "Fins", category: "fins" });
      render(<ProductGrid {...baseProps} tab="retail" products={[defaultProduct, fins]} />);
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("masks")).toBeInTheDocument();
      expect(screen.getByText("fins")).toBeInTheDocument();
    });

    it("calls onSelectCategory(null) when 'All' pill is clicked", () => {
      const onSelectCategory = vi.fn();
      render(
        <ProductGrid
          {...baseProps}
          tab="retail"
          products={[defaultProduct]}
          onSelectCategory={onSelectCategory}
        />
      );
      fireEvent.click(screen.getByText("All"));
      expect(onSelectCategory).toHaveBeenCalledWith(null);
    });

    it("calls onSelectCategory with category name when a category pill is clicked", () => {
      const onSelectCategory = vi.fn();
      render(
        <ProductGrid
          {...baseProps}
          tab="retail"
          products={[defaultProduct]}
          onSelectCategory={onSelectCategory}
        />
      );
      fireEvent.click(screen.getByText("masks"));
      expect(onSelectCategory).toHaveBeenCalledWith("masks");
    });

    it("does not render category pills when no products exist", () => {
      render(<ProductGrid {...baseProps} tab="retail" products={[]} />);
      expect(screen.queryByText("All")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Rentals tab – equipment cards
  // ---------------------------------------------------------------------------
  describe("rentals tab – equipment cards", () => {
    it("renders equipment card with equipment name", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[makeEquipment()]} />);
      expect(screen.getByText("BCD Jacket L")).toBeInTheDocument();
    });

    it("renders equipment daily rate", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[makeEquipment()]} />);
      expect(screen.getByText("$25.00/day")).toBeInTheDocument();
    });

    it("renders equipment size when provided", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[makeEquipment()]} />);
      expect(screen.getByText("Size: L")).toBeInTheDocument();
    });

    it("renders 'Add Rental' button to begin rental flow", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[makeEquipment()]} />);
      expect(screen.getByText("Add Rental")).toBeInTheDocument();
    });

    it("shows duration selector after clicking 'Add Rental'", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[makeEquipment()]} />);
      fireEvent.click(screen.getByText("Add Rental"));
      expect(screen.getByText(/1 day/)).toBeInTheDocument();
    });

    it("calls onAddRental with equipment and day count after confirming rental", () => {
      const onAddRental = vi.fn();
      render(
        <ProductGrid
          {...baseProps}
          tab="rentals"
          equipment={[makeEquipment()]}
          onAddRental={onAddRental}
        />
      );
      fireEvent.click(screen.getByText("Add Rental"));
      // Click the confirm button (shows total cost)
      fireEvent.click(screen.getByText("Add $25.00"));
      expect(onAddRental).toHaveBeenCalledWith(
        expect.objectContaining({ id: "equip-001" }),
        1
      );
    });

    it("shows 'No equipment available' when equipment list is empty", () => {
      render(<ProductGrid {...baseProps} tab="rentals" equipment={[]} />);
      expect(screen.getByText("No equipment available")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Trips tab – trip cards
  // ---------------------------------------------------------------------------
  describe("trips tab – trip cards", () => {
    it("renders trip card with tour name", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      expect(screen.getByText("Morning Reef Dive")).toBeInTheDocument();
    });

    it("renders trip start time", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      expect(screen.getByText("08:00")).toBeInTheDocument();
    });

    it("renders trip price", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      expect(screen.getByText("$120.00")).toBeInTheDocument();
    });

    it("renders available spots", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      expect(screen.getByText("6 spots left")).toBeInTheDocument();
    });

    it("renders 'Book Now' button to begin booking flow", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      expect(screen.getByText("Book Now")).toBeInTheDocument();
    });

    it("shows participant selector after clicking 'Book Now'", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[makeTrip()]} />);
      fireEvent.click(screen.getByText("Book Now"));
      // The participant count defaults to 1
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("calls onAddBooking with trip and participant count after confirming booking", () => {
      const onAddBooking = vi.fn();
      render(
        <ProductGrid
          {...baseProps}
          tab="trips"
          trips={[makeTrip()]}
          onAddBooking={onAddBooking}
        />
      );
      fireEvent.click(screen.getByText("Book Now"));
      fireEvent.click(screen.getByText("Add $120.00"));
      expect(onAddBooking).toHaveBeenCalledWith(
        expect.objectContaining({ id: "trip-001" }),
        1
      );
    });

    it("shows 'Fully booked' text when trip has 0 available spots", () => {
      render(
        <ProductGrid {...baseProps} tab="trips" trips={[makeTrip({ available: 0 })]} />
      );
      expect(screen.getByText("Fully booked")).toBeInTheDocument();
    });

    it("shows 'No trips scheduled today' when trips list is empty", () => {
      render(<ProductGrid {...baseProps} tab="trips" trips={[]} />);
      expect(screen.getByText("No trips scheduled today")).toBeInTheDocument();
    });
  });
});
