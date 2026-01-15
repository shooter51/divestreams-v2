/**
 * Tenant Database Query Helpers
 *
 * These functions provide typed queries for tenant-specific data.
 * All functions accept an organizationId and filter data accordingly.
 *
 * IMPORTANT: This file was refactored from schema-per-tenant to organization-based
 * multi-tenancy. All queries now filter by organization_id in the public schema.
 */

import { desc, eq, gte, lte, count, sum, and, sql } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";

// ============================================================================
// Dashboard Queries
// ============================================================================

export async function getDashboardStats(organizationId: string) {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Today's bookings count
  const todayBookingsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      sql`DATE(${schema.bookings.createdAt}) = ${today}`
    ));

  // This week's revenue (sum of paid transactions)
  const weekRevenueResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      gte(schema.transactions.createdAt, new Date(weekAgo))
    ));

  // Active trips (scheduled trips today or tomorrow)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const activeTripsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      sql`${schema.trips.status} IN ('scheduled', 'in_progress')`,
      lte(schema.trips.date, tomorrow)
    ));

  // Total customers
  const totalCustomersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.customers)
    .where(eq(schema.customers.organizationId, organizationId));

  return {
    todayBookings: Number(todayBookingsResult[0]?.count || 0),
    weekRevenue: Number(weekRevenueResult[0]?.total || 0),
    activeTrips: Number(activeTripsResult[0]?.count || 0),
    totalCustomers: Number(totalCustomersResult[0]?.count || 0),
  };
}

export async function getUpcomingTrips(organizationId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      name: schema.tours.name,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  // Get participant counts separately
  const result = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      name: trip.name,
      date: formatRelativeDate(trip.date),
      time: formatTime(trip.startTime),
      participants: Number(participantsResult[0]?.total || 0),
      maxParticipants: Number(trip.maxParticipants || 0),
    });
  }

  return result;
}

export async function getRecentBookings(organizationId: string, limit = 5) {
  const bookings = await db
    .select({
      id: schema.bookings.id,
      status: schema.bookings.status,
      total: schema.bookings.total,
      createdAt: schema.bookings.createdAt,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      tourName: schema.tours.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(eq(schema.bookings.organizationId, organizationId))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(limit);

  return bookings.map((booking) => ({
    id: booking.id,
    customer: `${booking.firstName} ${booking.lastName}`,
    trip: booking.tourName,
    date: formatRelativeTime(booking.createdAt),
    status: booking.status,
    amount: Number(booking.total || 0),
  }));
}

// ============================================================================
// Customer Queries
// ============================================================================

export async function getCustomerBookings(organizationId: string, customerId: string, limit = 10) {
  const bookings = await db
    .select({
      id: schema.bookings.id,
      bookingNumber: schema.bookings.bookingNumber,
      status: schema.bookings.status,
      total: schema.bookings.total,
      createdAt: schema.bookings.createdAt,
      tourName: schema.tours.name,
      tripDate: schema.trips.date,
    })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.customerId, customerId)
    ))
    .orderBy(desc(schema.trips.date))
    .limit(limit);

  return bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    tripName: b.tourName,
    date: b.tripDate,
    status: b.status,
    total: Number(b.total || 0).toFixed(2),
  }));
}

export async function getCustomers(
  organizationId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const { search, limit = 50, offset = 0 } = options;

  const whereConditions = [eq(schema.customers.organizationId, organizationId)];
  if (search) {
    whereConditions.push(sql`(
      ${schema.customers.firstName} ILIKE ${'%' + search + '%'} OR
      ${schema.customers.lastName} ILIKE ${'%' + search + '%'} OR
      ${schema.customers.email} ILIKE ${'%' + search + '%'}
    )`);
  }

  const customers = await db
    .select()
    .from(schema.customers)
    .where(and(...whereConditions))
    .orderBy(schema.customers.lastName, schema.customers.firstName)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.customers)
    .where(and(...whereConditions));

  return {
    customers: customers.map(mapCustomer),
    total: Number(countResult[0]?.count || 0),
  };
}

export async function getCustomerById(organizationId: string, id: string) {
  const result = await db
    .select()
    .from(schema.customers)
    .where(and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.id, id)
    ))
    .limit(1);

  return result[0] ? mapCustomer(result[0]) : null;
}

export async function createCustomer(organizationId: string, data: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  medicalConditions?: string;
  medications?: string;
  certifications?: any;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}) {
  const [customer] = await db
    .insert(schema.customers)
    .values({
      organizationId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      emergencyContactRelation: data.emergencyContactRelation || null,
      medicalConditions: data.medicalConditions || null,
      medications: data.medications || null,
      certifications: data.certifications || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
      notes: data.notes || null,
    })
    .returning();

  return mapCustomer(customer);
}

export async function updateCustomer(organizationId: string, id: string, data: Partial<{
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  medicalConditions: string;
  medications: string;
  certifications: any;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
}>) {
  const [customer] = await db
    .update(schema.customers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.id, id)
    ))
    .returning();

  return customer ? mapCustomer(customer) : null;
}

export async function deleteCustomer(organizationId: string, id: string) {
  await db
    .delete(schema.customers)
    .where(and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.id, id)
    ));
  return true;
}

// ============================================================================
// Tours & Trips Queries
// ============================================================================

export async function getTours(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string; type?: string } = {}
) {
  const { activeOnly = false, search, type } = options;

  const whereConditions = [eq(schema.tours.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.tours.isActive, true));
  if (type) whereConditions.push(eq(schema.tours.type, type));
  if (search) {
    whereConditions.push(sql`${schema.tours.name} ILIKE ${'%' + search + '%'}`);
  }

  const tours = await db
    .select()
    .from(schema.tours)
    .where(and(...whereConditions))
    .orderBy(schema.tours.name);

  // Get trip counts
  const result = [];
  for (const tour of tours) {
    const tripCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.trips)
      .where(eq(schema.trips.tourId, tour.id));

    result.push({
      ...mapTour(tour),
      tripCount: Number(tripCountResult[0]?.count || 0),
    });
  }

  return result;
}

export async function getAllTours(organizationId: string) {
  const tours = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
    })
    .from(schema.tours)
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.isActive, true)
    ))
    .orderBy(schema.tours.name);

  return tours;
}

