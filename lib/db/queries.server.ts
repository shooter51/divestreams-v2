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
  options: { category?: string; status?: string; search?: string; limit?: number } = {}
) {
  const client = getClient(schemaName);
  const { category, status, search, limit = 100 } = options;

  try {
    const conditions: string[] = [];
    if (category) conditions.push(`category = '${category}'`);
    if (status) conditions.push(`status = '${status}'`);
    if (search) {
      const searchTerm = search.replace(/'/g, "''");
      conditions.push(`name ILIKE '%${searchTerm}%'`);
    }

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
