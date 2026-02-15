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
// Mapper functions
// ============================================================================

export function mapCustomer(row: CustomerInput) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName || (row as Record<string, unknown>).first_name as string,
    lastName: row.lastName || (row as Record<string, unknown>).last_name as string,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth || (row as Record<string, unknown>).date_of_birth as string | null,
    emergencyContactName: row.emergencyContactName || (row as Record<string, unknown>).emergency_contact_name as string | null,
    emergencyContactPhone: row.emergencyContactPhone || (row as Record<string, unknown>).emergency_contact_phone as string | null,
    emergencyContactRelation: row.emergencyContactRelation || (row as Record<string, unknown>).emergency_contact_relation as string | null,
    medicalConditions: row.medicalConditions || (row as Record<string, unknown>).medical_conditions as string | null,
    medications: row.medications,
    certifications: row.certifications,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode || (row as Record<string, unknown>).postal_code as string | null,
    country: row.country,
    preferredLanguage: row.preferredLanguage || (row as Record<string, unknown>).preferred_language as string || "en",
    tags: row.tags || [],
    marketingOptIn: row.marketingOptIn ?? (row as Record<string, unknown>).marketing_opt_in ?? false,
    notes: row.notes,
    totalDives: row.totalDives || (row as Record<string, unknown>).total_dives as number || 0,
    totalSpent: Number(row.totalSpent || (row as Record<string, unknown>).total_spent || 0),
    lastDiveAt: row.lastDiveAt || (row as Record<string, unknown>).last_dive_at as Date | null,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapTour(row: TourInput) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    duration: row.duration,
    maxParticipants: row.maxParticipants || (row as Record<string, unknown>).max_participants as number,
    minParticipants: row.minParticipants || (row as Record<string, unknown>).min_participants as number,
    price: Number(row.price || 0),
    currency: row.currency,
    includesEquipment: row.includesEquipment || (row as Record<string, unknown>).includes_equipment as boolean,
    includesMeals: row.includesMeals || (row as Record<string, unknown>).includes_meals as boolean,
    includesTransport: row.includesTransport || (row as Record<string, unknown>).includes_transport as boolean,
    minCertLevel: row.minCertLevel || (row as Record<string, unknown>).min_cert_level as string | null,
    minAge: row.minAge || (row as Record<string, unknown>).min_age as number | null,
    inclusions: row.inclusions || [],
    exclusions: row.exclusions || [],
    requirements: row.requirements || [],
    isActive: row.isActive || (row as Record<string, unknown>).is_active as boolean,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapTrip(row: TripInput) {
  return {
    id: row.id,
    tourId: row.tourId || (row as Record<string, unknown>).tour_id as string,
    boatId: row.boatId || (row as Record<string, unknown>).boat_id as string | null,
    date: row.date,
    startTime: row.startTime || (row as Record<string, unknown>).start_time as string,
    endTime: row.endTime || (row as Record<string, unknown>).end_time as string | null,
    status: row.status,
    maxParticipants: row.maxParticipants || (row as Record<string, unknown>).max_participants as number | null,
    price: row.price ? Number(row.price) : null,
    notes: row.notes,
    weatherNotes: row.weatherNotes || (row as Record<string, unknown>).weather_notes as string | null || null,
    isPublic: row.isPublic ?? (row as Record<string, unknown>).is_public ?? false,
    tourName: row.tourName || row.tour_name,
    tourType: row.tourType || row.tour_type,
    boatName: row.boatName || row.boat_name,
    bookedParticipants: Number(row.bookedParticipants || row.booked_participants || 0),
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapBooking(row: BookingInput) {
  const firstName = row.first_name || row.firstName || '';
  const lastName = row.last_name || row.lastName || '';
  return {
    id: row.id,
    bookingNumber: row.bookingNumber || (row as Record<string, unknown>).booking_number as string,
    tripId: row.tripId || (row as Record<string, unknown>).trip_id as string,
    customerId: row.customerId || (row as Record<string, unknown>).customer_id as string,
    participants: row.participants,
    status: row.status,
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    tax: Number(row.tax || 0),
    total: Number(row.total || 0),
    currency: row.currency,
    paymentStatus: row.paymentStatus || (row as Record<string, unknown>).payment_status as string,
    paidAmount: Number(row.paidAmount || (row as Record<string, unknown>).paid_amount || 0),
    specialRequests: row.specialRequests || (row as Record<string, unknown>).special_requests as string | null,
    source: row.source,
    firstName,
    lastName,
    customerName: firstName && lastName ? `${firstName} ${lastName}` : row.customerName,
    customerEmail: row.customer_email || (row as Record<string, unknown>).customerEmail as string,
    customerPhone: row.customer_phone || (row as Record<string, unknown>).customerPhone as string | null,
    tourName: (row as Record<string, unknown>).tourName as string || row.tour_name,
    tripDate: (row as Record<string, unknown>).tripDate as string || row.trip_date,
    tripTime: (row as Record<string, unknown>).tripTime as string || row.trip_time,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapEquipment(row: EquipmentInput) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber || (row as Record<string, unknown>).serial_number as string | null,
    barcode: row.barcode,
    size: row.size,
    status: row.status,
    condition: row.condition,
    rentalPrice: row.rentalPrice || (row as Record<string, unknown>).rental_price ? Number(row.rentalPrice || (row as Record<string, unknown>).rental_price) : null,
    isRentable: row.isRentable || (row as Record<string, unknown>).is_rentable as boolean,
    isPublic: row.isPublic ?? (row as Record<string, unknown>).is_public ?? false,
    lastServiceDate: row.lastServiceDate || (row as Record<string, unknown>).last_service_date as Date | null,
    nextServiceDate: row.nextServiceDate || (row as Record<string, unknown>).next_service_date as Date | null,
    serviceNotes: row.serviceNotes || (row as Record<string, unknown>).service_notes as string | null,
    purchaseDate: row.purchaseDate || (row as Record<string, unknown>).purchase_date as Date | null,
    purchasePrice: row.purchasePrice || (row as Record<string, unknown>).purchase_price ? Number(row.purchasePrice || (row as Record<string, unknown>).purchase_price) : null,
    notes: row.notes,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapBoat(row: BoatInput) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    type: row.type,
    registrationNumber: row.registrationNumber || (row as Record<string, unknown>).registration_number as string | null,
    amenities: row.amenities,
    isActive: row.isActive || (row as Record<string, unknown>).is_active as boolean,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapDiveSite(row: DiveSiteInput) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    maxDepth: row.maxDepth || (row as Record<string, unknown>).max_depth as number | null,
    minDepth: row.minDepth || (row as Record<string, unknown>).min_depth as number | null,
    difficulty: row.difficulty,
    currentStrength: row.currentStrength || (row as Record<string, unknown>).current_strength as string | null,
    visibility: row.visibility,
    highlights: row.highlights,
    isActive: row.isActive || (row as Record<string, unknown>).is_active as boolean,
    createdAt: row.createdAt || (row as Record<string, unknown>).created_at as Date,
    updatedAt: row.updatedAt || (row as Record<string, unknown>).updated_at as Date,
  };
}

export function mapProduct(row: ProductInput): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    description: row.description,
    price: Number(row.price || 0),
    costPrice: row.costPrice || (row as Record<string, unknown>).cost_price ? Number(row.costPrice || (row as Record<string, unknown>).cost_price) : null,
    currency: row.currency,
    taxRate: Number(row.taxRate || (row as Record<string, unknown>).tax_rate || 0),
    salePrice: row.salePrice || (row as Record<string, unknown>).sale_price ? Number(row.salePrice || (row as Record<string, unknown>).sale_price) : null,
    trackInventory: row.trackInventory || (row as Record<string, unknown>).track_inventory as boolean,
    stockQuantity: row.stockQuantity || (row as Record<string, unknown>).stock_quantity as number || 0,
    lowStockThreshold: row.lowStockThreshold || (row as Record<string, unknown>).low_stock_threshold as number || 5,
    imageUrl: row.imageUrl || (row as Record<string, unknown>).image_url as string | null,
    isActive: row.isActive || (row as Record<string, unknown>).is_active as boolean,
  };
}