export async function getTourById(organizationId: string, id: string) {
  const [tour] = await db
    .select()
    .from(schema.tours)
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ))
    .limit(1);

  return tour ? mapTour(tour) : null;
}

export async function createTour(organizationId: string, data: {
  name: string;
  description?: string;
  type: string;
  duration?: number;
  maxParticipants: number;
  minParticipants?: number;
  price: number;
  currency?: string;
  includesEquipment?: boolean;
  includesMeals?: boolean;
  includesTransport?: boolean;
  minCertLevel?: string;
  minAge?: number;
}) {
  const [tour] = await db
    .insert(schema.tours)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      type: data.type,
      duration: data.duration || null,
      maxParticipants: data.maxParticipants,
      minParticipants: data.minParticipants || 1,
      price: String(data.price),
      currency: data.currency || "USD",
      includesEquipment: data.includesEquipment || false,
      includesMeals: data.includesMeals || false,
      includesTransport: data.includesTransport || false,
      minCertLevel: data.minCertLevel || null,
      minAge: data.minAge || null,
    })
    .returning();

  return mapTour(tour);
}

export async function updateTourActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [tour] = await db
    .update(schema.tours)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ))
    .returning();

  return tour ? mapTour(tour) : null;
}

export async function deleteTour(organizationId: string, id: string) {
  await db
    .update(schema.tours)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ));
  return true;
}

export async function getTrips(
  organizationId: string,
  options: { fromDate?: string; toDate?: string; status?: string; limit?: number } = {}
) {
  const { fromDate, toDate, status, limit = 50 } = options;

  const whereConditions = [eq(schema.trips.organizationId, organizationId)];
  if (fromDate) whereConditions.push(gte(schema.trips.date, fromDate));
  if (toDate) whereConditions.push(lte(schema.trips.date, toDate));
  if (status) whereConditions.push(eq(schema.trips.status, status));

  const trips = await db
    .select({
      trip: schema.trips,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      boatName: schema.boats.name,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(...whereConditions))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  // Get booked participants for each trip
  const result = [];
  for (const row of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, row.trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push(mapTrip({
      ...row.trip,
      tour_name: row.tourName,
      tour_type: row.tourType,
      boat_name: row.boatName,
      booked_participants: participantsResult[0]?.total || 0,
    }));
  }

  return result;
}

export async function getTripById(organizationId: string, id: string) {
  const [result] = await db
    .select({
      trip: schema.trips,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      tourPrice: schema.tours.price,
      tourMaxParticipants: schema.tours.maxParticipants,
      boatName: schema.boats.name,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      eq(schema.trips.id, id)
    ))
    .limit(1);

  if (!result) return null;

  return mapTrip({
    ...result.trip,
    tour_name: result.tourName,
    tour_type: result.tourType,
    tour_price: result.tourPrice,
    tour_max_participants: result.tourMaxParticipants,
    boat_name: result.boatName,
  });
}

// ============================================================================
// Calendar Queries
// ============================================================================

export interface CalendarTrip {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  date: string;
  startTime: string;
  endTime: string | null;
  boatName: string | null;
  maxParticipants: number;
  bookedParticipants: number;
  status: string;
}

export async function getCalendarTrips(
  organizationId: string,
  options: { fromDate: string; toDate: string }
): Promise<CalendarTrip[]> {
  const { fromDate, toDate } = options;

  const trips = await db
    .select({
      id: schema.trips.id,
      tourId: schema.trips.tourId,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      endTime: schema.trips.endTime,
      boatName: schema.boats.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, fromDate),
      lte(schema.trips.date, toDate)
    ))
    .orderBy(schema.trips.date, schema.trips.startTime);

  // Get booked participants for each trip
  const result: CalendarTrip[] = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      tourId: trip.tourId,
      tourName: trip.tourName,
      tourType: trip.tourType,
      date: formatDateString(trip.date),
      startTime: formatTimeString(trip.startTime),
      endTime: trip.endTime ? formatTimeString(trip.endTime) : null,
      boatName: trip.boatName,
      maxParticipants: Number(trip.maxParticipants || 0),
      bookedParticipants: Number(participantsResult[0]?.total || 0),
      status: trip.status,
    });
  }

  return result;
}

export async function createTrip(organizationId: string, data: {
  tourId: string;
  boatId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  maxParticipants?: number;
  price?: number;
  notes?: string;
}) {
  const [trip] = await db
    .insert(schema.trips)
    .values({
      organizationId,
      tourId: data.tourId,
      boatId: data.boatId || null,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime || null,
      maxParticipants: data.maxParticipants || null,
      price: data.price ? String(data.price) : null,
      notes: data.notes || null,
    })
    .returning();

  return trip;
}

export async function updateTripStatus(organizationId: string, id: string, status: string) {
  const [trip] = await db
    .update(schema.trips)
    .set({ status, updatedAt: new Date() })
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      eq(schema.trips.id, id)
    ))
    .returning();

  return trip ? mapTrip(trip) : null;
}

// ============================================================================
// Booking Queries
// ============================================================================

export async function getBookings(
  organizationId: string,
  options: { status?: string; tripId?: string; customerId?: string; limit?: number; offset?: number } = {}
) {
  const { status, tripId, customerId, limit = 50, offset = 0 } = options;

  const whereConditions = [eq(schema.bookings.organizationId, organizationId)];
  if (status) whereConditions.push(eq(schema.bookings.status, status));
  if (tripId) whereConditions.push(eq(schema.bookings.tripId, tripId));
  if (customerId) whereConditions.push(eq(schema.bookings.customerId, customerId));

  const bookings = await db
    .select({
      booking: schema.bookings,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      tourName: schema.tours.name,
      tripDate: schema.trips.date,
      tripTime: schema.trips.startTime,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(...whereConditions))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookings)
    .where(and(...whereConditions));

  return {
    bookings: bookings.map((row) => mapBooking({
      ...row.booking,
      first_name: row.firstName,
      last_name: row.lastName,
      customer_email: row.customerEmail,
      customer_phone: row.customerPhone,
      tour_name: row.tourName,
      trip_date: row.tripDate,
      trip_time: row.tripTime,
    })),
    total: Number(countResult[0]?.count || 0),
  };
}

