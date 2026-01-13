/**
 * Tenant Database Query Helpers
 *
 * These functions provide typed queries for tenant-specific data.
 * Each function accepts a tenant schema and returns query results.
 */

import { desc, eq, gte, lte, count, sum, and, sql } from "drizzle-orm";
import type { TenantSchema } from "./schema";
import postgres from "postgres";

// Get the raw postgres client for a schema
function getClient(schemaName: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }
  return postgres(connectionString);
}

// ============================================================================
// Dashboard Queries
// ============================================================================

export async function getDashboardStats(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Today's bookings count
    const todayBookings = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".bookings
      WHERE DATE(created_at) = '${today}'
    `);

    // This week's revenue (sum of paid transactions)
    const weekRevenue = await client.unsafe(`
      SELECT COALESCE(SUM(amount), 0) as total FROM "${schemaName}".transactions
      WHERE type = 'sale' AND created_at >= '${weekAgo}'
    `);

    // Active trips (scheduled trips today or tomorrow)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const activeTrips = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".trips
      WHERE status IN ('scheduled', 'in_progress') AND date <= '${tomorrow}'
    `);

    // Total customers
    const totalCustomers = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".customers
    `);

    return {
      todayBookings: Number(todayBookings[0]?.count || 0),
      weekRevenue: Number(weekRevenue[0]?.total || 0),
      activeTrips: Number(activeTrips[0]?.count || 0),
      totalCustomers: Number(totalCustomers[0]?.count || 0),
    };
  } finally {
    await client.end();
  }
}

export async function getUpcomingTrips(schemaName: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const today = new Date().toISOString().split("T")[0];

    const trips = await client.unsafe(`
      SELECT
        t.id,
        tr.name,
        t.date,
        t.start_time,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        (
          SELECT COALESCE(SUM(b.participants), 0)
          FROM "${schemaName}".bookings b
          WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')
        ) as current_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.date >= '${today}' AND t.status = 'scheduled'
      ORDER BY t.date, t.start_time
      LIMIT ${limit}
    `);

    return trips.map((trip: any) => ({
      id: trip.id,
      name: trip.name,
      date: formatRelativeDate(trip.date),
      time: formatTime(trip.start_time),
      participants: Number(trip.current_participants || 0),
      maxParticipants: Number(trip.max_participants || 0),
    }));
  } finally {
    await client.end();
  }
}

export async function getRecentBookings(schemaName: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const bookings = await client.unsafe(`
      SELECT
        b.id,
        b.status,
        b.total,
        b.created_at,
        c.first_name,
        c.last_name,
        tr.name as trip_name
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      ORDER BY b.created_at DESC
      LIMIT ${limit}
    `);

    return bookings.map((booking: any) => ({
      id: booking.id,
      customer: `${booking.first_name} ${booking.last_name}`,
      trip: booking.trip_name,
      date: formatRelativeTime(booking.created_at),
      status: booking.status,
      amount: Number(booking.total || 0),
    }));
  } finally {
    await client.end();
  }
}

// ============================================================================
// Customer Queries
// ============================================================================

export async function getCustomerBookings(schemaName: string, customerId: string, limit = 10) {
  const client = getClient(schemaName);

  try {
    const bookings = await client.unsafe(`
      SELECT
        b.id,
        b.booking_number,
        b.status,
        b.total,
        b.created_at,
        tr.name as trip_name,
        t.date as trip_date
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE b.customer_id = '${customerId}'
      ORDER BY t.date DESC
      LIMIT ${limit}
    `);

    return bookings.map((b: any) => ({
      id: b.id,
      bookingNumber: b.booking_number,
      tripName: b.trip_name,
      date: b.trip_date,
      status: b.status,
      total: Number(b.total || 0).toFixed(2),
    }));
  } finally {
    await client.end();
  }
}

export async function getCustomers(
  schemaName: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const client = getClient(schemaName);
  const { search, limit = 50, offset = 0 } = options;

  try {
    let whereClause = "";
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      whereClause = `WHERE
        first_name ILIKE '%${searchTerm}%' OR
        last_name ILIKE '%${searchTerm}%' OR
        email ILIKE '%${searchTerm}%'`;
    }

    const customers = await client.unsafe(`
      SELECT * FROM "${schemaName}".customers
      ${whereClause}
      ORDER BY last_name, first_name
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".customers ${whereClause}
    `);

    return {
      customers: customers.map(mapCustomer),
      total: Number(countResult[0]?.count || 0),
    };
  } finally {
    await client.end();
  }
}

export async function getCustomerById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT * FROM "${schemaName}".customers WHERE id = '${id}'
    `);
    return result[0] ? mapCustomer(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function createCustomer(schemaName: string, data: {
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
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".customers (
        email, first_name, last_name, phone, date_of_birth,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        medical_conditions, medications, certifications,
        address, city, state, postal_code, country, notes
      ) VALUES (
        '${data.email.replace(/'/g, "''")}',
        '${data.firstName.replace(/'/g, "''")}',
        '${data.lastName.replace(/'/g, "''")}',
        ${data.phone ? `'${data.phone.replace(/'/g, "''")}'` : "NULL"},
        ${data.dateOfBirth ? `'${data.dateOfBirth}'` : "NULL"},
        ${data.emergencyContactName ? `'${data.emergencyContactName.replace(/'/g, "''")}'` : "NULL"},
        ${data.emergencyContactPhone ? `'${data.emergencyContactPhone.replace(/'/g, "''")}'` : "NULL"},
        ${data.emergencyContactRelation ? `'${data.emergencyContactRelation.replace(/'/g, "''")}'` : "NULL"},
        ${data.medicalConditions ? `'${data.medicalConditions.replace(/'/g, "''")}'` : "NULL"},
        ${data.medications ? `'${data.medications.replace(/'/g, "''")}'` : "NULL"},
        ${data.certifications ? `'${JSON.stringify(data.certifications).replace(/'/g, "''")}'::jsonb` : "NULL"},
        ${data.address ? `'${data.address.replace(/'/g, "''")}'` : "NULL"},
        ${data.city ? `'${data.city.replace(/'/g, "''")}'` : "NULL"},
        ${data.state ? `'${data.state.replace(/'/g, "''")}'` : "NULL"},
        ${data.postalCode ? `'${data.postalCode.replace(/'/g, "''")}'` : "NULL"},
        ${data.country ? `'${data.country.replace(/'/g, "''")}'` : "NULL"},
        ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : "NULL"}
      ) RETURNING *
    `);
    return mapCustomer(result[0]);
  } finally {
    await client.end();
  }
}

export async function updateCustomer(schemaName: string, id: string, data: Partial<{
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
  const client = getClient(schemaName);

  try {
    const updates: string[] = [];
    if (data.email !== undefined) updates.push(`email = '${data.email.replace(/'/g, "''")}'`);
    if (data.firstName !== undefined) updates.push(`first_name = '${data.firstName.replace(/'/g, "''")}'`);
    if (data.lastName !== undefined) updates.push(`last_name = '${data.lastName.replace(/'/g, "''")}'`);
    if (data.phone !== undefined) updates.push(`phone = '${data.phone.replace(/'/g, "''")}'`);
    if (data.dateOfBirth !== undefined) updates.push(`date_of_birth = '${data.dateOfBirth}'`);
    if (data.emergencyContactName !== undefined) updates.push(`emergency_contact_name = '${data.emergencyContactName.replace(/'/g, "''")}'`);
    if (data.emergencyContactPhone !== undefined) updates.push(`emergency_contact_phone = '${data.emergencyContactPhone.replace(/'/g, "''")}'`);
    if (data.emergencyContactRelation !== undefined) updates.push(`emergency_contact_relation = '${data.emergencyContactRelation.replace(/'/g, "''")}'`);
    if (data.medicalConditions !== undefined) updates.push(`medical_conditions = '${data.medicalConditions.replace(/'/g, "''")}'`);
    if (data.medications !== undefined) updates.push(`medications = '${data.medications.replace(/'/g, "''")}'`);
    if (data.certifications !== undefined) updates.push(`certifications = '${JSON.stringify(data.certifications).replace(/'/g, "''")}'::jsonb`);
    if (data.address !== undefined) updates.push(`address = '${data.address.replace(/'/g, "''")}'`);
    if (data.city !== undefined) updates.push(`city = '${data.city.replace(/'/g, "''")}'`);
    if (data.state !== undefined) updates.push(`state = '${data.state.replace(/'/g, "''")}'`);
    if (data.postalCode !== undefined) updates.push(`postal_code = '${data.postalCode.replace(/'/g, "''")}'`);
    if (data.country !== undefined) updates.push(`country = '${data.country.replace(/'/g, "''")}'`);
    if (data.notes !== undefined) updates.push(`notes = '${data.notes.replace(/'/g, "''")}'`);
    updates.push(`updated_at = NOW()`);

    const result = await client.unsafe(`
      UPDATE "${schemaName}".customers
      SET ${updates.join(", ")}
      WHERE id = '${id}'
      RETURNING *
    `);
    return result[0] ? mapCustomer(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function deleteCustomer(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    await client.unsafe(`DELETE FROM "${schemaName}".customers WHERE id = '${id}'`);
    return true;
  } finally {
    await client.end();
  }
}

