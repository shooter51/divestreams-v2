/**
 * Customer CRUD Queries
 *
 * All customer-related database operations including search, create, update, and delete.
 */

import { desc, eq, gte, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapCustomer } from "./mappers";

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
  // Delete related records first to avoid foreign key constraint violations
  // Note: customerCommunications has onDelete: cascade, so it will be deleted automatically

  // Delete rentals
  await db
    .delete(schema.rentals)
    .where(and(
      eq(schema.rentals.organizationId, organizationId),
      eq(schema.rentals.customerId, id)
    ));

  // Delete transactions
  await db
    .delete(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.customerId, id)
    ));

  // Delete bookings
  await db
    .delete(schema.bookings)
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.customerId, id)
    ));

  // Finally delete the customer
  await db
    .delete(schema.customers)
    .where(and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.id, id)
    ));

  return true;
}

// ============================================================================
// Customer Report Stats (used by reports)
// ============================================================================

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
