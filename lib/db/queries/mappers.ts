/**
 * Mapper functions that transform raw database rows into typed application objects.
 *
 * These mappers handle both camelCase (Drizzle ORM) and snake_case (raw SQL)
 * field naming conventions for backward compatibility.
 */

import type { InferSelectModel } from "drizzle-orm";
import type {
  customers,
  tours,
  trips,
  bookings,
  equipment,
  boats,
  diveSites,
  products,
} from "../schema";

// ============================================================================
// Row types from Drizzle schema inference
// ============================================================================

type CustomerRow = InferSelectModel<typeof customers>;
type TourRow = InferSelectModel<typeof tours>;
type TripRow = InferSelectModel<typeof trips>;
type BookingRow = InferSelectModel<typeof bookings>;
type EquipmentRow = InferSelectModel<typeof equipment>;
type BoatRow = InferSelectModel<typeof boats>;
type DiveSiteRow = InferSelectModel<typeof diveSites>;
type ProductRow = InferSelectModel<typeof products>;

// ============================================================================
// Extended row types for joined query results (snake_case fallbacks)
// ============================================================================

/** Customer row with possible snake_case column aliases */
type CustomerInput = CustomerRow & Record<string, unknown>;

/** Tour row with possible snake_case column aliases */
type TourInput = TourRow & Record<string, unknown>;

/** Trip row with possible snake_case column aliases and joined fields */
type TripInput = TripRow & {
  tourName?: string;
  tour_name?: string;
  tourType?: string;
  tour_type?: string;
  tourPrice?: string | null;
  tour_price?: string | null;
  tourMaxParticipants?: number;
  tour_max_participants?: number;
  boatName?: string | null;
  boat_name?: string | null;
  bookedParticipants?: number;
  booked_participants?: number;
} & Record<string, unknown>;

/** Booking row with possible snake_case column aliases and joined fields */
type BookingInput = BookingRow & {
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  tour_name?: string;
  trip_date?: string;
  trip_time?: string;
  customerName?: string;
} & Record<string, unknown>;

/** Equipment row with possible snake_case column aliases */
type EquipmentInput = EquipmentRow & Record<string, unknown>;

/** Boat row with possible snake_case column aliases */
type BoatInput = BoatRow & Record<string, unknown>;

/** Dive site row with possible snake_case column aliases */
type DiveSiteInput = DiveSiteRow & Record<string, unknown>;

/** Product row with possible snake_case column aliases */
type ProductInput = ProductRow & Record<string, unknown>;

// ============================================================================
// Product type (exported for use by consuming modules)
// ============================================================================

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  description: string | null;
  price: number;
  costPrice: number | null;
  currency: string;
  taxRate: number;
  salePrice: number | null;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** Pick first defined value (treats null as a valid value, unlike ??). */
function pick<T>(camel: T | undefined, snake: unknown): T {
  return camel !== undefined ? camel : snake as T;
}

// ============================================================================
// Mapper functions
// ============================================================================