export async function getBookingById(organizationId: string, id: string) {
  const [result] = await db
    .select({
      booking: schema.bookings,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      tourName: schema.tours.name,
      tripDate: schema.trips.date,
      tripTime: schema.trips.startTime,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.id, id)
    ))
    .limit(1);

  if (!result) return null;

  return mapBooking({
    ...result.booking,
    first_name: result.firstName,
    last_name: result.lastName,
    customer_email: result.customerEmail,
    customer_phone: result.customerPhone,
    tour_name: result.tourName,
    trip_date: result.tripDate,
    trip_time: result.tripTime,
  });
}

export async function createBooking(organizationId: string, data: {
  tripId: string;
  customerId: string;
  participants?: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  currency?: string;
  specialRequests?: string;
  source?: string;
}) {
  const bookingNumber = `BK${Date.now().toString(36).toUpperCase()}`;

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      organizationId,
      bookingNumber,
      tripId: data.tripId,
      customerId: data.customerId,
      participants: data.participants || 1,
      subtotal: String(data.subtotal),
      discount: String(data.discount || 0),
      tax: String(data.tax || 0),
      total: String(data.total),
      currency: data.currency || "USD",
      specialRequests: data.specialRequests || null,
      source: data.source || "direct",
    })
    .returning();

  return booking;
}

export async function updateBookingStatus(organizationId: string, id: string, status: string) {
  const [booking] = await db
    .update(schema.bookings)
    .set({ status, updatedAt: new Date() })
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.id, id)
    ))
    .returning();

  return booking;
}

// ============================================================================
// Equipment Queries
// ============================================================================

export async function getEquipment(
  organizationId: string,
  options: { category?: string; status?: string; search?: string; isRentable?: boolean; limit?: number } = {}
) {
  const { category, status, search, isRentable, limit = 100 } = options;

  const whereConditions = [eq(schema.equipment.organizationId, organizationId)];
  if (category) whereConditions.push(eq(schema.equipment.category, category));
  if (status) whereConditions.push(eq(schema.equipment.status, status));
  if (isRentable !== undefined) whereConditions.push(eq(schema.equipment.isRentable, isRentable));
  if (search) {
    whereConditions.push(sql`${schema.equipment.name} ILIKE ${'%' + search + '%'}`);
  }

  const equipment = await db
    .select()
    .from(schema.equipment)
    .where(and(...whereConditions))
    .orderBy(schema.equipment.category, schema.equipment.name)
    .limit(limit);

  return equipment.map(mapEquipment);
}

export async function getEquipmentById(organizationId: string, id: string) {
  const [equipment] = await db
    .select()
    .from(schema.equipment)
    .where(and(
      eq(schema.equipment.organizationId, organizationId),
      eq(schema.equipment.id, id)
    ))
    .limit(1);

  return equipment ? mapEquipment(equipment) : null;
}

export async function createEquipment(organizationId: string, data: {
  category: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  barcode?: string;
  size?: string;
  status?: string;
  condition?: string;
  rentalPrice?: number;
  isRentable?: boolean;
}) {
  const [equipment] = await db
    .insert(schema.equipment)
    .values({
      organizationId,
      category: data.category,
      name: data.name,
      brand: data.brand || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      barcode: data.barcode || null,
      size: data.size || null,
      status: data.status || "available",
      condition: data.condition || "good",
      rentalPrice: data.rentalPrice ? String(data.rentalPrice) : null,
      isRentable: data.isRentable ?? true,
    })
    .returning();

  return mapEquipment(equipment);
}

// ============================================================================
// Boat Queries
// ============================================================================

export async function getBoats(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string } = {}
) {
  const { activeOnly = false, search } = options;

  const whereConditions = [eq(schema.boats.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.boats.isActive, true));
  if (search) {
    whereConditions.push(sql`${schema.boats.name} ILIKE ${'%' + search + '%'}`);
  }

  const boats = await db
    .select()
    .from(schema.boats)
    .where(and(...whereConditions))
    .orderBy(schema.boats.name);

  return boats.map(mapBoat);
}

export async function getAllBoats(organizationId: string) {
  const boats = await db
    .select({
      id: schema.boats.id,
      name: schema.boats.name,
      capacity: schema.boats.capacity,
    })
    .from(schema.boats)
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.isActive, true)
    ))
    .orderBy(schema.boats.name);

  return boats;
}

export async function getBoatById(organizationId: string, id: string) {
  const [boat] = await db
    .select()
    .from(schema.boats)
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ))
    .limit(1);

  return boat ? mapBoat(boat) : null;
}

export async function createBoat(organizationId: string, data: {
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  registrationNumber?: string;
  amenities?: string[];
  isActive?: boolean;
}) {
  const [boat] = await db
    .insert(schema.boats)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      capacity: data.capacity,
      type: data.type || null,
      registrationNumber: data.registrationNumber || null,
      amenities: data.amenities || null,
      isActive: data.isActive ?? true,
    })
    .returning();

  return mapBoat(boat);
}

// ============================================================================
// Dive Sites Queries
// ============================================================================

export async function getDiveSites(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string; difficulty?: string } = {}
) {
  const { activeOnly = false, search, difficulty } = options;

  const whereConditions = [eq(schema.diveSites.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.diveSites.isActive, true));
  if (difficulty) whereConditions.push(eq(schema.diveSites.difficulty, difficulty));
  if (search) {
    whereConditions.push(sql`${schema.diveSites.name} ILIKE ${'%' + search + '%'}`);
  }

  const sites = await db
    .select()
    .from(schema.diveSites)
    .where(and(...whereConditions))
    .orderBy(schema.diveSites.name);

  return sites.map(mapDiveSite);
}

export async function getDiveSiteById(organizationId: string, id: string) {
  const [site] = await db
    .select()
    .from(schema.diveSites)
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ))
    .limit(1);

  return site ? mapDiveSite(site) : null;
}

export async function updateDiveSiteActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [site] = await db
    .update(schema.diveSites)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ))
    .returning();

  return site ? mapDiveSite(site) : null;
}

export async function deleteDiveSite(organizationId: string, id: string) {
  await db
    .update(schema.diveSites)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ));
  return true;
}

// ============================================================================
// Tour Detail Queries
// ============================================================================

