/**
 * Equipment Queries
 *
 * All equipment-related database operations including CRUD, rental stats,
 * service history, and utilization reports.
 */

import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapEquipment } from "./mappers";

// ============================================================================
// Equipment CRUD Queries
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
  isPublic?: boolean;
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
      isPublic: data.isPublic ?? false,
    })
    .returning();

  return mapEquipment(equipment);
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
  type: string;
  description: string;
  performedAt: Date;
  performedBy: string | null;
  notes: string | null;
  cost: number | null;
}

export async function getEquipmentServiceHistory(organizationId: string, equipmentId: string, limit = 10): Promise<EquipmentServiceRecord[]> {
  const records = await db
    .select({
      id: schema.serviceRecords.id,
      type: schema.serviceRecords.type,
      description: schema.serviceRecords.description,
      performedAt: schema.serviceRecords.performedAt,
      performedBy: schema.serviceRecords.performedBy,
      notes: schema.serviceRecords.notes,
      cost: schema.serviceRecords.cost,
    })
    .from(schema.serviceRecords)
    .where(
      and(
        eq(schema.serviceRecords.organizationId, organizationId),
        eq(schema.serviceRecords.equipmentId, equipmentId)
      )
    )
    .orderBy(desc(schema.serviceRecords.performedAt))
    .limit(limit);

  return records.map(r => ({
    id: r.id,
    type: r.type,
    description: r.description,
    performedAt: r.performedAt,
    performedBy: r.performedBy,
    notes: r.notes,
    cost: r.cost ? parseFloat(r.cost) : null,
  }));
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
// Equipment Utilization Report
// ============================================================================

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