export function mapCustomer(row: CustomerInput) {
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    email: row.email,
    firstName: pick(row.firstName, r.first_name) as string,
    lastName: pick(row.lastName, r.last_name) as string,
    phone: row.phone,
    dateOfBirth: pick(row.dateOfBirth, r.date_of_birth) as string | null,
    emergencyContactName: pick(row.emergencyContactName, r.emergency_contact_name) as string | null,
    emergencyContactPhone: pick(row.emergencyContactPhone, r.emergency_contact_phone) as string | null,
    emergencyContactRelation: pick(row.emergencyContactRelation, r.emergency_contact_relation) as string | null,
    medicalConditions: pick(row.medicalConditions, r.medical_conditions) as string | null,
    medications: row.medications,
    certifications: row.certifications,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: pick(row.postalCode, r.postal_code) as string | null,
    country: row.country,
    preferredLanguage: pick(row.preferredLanguage, r.preferred_language) as string ?? "en",
    tags: row.tags || [],
    marketingOptIn: pick(row.marketingOptIn, r.marketing_opt_in) ?? false,
    notes: row.notes,
    totalDives: pick(row.totalDives, r.total_dives) as number ?? 0,
    totalSpent: Number(pick(row.totalSpent, r.total_spent) ?? 0),
    lastDiveAt: pick(row.lastDiveAt, r.last_dive_at) as Date | null,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapTour(row: TourInput) {
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    duration: row.duration,
    maxParticipants: pick(row.maxParticipants, r.max_participants) as number,
    minParticipants: pick(row.minParticipants, r.min_participants) as number,
    price: Number(row.price ?? 0),
    currency: row.currency,
    includesEquipment: pick(row.includesEquipment, r.includes_equipment) as boolean,
    includesMeals: pick(row.includesMeals, r.includes_meals) as boolean,
    includesTransport: pick(row.includesTransport, r.includes_transport) as boolean,
    minCertLevel: pick(row.minCertLevel, r.min_cert_level) as string | null,
    minAge: pick(row.minAge, r.min_age) as number | null,
    inclusions: row.inclusions || [],
    exclusions: row.exclusions || [],
    requirements: row.requirements || [],
    isActive: pick(row.isActive, r.is_active) as boolean,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapTrip(row: TripInput) {
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    tourId: pick(row.tourId, r.tour_id) as string,
    boatId: pick(row.boatId, r.boat_id) as string | null,
    date: row.date,
    startTime: pick(row.startTime, r.start_time) as string,
    endTime: pick(row.endTime, r.end_time) as string | null,
    status: row.status,
    maxParticipants: pick(row.maxParticipants, r.max_participants) as number | null,
    price: row.price ? Number(row.price) : null,
    notes: row.notes,
    weatherNotes: pick(row.weatherNotes, r.weather_notes) as string | null ?? null,
    isPublic: pick(row.isPublic, r.is_public) ?? false,
    tourName: pick(row.tourName, row.tour_name),
    tourType: pick(row.tourType, row.tour_type),
    boatName: pick(row.boatName, row.boat_name),
    bookedParticipants: Number(pick(row.bookedParticipants, row.booked_participants) ?? 0),
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapBooking(row: BookingInput) {
  const r = row as Record<string, unknown>;
  const firstName = pick(row.first_name, row.firstName) as string ?? '';
  const lastName = pick(row.last_name, row.lastName) as string ?? '';
  return {
    id: row.id,
    bookingNumber: pick(row.bookingNumber, r.booking_number) as string,
    tripId: pick(row.tripId, r.trip_id) as string,
    customerId: pick(row.customerId, r.customer_id) as string,
    participants: row.participants,
    status: row.status,
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency,
    paymentStatus: pick(row.paymentStatus, r.payment_status) as string,
    paidAmount: Number(pick(row.paidAmount, r.paid_amount) ?? 0),
    specialRequests: pick(row.specialRequests, r.special_requests) as string | null,
    source: row.source,
    firstName,
    lastName,
    customerName: firstName && lastName ? `${firstName} ${lastName}` : row.customerName,
    customerEmail: pick(row.customer_email, r.customerEmail) as string,
    customerPhone: pick(row.customer_phone, r.customerPhone) as string | null,
    tourName: pick(r.tourName, row.tour_name) as string,
    tripDate: pick(r.tripDate, row.trip_date) as string,
    tripTime: pick(r.tripTime, row.trip_time) as string,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapEquipment(row: EquipmentInput) {
  const r = row as Record<string, unknown>;
  const rentalPriceRaw = pick(row.rentalPrice, r.rental_price);
  const purchasePriceRaw = pick(row.purchasePrice, r.purchase_price);
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNumber: pick(row.serialNumber, r.serial_number) as string | null,
    barcode: row.barcode,
    size: row.size,
    status: row.status,
    condition: row.condition,
    rentalPrice: rentalPriceRaw != null ? Number(rentalPriceRaw) : null,
    isRentable: pick(row.isRentable, r.is_rentable) as boolean,
    isPublic: pick(row.isPublic, r.is_public) ?? false,
    lastServiceDate: pick(row.lastServiceDate, r.last_service_date) as Date | null,
    nextServiceDate: pick(row.nextServiceDate, r.next_service_date) as Date | null,
    serviceNotes: pick(row.serviceNotes, r.service_notes) as string | null,
    purchaseDate: pick(row.purchaseDate, r.purchase_date) as Date | null,
    purchasePrice: purchasePriceRaw != null ? Number(purchasePriceRaw) : null,
    notes: row.notes,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapBoat(row: BoatInput) {
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    type: row.type,
    registrationNumber: pick(row.registrationNumber, r.registration_number) as string | null,
    amenities: row.amenities,
    isActive: pick(row.isActive, r.is_active) as boolean,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapDiveSite(row: DiveSiteInput) {
  const r = row as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    maxDepth: pick(row.maxDepth, r.max_depth) as number | null,
    minDepth: pick(row.minDepth, r.min_depth) as number | null,
    difficulty: row.difficulty,
    currentStrength: pick(row.currentStrength, r.current_strength) as string | null,
    visibility: row.visibility,
    highlights: row.highlights,
    isActive: pick(row.isActive, r.is_active) as boolean,
    createdAt: pick(row.createdAt, r.created_at) as Date,
    updatedAt: pick(row.updatedAt, r.updated_at) as Date,
  };
}

export function mapProduct(row: ProductInput): Product {
  const r = row as Record<string, unknown>;
  const costPriceRaw = pick(row.costPrice, r.cost_price);
  const salePriceRaw = pick(row.salePrice, r.sale_price);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    description: row.description,
    price: Number(row.price ?? 0),
    costPrice: costPriceRaw != null ? Number(costPriceRaw) : null,
    currency: row.currency,
    taxRate: Number(pick(row.taxRate, r.tax_rate) ?? 0),
    salePrice: salePriceRaw != null ? Number(salePriceRaw) : null,
    trackInventory: pick(row.trackInventory, r.track_inventory) as boolean,
    stockQuantity: pick(row.stockQuantity, r.stock_quantity) as number ?? 0,
    lowStockThreshold: pick(row.lowStockThreshold, r.low_stock_threshold) as number ?? 5,
    imageUrl: pick(row.imageUrl, r.image_url) as string | null,
    isActive: pick(row.isActive, r.is_active) as boolean,
  };
}
