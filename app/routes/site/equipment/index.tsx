/**
 * Public Site Equipment Catalog Page
 *
 * Displays a grid of rental equipment and retail products with filtering,
 * search, and category navigation. Customers can browse available equipment
 * and view details to add to their bookings.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { eq, and, or, like, sql, asc, desc } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { equipment, images, organization } from "../../../../lib/db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Equipment" }];
  return [
    { title: `Rental Equipment - ${data.organizationName}` },
    { name: "description", content: `Browse our selection of quality dive equipment available for rent and purchase at ${data.organizationName}` },
  ];
};

// ============================================================================
// TYPES
// ============================================================================

interface EquipmentCard {
  id: string;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  rentalPrice: string | null;
  isRentable: boolean;
  status: string;
  condition: string | null;
  primaryImage: string | null;
}

// Equipment categories
const EQUIPMENT_CATEGORIES = [
  { value: "bcd", label: "BCDs", icon: "⚓" },
  { value: "regulator", label: "Regulators", icon: "🌬️" },
  { value: "wetsuit", label: "Wetsuits", icon: "🦈" },
  { value: "mask", label: "Masks", icon: "👓" },
  { value: "fins", label: "Fins", icon: "🦵" },
  { value: "computer", label: "Computers", icon: "💻" },
  { value: "tank", label: "Tanks", icon: "⛽" },
  { value: "snorkel", label: "Snorkels", icon: "🤿" },
  { value: "camera", label: "Cameras", icon: "📷" },
  { value: "light", label: "Lights", icon: "💡" },
  { value: "other", label: "Other", icon: "🔧" },
];

// ============================================================================
// LOADER
// ============================================================================

const ITEMS_PER_PAGE = 12;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;

  // Extract subdomain for organization lookup
  let subdomain: string | null = null;
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      subdomain = parts[0].toLowerCase();
    }
  } else {
    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin") {
        subdomain = sub;
      }
    }
  }

  // Get organization
  const [org] = await db
    .select()
    .from(organization)
    .where(subdomain
      ? eq(organization.slug, subdomain)
      : eq(organization.customDomain, host.split(":")[0])
    )
    .limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Parse query parameters
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const category = url.searchParams.get("category") || null;
  const search = url.searchParams.get("search") || null;
  const sortBy = url.searchParams.get("sort") || "name";
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // Build query conditions
  const conditions = [
    eq(equipment.organizationId, org.id),
    eq(equipment.isPublic, true),
    eq(equipment.status, "available"),
  ];

  if (category) {
    conditions.push(eq(equipment.category, category));
  }

  if (search) {
    conditions.push(
      or(
        like(equipment.name, `%${search}%`),
        like(equipment.brand, `%${search}%`),
        like(equipment.model, `%${search}%`)
      )!
    );
  }

  // Determine sort order
  let orderByClause;
  switch (sortBy) {
    case "price-low":
      orderByClause = asc(equipment.rentalPrice);
      break;
    case "price-high":
      orderByClause = desc(equipment.rentalPrice);
      break;
    case "name":
    default:
      orderByClause = asc(equipment.name);
      break;
  }

  // Get equipment data
  const equipmentData = await db
    .select({
      id: equipment.id,
      category: equipment.category,
      name: equipment.name,
      brand: equipment.brand,
      model: equipment.model,
      size: equipment.size,
      rentalPrice: equipment.rentalPrice,
      isRentable: equipment.isRentable,
      status: equipment.status,
      condition: equipment.condition,
    })
    .from(equipment)
    .where(and(...conditions))
    .orderBy(orderByClause)
    .limit(ITEMS_PER_PAGE)
    .offset(offset);

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(equipment)
    .where(and(...conditions));

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Get category counts
  const categoryCounts = await db
    .select({
      category: equipment.category,
      count: sql<number>`count(*)`,
    })
    .from(equipment)
    .where(
      and(
        eq(equipment.organizationId, org.id),
        eq(equipment.isPublic, true),
        eq(equipment.status, "available")
      )
    )
    .groupBy(equipment.category);

  const categoryCountMap = new Map(
    categoryCounts.map((c) => [c.category, Number(c.count)])
  );

  // Get images for equipment
  const equipmentCards: EquipmentCard[] = await Promise.all(
    equipmentData.map(async (item) => {
      // Get primary image
      const equipmentImages = await db
        .select({ url: images.url })
        .from(images)
        .where(
          and(
            eq(images.organizationId, org.id),
            eq(images.entityType, "equipment"),
            eq(images.entityId, item.id),
            eq(images.isPrimary, true)
          )
        )
        .limit(1);

      return {
        id: item.id,
        category: item.category,
        name: item.name,
        brand: item.brand,
        model: item.model,
        size: item.size,
        rentalPrice: item.rentalPrice,
        isRentable: item.isRentable || false,
        status: item.status,
        condition: item.condition,
        primaryImage: equipmentImages[0]?.url || null,
      };
    })
  );

  return {
    equipment: equipmentCards,
    total,
    page,
    totalPages,
    category,
    search,
    sortBy,
    organizationName: org.name,
    categoryCounts: categoryCountMap,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

function formatPrice(price: string | null): string {
  if (!price) return "Contact for pricing";
  const num = parseFloat(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function SiteEquipmentPage() {
  const { equipment, total, page, totalPages, category, search, sortBy, categoryCounts } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchValue = formData.get("search") as string;
    const params = new URLSearchParams(searchParams);
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    params.delete("page"); // Reset to page 1
    setSearchParams(params);
  };

  const handleCategoryFilter = (cat: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (cat) {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    params.delete("page"); // Reset to page 1
    setSearchParams(params);
  };

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", sort);
    params.delete("page"); // Reset to page 1
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  };

  const hasFilters = category || search || sortBy !== "name";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-card-bg)" }}>
      {/* Hero Section */}
      <section
        className="py-16 px-4"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: "var(--primary-color)" }}
          >
            Rental Equipment
          </h1>
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto" style={{ color: "var(--text-color)" }}>
            Quality dive equipment available for rent. Choose from our wide selection
            of BCDs, regulators, wetsuits, and more.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Categories */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="rounded-xl shadow-sm p-6 sticky top-20" style={{ backgroundColor: "var(--color-card-bg)" }}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>Categories</h2>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => handleCategoryFilter(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      !category
                        ? "font-medium"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: !category ? "var(--accent-color)" : "transparent",
                      color: !category ? "var(--primary-color)" : "inherit",
                    }}
                  >
                    <span className="flex items-center justify-between">
                      <span>All Equipment</span>
                      <span className="text-sm opacity-60">{total}</span>
                    </span>
                  </button>
                </li>
                {EQUIPMENT_CATEGORIES.map((cat) => {
                  const count = categoryCounts.get(cat.value) || 0;
                  if (count === 0) return null;
                  return (
                    <li key={cat.value}>
                      <button
                        onClick={() => handleCategoryFilter(cat.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          category === cat.value
                            ? "font-medium"
                            : "opacity-70 hover:opacity-100"
                        }`}
                        style={{
                          backgroundColor: category === cat.value ? "var(--accent-color)" : "transparent",
                          color: category === cat.value ? "var(--primary-color)" : "inherit",
                        }}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            <span className="mr-2">{cat.icon}</span>
                            {cat.label}
                          </span>
                          <span className="text-sm opacity-60">{count}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search and Filters */}
            <div className="rounded-xl shadow-sm p-4 mb-6" style={{ backgroundColor: "var(--color-card-bg)" }}>
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      name="search"
                      defaultValue={search || ""}
                      placeholder="Search equipment..."
                      className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:outline-none"
                      style={{
                        backgroundColor: "var(--color-card-bg)",
                        borderColor: "var(--color-border)",
                        color: "var(--text-color)",
                        // @ts-expect-error CSS custom property
                        "--tw-ring-color": "var(--primary-color)",
                      }}
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </form>

                {/* Sort */}
                <div className="sm:w-48">
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                    style={{
                      backgroundColor: "var(--color-card-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--text-color)",
                      // @ts-expect-error CSS custom property
                      "--tw-ring-color": "var(--primary-color)",
                    }}
                  >
                    <option value="name">Sort by Name</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>

                {/* Clear Filters */}
                {hasFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 border rounded-lg font-medium transition-colors"
                    style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Active Filters */}
              {(category || search) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {category && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: "var(--accent-color)", color: "var(--primary-color)" }}>
                      Category: {EQUIPMENT_CATEGORIES.find(c => c.value === category)?.label}
                      <button
                        onClick={() => handleCategoryFilter(null)}
                        className="hover:opacity-70"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {search && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: "var(--accent-color)", color: "var(--primary-color)" }}>
                      Search: "{search}"
                      <button
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete("search");
                          setSearchParams(params);
                        }}
                        className="hover:opacity-70"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              )}

              <p className="mt-3 text-sm opacity-60" style={{ color: "var(--text-color)" }}>
                Showing {equipment.length} of {total} items
              </p>
            </div>

            {/* Equipment Grid */}
            {equipment.length === 0 ? (
              <div className="text-center py-16 rounded-xl shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  <svg
                    className="w-10 h-10 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: "var(--text-color)" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-color)" }}>No Equipment Found</h2>
                <p className="opacity-75 mb-6" style={{ color: "var(--text-color)" }}>
                  {hasFilters
                    ? "Try adjusting your filters or search terms."
                    : "Check back soon for available equipment!"}
                </p>
                {hasFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-6 py-2 rounded-lg text-white font-medium"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {equipment.map((item) => (
                    <EquipmentCard key={item.id} equipment={item} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-12 flex justify-center items-center gap-2">
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className="w-10 h-10 rounded-lg font-medium transition-colors"
                            style={{
                              backgroundColor: pageNum === page ? "var(--primary-color)" : "transparent",
                              color: pageNum === page ? "white" : "var(--text-color)",
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EQUIPMENT CARD COMPONENT
// ============================================================================

function EquipmentCard({ equipment }: { equipment: EquipmentCard }) {
  const categoryInfo = EQUIPMENT_CATEGORIES.find(c => c.value === equipment.category);
  const conditionColor = equipment.condition === "excellent"
    ? "bg-success-muted text-success"
    : equipment.condition === "good"
    ? "bg-info-muted text-info"
    : equipment.condition === "fair"
    ? "bg-warning-muted text-warning"
    : "bg-danger-muted text-danger";

  return (
    <Link
      to={`/site/equipment/${equipment.id}`}
      className="group block rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md border"
      style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: "var(--accent-color)" }}>
        {equipment.primaryImage ? (
          <img
            src={equipment.primaryImage}
            alt={equipment.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-6xl"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {categoryInfo?.icon || "🔧"}
          </div>
        )}
        {/* Condition Badge */}
        {equipment.condition && (
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium ${conditionColor}`}>
            {equipment.condition.charAt(0).toUpperCase() + equipment.condition.slice(1)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category */}
        <div className="mb-2">
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--primary-color)",
            }}
          >
            {categoryInfo?.label || equipment.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-1 line-clamp-1" style={{ color: "var(--text-color)" }}>{equipment.name}</h3>

        {/* Brand & Model */}
        {(equipment.brand || equipment.model) && (
          <p className="text-sm opacity-60 mb-3" style={{ color: "var(--text-color)" }}>
            {[equipment.brand, equipment.model].filter(Boolean).join(" ")}
          </p>
        )}

        {/* Size */}
        {equipment.size && (
          <div className="mb-3">
            <span className="text-sm" style={{ color: "var(--text-color)" }}>
              <span className="opacity-60">Size:</span> <span className="font-medium">{equipment.size}</span>
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <p
              className="text-xl font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              {formatPrice(equipment.rentalPrice)}
            </p>
            {equipment.rentalPrice && (
              <p className="text-xs opacity-50" style={{ color: "var(--text-color)" }}>per day</p>
            )}
          </div>
          <span
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: "var(--primary-color)" }}
          >
            View Details
          </span>
        </div>
      </div>
    </Link>
  );
}