// ============================================================================
// Tours & Trips Queries
// ============================================================================

export async function getTours(
  schemaName: string,
  options: { activeOnly?: boolean; search?: string; type?: string } = {}
) {
  const client = getClient(schemaName);
  const { activeOnly = false, search, type } = options;

  try {
    const conditions: string[] = [];
    if (activeOnly) conditions.push("t.is_active = true");
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      conditions.push(`t.name ILIKE '%${searchTerm}%'`);
    }
    if (type) conditions.push(`t.type = '${type}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const tours = await client.unsafe(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM "${schemaName}".trips tr WHERE tr.tour_id = t.id) as trip_count
      FROM "${schemaName}".tours t
      ${whereClause}
      ORDER BY t.name
    `);

    return tours.map((row: any) => ({
      ...mapTour(row),
      tripCount: Number(row.trip_count || 0),
    }));
  } finally {
    await client.end();
  }
}

/**
 * Get all active tours for dropdown selection
 */
export async function getAllTours(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const tours = await client.unsafe(`
      SELECT id, name
      FROM "${schemaName}".tours
      WHERE is_active = true
      ORDER BY name
    `);

    return tours.map((row: any) => ({
      id: row.id,
      name: row.name,
    }));
  } finally {
    await client.end();
  }
}

export async function getTourById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT * FROM "${schemaName}".tours WHERE id = '${id}'
    `);
    return result[0] ? mapTour(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function createTour(schemaName: string, data: {
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
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".tours (
        name, description, type, duration, max_participants, min_participants,
        price, currency, includes_equipment, includes_meals, includes_transport,
        min_cert_level, min_age
      ) VALUES (
        '${data.name.replace(/'/g, "''")}',
        ${data.description ? `'${data.description.replace(/'/g, "''")}'` : "NULL"},
        '${data.type}',
        ${data.duration || "NULL"},
        ${data.maxParticipants},
        ${data.minParticipants || 1},
        ${data.price},
        '${data.currency || "USD"}',
        ${data.includesEquipment || false},
        ${data.includesMeals || false},
        ${data.includesTransport || false},
        ${data.minCertLevel ? `'${data.minCertLevel}'` : "NULL"},
        ${data.minAge || "NULL"}
      ) RETURNING *
    `);
    return mapTour(result[0]);
  } finally {
    await client.end();
  }
}

export async function getTrips(
  schemaName: string,
  options: { fromDate?: string; toDate?: string; status?: string; limit?: number } = {}
) {
  const client = getClient(schemaName);
  const { fromDate, toDate, status, limit = 50 } = options;

  try {
    const conditions: string[] = [];
    if (fromDate) conditions.push(`t.date >= '${fromDate}'`);
    if (toDate) conditions.push(`t.date <= '${toDate}'`);
    if (status) conditions.push(`t.status = '${status}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const trips = await client.unsafe(`
      SELECT
        t.*,
        tr.name as tour_name,
        tr.type as tour_type,
        b.name as boat_name,
        (
          SELECT COALESCE(SUM(bk.participants), 0)
          FROM "${schemaName}".bookings bk
          WHERE bk.trip_id = t.id AND bk.status NOT IN ('canceled', 'no_show')
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats b ON t.boat_id = b.id
      ${whereClause}
      ORDER BY t.date, t.start_time
      LIMIT ${limit}
    `);

    return trips.map(mapTrip);
  } finally {
    await client.end();
  }
}

export async function getTripById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        t.*,
        tr.name as tour_name,
        tr.type as tour_type,
        tr.price as tour_price,
        tr.max_participants as tour_max_participants,
        b.name as boat_name
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats b ON t.boat_id = b.id
      WHERE t.id = '${id}'
    `);
    return result[0] ? mapTrip(result[0]) : null;
  } finally {
    await client.end();
  }
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
  schemaName: string,
  options: { fromDate: string; toDate: string }
): Promise<CalendarTrip[]> {
  const client = getClient(schemaName);
  const { fromDate, toDate } = options;

  try {
    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.tour_id,
        tr.name as tour_name,
        tr.type as tour_type,
        t.date,
        t.start_time,
        t.end_time,
        b.name as boat_name,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        t.status,
        (
          SELECT COALESCE(SUM(bk.participants), 0)
          FROM "${schemaName}".bookings bk
          WHERE bk.trip_id = t.id AND bk.status NOT IN ('canceled', 'no_show')
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats b ON t.boat_id = b.id
      WHERE t.date >= '${fromDate}' AND t.date <= '${toDate}'
      ORDER BY t.date, t.start_time
    `);

    return trips.map((row: any) => ({
      id: row.id,
      tourId: row.tour_id,
      tourName: row.tour_name,
      tourType: row.tour_type,
      date: formatDateString(row.date),
      startTime: formatTimeString(row.start_time),
      endTime: row.end_time ? formatTimeString(row.end_time) : null,
      boatName: row.boat_name,
      maxParticipants: Number(row.max_participants || 0),
      bookedParticipants: Number(row.booked_participants || 0),
      status: row.status,
    }));
  } finally {
    await client.end();
  }
}

export async function createTrip(schemaName: string, data: {
  tourId: string;
  boatId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  maxParticipants?: number;
  price?: number;
  notes?: string;
}) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".trips (
        tour_id, boat_id, date, start_time, end_time, max_participants, price, notes
      ) VALUES (
        '${data.tourId}',
        ${data.boatId ? `'${data.boatId}'` : "NULL"},
        '${data.date}',
        '${data.startTime}',
        ${data.endTime ? `'${data.endTime}'` : "NULL"},
        ${data.maxParticipants || "NULL"},
        ${data.price || "NULL"},
        ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : "NULL"}
      ) RETURNING *
    `);
    return result[0];
  } finally {
    await client.end();
  }
}

// ============================================================================
// Booking Queries
// ============================================================================