export async function getTourStats(organizationId: string, tourId: string) {
  // Get trip count
  const tripCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(eq(schema.trips.tourId, tourId));

  // Get total revenue from bookings on trips for this tour
  const revenueResult = await db
    .select({ total: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)` })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .where(and(
      eq(schema.trips.tourId, tourId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'refunded')`
    ));

  return {
    tripCount: Number(tripCountResult[0]?.count || 0),
    totalRevenue: Number(revenueResult[0]?.total || 0),
    averageRating: null,
  };
}

export async function getUpcomingTripsForTour(organizationId: string, tourId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      boatName: schema.boats.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.tourId, tourId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: formatDateString(trip.date),
      time: formatTimeString(trip.startTime),
      boatName: trip.boatName,
      bookedParticipants: Number(participantsResult[0]?.total || 0),
      maxParticipants: Number(trip.maxParticipants || 0),
    });
  }

  return result;
}

// ============================================================================
// Dive Site Detail Queries
// ============================================================================

export async function getDiveSiteStats(organizationId: string, siteId: string) {
  // Get total trips that visited this site (through tour -> tourDiveSites)
  const tripCountResult = await db
    .select({ count: sql<number>`count(DISTINCT ${schema.trips.id})` })
    .from(schema.trips)
    .innerJoin(schema.tourDiveSites, eq(schema.trips.tourId, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId)
    ));

  // Get total divers who visited this site
  const diversResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tourDiveSites, eq(schema.trips.tourId, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  return {
    totalTrips: Number(tripCountResult[0]?.count || 0),
    totalDivers: Number(diversResult[0]?.total || 0),
    avgRating: null,
  };
}

export async function getRecentTripsForDiveSite(organizationId: string, siteId: string, limit = 5) {
  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      tourName: schema.tours.name,
      conditions: schema.trips.notes,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .innerJoin(schema.tourDiveSites, eq(schema.tours.id, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId)
    ))
    .orderBy(desc(schema.trips.date))
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: trip.date,
      tourName: trip.tourName,
      participants: Number(participantsResult[0]?.total || 0),
      conditions: trip.conditions,
    });
  }

  return result;
}

export async function getToursUsingDiveSite(organizationId: string, siteId: string, limit = 5) {
  const tours = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
    })
    .from(schema.tours)
    .innerJoin(schema.tourDiveSites, eq(schema.tours.id, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.isActive, true)
    ))
    .limit(limit);

  return tours;
}

export async function createDiveSite(organizationId: string, data: {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  maxDepth?: number;
  minDepth?: number;
  difficulty?: string;
  currentStrength?: string;
  visibility?: string;
  highlights?: string[];
}) {
  const [site] = await db
    .insert(schema.diveSites)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      latitude: data.latitude ? String(data.latitude) : null,
      longitude: data.longitude ? String(data.longitude) : null,
      maxDepth: data.maxDepth || null,
      minDepth: data.minDepth || null,
      difficulty: data.difficulty || null,
      currentStrength: data.currentStrength || null,
      visibility: data.visibility || null,
      highlights: data.highlights || null,
    })
    .returning();

  return mapDiveSite(site);
}

// ============================================================================
// Equipment Detail Queries
// ============================================================================

export async function getEquipmentRentalStats(organizationId: string, equipmentId: string) {
  // Get total rentals
  const rentalsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.rentals)
    .where(eq(schema.rentals.equipmentId, equipmentId));

  // Get active rentals
  const activeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.rentals)
    .where(and(
      eq(schema.rentals.equipmentId, equipmentId),
      eq(schema.rentals.status, "active")
    ));

  // Get total revenue and days rented
  const revenueResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${schema.rentals.totalCharge} AS DECIMAL)), 0)`,
      daysRented: sql<number>`COALESCE(SUM(EXTRACT(DAY FROM (COALESCE(${schema.rentals.returnedAt}, NOW()) - ${schema.rentals.rentedAt}))), 0)`
    })
    .from(schema.rentals)
    .where(eq(schema.rentals.equipmentId, equipmentId));

  const totalRentals = Number(rentalsResult[0]?.count || 0);
  const totalRevenue = Number(revenueResult[0]?.total || 0);
  const daysRented = Math.round(Number(revenueResult[0]?.daysRented || 0));

  // Calculate average rentals per month (based on equipment age - simplified to 1 month minimum)
  const avgRentalsPerMonth = totalRentals > 0 ? Math.round(totalRentals / Math.max(1, Math.ceil(daysRented / 30)) * 10) / 10 : 0;

  return {
    totalRentals,
    activeRentals: Number(activeResult[0]?.count || 0),
    totalRevenue,
    rentalRevenue: totalRevenue.toFixed(2),
    daysRented,
    avgRentalsPerMonth,
  };
}

export async function getEquipmentRentalHistory(organizationId: string, equipmentId: string, limit = 10) {
  const rentals = await db
    .select({
      id: schema.rentals.id,
      rentedAt: schema.rentals.rentedAt,
      returnedAt: schema.rentals.returnedAt,
      dueAt: schema.rentals.dueAt,
      status: schema.rentals.status,
      dailyRate: schema.rentals.dailyRate,
      totalCharge: schema.rentals.totalCharge,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
    })
    .from(schema.rentals)
    .innerJoin(schema.customers, eq(schema.rentals.customerId, schema.customers.id))
    .where(eq(schema.rentals.equipmentId, equipmentId))
    .orderBy(desc(schema.rentals.rentedAt))
    .limit(limit);

  return rentals.map((r) => ({
    id: r.id,
    rentedAt: r.rentedAt,
    returnedAt: r.returnedAt,
    dueAt: r.dueAt,
    status: r.status,
    dailyRate: Number(r.dailyRate),
    totalCharge: Number(r.totalCharge),
    customerName: `${r.customerFirstName} ${r.customerLastName}`,
  }));
}

export interface EquipmentServiceRecord {
  id: string;
  date: Date;
  type: string;
  description: string;
  technician: string | null;
  performedBy: string | null;
  notes: string | null;
  cost: number | null;
}

export async function getEquipmentServiceHistory(organizationId: string, equipmentId: string, limit = 10): Promise<EquipmentServiceRecord[]> {
  // Service history would be stored in equipment.serviceNotes or a separate service_records table
  // For now, return empty array as a stub
  // TODO: Implement when service_records table is added
  return [];
}

export async function updateEquipmentStatus(organizationId: string, id: string, status: string) {
  const [equipment] = await db
    .update(schema.equipment)
    .set({ status, updatedAt: new Date() })
    .where(and(
      eq(schema.equipment.organizationId, organizationId),
      eq(schema.equipment.id, id)
    ))
    .returning();

  return equipment ? mapEquipment(equipment) : null;
}

export async function deleteEquipment(organizationId: string, id: string) {
  await db
    .delete(schema.equipment)
    .where(and(
      eq(schema.equipment.organizationId, organizationId),
      eq(schema.equipment.id, id)
    ));
  return true;
}

// ============================================================================
// Boat Detail Queries
// ============================================================================

export async function getBoatRecentTrips(organizationId: string, boatId: string, limit = 5) {
  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      tourName: schema.tours.name,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.organizationId, organizationId)
    ))
    .orderBy(desc(schema.trips.date))
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const bookingsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
        revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS NUMERIC)), 0)`
      })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: formatDateString(trip.date),
      tourName: trip.tourName,
      participants: Number(bookingsResult[0]?.total || 0),
      revenue: `$${Number(bookingsResult[0]?.revenue || 0).toFixed(2)}`,
      status: trip.status,
    });
  }

  return result;
}

