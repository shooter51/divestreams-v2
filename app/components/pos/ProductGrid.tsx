/**
 * POS Product/Equipment/Trip Grid Component
 */

import { useState, useEffect } from "react";

interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  salePrice: string | null;
  saleStartDate: Date | string | null;
  saleEndDate: Date | string | null;
  stockQuantity: number;
  imageUrl: string | null;
}

// Helper to check if product is currently on sale
// Takes 'now' parameter to avoid hydration mismatch (don't call new Date() during render)
function isOnSale(product: Product, now: Date): boolean {
  if (!product.salePrice) return false;
  if (product.saleStartDate && new Date(product.saleStartDate) > now) return false;
  if (product.saleEndDate && new Date(product.saleEndDate) < now) return false;
  return true;
}

// Helper to get the effective price (sale price if on sale, otherwise regular price)
function getEffectivePrice(product: Product, now: Date): number {
  if (isOnSale(product, now)) {
    return Number(product.salePrice);
  }
  return Number(product.price);
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  size: string | null;
  rentalPrice: string | null;
  status: string;
}

interface Trip {
  id: string;
  date: string;
  startTime: string;
  tour: {
    id: string;
    name: string;
    price: string;
  };
  available: number;
  maxParticipants: number;
}

interface ProductGridProps {
  tab: "retail" | "rentals" | "trips";
  products: Product[];
  equipment: Equipment[];
  trips: Trip[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onAddProduct: (product: Product) => void;
  onAddRental: (equipment: Equipment, days: number) => void;
  onAddBooking: (trip: Trip, participants: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ProductGrid({
  tab,
  products,
  equipment,
  trips,
  selectedCategory,
  onSelectCategory,
  onAddProduct,
  onAddRental,
  onAddBooking,
  searchQuery,
  onSearchChange,
}: ProductGridProps) {
  // Track which products are on sale (calculated client-side to avoid hydration mismatch)
  const [productsOnSale, setProductsOnSale] = useState<Set<string>>(new Set());

  // Calculate sale status after hydration (client-side only)
  useEffect(() => {
    const now = new Date();
    const onSaleSet = new Set<string>();
    products.forEach((product) => {
      if (isOnSale(product, now)) {
        onSaleSet.add(product.id);
      }
    });
    setProductsOnSale(onSaleSet);
  }, [products]);

  // Get unique categories based on tab
  const categories = tab === "retail"
    ? [...new Set(products.map(p => p.category))]
    : tab === "rentals"
    ? [...new Set(equipment.map(e => e.category))]
    : [];

  // Filter items based on search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredEquipment = equipment.filter(e => {
    const matchesSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || e.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredTrips = trips.filter(t => {
    const matchesSearch = !searchQuery || t.tour.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4">
        <input
          type="text"
          placeholder={`Search ${tab}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
        />
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          <button
            onClick={() => onSelectCategory(null)}
            className={`px-3 py-1 rounded-full text-sm ${
              !selectedCategory
                ? "bg-brand text-white"
                : "bg-surface-inset text-foreground hover:bg-surface-overlay"
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm capitalize ${
                selectedCategory === cat
                  ? "bg-brand text-white"
                  : "bg-surface-inset text-foreground hover:bg-surface-overlay"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tab === "retail" && filteredProducts.map(product => {
            const onSale = productsOnSale.has(product.id);
            const effectivePrice = onSale && product.salePrice ? Number(product.salePrice) : Number(product.price);
            return (
            <button
              key={product.id}
              onClick={() => onAddProduct({ ...product, price: effectivePrice.toString() })}
              disabled={product.stockQuantity <= 0}
              className={`p-4 bg-surface-raised rounded-lg shadow-sm border hover:border-brand hover:shadow-md transition-all text-left relative ${
                product.stockQuantity <= 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {onSale && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-danger text-white rounded-full font-semibold">
                  SALE
                </span>
              )}
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-24 object-cover rounded-md mb-2"
                />
              )}
              <p className="font-medium truncate">{product.name}</p>
              {onSale ? (
                <div>
                  <span className="text-lg font-bold text-danger">${effectivePrice.toFixed(2)}</span>
                  <span className="text-sm text-foreground-subtle line-through ml-2">${Number(product.price).toFixed(2)}</span>
                </div>
              ) : (
                <p className="text-lg font-bold text-brand">${Number(product.price).toFixed(2)}</p>
              )}
              <p className="text-xs text-foreground-muted">{product.stockQuantity} in stock</p>
            </button>
            );
          })}

          {tab === "rentals" && filteredEquipment.map(item => (
            <RentalCard
              key={item.id}
              equipment={item}
              onAddRental={onAddRental}
            />
          ))}

          {tab === "trips" && filteredTrips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              onAddBooking={onAddBooking}
            />
          ))}
        </div>

        {/* Empty states */}
        {tab === "retail" && filteredProducts.length === 0 && (
          <p className="text-center text-foreground-muted py-8">No products found</p>
        )}
        {tab === "rentals" && filteredEquipment.length === 0 && (
          <p className="text-center text-foreground-muted py-8">No equipment available</p>
        )}
        {tab === "trips" && filteredTrips.length === 0 && (
          <p className="text-center text-foreground-muted py-8">No trips scheduled today</p>
        )}
      </div>
    </div>
  );
}

// Rental card with duration selector
function RentalCard({
  equipment,
  onAddRental,
}: {
  equipment: Equipment;
  onAddRental: (equipment: Equipment, days: number) => void;
}) {
  const [showDays, setShowDays] = useState(false);
  const [days, setDays] = useState(1);

  // Equipment should always have a rental price if it gets here from the backend query
  // But keep this as a safety check - should not happen in practice
  if (!equipment.rentalPrice || Number(equipment.rentalPrice) <= 0) return null;

  return (
    <div className="p-4 bg-surface-raised rounded-lg shadow-sm border">
      <p className="font-medium truncate">{equipment.name}</p>
      {equipment.size && <p className="text-sm text-foreground-muted">Size: {equipment.size}</p>}
      <p className="text-lg font-bold text-success">${Number(equipment.rentalPrice).toFixed(2)}/day</p>

      {!showDays ? (
        <button
          onClick={() => setShowDays(true)}
          className="mt-2 w-full py-2 bg-success text-white rounded-lg hover:bg-success-hover text-sm"
        >
          Add Rental
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDays(Math.max(1, days - 1))}
              className="w-8 h-8 rounded bg-surface-overlay hover:bg-border"
            >
              -
            </button>
            <span className="flex-1 text-center">{days} day{days > 1 ? "s" : ""}</span>
            <button
              onClick={() => setDays(days + 1)}
              className="w-8 h-8 rounded bg-surface-overlay hover:bg-border"
            >
              +
            </button>
          </div>
          <button
            onClick={() => {
              onAddRental(equipment, days);
              setShowDays(false);
              setDays(1);
            }}
            className="w-full py-2 bg-success text-white rounded-lg hover:bg-success-hover text-sm"
          >
            Add ${(Number(equipment.rentalPrice) * days).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}

// Trip card with participant selector
function TripCard({
  trip,
  onAddBooking,
}: {
  trip: Trip;
  onAddBooking: (trip: Trip, participants: number) => void;
}) {
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState(1);

  return (
    <div className="p-4 bg-surface-raised rounded-lg shadow-sm border">
      <p className="font-medium">{trip.tour.name}</p>
      <p className="text-sm text-foreground-muted">{trip.startTime}</p>
      <p className="text-lg font-bold text-info">${Number(trip.tour.price).toFixed(2)}</p>
      <p className="text-xs text-foreground-muted">{trip.available} spots left</p>

      {trip.available <= 0 ? (
        <p className="mt-2 text-center text-danger text-sm">Fully booked</p>
      ) : !showParticipants ? (
        <button
          onClick={() => setShowParticipants(true)}
          className="mt-2 w-full py-2 bg-info text-white rounded-lg hover:bg-info-hover text-sm"
        >
          Book Now
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setParticipants(Math.max(1, participants - 1))}
              className="w-8 h-8 rounded bg-surface-overlay hover:bg-border"
            >
              -
            </button>
            <span className="flex-1 text-center">{participants}</span>
            <button
              onClick={() => setParticipants(Math.min(trip.available, participants + 1))}
              className="w-8 h-8 rounded bg-surface-overlay hover:bg-border"
            >
              +
            </button>
          </div>
          <button
            onClick={() => {
              onAddBooking(trip, participants);
              setShowParticipants(false);
              setParticipants(1);
            }}
            className="w-full py-2 bg-info text-white rounded-lg hover:bg-info-hover text-sm"
          >
            Add ${(Number(trip.tour.price) * participants).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