export async function getBookings(
  schemaName: string,
  options: { status?: string; tripId?: string; customerId?: string; limit?: number; offset?: number } = {}
) {
  const client = getClient(schemaName);
  const { status, tripId, customerId, limit = 50, offset = 0 } = options;

  try {
    const conditions: string[] = [];
    if (status) conditions.push(`b.status = '${status}'`);
    if (tripId) conditions.push(`b.trip_id = '${tripId}'`);
    if (customerId) conditions.push(`b.customer_id = '${customerId}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const bookings = await client.unsafe(`
      SELECT
        b.*,
        c.first_name,
        c.last_name,
        c.email as customer_email,
        c.phone as customer_phone,
        tr.name as tour_name,
        t.date as trip_date,
        t.start_time as trip_time
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".bookings b ${whereClause}
    `);

    return {
      bookings: bookings.map(mapBooking),
      total: Number(countResult[0]?.count || 0),
    };
  } finally {
    await client.end();
  }
}

export async function getBookingById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        b.*,
        c.first_name,
        c.last_name,
        c.email as customer_email,
        c.phone as customer_phone,
        tr.name as tour_name,
        t.date as trip_date,
        t.start_time as trip_time
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE b.id = '${id}'
    `);
    return result[0] ? mapBooking(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function createBooking(schemaName: string, data: {
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
  const client = getClient(schemaName);

  try {
    // Generate booking number
    const bookingNumber = `BK${Date.now().toString(36).toUpperCase()}`;

    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".bookings (
        booking_number, trip_id, customer_id, participants,
        subtotal, discount, tax, total, currency, special_requests, source
      ) VALUES (
        '${bookingNumber}',
        '${data.tripId}',
        '${data.customerId}',
        ${data.participants || 1},
        ${data.subtotal},
        ${data.discount || 0},
        ${data.tax || 0},
        ${data.total},
        '${data.currency || "USD"}',
        ${data.specialRequests ? `'${data.specialRequests.replace(/'/g, "''")}'` : "NULL"},
        '${data.source || "direct"}'
      ) RETURNING *
    `);
    return result[0];
  } finally {
    await client.end();
  }
}

export async function updateBookingStatus(schemaName: string, id: string, status: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      UPDATE "${schemaName}".bookings
      SET status = '${status}', updated_at = NOW()
      WHERE id = '${id}'
      RETURNING *
    `);
    return result[0];
  } finally {
    await client.end();
  }
}

// ============================================================================
// Equipment Queries
// ============================================================================

export async function getEquipment(
  schemaName: string,
  options: { category?: string; status?: string; search?: string; isRentable?: boolean; limit?: number } = {}
) {
  const client = getClient(schemaName);
  const { category, status, search, isRentable, limit = 100 } = options;

  try {
    const conditions: string[] = [];
    if (category) conditions.push(`category = '${category}'`);
    if (status) conditions.push(`status = '${status}'`);
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      conditions.push(`name ILIKE '%${searchTerm}%'`);
    }
    if (isRentable !== undefined) conditions.push(`is_rentable = ${isRentable}`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const equipment = await client.unsafe(`
      SELECT * FROM "${schemaName}".equipment
      ${whereClause}
      ORDER BY category, name
      LIMIT ${limit}
    `);

    return equipment.map(mapEquipment);
  } finally {
    await client.end();
  }
}

export async function getEquipmentById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT * FROM "${schemaName}".equipment WHERE id = '${id}'
    `);
    return result[0] ? mapEquipment(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function createEquipment(schemaName: string, data: {
  category: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  size?: string;
  status?: string;
  condition?: string;
  rentalPrice?: number;
  isRentable?: boolean;
}) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".equipment (
        category, name, brand, model, serial_number, size,
        status, condition, rental_price, is_rentable
      ) VALUES (
        '${data.category}',
        '${data.name.replace(/'/g, "''")}',
        ${data.brand ? `'${data.brand.replace(/'/g, "''")}'` : "NULL"},
        ${data.model ? `'${data.model.replace(/'/g, "''")}'` : "NULL"},
        ${data.serialNumber ? `'${data.serialNumber.replace(/'/g, "''")}'` : "NULL"},
        ${data.size ? `'${data.size}'` : "NULL"},
        '${data.status || "available"}',
        '${data.condition || "good"}',
        ${data.rentalPrice || "NULL"},
        ${data.isRentable !== false}
      ) RETURNING *
    `);
    return mapEquipment(result[0]);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Boats Queries
// ============================================================================

export async function getBoats(
  schemaName: string,
  options: { activeOnly?: boolean; search?: string } = {}
) {
  const client = getClient(schemaName);
  const { activeOnly = false, search } = options;

  try {
    const conditions: string[] = [];
    if (activeOnly) conditions.push("b.is_active = true");
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      conditions.push(`b.name ILIKE '%${searchTerm}%'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const boats = await client.unsafe(`
      SELECT
        b.*,
        (SELECT COUNT(*) FROM "${schemaName}".trips t WHERE t.boat_id = b.id) as trip_count
      FROM "${schemaName}".boats b
      ${whereClause}
      ORDER BY b.name
    `);

    return boats.map((row: any) => ({
      ...mapBoat(row),
      tripCount: Number(row.trip_count || 0),
    }));
  } finally {
    await client.end();
  }
}

/**
 * Get all active boats for dropdown selection
 */
export async function getAllBoats(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const boats = await client.unsafe(`
      SELECT id, name, capacity
      FROM "${schemaName}".boats
      WHERE is_active = true
      ORDER BY name
    `);

    return boats.map((row: any) => ({
      id: row.id,
      name: row.name,
      capacity: row.capacity,
    }));
  } finally {
    await client.end();
  }
}

export async function getBoatById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT * FROM "${schemaName}".boats WHERE id = '${id}'
    `);
    return result[0] ? mapBoat(result[0]) : null;
  } finally {
    await client.end();
  }
}

export async function createBoat(schemaName: string, data: {
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  registrationNumber?: string;
}) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".boats (
        name, description, capacity, type, registration_number
      ) VALUES (
        '${data.name.replace(/'/g, "''")}',
        ${data.description ? `'${data.description.replace(/'/g, "''")}'` : "NULL"},
        ${data.capacity},
        ${data.type ? `'${data.type}'` : "NULL"},
        ${data.registrationNumber ? `'${data.registrationNumber.replace(/'/g, "''")}'` : "NULL"}
      ) RETURNING *
    `);
    return mapBoat(result[0]);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Dive Sites Queries
// ============================================================================

export async function getDiveSites(
  schemaName: string,
  options: { activeOnly?: boolean; search?: string; difficulty?: string } = {}
) {
  const client = getClient(schemaName);
  const { activeOnly = false, search, difficulty } = options;

  try {
    const conditions: string[] = [];
    if (activeOnly) conditions.push("ds.is_active = true");
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      conditions.push(`ds.name ILIKE '%${searchTerm}%'`);
    }
    if (difficulty) conditions.push(`ds.difficulty = '${difficulty}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sites = await client.unsafe(`
      SELECT ds.*
      FROM "${schemaName}".dive_sites ds
      ${whereClause}
      ORDER BY ds.name
    `);

    return sites.map((row: any) => ({
      ...mapDiveSite(row),
    }));
  } finally {
    await client.end();
  }
}

export async function getDiveSiteById(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT * FROM "${schemaName}".dive_sites WHERE id = '${id}'
    `);
    return result[0] ? mapDiveSite(result[0]) : null;
  } finally {
    await client.end();
  }
}

// ============================================================================
// Tour Detail Queries
// ============================================================================