export async function getBoatUpcomingTrips(organizationId: string, boatId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      tourName: schema.tours.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: formatDateString(trip.date),
      time: formatTimeString(trip.startTime),
      tourName: trip.tourName,
      bookedParticipants: Number(participantsResult[0]?.total || 0),
      maxParticipants: Number(trip.maxParticipants || 0),
    });
  }

  return result;
}

export async function getBoatStats(organizationId: string, boatId: string) {
  // Get total trips
  const tripCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(eq(schema.trips.boatId, boatId));

  // Get completed trips
  const completedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.status, "completed")
    ));

  // Get total passengers and revenue
  const bookingsResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS NUMERIC)), 0)`
    })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  // Get boat capacity for avg occupancy calculation
  const [boat] = await db
    .select({ capacity: schema.boats.capacity })
    .from(schema.boats)
    .where(eq(schema.boats.id, boatId))
    .limit(1);

  const totalTrips = Number(tripCountResult[0]?.count || 0);
  const totalPassengers = Number(bookingsResult[0]?.total || 0);
  const capacity = Number(boat?.capacity || 10);
  const avgOccupancy = totalTrips > 0 ? Math.round((totalPassengers / (totalTrips * capacity)) * 100) : 0;

  return {
    totalTrips,
    completedTrips: Number(completedResult[0]?.count || 0),
    totalPassengers,
    totalRevenue: `$${Number(bookingsResult[0]?.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    avgOccupancy,
  };
}

export async function updateBoatActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [boat] = await db
    .update(schema.boats)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ))
    .returning();

  return boat ? mapBoat(boat) : null;
}

export async function deleteBoat(organizationId: string, id: string) {
  await db
    .update(schema.boats)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ));
  return true;
}

// ============================================================================
// Report Queries
// ============================================================================

export interface BookingsByStatus {
  status: string;
  count: number;
}

export async function getBookingsByStatus(organizationId: string): Promise<BookingsByStatus[]> {
  const result = await db
    .select({
      status: schema.bookings.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.organizationId, organizationId))
    .groupBy(schema.bookings.status);

  return result.map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));
}

export interface TopTour {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
}

