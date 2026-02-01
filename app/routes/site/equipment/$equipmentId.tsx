/**
 * Public Site Equipment Detail Page
 *
 * Displays detailed information about a specific piece of equipment including
 * specifications, pricing, availability, and booking options.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useState } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { equipment, images, organization } from "../../../../lib/db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Equipment" }];
  return [
    { title: `${data.equipment.name} - ${data.organizationName}` },
    {
      name: "description",
      content: `Rent ${data.equipment.name} from ${data.organizationName}. ${data.equipment.brand ? `${data.equipment.brand} ` : ""}Quality dive equipment available.`
    },
  ];
};

// ============================================================================
// TYPES
// ============================================================================

interface EquipmentDetail {
  id: string;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  size: string | null;
  rentalPrice: string | null;
  isRentable: boolean;
  status: string;
  condition: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  serviceNotes: string | null;
  notes: string | null;
}

interface EquipmentImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { equipmentId } = params;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

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

  // Get equipment details
  const [equipmentData] = await db
    .select()
    .from(equipment)
    .where(
      and(
        eq(equipment.id, equipmentId),
        eq(equipment.organizationId, org.id),
        eq(equipment.isPublic, true)
      )
    )
    .limit(1);

  if (!equipmentData) {
    throw new Response("Equipment not found", { status: 404 });
  }

  // Get all images for this equipment
  const equipmentImages = await db
    .select({
      id: images.id,
      url: images.url,
      thumbnailUrl: images.thumbnailUrl,
      alt: images.alt,
      isPrimary: images.isPrimary,
      sortOrder: images.sortOrder,
    })
    .from(images)
    .where(
      and(
        eq(images.organizationId, org.id),
        eq(images.entityType, "equipment"),
        eq(images.entityId, equipmentId)
      )
    )
    .orderBy(images.sortOrder);

  const equipmentDetail: EquipmentDetail = {
    id: equipmentData.id,
    category: equipmentData.category,
    name: equipmentData.name,
    brand: equipmentData.brand,
    model: equipmentData.model,
    serialNumber: equipmentData.serialNumber,
    size: equipmentData.size,
    rentalPrice: equipmentData.rentalPrice,
    isRentable: equipmentData.isRentable || false,
    status: equipmentData.status,
    condition: equipmentData.condition,
    lastServiceDate: equipmentData.lastServiceDate,
    nextServiceDate: equipmentData.nextServiceDate,
    serviceNotes: equipmentData.serviceNotes,
    notes: equipmentData.notes,
  };

  return {
    equipment: equipmentDetail,
    images: equipmentImages,
    organizationName: org.name,
    organizationId: org.id,
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

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Equipment categories mapping
const EQUIPMENT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  bcd: { label: "BCD", icon: "⚓" },
  regulator: { label: "Regulator", icon: "🌬️" },
  wetsuit: { label: "Wetsuit", icon: "🦈" },
  mask: { label: "Mask", icon: "👓" },
  fins: { label: "Fins", icon: "🦵" },
  computer: { label: "Dive Computer", icon: "💻" },
  tank: { label: "Tank", icon: "⛽" },
  snorkel: { label: "Snorkel", icon: "🤿" },
  camera: { label: "Camera", icon: "📷" },
  light: { label: "Dive Light", icon: "💡" },
  other: { label: "Equipment", icon: "🔧" },
};

export default function SiteEquipmentDetailPage() {
  const { equipment, images, organizationName } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);

  const categoryInfo = EQUIPMENT_CATEGORIES[equipment.category] || EQUIPMENT_CATEGORIES.other;
  const primaryImage = images.find(img => img.isPrimary) || images[0];
  const displayImages = images.length > 0 ? images : null;

  const handleBooking = () => {
    // Navigate to booking page with equipment pre-selected
    navigate(`/site/book?equipment=${equipment.id}`);
  };

  const conditionBadgeColor = equipment.condition === "excellent"
    ? "bg-success-muted text-success"
    : equipment.condition === "good"
    ? "bg-info-muted text-info"
    : equipment.condition === "fair"
    ? "bg-warning-muted text-warning"
    : "bg-danger-muted text-danger";

  const isAvailable = equipment.status === "available";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-card-bg)" }}>
      {/* Breadcrumb */}
      <div className="border-b" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--text-color)" }}>
            <Link to="/site" className="opacity-60 hover:opacity-100">Home</Link>
            <span className="opacity-40">/</span>
            <Link to="/site/equipment" className="opacity-60 hover:opacity-100">Equipment</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium">{equipment.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square rounded-xl shadow-sm overflow-hidden border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              {displayImages ? (
                <img
                  src={displayImages[selectedImage]?.url || primaryImage?.url}
                  alt={displayImages[selectedImage]?.alt || equipment.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-9xl"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  {categoryInfo.icon}
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {displayImages && displayImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {displayImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square rounded-lg overflow-hidden transition-all ${
                      selectedImage === idx
                        ? "ring-2 ring-offset-2"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      // @ts-expect-error CSS custom property
                      "--tw-ring-color": "var(--primary-color)",
                    }}
                  >
                    <img
                      src={img.thumbnailUrl || img.url}
                      alt={img.alt || `View ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Equipment Details */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-sm font-medium px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    color: "var(--primary-color)",
                  }}
                >
                  {categoryInfo.label}
                </span>
                {equipment.condition && (
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${conditionBadgeColor}`}>
                    {equipment.condition.charAt(0).toUpperCase() + equipment.condition.slice(1)} Condition
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "var(--text-color)" }}>{equipment.name}</h1>
              {(equipment.brand || equipment.model) && (
                <p className="text-lg opacity-70" style={{ color: "var(--text-color)" }}>
                  {[equipment.brand, equipment.model].filter(Boolean).join(" ")}
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="rounded-xl shadow-sm p-6 border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              <div className="flex items-baseline gap-2 mb-2">
                <span
                  className="text-4xl font-bold"
                  style={{ color: "var(--primary-color)" }}
                >
                  {formatPrice(equipment.rentalPrice)}
                </span>
                {equipment.rentalPrice && (
                  <span className="text-lg opacity-60" style={{ color: "var(--text-color)" }}>per day</span>
                )}
              </div>
              <p className="text-sm opacity-60 mb-4" style={{ color: "var(--text-color)" }}>
                Multi-day discounts available. Contact us for weekly rates.
              </p>

              {/* Availability Status */}
              <div className="mb-4">
                {isAvailable ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Available for Rent</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Currently Unavailable</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleBooking}
                  disabled={!isAvailable}
                  className="w-full px-6 py-3 rounded-lg text-white font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {isAvailable ? "Add to Booking" : "Contact Us"}
                </button>
                <Link
                  to="/site/contact"
                  className="block w-full px-6 py-3 rounded-lg text-center font-medium border transition-colors"
                  style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
                >
                  Check Availability
                </Link>
              </div>
            </div>

            {/* Specifications */}
            <div className="rounded-xl shadow-sm p-6 border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>Specifications</h2>
              <dl className="space-y-3">
                {equipment.brand && (
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}>
                    <dt className="opacity-70">Brand</dt>
                    <dd className="font-medium">{equipment.brand}</dd>
                  </div>
                )}
                {equipment.model && (
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}>
                    <dt className="opacity-70">Model</dt>
                    <dd className="font-medium">{equipment.model}</dd>
                  </div>
                )}
                {equipment.size && (
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}>
                    <dt className="opacity-70">Size</dt>
                    <dd className="font-medium">{equipment.size}</dd>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}>
                  <dt className="opacity-70">Condition</dt>
                  <dd className="font-medium capitalize">{equipment.condition || "Good"}</dd>
                </div>
                {equipment.lastServiceDate && (
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}>
                    <dt className="opacity-70">Last Serviced</dt>
                    <dd className="font-medium">{formatDate(equipment.lastServiceDate)}</dd>
                  </div>
                )}
                {equipment.nextServiceDate && (
                  <div className="flex justify-between py-2" style={{ color: "var(--text-color)" }}>
                    <dt className="opacity-70">Next Service</dt>
                    <dd className="font-medium">{formatDate(equipment.nextServiceDate)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Description / Notes */}
            {equipment.notes && (
              <div className="rounded-xl shadow-sm p-6 border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
                <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>Description</h2>
                <p className="opacity-80 whitespace-pre-wrap" style={{ color: "var(--text-color)" }}>{equipment.notes}</p>
              </div>
            )}

            {/* Service Notes (if applicable) */}
            {equipment.serviceNotes && (
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-900">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Service Information
                </h3>
                <p className="text-sm text-blue-800">{equipment.serviceNotes}</p>
              </div>
            )}

            {/* Rental Terms */}
            <div className="rounded-xl p-6 border" style={{ backgroundColor: "var(--accent-color)", borderColor: "var(--color-border)" }}>
              <h3 className="font-semibold mb-3" style={{ color: "var(--text-color)" }}>Rental Terms</h3>
              <ul className="space-y-2 text-sm opacity-80" style={{ color: "var(--text-color)" }}>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Equipment is professionally maintained and serviced regularly
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Rental agreement must be signed before checkout
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Equipment must be returned in the same condition
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Damage or loss may result in additional charges
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back to Equipment */}
        <div className="mt-12 text-center">
          <Link
            to="/site/equipment"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border font-medium transition-colors"
            style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Equipment
          </Link>
        </div>
      </div>
    </div>
  );
}