export async function getTourStats(schemaName: string, tourId: string) {
  const client = getClient(schemaName);

  try {
    // Get trip count
    const tripCountResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".trips WHERE tour_id = '${tourId}'
    `);

    // Get total revenue from bookings on trips for this tour
    const revenueResult = await client.unsafe(`
      SELECT COALESCE(SUM(b.total), 0) as total
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE t.tour_id = '${tourId}' AND b.status NOT IN ('canceled', 'refunded')
    `);

    // Get average rating (if you have ratings, otherwise return null)
    // For now, return null as ratings may not be implemented
    const avgRating = null;

    return {
      tripCount: Number(tripCountResult[0]?.count || 0),
      totalRevenue: Number(revenueResult[0]?.total || 0),
      averageRating: avgRating,
    };
  } finally {
    await client.end();
  }
}

export async function getUpcomingTripsForTour(schemaName: string, tourId: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const today = new Date().toISOString().split("T")[0];

    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.date,
        t.start_time,
        t.status,
        COALESCE(t.max_participants, tr.max_participants) as max_spots,
        b.name as boat_name,
        (
          SELECT COALESCE(SUM(bk.participants), 0)
          FROM "${schemaName}".bookings bk
          WHERE bk.trip_id = t.id AND bk.status NOT IN ('canceled', 'no_show')
        ) as spots_booked
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats b ON t.boat_id = b.id
      WHERE t.tour_id = '${tourId}' AND t.date >= '${today}'
      ORDER BY t.date, t.start_time
      LIMIT ${limit}
    `);

    return trips.map((trip: any) => {
      const spotsBooked = Number(trip.spots_booked || 0);
      const maxSpots = Number(trip.max_spots || 0);
      let status = trip.status;

      // Determine display status
      if (spotsBooked >= maxSpots && maxSpots > 0) {
        status = "full";
      } else if (trip.status === "scheduled" && spotsBooked > 0) {
        status = "confirmed";
      } else if (trip.status === "scheduled") {
        status = "open";
      }

      return {
        id: trip.id,
        date: formatDateString(trip.date),
        startTime: formatTimeString(trip.start_time),
        boatName: trip.boat_name || "No boat assigned",
        spotsBooked,
        maxSpots,
        status,
      };
    });
  } finally {
    await client.end();
  }
}

// ============================================================================
// Dive Site Detail Queries
// ============================================================================

export async function getDiveSiteStats(schemaName: string, siteId: string) {
  const client = getClient(schemaName);

  try {
    // Get total trips that visited this site
    // Check if dive_site_ids array contains this site ID
    const tripCountResult = await client.unsafe(`
      SELECT COUNT(DISTINCT t.id) as count
      FROM "${schemaName}".trips t
      WHERE t.dive_site_ids @> ARRAY['${siteId}']::uuid[]
    `).catch(() => [{ count: 0 }]);

    // Get total divers (sum of participants from bookings on trips to this site)
    const diversResult = await client.unsafe(`
      SELECT COALESCE(SUM(b.participants), 0) as total
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE b.status NOT IN ('canceled', 'no_show')
        AND t.dive_site_ids @> ARRAY['${siteId}']::uuid[]
    `).catch(() => [{ total: 0 }]);

    // Get last visited date
    const lastVisitedResult = await client.unsafe(`
      SELECT MAX(t.date) as last_date
      FROM "${schemaName}".trips t
      WHERE t.dive_site_ids @> ARRAY['${siteId}']::uuid[]
    `).catch(() => [{ last_date: null }]);

    return {
      totalTrips: Number(tripCountResult[0]?.count || 0),
      totalDivers: Number(diversResult[0]?.total || 0),
      avgRating: null, // Ratings may not be implemented
      lastVisited: lastVisitedResult[0]?.last_date ? formatDateString(lastVisitedResult[0].last_date) : null,
    };
  } finally {
    await client.end();
  }
}

export async function getRecentTripsForDiveSite(schemaName: string, siteId: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.date,
        t.conditions,
        tr.name as tour_name,
        (
          SELECT COALESCE(SUM(bk.participants), 0)
          FROM "${schemaName}".bookings bk
          WHERE bk.trip_id = t.id AND bk.status NOT IN ('canceled', 'no_show')
        ) as participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.dive_site_ids @> ARRAY['${siteId}']::uuid[]
      ORDER BY t.date DESC
      LIMIT ${limit}
    `).catch(() => []);

    return trips.map((trip: any) => ({
      id: trip.id,
      date: formatDateString(trip.date),
      tourName: trip.tour_name,
      participants: Number(trip.participants || 0),
      conditions: trip.conditions || null,
    }));
  } finally {
    await client.end();
  }
}

export async function getToursUsingDiveSite(schemaName: string, siteId: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    // Get tours that have had trips to this dive site
    const tours = await client.unsafe(`
      SELECT DISTINCT tr.id, tr.name
      FROM "${schemaName}".tours tr
      JOIN "${schemaName}".trips t ON t.tour_id = tr.id
      WHERE t.dive_site_ids @> ARRAY['${siteId}']::uuid[]
      ORDER BY tr.name
      LIMIT ${limit}
    `).catch(() => []);

    return tours.map((tour: any) => ({
      id: tour.id,
      name: tour.name,
    }));
  } finally {
    await client.end();
  }
}

export async function createDiveSite(schemaName: string, data: {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  maxDepth?: number;
  minDepth?: number;
  difficulty?: string;
  currentStrength?: string;
  visibility?: string;
}) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      INSERT INTO "${schemaName}".dive_sites (
        name, description, latitude, longitude, max_depth, min_depth,
        difficulty, current_strength, visibility
      ) VALUES (
        '${data.name.replace(/'/g, "''")}',
        ${data.description ? `'${data.description.replace(/'/g, "''")}'` : "NULL"},
        ${data.latitude || "NULL"},
        ${data.longitude || "NULL"},
        ${data.maxDepth || "NULL"},
        ${data.minDepth || "NULL"},
        ${data.difficulty ? `'${data.difficulty}'` : "NULL"},
        ${data.currentStrength ? `'${data.currentStrength}'` : "NULL"},
        ${data.visibility ? `'${data.visibility}'` : "NULL"}
      ) RETURNING *
    `);
    return mapDiveSite(result[0]);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Users/Staff Queries
// ============================================================================

export async function getStaff(
  schemaName: string,
  options: { activeOnly?: boolean; role?: string } = {}
) {
  const client = getClient(schemaName);
  const { activeOnly = true, role } = options;

  try {
    const conditions: string[] = [];
    if (activeOnly) conditions.push("is_active = true");
    if (role) conditions.push(`role = '${role}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const staff = await client.unsafe(`
      SELECT id, name, email, role, avatar_url
      FROM "${schemaName}".users
      ${whereClause}
      ORDER BY name
    `);

    return staff.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatarUrl: row.avatar_url,
    }));
  } finally {
    await client.end();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate.getTime() === today.getTime()) {
    return "Today";
  }
  if (inputDate.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function formatDateString(dateStr: string | Date): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
}

function formatTimeString(timeStr: string): string {
  if (!timeStr) return "";
  // If already in HH:MM format, return as-is
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  // If in HH:MM:SS format, strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr.slice(0, 5);
  return timeStr;
}

// Map database row to camelCase object
function mapCustomer(row: any) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyContactRelation: row.emergency_contact_relation,
    medicalConditions: row.medical_conditions,
    medications: row.medications,
    certifications: row.certifications,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    preferredLanguage: row.preferred_language,
    marketingOptIn: row.marketing_opt_in,
    notes: row.notes,
    tags: row.tags,
    totalDives: row.total_dives,
    totalSpent: row.total_spent,
    lastDiveAt: row.last_dive_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTour(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    duration: row.duration,
    maxParticipants: row.max_participants,
    minParticipants: row.min_participants,
    price: Number(row.price),
    currency: row.currency,
    includesEquipment: row.includes_equipment,
    includesMeals: row.includes_meals,
    includesTransport: row.includes_transport,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    minCertLevel: row.min_cert_level,
    minAge: row.min_age,
    requirements: row.requirements,
    images: row.images,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrip(row: any) {
  return {
    id: row.id,
    tourId: row.tour_id,
    boatId: row.boat_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    maxParticipants: row.max_participants || row.tour_max_participants,
    price: row.price ? Number(row.price) : (row.tour_price ? Number(row.tour_price) : null),
    weatherNotes: row.weather_notes,
    conditions: row.conditions,
    notes: row.notes,
    staffIds: row.staff_ids,
    tourName: row.tour_name,
    tourType: row.tour_type,
    boatName: row.boat_name,
    bookedParticipants: Number(row.booked_participants || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row: any) {
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    tripId: row.trip_id,
    customerId: row.customer_id,
    participants: row.participants,
    participantDetails: row.participant_details,
    status: row.status,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount || 0),
    tax: Number(row.tax || 0),
    total: Number(row.total),
    currency: row.currency,
    paymentStatus: row.payment_status,
    depositAmount: row.deposit_amount ? Number(row.deposit_amount) : null,
    depositPaidAt: row.deposit_paid_at,
    paidAmount: Number(row.paid_amount || 0),
    equipmentRental: row.equipment_rental,
    waiverSignedAt: row.waiver_signed_at,
    medicalFormSignedAt: row.medical_form_signed_at,
    specialRequests: row.special_requests,
    internalNotes: row.internal_notes,
    source: row.source,
    // Joined fields
    customerFirstName: row.first_name,
    customerLastName: row.last_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    tourName: row.tour_name,
    tripDate: row.trip_date,
    tripTime: row.trip_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEquipment(row: any) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    size: row.size,
    status: row.status,
    condition: row.condition,
    rentalPrice: row.rental_price ? Number(row.rental_price) : null,
    isRentable: row.is_rentable,
    lastServiceDate: row.last_service_date,
    nextServiceDate: row.next_service_date,
    serviceNotes: row.service_notes,
    purchaseDate: row.purchase_date,
    purchasePrice: row.purchase_price ? Number(row.purchase_price) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBoat(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    type: row.type,
    registrationNumber: row.registration_number,
    images: row.images,
    amenities: row.amenities,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDiveSite(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    maxDepth: row.max_depth,
    minDepth: row.min_depth,
    difficulty: row.difficulty,
    currentStrength: row.current_strength,
    visibility: row.visibility,
    highlights: row.highlights,
    images: row.images,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Team / User Queries
// ============================================================================

export async function getTeamMembers(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const users = await client.unsafe(`
      SELECT
        id,
        name,
        email,
        role,
        is_active,
        avatar_url,
        last_login_at,
        created_at
      FROM "${schemaName}".users
      WHERE is_active = true
      ORDER BY
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'divemaster' THEN 3
          ELSE 4
        END,
        name
    `);

    return users.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.is_active ? "active" : "inactive",
      avatar: row.avatar_url,
      lastActive: row.last_login_at ? formatRelativeTime(row.last_login_at) : "Never",
      joinedAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : null,
    }));
  } finally {
    await client.end();
  }
}

export async function getTeamMemberCount(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".users WHERE is_active = true
    `);
    return Number(result[0]?.count || 0);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Subscription Plan Queries (Public Schema)