export async function getTopTours(organizationId: string, limit: number = 5): Promise<TopTour[]> {
  const result = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
      bookings: sql<number>`count(${schema.bookings.id})`,
      revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)`,
    })
    .from(schema.tours)
    .leftJoin(schema.trips, eq(schema.tours.id, schema.trips.tourId))
    .leftJoin(schema.bookings, eq(schema.trips.id, schema.bookings.tripId))
    .where(eq(schema.tours.organizationId, organizationId))
    .groupBy(schema.tours.id, schema.tours.name)
    .orderBy(sql`count(${schema.bookings.id}) DESC`)
    .limit(limit);

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    bookings: Number(row.bookings),
    revenue: Number(row.revenue),
  }));
}

export interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  activeCustomers: number;
}

export async function getCustomerReportStats(organizationId: string): Promise<CustomerStats> {
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.customers)
    .where(eq(schema.customers.organizationId, organizationId));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.customers)
    .where(and(
      eq(schema.customers.organizationId, organizationId),
      gte(schema.customers.createdAt, startOfMonth)
    ));

  // Active = has a booking in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const activeResult = await db
    .select({ count: sql<number>`count(DISTINCT ${schema.bookings.customerId})` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      gte(schema.bookings.createdAt, ninetyDaysAgo)
    ));

  return {
    totalCustomers: Number(totalResult[0]?.count || 0),
    newThisMonth: Number(newResult[0]?.count || 0),
    activeCustomers: Number(activeResult[0]?.count || 0),
  };
}

export interface EquipmentUtilization {
  category: string;
  total: number;
  rented: number;
  available: number;
}

export async function getEquipmentUtilization(organizationId: string): Promise<EquipmentUtilization[]> {
  const result = await db
    .select({
      category: schema.equipment.category,
      total: sql<number>`count(*)`,
      rented: sql<number>`SUM(CASE WHEN ${schema.equipment.status} = 'rented' THEN 1 ELSE 0 END)`,
      available: sql<number>`SUM(CASE WHEN ${schema.equipment.status} = 'available' THEN 1 ELSE 0 END)`,
    })
    .from(schema.equipment)
    .where(eq(schema.equipment.organizationId, organizationId))
    .groupBy(schema.equipment.category);

  return result.map((row) => ({
    category: row.category,
    total: Number(row.total),
    rented: Number(row.rented || 0),
    available: Number(row.available || 0),
  }));
}

export async function getRevenueOverview(organizationId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // This month's revenue
  const thisMonthResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      gte(schema.transactions.createdAt, startOfMonth)
    ));

  // Last month's revenue
  const lastMonthResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      gte(schema.transactions.createdAt, startOfLastMonth),
      lte(schema.transactions.createdAt, endOfLastMonth)
    ));

  return {
    thisMonth: Number(thisMonthResult[0]?.total || 0),
    lastMonth: Number(lastMonthResult[0]?.total || 0),
  };
}

// ============================================================================
// Product Queries (POS)
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

export async function getProducts(
  organizationId: string,
  options: { category?: string; search?: string; activeOnly?: boolean; limit?: number } = {}
): Promise<Product[]> {
  const { category, search, activeOnly = true, limit = 100 } = options;

  const whereConditions = [eq(schema.products.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.products.isActive, true));
  if (category) whereConditions.push(eq(schema.products.category, category));
  if (search) {
    whereConditions.push(sql`${schema.products.name} ILIKE ${'%' + search + '%'}`);
  }

  const products = await db
    .select()
    .from(schema.products)
    .where(and(...whereConditions))
    .orderBy(schema.products.category, schema.products.name)
    .limit(limit);

  return products.map(mapProduct);
}

export async function getProductById(organizationId: string, id: string): Promise<Product | null> {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ))
    .limit(1);

  return product ? mapProduct(product) : null;
}

export async function getProductCategories(organizationId: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ category: schema.products.category })
    .from(schema.products)
    .where(eq(schema.products.organizationId, organizationId))
    .orderBy(schema.products.category);

  return result.map((r) => r.category);
}

export async function createProduct(organizationId: string, data: {
  name: string;
  sku?: string;
  category: string;
  description?: string;
  price: number;
  costPrice?: number;
  currency?: string;
  taxRate?: number;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
}): Promise<Product> {
  const [product] = await db
    .insert(schema.products)
    .values({
      organizationId,
      name: data.name,
      sku: data.sku || null,
      category: data.category,
      description: data.description || null,
      price: String(data.price),
      costPrice: data.costPrice ? String(data.costPrice) : null,
      currency: data.currency || "USD",
      taxRate: data.taxRate ? String(data.taxRate) : "0",
      trackInventory: data.trackInventory ?? true,
      stockQuantity: data.stockQuantity ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 5,
      imageUrl: data.imageUrl || null,
    })
    .returning();

  return mapProduct(product);
}

export async function updateProduct(organizationId: string, id: string, data: {
  name?: string;
  sku?: string;
  category?: string;
  description?: string;
  price?: number;
  costPrice?: number;
  currency?: string;
  taxRate?: number;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
  isActive?: boolean;
}): Promise<Product | null> {
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.taxRate !== undefined) updateData.taxRate = String(data.taxRate);
  if (data.trackInventory !== undefined) updateData.trackInventory = data.trackInventory;
  if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [product] = await db
    .update(schema.products)
    .set(updateData)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ))
    .returning();

  return product ? mapProduct(product) : null;
}

export async function deleteProduct(organizationId: string, id: string): Promise<boolean> {
  await db
    .update(schema.products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ));
  return true;
}

// ============================================================================
// POS Transaction Queries
// ============================================================================

export async function createPOSTransaction(organizationId: string, data: {
  customerId?: string;
  items: Array<{ productId: string; name?: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
}) {
  // Transform items to match the transactions table schema
  const transactionItems = data.items.map(item => ({
    description: item.name || `Product ${item.productId.substring(0, 8)}`,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.quantity * item.price,
  }));

  const [transaction] = await db
    .insert(schema.transactions)
    .values({
      organizationId,
      type: "sale",
      customerId: data.customerId || null,
      amount: String(data.total),
      currency: "USD",
      paymentMethod: data.paymentMethod,
      items: transactionItems,
    })
    .returning();

  // Update product stock quantities
  for (const item of data.items) {
    await db
      .update(schema.products)
      .set({
        stockQuantity: sql`${schema.products.stockQuantity} - ${item.quantity}`,
      })
      .where(eq(schema.products.id, item.productId));
  }

  return transaction;
}

export async function getPOSSummary(organizationId: string, date?: string): Promise<{
  totalSales: number;
  transactionCount: number;
  averageTransaction: number;
}> {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const result = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(CAST(${schema.transactions.amount} AS DECIMAL)), 0)`,
      transactionCount: sql<number>`count(*)`,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      sql`DATE(${schema.transactions.createdAt}) = ${targetDate}`
    ));

  const totalSales = Number(result[0]?.totalSales || 0);
  const transactionCount = Number(result[0]?.transactionCount || 0);

  return {
    totalSales,
    transactionCount,
    averageTransaction: transactionCount > 0 ? totalSales / transactionCount : 0,
  };
}

export async function getLowStockProducts(organizationId: string): Promise<Product[]> {
  const products = await db
    .select()
    .from(schema.products)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.isActive, true),
      eq(schema.products.trackInventory, true),
      sql`${schema.products.stockQuantity} <= ${schema.products.lowStockThreshold}`
    ))
    .orderBy(schema.products.stockQuantity);

  return products.map(mapProduct);
}

export type POSTransaction = {
  id: string;
  type: string;
  amount: number;
  paymentMethod: string;
  customerName: string | null;
  items: unknown[] | null;
  createdAt: Date;
};

export async function getPOSTransactions(
  organizationId: string,
  options: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}
): Promise<POSTransaction[]> {
  const { type, dateFrom, dateTo, limit = 50 } = options;

  const conditions = [eq(schema.transactions.organizationId, organizationId)];

  if (type) {
    conditions.push(eq(schema.transactions.type, type));
  }
  if (dateFrom) {
    conditions.push(sql`DATE(${schema.transactions.createdAt}) >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`DATE(${schema.transactions.createdAt}) <= ${dateTo}`);
  }

  const transactions = await db
    .select({
      id: schema.transactions.id,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      paymentMethod: schema.transactions.paymentMethod,
      items: schema.transactions.items,
      createdAt: schema.transactions.createdAt,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
    })
    .from(schema.transactions)
    .leftJoin(schema.customers, eq(schema.transactions.customerId, schema.customers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(limit);

  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    paymentMethod: t.paymentMethod || "unknown",
    customerName: t.customerFirstName && t.customerLastName
      ? `${t.customerFirstName} ${t.customerLastName}`
      : null,
    items: t.items as unknown[] | null,
    createdAt: t.createdAt,
  }));
}

export async function adjustProductStock(
  organizationId: string,
  productId: string,
  adjustment: number
): Promise<boolean> {
  await db
    .update(schema.products)
    .set({
      stockQuantity: sql`${schema.products.stockQuantity} + ${adjustment}`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, productId)
    ));
  return true;
}

// ============================================================================
// Team Member Queries
// ============================================================================

export async function getTeamMembers(organizationId: string) {
  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      userName: schema.user.name,
      userEmail: schema.user.email,
      userImage: schema.user.image,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, organizationId))
    .orderBy(schema.user.name);

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.userName,
    email: m.userEmail,
    role: m.role,
    avatarUrl: m.userImage,
    createdAt: m.createdAt,
  }));
}

export async function getTeamMemberCount(organizationId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId));

  return Number(result[0]?.count || 0);
}

// ============================================================================
// Billing Queries
// ============================================================================

export async function getBillingHistory(organizationId: string, limit = 10) {
  // For now return empty - billing is handled by Stripe
  return [];
}

export async function getMonthlyBookingCount(organizationId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      gte(schema.bookings.createdAt, startOfMonth)
    ));

  return Number(result[0]?.count || 0);
}

// ============================================================================
// Booking Detail Queries
// ============================================================================

export async function getBookingWithFullDetails(organizationId: string, id: string) {
  const booking = await getBookingById(organizationId, id);
  if (!booking) return null;

  const customer = await getCustomerById(organizationId, booking.customerId);
  const trip = await getTripById(organizationId, booking.tripId);

  // Calculate pricing structure expected by UI
  const basePrice = trip?.price || booking.total / (booking.participants || 1);
  const balanceDue = (booking.total - booking.paidAmount).toFixed(2);

  return {
    ...booking,
    customer: {
      id: customer?.id || booking.customerId,
      firstName: customer?.firstName || "Unknown",
      lastName: customer?.lastName || "Customer",
      email: customer?.email || "",
      phone: customer?.phone || "",
    },
    trip: {
      id: trip?.id || booking.tripId,
      tourId: trip?.tourId || "",
      tourName: trip?.tourName || "Unknown Trip",
      date: trip?.date || "",
      startTime: trip?.startTime || "",
      endTime: trip?.endTime || "",
      boatName: trip?.boatName || "",
    },
    pricing: {
      basePrice: basePrice.toFixed(2),
      participants: booking.participants,
      subtotal: booking.subtotal.toFixed(2),
      equipmentTotal: "0.00",
      discount: booking.discount.toFixed(2),
      total: booking.total.toFixed(2),
    },
    paidAmount: booking.paidAmount.toFixed(2),
    balanceDue,
    participantDetails: [],
    equipmentRental: [],
    internalNotes: null,
  };
}

export async function getPaymentsByBookingId(organizationId: string, bookingId: string) {
  const payments = await db
    .select()
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.bookingId, bookingId)
    ))
    .orderBy(desc(schema.transactions.createdAt));

  return payments.map((p) => ({
    id: p.id,
    type: p.type,
    amount: Number(p.amount),
    method: p.paymentMethod,
    date: p.createdAt,
    note: p.notes,
  }));
}

export async function recordPayment(organizationId: string, data: {
  bookingId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}) {
  const { bookingId, amount, paymentMethod, notes } = data;

  // Create the transaction record
  const [transaction] = await db
    .insert(schema.transactions)
    .values({
      organizationId,
      bookingId,
      type: "payment",
      amount: String(amount),
      paymentMethod,
      notes,
    })
    .returning();

  // Update the booking's paid amount
  const [booking] = await db
    .select({ paidAmount: schema.bookings.paidAmount })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId));

  if (booking) {
    const newPaidAmount = Number(booking.paidAmount || 0) + amount;
    await db
      .update(schema.bookings)
      .set({
        paidAmount: String(newPaidAmount),
        paymentStatus: "partial", // Will be updated to "paid" if full
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, bookingId));

    // Check if fully paid and update status
    const [updatedBooking] = await db
      .select({ total: schema.bookings.total, paidAmount: schema.bookings.paidAmount })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));

    if (updatedBooking && Number(updatedBooking.paidAmount) >= Number(updatedBooking.total)) {
      await db
        .update(schema.bookings)
        .set({ paymentStatus: "paid" })
        .where(eq(schema.bookings.id, bookingId));
    }
  }

  return transaction;
}

// ============================================================================
// Trip Detail Queries
// ============================================================================

export async function getTripWithFullDetails(organizationId: string, id: string) {
  const trip = await getTripById(organizationId, id);
  if (!trip) return null;

  const tour = await getTourById(organizationId, trip.tourId);
  const boat = trip.boatId ? await getBoatById(organizationId, trip.boatId) : null;

  return {
    ...trip,
    tour: tour ? { id: tour.id, name: tour.name } : { id: trip.tourId, name: trip.tourName || "" },
    boat: boat ? { id: boat.id, name: boat.name } : { id: "", name: "No boat assigned" },
    staff: [] as Array<{ id: string; name: string; role: string }>, // No trip-specific staff assignments in schema yet
    weatherNotes: trip.weatherNotes || null,
  };
}

export async function getTripBookings(organizationId: string, tripId: string) {
  const { bookings } = await getBookings(organizationId, { tripId, limit: 100 });
  // Transform to structure expected by trip detail page
  return bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    participants: b.participants,
    total: b.total,
    paidInFull: b.paidAmount >= b.total,
    customer: {
      id: b.customerId,
      email: b.customerEmail,
      firstName: b.firstName,
      lastName: b.lastName,
    },
  }));
}

export async function getTripRevenue(organizationId: string, tripId: string) {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)`,
      paid: sql<number>`COALESCE(SUM(CAST(${schema.bookings.paidAmount} AS DECIMAL)), 0)`,
    })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.tripId, tripId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'refunded')`
    ));

  const bookingsTotal = Number(result[0]?.total || 0).toFixed(2);
  const paidTotal = Number(result[0]?.paid || 0);
  const pendingTotal = (Number(result[0]?.total || 0) - paidTotal).toFixed(2);

  return { bookingsTotal, pendingTotal };
}

export async function getTripBookedParticipants(organizationId: string, tripId: string) {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.tripId, tripId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  return Number(result[0]?.total || 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeDate(date: any): string {
  if (!date) return "";
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTime(date: any): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(time: any): string {
  if (!time) return "";
  if (typeof time === "string") {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  }
  return String(time);
}

function formatDateString(date: any): string {
  if (!date) return "";
  if (typeof date === "string") return date;
  if (date instanceof Date) return date.toISOString().split("T")[0];
  return String(date);
}

function formatTimeString(time: any): string {
  if (!time) return "";
  if (typeof time === "string") return time;
  return String(time);
}

// ============================================================================
// Mappers
// ============================================================================

function mapCustomer(row: any) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName || row.first_name,
    lastName: row.lastName || row.last_name,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth || row.date_of_birth,
    emergencyContactName: row.emergencyContactName || row.emergency_contact_name,
    emergencyContactPhone: row.emergencyContactPhone || row.emergency_contact_phone,
    emergencyContactRelation: row.emergencyContactRelation || row.emergency_contact_relation,
    medicalConditions: row.medicalConditions || row.medical_conditions,
    medications: row.medications,
    certifications: row.certifications,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode || row.postal_code,
    country: row.country,
    preferredLanguage: row.preferredLanguage || row.preferred_language || "en",
    tags: row.tags || [],
    marketingOptIn: row.marketingOptIn ?? row.marketing_opt_in ?? false,
    notes: row.notes,
    totalDives: row.totalDives || row.total_dives || 0,
    totalSpent: Number(row.totalSpent || row.total_spent || 0),
    lastDiveAt: row.lastDiveAt || row.last_dive_at,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapTour(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    duration: row.duration,
    maxParticipants: row.maxParticipants || row.max_participants,
    minParticipants: row.minParticipants || row.min_participants,
    price: Number(row.price || 0),
    currency: row.currency,
    includesEquipment: row.includesEquipment || row.includes_equipment,
    includesMeals: row.includesMeals || row.includes_meals,
    includesTransport: row.includesTransport || row.includes_transport,
    minCertLevel: row.minCertLevel || row.min_cert_level,
    minAge: row.minAge || row.min_age,
    inclusions: row.inclusions || [],
    exclusions: row.exclusions || [],
    requirements: row.requirements || [],
    isActive: row.isActive || row.is_active,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapTrip(row: any) {
  return {
    id: row.id,
    tourId: row.tourId || row.tour_id,
    boatId: row.boatId || row.boat_id,
    date: row.date,
    startTime: row.startTime || row.start_time,
    endTime: row.endTime || row.end_time,
    status: row.status,
    maxParticipants: row.maxParticipants || row.max_participants,
    price: row.price ? Number(row.price) : null,
    notes: row.notes,
    weatherNotes: row.weatherNotes || row.weather_notes || null,
    tourName: row.tourName || row.tour_name,
    tourType: row.tourType || row.tour_type,
    boatName: row.boatName || row.boat_name,
    bookedParticipants: Number(row.bookedParticipants || row.booked_participants || 0),
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapBooking(row: any) {
  const firstName = row.first_name || row.firstName || '';
  const lastName = row.last_name || row.lastName || '';
  return {
    id: row.id,
    bookingNumber: row.bookingNumber || row.booking_number,
    tripId: row.tripId || row.trip_id,
    customerId: row.customerId || row.customer_id,
    participants: row.participants,
    status: row.status,
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    tax: Number(row.tax || 0),
    total: Number(row.total || 0),
    currency: row.currency,
    paymentStatus: row.paymentStatus || row.payment_status,
    paidAmount: Number(row.paidAmount || row.paid_amount || 0),
    specialRequests: row.specialRequests || row.special_requests,
    source: row.source,
    firstName,
    lastName,
    customerName: firstName && lastName ? `${firstName} ${lastName}` : row.customerName,
    customerEmail: row.customerEmail || row.customer_email,
    customerPhone: row.customerPhone || row.customer_phone,
    tourName: row.tourName || row.tour_name,
    tripDate: row.tripDate || row.trip_date,
    tripTime: row.tripTime || row.trip_time,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapEquipment(row: any) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber || row.serial_number,
    barcode: row.barcode,
    size: row.size,
    status: row.status,
    condition: row.condition,
    rentalPrice: row.rentalPrice || row.rental_price ? Number(row.rentalPrice || row.rental_price) : null,
    isRentable: row.isRentable || row.is_rentable,
    lastServiceDate: row.lastServiceDate || row.last_service_date,
    nextServiceDate: row.nextServiceDate || row.next_service_date,
    serviceNotes: row.serviceNotes || row.service_notes,
    purchaseDate: row.purchaseDate || row.purchase_date,
    purchasePrice: row.purchasePrice || row.purchase_price ? Number(row.purchasePrice || row.purchase_price) : null,
    notes: row.notes,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapBoat(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    type: row.type,
    registrationNumber: row.registrationNumber || row.registration_number,
    amenities: row.amenities,
    isActive: row.isActive || row.is_active,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapDiveSite(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    maxDepth: row.maxDepth || row.max_depth,
    minDepth: row.minDepth || row.min_depth,
    difficulty: row.difficulty,
    currentStrength: row.currentStrength || row.current_strength,
    visibility: row.visibility,
    highlights: row.highlights,
    isActive: row.isActive || row.is_active,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    description: row.description,
    price: Number(row.price || 0),
    costPrice: row.costPrice || row.cost_price ? Number(row.costPrice || row.cost_price) : null,
    currency: row.currency,
    taxRate: Number(row.taxRate || row.tax_rate || 0),
    salePrice: row.salePrice || row.sale_price ? Number(row.salePrice || row.sale_price) : null,
    trackInventory: row.trackInventory || row.track_inventory,
    stockQuantity: row.stockQuantity || row.stock_quantity || 0,
    lowStockThreshold: row.lowStockThreshold || row.low_stock_threshold || 5,
    imageUrl: row.imageUrl || row.image_url,
    isActive: row.isActive || row.is_active,
  };
}

// ============================================================================
// Staff Queries
// ============================================================================

/**
 * Get staff members for an organization
 * Staff are organization members with roles: owner, admin, manager, staff
 */
export async function getStaff(
  organizationId: string,
  options: { activeOnly?: boolean } = {}
) {
  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(
      and(
        eq(schema.member.organizationId, organizationId),
        sql`${schema.member.role} IN ('owner', 'admin', 'manager', 'staff')`
      )
    );

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.name || m.email,
    role: m.role,
    email: m.email,
  }));
}