// ============================================================================

export async function getSubscriptionPlanById(planId: string) {
  const client = getClient("public");

  try {
    const result = await client.unsafe(`
      SELECT * FROM subscription_plans WHERE id = '${planId}'
    `);

    if (!result[0]) return null;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      monthlyPrice: Number(row.monthly_price),
      yearlyPrice: Number(row.yearly_price),
      monthlyPriceId: row.monthly_price_id,
      yearlyPriceId: row.yearly_price_id,
      features: row.features,
      limits: row.limits,
      isActive: row.is_active,
    };
  } finally {
    await client.end();
  }
}

export async function getAllSubscriptionPlans() {
  const client = getClient("public");

  try {
    const result = await client.unsafe(`
      SELECT * FROM subscription_plans WHERE is_active = true ORDER BY monthly_price
    `);

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      monthlyPrice: Number(row.monthly_price),
      yearlyPrice: Number(row.yearly_price),
      monthlyPriceId: row.monthly_price_id,
      yearlyPriceId: row.yearly_price_id,
      features: row.features,
      limits: row.limits,
      isActive: row.is_active,
    }));
  } finally {
    await client.end();
  }
}

// ============================================================================
// Billing / Transaction Queries
// ============================================================================

export async function getBillingHistory(schemaName: string, limit = 10) {
  const client = getClient(schemaName);

  try {
    const transactions = await client.unsafe(`
      SELECT
        id,
        type,
        amount,
        currency,
        payment_method,
        stripe_payment_id,
        notes,
        created_at
      FROM "${schemaName}".transactions
      WHERE type IN ('sale', 'payment', 'subscription')
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return transactions.map((row: any) => ({
      id: row.id,
      date: new Date(row.created_at).toISOString().split("T")[0],
      description: row.notes || `${row.type.charAt(0).toUpperCase() + row.type.slice(1)} Payment`,
      amount: Number(row.amount),
      status: "paid",
      invoiceUrl: row.stripe_payment_id ? `https://dashboard.stripe.com/payments/${row.stripe_payment_id}` : "#",
    }));
  } finally {
    await client.end();
  }
}

export async function getMonthlyBookingCount(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".bookings
      WHERE created_at >= '${startOfMonth.toISOString()}'
    `);
    return Number(result[0]?.count || 0);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Integration Status Queries
// ============================================================================

export interface ConnectedIntegration {
  id: string;
  connectedAt: string;
  status: string;
  accountName: string;
  lastSync: string;
}

export function getConnectedIntegrations(tenant: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  name: string;
}): ConnectedIntegration[] {
  const integrations: ConnectedIntegration[] = [];

  // Check Stripe connection
  if (tenant.stripeCustomerId) {
    integrations.push({
      id: "stripe",
      connectedAt: "Connected",
      status: "active",
      accountName: tenant.name,
      lastSync: "Auto-synced",
    });
  }

  // Add more integration checks here as needed
  // e.g., Google Calendar, Mailchimp, etc.

  return integrations;
}

// ============================================================================
// Booking Detail Queries (for booking detail page)
// ============================================================================

export async function getBookingWithFullDetails(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        b.*,
        c.id as customer_id,
        c.first_name,
        c.last_name,
        c.email as customer_email,
        c.phone as customer_phone,
        t.id as trip_id,
        t.date as trip_date,
        t.start_time,
        t.end_time,
        t.boat_id,
        tr.id as tour_id,
        tr.name as tour_name,
        tr.price as tour_price,
        bo.name as boat_name
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats bo ON t.boat_id = bo.id
      WHERE b.id = '${id}'
    `);

    if (!result[0]) return null;

    const row = result[0];
    return {
      id: row.id,
      bookingNumber: row.booking_number,
      status: row.status,
      customer: {
        id: row.customer_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.customer_email,
        phone: row.customer_phone,
      },
      trip: {
        id: row.trip_id,
        tourName: row.tour_name,
        tourId: row.tour_id,
        date: formatDateStr(row.trip_date),
        startTime: formatTimeStr(row.start_time),
        endTime: formatTimeStr(row.end_time),
        boatName: row.boat_name,
      },
      participants: row.participants,
      participantDetails: row.participant_details || [],
      equipmentRental: row.equipment_rental || [],
      pricing: {
        basePrice: Number(row.tour_price || 0).toFixed(2),
        participants: row.participants,
        subtotal: Number(row.subtotal).toFixed(2),
        equipmentTotal: calcEquipmentTotal(row.equipment_rental),
        discount: Number(row.discount || 0).toFixed(2),
        total: Number(row.total).toFixed(2),
      },
      paidAmount: Number(row.paid_amount || 0).toFixed(2),
      balanceDue: (Number(row.total) - Number(row.paid_amount || 0)).toFixed(2),
      specialRequests: row.special_requests,
      internalNotes: row.internal_notes,
      source: row.source,
      createdAt: formatDateTimeStr(row.created_at),
      updatedAt: formatDateTimeStr(row.updated_at),
    };
  } finally {
    await client.end();
  }
}

export async function getPaymentsByBookingId(schemaName: string, bookingId: string) {
  const client = getClient(schemaName);

  try {
    const payments = await client.unsafe(`
      SELECT
        t.id,
        t.amount,
        t.payment_method,
        t.notes,
        t.created_at
      FROM "${schemaName}".transactions t
      WHERE t.booking_id = '${bookingId}'
      ORDER BY t.created_at DESC
    `);

    return payments.map((p: any) => ({
      id: p.id,
      date: formatDateStr(p.created_at),
      amount: Number(p.amount).toFixed(2),
      method: fmtPaymentMethod(p.payment_method),
      note: p.notes,
    }));
  } finally {
    await client.end();
  }
}

// ============================================================================
// Trip Detail Queries (for trip detail page)
// ============================================================================

export async function getTripWithFullDetails(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        t.*,
        tr.id as tour_id,
        tr.name as tour_name,
        tr.price as tour_price,
        COALESCE(t.max_participants, tr.max_participants) as effective_max_participants,
        b.id as boat_id,
        b.name as boat_name
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".boats b ON t.boat_id = b.id
      WHERE t.id = '${id}'
    `);

    if (!result[0]) return null;

    const row = result[0];

    // Get staff details if staff_ids exist
    let staff: { id: string; name: string; role: string }[] = [];
    if (row.staff_ids && Array.isArray(row.staff_ids) && row.staff_ids.length > 0) {
      const staffIds = row.staff_ids.map((sid: string) => `'${sid}'`).join(",");
      const staffResult = await client.unsafe(`
        SELECT id, name, role FROM "${schemaName}".users WHERE id IN (${staffIds})
      `);
      staff = staffResult.map((s: any) => ({
        id: s.id,
        name: s.name,
        role: capFirst(s.role),
      }));
    }

    return {
      id: row.id,
      tour: {
        id: row.tour_id,
        name: row.tour_name,
      },
      boat: {
        id: row.boat_id,
        name: row.boat_name || "No boat assigned",
      },
      date: formatDateStr(row.date),
      startTime: formatTimeStr(row.start_time),
      endTime: formatTimeStr(row.end_time),
      maxParticipants: Number(row.effective_max_participants),
      status: row.status,
      price: Number(row.price || row.tour_price || 0).toFixed(2),
      weatherNotes: row.weather_notes,
      notes: row.notes,
      staff,
      createdAt: formatDateStr(row.created_at),
    };
  } finally {
    await client.end();
  }
}

export async function getTripBookings(schemaName: string, tripId: string) {
  const client = getClient(schemaName);

  try {
    const bookings = await client.unsafe(`
      SELECT
        b.id,
        b.booking_number,
        b.participants,
        b.status,
        b.total,
        b.paid_amount,
        c.id as customer_id,
        c.first_name,
        c.last_name
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      WHERE b.trip_id = '${tripId}'
      ORDER BY b.created_at DESC
    `);

    return bookings.map((b: any) => ({
      id: b.id,
      bookingNumber: b.booking_number,
      customer: {
        id: b.customer_id,
        firstName: b.first_name,
        lastName: b.last_name,
      },
      participants: b.participants,
      status: b.status,
      total: Number(b.total).toFixed(2),
      paidInFull: Number(b.paid_amount || 0) >= Number(b.total),
    }));
  } finally {
    await client.end();
  }
}

export async function getTripRevenue(schemaName: string, tripId: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        COALESCE(SUM(total), 0) as bookings_total,
        COALESCE(SUM(paid_amount), 0) as paid_total,
        COALESCE(SUM(total) - SUM(paid_amount), 0) as pending_total
      FROM "${schemaName}".bookings
      WHERE trip_id = '${tripId}' AND status NOT IN ('canceled', 'no_show')
    `);

    const row = result[0] || {};
    return {
      bookingsTotal: fmtCurrency(Number(row.bookings_total || 0)),
      paidTotal: fmtCurrency(Number(row.paid_total || 0)),
      pendingTotal: fmtCurrency(Number(row.pending_total || 0)),
    };
  } finally {
    await client.end();
  }
}

export async function getTripBookedParticipants(schemaName: string, tripId: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT COALESCE(SUM(participants), 0) as count
      FROM "${schemaName}".bookings
      WHERE trip_id = '${tripId}' AND status NOT IN ('canceled', 'no_show')
    `);

    return Number(result[0]?.count || 0);
  } finally {
    await client.end();
  }
}

// ============================================================================
// Additional Detail Page Helpers
// ============================================================================

function formatDateStr(dateValue: any): string {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  return d.toISOString().split("T")[0];
}

function formatTimeStr(timeValue: any): string {
  if (!timeValue) return "";
  // If already in HH:MM format, return as-is
  if (typeof timeValue === "string") {
    if (/^\d{2}:\d{2}$/.test(timeValue)) return timeValue;
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) return timeValue.slice(0, 5);
  }
  return String(timeValue);
}

function formatDateTimeStr(dateValue: any): string {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  return d.toISOString();
}

function calcEquipmentTotal(equipmentRental: any[] | null): string {
  if (!equipmentRental || !Array.isArray(equipmentRental)) return "0.00";
  const total = equipmentRental.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  return total.toFixed(2);
}

function fmtPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cash: "Cash",
    card: "Credit Card",
    stripe: "Credit Card",
    bank_transfer: "Bank Transfer",
  };
  return methods[method] || method;
}

function capFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fmtCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// Equipment Detail Queries
// ============================================================================

/**
 * Get rental history for a specific equipment item
 * Searches bookings with equipment_rental JSONB field that references this equipment
 */
export async function getEquipmentRentalHistory(
  schemaName: string,
  equipmentId: string,
  limit = 10
) {
  const client = getClient(schemaName);

  try {
    // Get the equipment name/category to search for in bookings
    const equipmentResult = await client.unsafe(`
      SELECT name, category FROM "${schemaName}".equipment WHERE id = '${equipmentId}'
    `);

    if (!equipmentResult[0]) {
      return [];
    }

    const equipment = equipmentResult[0];

    // Search bookings where equipment_rental JSONB contains this equipment
    // The equipment_rental field structure is: [{ item: string, size?: string, price: number }]
    const rentals = await client.unsafe(`
      SELECT
        b.id,
        b.booking_number,
        b.created_at as rental_date,
        b.status,
        c.first_name,
        c.last_name,
        t.date as trip_date
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE b.equipment_rental IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(b.equipment_rental) elem
          WHERE elem->>'item' ILIKE '%${equipment.name.replace(/'/g, "''")}%'
             OR elem->>'item' ILIKE '%${equipment.category.replace(/'/g, "''")}%'
        )
      ORDER BY t.date DESC
      LIMIT ${limit}
    `);

    return rentals.map((r: any) => ({
      id: r.id,
      bookingNumber: r.booking_number,
      customerName: `${r.first_name} ${r.last_name}`,
      date: r.trip_date,
      returned: r.status === "completed" || r.status === "checked_in",
    }));
  } finally {
    await client.end();
  }
}

/**
 * Get equipment rental stats
 */
export async function getEquipmentRentalStats(schemaName: string, equipmentId: string) {
  const client = getClient(schemaName);

  try {
    // Get the equipment details
    const equipmentResult = await client.unsafe(`
      SELECT name, category, rental_price FROM "${schemaName}".equipment WHERE id = '${equipmentId}'
    `);

    if (!equipmentResult[0]) {
      return {
        totalRentals: 0,
        rentalRevenue: 0,
        daysRented: 0,
        avgRentalsPerMonth: 0,
      };
    }

    const equipment = equipmentResult[0];
    const rentalPrice = Number(equipment.rental_price || 0);

    // Count bookings that include this equipment
    const statsResult = await client.unsafe(`
      SELECT
        COUNT(DISTINCT b.id) as total_rentals,
        COUNT(DISTINCT t.date) as days_rented,
        MIN(t.date) as first_rental_date
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE b.equipment_rental IS NOT NULL
        AND b.status NOT IN ('canceled', 'no_show')
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(b.equipment_rental) elem
          WHERE elem->>'item' ILIKE '%${equipment.name.replace(/'/g, "''")}%'
             OR elem->>'item' ILIKE '%${equipment.category.replace(/'/g, "''")}%'
        )
    `);

    const stats = statsResult[0];
    const totalRentals = Number(stats?.total_rentals || 0);
    const daysRented = Number(stats?.days_rented || 0);

    // Calculate months since first rental for avg calculation
    let avgRentalsPerMonth = 0;
    if (stats?.first_rental_date) {
      const firstRentalDate = new Date(stats.first_rental_date);
      const now = new Date();
      const monthsDiff = Math.max(1,
        (now.getFullYear() - firstRentalDate.getFullYear()) * 12 +
        (now.getMonth() - firstRentalDate.getMonth())
      );
      avgRentalsPerMonth = Math.round((totalRentals / monthsDiff) * 10) / 10;
    }

    return {
      totalRentals,
      rentalRevenue: totalRentals * rentalPrice,
      daysRented,
      avgRentalsPerMonth,
    };
  } finally {
    await client.end();
  }
}

/**
 * Get service history for equipment
 * Note: This uses a simple approach - storing service entries in the equipment notes
 * A production system might have a separate equipment_service_log table
 */
export async function getEquipmentServiceHistory(schemaName: string, equipmentId: string) {
  const client = getClient(schemaName);

  try {
    // For now, we'll return the service info from the equipment record itself
    // A more complete implementation would have a separate service_log table
    const result = await client.unsafe(`
      SELECT
        last_service_date,
        next_service_date,
        service_notes,
        created_at
      FROM "${schemaName}".equipment
      WHERE id = '${equipmentId}'
    `);

    if (!result[0]) {
      return [];
    }

    const eq = result[0];
    const history = [];

    // If there's a last service date, create an entry for it
    if (eq.last_service_date) {
      history.push({
        id: `s-${equipmentId}-1`,
        date: eq.last_service_date,
        type: "Service",
        notes: eq.service_notes || "Routine service completed",
        performedBy: "Service Technician",
      });
    }

    // Add initial entry (purchase/registration)
    if (eq.created_at) {
      history.push({
        id: `s-${equipmentId}-0`,
        date: new Date(eq.created_at).toISOString().split("T")[0],
        type: "Initial Registration",
        notes: "Equipment added to inventory",
        performedBy: "System",
      });
    }

    return history;
  } finally {
    await client.end();
  }
}

/**
 * Update equipment status
 */
export async function updateEquipmentStatus(schemaName: string, id: string, status: string) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      UPDATE "${schemaName}".equipment
      SET status = '${status}', updated_at = NOW()
      WHERE id = '${id}'
      RETURNING *
    `);
    return result[0] ? mapEquipment(result[0]) : null;
  } finally {
    await client.end();
  }
}

/**
 * Delete equipment
 */
export async function deleteEquipment(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    await client.unsafe(`DELETE FROM "${schemaName}".equipment WHERE id = '${id}'`);
    return true;
  } finally {
    await client.end();
  }
}

// ============================================================================
// Boat Detail Queries
// ============================================================================

/**
 * Get recent trips for a boat
 */
export async function getBoatRecentTrips(schemaName: string, boatId: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const today = new Date().toISOString().split("T")[0];

    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.date,
        tr.name as tour_name,
        COALESCE(
          (SELECT COALESCE(SUM(b.participants), 0)
           FROM "${schemaName}".bookings b
           WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')),
          0
        ) as participants,
        COALESCE(
          (SELECT COALESCE(SUM(b.total), 0)
           FROM "${schemaName}".bookings b
           WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')),
          0
        ) as revenue
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.boat_id = '${boatId}'
        AND t.date < '${today}'
        AND t.status = 'completed'
      ORDER BY t.date DESC
      LIMIT ${limit}
    `);

    return trips.map((trip: any) => ({
      id: trip.id,
      date: trip.date,
      tourName: trip.tour_name,
      participants: Number(trip.participants || 0),
      revenue: `$${Number(trip.revenue || 0).toLocaleString()}`,
    }));
  } finally {
    await client.end();
  }
}

/**
 * Get upcoming trips for a boat
 */
export async function getBoatUpcomingTrips(schemaName: string, boatId: string, limit = 5) {
  const client = getClient(schemaName);

  try {
    const today = new Date().toISOString().split("T")[0];

    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.date,
        tr.name as tour_name,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        COALESCE(
          (SELECT COALESCE(SUM(b.participants), 0)
           FROM "${schemaName}".bookings b
           WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')),
          0
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.boat_id = '${boatId}'
        AND t.date >= '${today}'
        AND t.status = 'scheduled'
      ORDER BY t.date, t.start_time
      LIMIT ${limit}
    `);

    return trips.map((trip: any) => ({
      id: trip.id,
      date: trip.date,
      tourName: trip.tour_name,
      bookedParticipants: Number(trip.booked_participants || 0),
      maxParticipants: Number(trip.max_participants || 0),
    }));
  } finally {
    await client.end();
  }
}

/**
 * Get boat stats (total trips, passengers, revenue, avg occupancy)
 */
export async function getBoatStats(schemaName: string, boatId: string) {
  const client = getClient(schemaName);

  try {
    const statsResult = await client.unsafe(`
      SELECT
        COUNT(DISTINCT t.id) as total_trips,
        COALESCE(SUM(bk.participants), 0) as total_passengers,
        COALESCE(SUM(bk.total), 0) as total_revenue,
        COALESCE(AVG(
          CASE WHEN COALESCE(t.max_participants, tr.max_participants) > 0
          THEN (bk_sum.participants::decimal / COALESCE(t.max_participants, tr.max_participants)) * 100
          ELSE 0 END
        ), 0) as avg_occupancy
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      LEFT JOIN "${schemaName}".bookings bk ON bk.trip_id = t.id AND bk.status NOT IN ('canceled', 'no_show')
      LEFT JOIN (
        SELECT trip_id, SUM(participants) as participants
        FROM "${schemaName}".bookings
        WHERE status NOT IN ('canceled', 'no_show')
        GROUP BY trip_id
      ) bk_sum ON bk_sum.trip_id = t.id
      WHERE t.boat_id = '${boatId}'
        AND t.status IN ('completed', 'scheduled', 'in_progress')
    `);

    const stats = statsResult[0];

    return {
      totalTrips: Number(stats?.total_trips || 0),
      totalPassengers: Number(stats?.total_passengers || 0),
      totalRevenue: `$${Number(stats?.total_revenue || 0).toLocaleString()}`,
      avgOccupancy: Math.round(Number(stats?.avg_occupancy || 0)),
    };
  } finally {
    await client.end();
  }
}

/**
 * Update boat active status
 */
export async function updateBoatActiveStatus(schemaName: string, id: string, isActive: boolean) {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      UPDATE "${schemaName}".boats
      SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = '${id}'
      RETURNING *
    `);
    return result[0] ? mapBoat(result[0]) : null;
  } finally {
    await client.end();
  }
}

/**
 * Delete boat (soft delete by setting is_active = false)
 */
export async function deleteBoat(schemaName: string, id: string) {
  const client = getClient(schemaName);

  try {
    // Soft delete - just mark as inactive
    await client.unsafe(`
      UPDATE "${schemaName}".boats
      SET is_active = false, updated_at = NOW()
      WHERE id = '${id}'
    `);
    return true;
  } finally {
    await client.end();
  }
}

// ============================================================================
// Report Queries
// ============================================================================

export interface RevenueData {
  period: string;
  revenue: number;
  bookings: number;
}

export interface BookingsByStatus {
  status: string;
  count: number;
}

export interface TopTour {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
}

export interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  repeatCustomers: number;
  avgBookingsPerCustomer: number;
}

export interface EquipmentUtilization {
  category: string;
  total: number;
  available: number;
  rented: number;
  maintenance: number;
}

export async function getRevenueReport(
  schemaName: string,
  period: "daily" | "weekly" | "monthly" = "daily",
  days: number = 30
): Promise<RevenueData[]> {
  const client = getClient(schemaName);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    let groupBy: string;
    let format: string;

    if (period === "daily") {
      groupBy = "DATE(t.date)";
      format = "YYYY-MM-DD";
    } else if (period === "weekly") {
      groupBy = "DATE_TRUNC('week', t.date)";
      format = "IYYY-IW";
    } else {
      groupBy = "DATE_TRUNC('month', t.date)";
      format = "YYYY-MM";
    }

    const result = await client.unsafe(`
      SELECT
        TO_CHAR(${groupBy}, '${format}') as period,
        COALESCE(SUM(b.total), 0) as revenue,
        COUNT(DISTINCT b.id) as bookings
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE t.date >= '${startDateStr}'
        AND b.status NOT IN ('canceled', 'no_show')
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `);

    return result.map((row: any) => ({
      period: row.period,
      revenue: Number(row.revenue || 0),
      bookings: Number(row.bookings || 0),
    }));
  } finally {
    await client.end();
  }
}

export async function getBookingsByStatus(schemaName: string): Promise<BookingsByStatus[]> {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        status,
        COUNT(*) as count
      FROM "${schemaName}".bookings
      GROUP BY status
      ORDER BY count DESC
    `);

    return result.map((row: any) => ({
      status: row.status,
      count: Number(row.count || 0),
    }));
  } finally {
    await client.end();
  }
}

export async function getTopTours(schemaName: string, limit: number = 5): Promise<TopTour[]> {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        tr.id,
        tr.name,
        COUNT(DISTINCT b.id) as bookings,
        COALESCE(SUM(b.total), 0) as revenue
      FROM "${schemaName}".tours tr
      JOIN "${schemaName}".trips t ON t.tour_id = tr.id
      JOIN "${schemaName}".bookings b ON b.trip_id = t.id
      WHERE b.status NOT IN ('canceled', 'no_show')
      GROUP BY tr.id, tr.name
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      bookings: Number(row.bookings || 0),
      revenue: Number(row.revenue || 0),
    }));
  } finally {
    await client.end();
  }
}

export async function getCustomerReportStats(schemaName: string): Promise<CustomerStats> {
  const client = getClient(schemaName);

  try {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    // Total customers
    const totalResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".customers
    `);

    // New customers this month
    const newResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM "${schemaName}".customers
      WHERE created_at >= '${startOfMonthStr}'
    `);

    // Repeat customers (more than one booking)
    const repeatResult = await client.unsafe(`
      SELECT COUNT(*) as count FROM (
        SELECT customer_id
        FROM "${schemaName}".bookings
        WHERE status NOT IN ('canceled', 'no_show')
        GROUP BY customer_id
        HAVING COUNT(*) > 1
      ) as repeat_customers
    `);

    // Average bookings per customer
    const avgResult = await client.unsafe(`
      SELECT
        CASE WHEN COUNT(DISTINCT customer_id) > 0
        THEN COUNT(*)::decimal / COUNT(DISTINCT customer_id)
        ELSE 0 END as avg
      FROM "${schemaName}".bookings
      WHERE status NOT IN ('canceled', 'no_show')
    `);

    return {
      totalCustomers: Number(totalResult[0]?.count || 0),
      newThisMonth: Number(newResult[0]?.count || 0),
      repeatCustomers: Number(repeatResult[0]?.count || 0),
      avgBookingsPerCustomer: Math.round(Number(avgResult[0]?.avg || 0) * 10) / 10,
    };
  } finally {
    await client.end();
  }
}

export async function getEquipmentUtilization(schemaName: string): Promise<EquipmentUtilization[]> {
  const client = getClient(schemaName);

  try {
    const result = await client.unsafe(`
      SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) as rented,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM "${schemaName}".equipment
      GROUP BY category
      ORDER BY total DESC
    `);

    return result.map((row: any) => ({
      category: row.category,
      total: Number(row.total || 0),
      available: Number(row.available || 0),
      rented: Number(row.rented || 0),
      maintenance: Number(row.maintenance || 0),
    }));
  } finally {
    await client.end();
  }
}

export async function getRevenueOverview(schemaName: string) {
  const client = getClient(schemaName);

  try {
    const now = new Date();

    // This month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    // Last month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfLastMonthStr = startOfLastMonth.toISOString().split("T")[0];
    const endOfLastMonthStr = endOfLastMonth.toISOString().split("T")[0];

    // This year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfYearStr = startOfYear.toISOString().split("T")[0];

    // Current month revenue
    const currentMonthResult = await client.unsafe(`
      SELECT COALESCE(SUM(b.total), 0) as revenue
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE t.date >= '${startOfMonthStr}'
        AND b.status NOT IN ('canceled', 'no_show')
    `);

    // Last month revenue
    const lastMonthResult = await client.unsafe(`
      SELECT COALESCE(SUM(b.total), 0) as revenue
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE t.date >= '${startOfLastMonthStr}'
        AND t.date <= '${endOfLastMonthStr}'
        AND b.status NOT IN ('canceled', 'no_show')
    `);

    // Year to date revenue
    const ytdResult = await client.unsafe(`
      SELECT COALESCE(SUM(b.total), 0) as revenue
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      WHERE t.date >= '${startOfYearStr}'
        AND b.status NOT IN ('canceled', 'no_show')
    `);

    // Average booking value
    const avgResult = await client.unsafe(`
      SELECT COALESCE(AVG(total), 0) as avg
      FROM "${schemaName}".bookings
      WHERE status NOT IN ('canceled', 'no_show')
    `);

    const currentMonth = Number(currentMonthResult[0]?.revenue || 0);
    const lastMonth = Number(lastMonthResult[0]?.revenue || 0);
    const changePercent = lastMonth > 0
      ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100)
      : 0;

    return {
      currentMonth,
      lastMonth,
      changePercent,
      yearToDate: Number(ytdResult[0]?.revenue || 0),
      avgBookingValue: Math.round(Number(avgResult[0]?.avg || 0)),
    };
  } finally {
    await client.end();
  }
}
