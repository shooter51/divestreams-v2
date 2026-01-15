/**
 * Recurring Trip Utilities
 *
 * Functions for managing recurring trips including creation, generation,
 * and updating of recurring trip series.
 */

import { db } from "../db";
import { trips } from "../db/schema";
import { eq, and, gte, sql, or } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type RecurrencePattern = "daily" | "weekly" | "biweekly" | "monthly";

export interface RecurringTripTemplate {
  organizationId: string;
  tourId: string;
  boatId?: string | null;
  startTime: string;
  endTime?: string | null;
  maxParticipants?: number | null;
  price?: number | null;
  notes?: string | null;
  staffIds?: string[] | null;
  weatherNotes?: string | null;
  // Recurrence settings
  recurrencePattern: RecurrencePattern;
  recurrenceDays?: number[] | null; // [0-6] for Sun-Sat
  recurrenceEndDate?: string | null;
  recurrenceCount?: number | null;
  // First occurrence date
  startDate: string;
}

export interface GeneratedTrip {
  date: string;
  index: number;
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get day of week from date string (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay();
}

/**
 * Add days to a date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Add months to a date string (same day of month)
 */
function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split("T")[0];
}

/**
 * Check if date1 is before or equal to date2
 */
function isDateBefore(date1: string, date2: string): boolean {
  return date1 <= date2;
}

/**
 * Check if date1 is after date2
 */
function isDateAfter(date1: string, date2: string): boolean {
  return date1 > date2;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate next occurrence dates based on recurrence pattern
 */
export function calculateOccurrences(
  startDate: string,
  pattern: RecurrencePattern,
  options: {
    recurrenceDays?: number[] | null;
    endDate?: string | null;
    maxCount?: number | null;
    generateUntil?: string; // Generate until this date
  }
): GeneratedTrip[] {
  const occurrences: GeneratedTrip[] = [];
  const { recurrenceDays, endDate, maxCount, generateUntil } = options;

  // Default: generate 3 months ahead or until endDate/maxCount
  const defaultEndDate = generateUntil || addDays(new Date().toISOString().split("T")[0], 90);
  const effectiveEndDate = endDate && isDateBefore(endDate, defaultEndDate) ? endDate : defaultEndDate;
  const effectiveMaxCount = maxCount || 100; // Safety limit

  let currentDate = startDate;
  let index = 0;

  while (
    occurrences.length < effectiveMaxCount &&
    isDateBefore(currentDate, effectiveEndDate)
  ) {
    // For weekly/biweekly with specific days, check if current day is in the list
    if ((pattern === "weekly" || pattern === "biweekly") && recurrenceDays && recurrenceDays.length > 0) {
      const dayOfWeek = getDayOfWeek(currentDate);
      if (recurrenceDays.includes(dayOfWeek)) {
        occurrences.push({ date: currentDate, index });
        index++;
      }
    } else {
      // For daily, monthly, or weekly without specific days
      occurrences.push({ date: currentDate, index });
      index++;
    }

    // Calculate next date based on pattern
    switch (pattern) {
      case "daily":
        currentDate = addDays(currentDate, 1);
        break;
      case "weekly":
        if (recurrenceDays && recurrenceDays.length > 0) {
          // Move to next day
          currentDate = addDays(currentDate, 1);
        } else {
          // Weekly on same day
          currentDate = addDays(currentDate, 7);
        }
        break;
      case "biweekly":
        if (recurrenceDays && recurrenceDays.length > 0) {
          // For biweekly with specific days, we need to track week parity
          const startWeek = Math.floor(new Date(startDate + "T00:00:00").getTime() / (7 * 24 * 60 * 60 * 1000));
          const currentWeek = Math.floor(new Date(currentDate + "T00:00:00").getTime() / (7 * 24 * 60 * 60 * 1000));
          const isCorrectWeek = (currentWeek - startWeek) % 2 === 0;

          currentDate = addDays(currentDate, 1);

          // If we just moved to a new week, check if it's a biweekly week
          const nextWeek = Math.floor(new Date(currentDate + "T00:00:00").getTime() / (7 * 24 * 60 * 60 * 1000));
          if (nextWeek !== currentWeek && (nextWeek - startWeek) % 2 !== 0) {
            // Skip to next week
            currentDate = addDays(currentDate, 7);
          }
        } else {
          // Every 2 weeks on same day
          currentDate = addDays(currentDate, 14);
        }
        break;
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
    }
  }

  return occurrences;
}

/**
 * Create a recurring trip template and optionally generate initial instances
 */
export async function createRecurringTrip(
  template: RecurringTripTemplate,
  options: { generateInstances?: boolean; generateUntil?: string } = {}
): Promise<{ templateId: string; generatedCount: number }> {
  const { generateInstances = true, generateUntil } = options;

  // Create the template trip (first occurrence)
  const [templateTrip] = await db
    .insert(trips)
    .values({
      organizationId: template.organizationId,
      tourId: template.tourId,
      boatId: template.boatId || null,
      date: template.startDate,
      startTime: template.startTime,
      endTime: template.endTime || null,
      maxParticipants: template.maxParticipants || null,
      price: template.price ? String(template.price) : null,
      notes: template.notes || null,
      staffIds: template.staffIds || null,
      weatherNotes: template.weatherNotes || null,
      isRecurring: true,
      recurrencePattern: template.recurrencePattern,
      recurrenceDays: template.recurrenceDays || null,
      recurrenceEndDate: template.recurrenceEndDate || null,
      recurrenceCount: template.recurrenceCount || null,
      recurringTemplateId: null, // Template has no parent
      recurrenceIndex: 0,
      status: "scheduled",
    })
    .returning();

  let generatedCount = 1; // The template itself counts as 1

  // Generate future instances if requested
  if (generateInstances) {
    const occurrences = calculateOccurrences(
      template.startDate,
      template.recurrencePattern,
      {
        recurrenceDays: template.recurrenceDays,
        endDate: template.recurrenceEndDate,
        maxCount: template.recurrenceCount,
        generateUntil,
      }
    );

    // Skip the first occurrence (it's the template)
    const futureOccurrences = occurrences.slice(1);

    if (futureOccurrences.length > 0) {
      await db.insert(trips).values(
        futureOccurrences.map((occ) => ({
          organizationId: template.organizationId,
          tourId: template.tourId,
          boatId: template.boatId || null,
          date: occ.date,
          startTime: template.startTime,
          endTime: template.endTime || null,
          maxParticipants: template.maxParticipants || null,
          price: template.price ? String(template.price) : null,
          notes: template.notes || null,
          staffIds: template.staffIds || null,
          weatherNotes: template.weatherNotes || null,
          isRecurring: true,
          recurrencePattern: template.recurrencePattern,
          recurrenceDays: template.recurrenceDays || null,
          recurrenceEndDate: template.recurrenceEndDate || null,
          recurrenceCount: template.recurrenceCount || null,
          recurringTemplateId: templateTrip.id,
          recurrenceIndex: occ.index,
          status: "scheduled",
        }))
      );

      generatedCount += futureOccurrences.length;
    }
  }

  return { templateId: templateTrip.id, generatedCount };
}

/**
 * Generate additional trip instances from an existing recurring template
 */
export async function generateTripsFromRecurrence(
  organizationId: string,
  templateId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  // Get the template
  const [template] = await db
    .select()
    .from(trips)
    .where(and(
      eq(trips.organizationId, organizationId),
      eq(trips.id, templateId),
      eq(trips.isRecurring, true)
    ))
    .limit(1);

  if (!template || !template.recurrencePattern) {
    throw new Error("Template not found or is not a recurring trip");
  }

  // Get existing instances to find the latest index
  const existingInstances = await db
    .select({ date: trips.date, recurrenceIndex: trips.recurrenceIndex })
    .from(trips)
    .where(or(
      eq(trips.id, templateId),
      eq(trips.recurringTemplateId, templateId)
    ))
    .orderBy(trips.recurrenceIndex);

  const existingDates = new Set(existingInstances.map((i) => i.date));
  const maxIndex = Math.max(...existingInstances.map((i) => i.recurrenceIndex || 0));

  // Calculate new occurrences
  const occurrences = calculateOccurrences(
    startDate,
    template.recurrencePattern as RecurrencePattern,
    {
      recurrenceDays: template.recurrenceDays as number[] | null,
      endDate: template.recurrenceEndDate || endDate,
      maxCount: template.recurrenceCount,
      generateUntil: endDate,
    }
  );

  // Filter out dates that already exist
  const newOccurrences = occurrences.filter((occ) => !existingDates.has(occ.date));

  if (newOccurrences.length === 0) {
    return 0;
  }

  // Insert new instances
  await db.insert(trips).values(
    newOccurrences.map((occ, idx) => ({
      organizationId: template.organizationId,
      tourId: template.tourId,
      boatId: template.boatId || null,
      date: occ.date,
      startTime: template.startTime,
      endTime: template.endTime || null,
      maxParticipants: template.maxParticipants || null,
      price: template.price,
      notes: template.notes || null,
      staffIds: template.staffIds || null,
      weatherNotes: template.weatherNotes || null,
      isRecurring: true,
      recurrencePattern: template.recurrencePattern,
      recurrenceDays: template.recurrenceDays,
      recurrenceEndDate: template.recurrenceEndDate,
      recurrenceCount: template.recurrenceCount,
      recurringTemplateId: templateId,
      recurrenceIndex: maxIndex + idx + 1,
      status: "scheduled",
    }))
  );

  return newOccurrences.length;
}

/**
 * Get next N occurrences of a recurring trip
 */
export async function getNextOccurrences(
  organizationId: string,
  templateId: string,
  count: number
): Promise<Array<{ id: string; date: string; startTime: string; status: string }>> {
  const today = new Date().toISOString().split("T")[0];

  const instances = await db
    .select({
      id: trips.id,
      date: trips.date,
      startTime: trips.startTime,
      status: trips.status,
    })
    .from(trips)
    .where(and(
      eq(trips.organizationId, organizationId),
      or(
        eq(trips.id, templateId),
        eq(trips.recurringTemplateId, templateId)
      ),
      gte(trips.date, today),
      sql`${trips.status} != 'cancelled'`
    ))
    .orderBy(trips.date, trips.startTime)
    .limit(count);

  return instances;
}

/**
 * Update a recurring trip template and optionally update future instances
 */
export async function updateRecurringTrip(
  organizationId: string,
  templateId: string,
  updates: Partial<{
    tourId: string;
    boatId: string | null;
    startTime: string;
    endTime: string | null;
    maxParticipants: number | null;
    price: number | null;
    notes: string | null;
    staffIds: string[] | null;
    weatherNotes: string | null;
    recurrencePattern: RecurrencePattern;
    recurrenceDays: number[] | null;
    recurrenceEndDate: string | null;
    recurrenceCount: number | null;
  }>,
  options: { updateFutureInstances?: boolean } = {}
): Promise<{ updatedTemplate: boolean; updatedInstances: number }> {
  const { updateFutureInstances = true } = options;
  const today = new Date().toISOString().split("T")[0];

  // Build update object
  const updateData: any = { updatedAt: new Date() };
  if (updates.tourId !== undefined) updateData.tourId = updates.tourId;
  if (updates.boatId !== undefined) updateData.boatId = updates.boatId;
  if (updates.startTime !== undefined) updateData.startTime = updates.startTime;
  if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
  if (updates.maxParticipants !== undefined) updateData.maxParticipants = updates.maxParticipants;
  if (updates.price !== undefined) updateData.price = updates.price ? String(updates.price) : null;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.staffIds !== undefined) updateData.staffIds = updates.staffIds;
  if (updates.weatherNotes !== undefined) updateData.weatherNotes = updates.weatherNotes;
  if (updates.recurrencePattern !== undefined) updateData.recurrencePattern = updates.recurrencePattern;
  if (updates.recurrenceDays !== undefined) updateData.recurrenceDays = updates.recurrenceDays;
  if (updates.recurrenceEndDate !== undefined) updateData.recurrenceEndDate = updates.recurrenceEndDate;
  if (updates.recurrenceCount !== undefined) updateData.recurrenceCount = updates.recurrenceCount;

  // Update template
  await db
    .update(trips)
    .set(updateData)
    .where(and(
      eq(trips.organizationId, organizationId),
      eq(trips.id, templateId)
    ));

  let updatedInstances = 0;

  // Update future instances if requested
  if (updateFutureInstances) {
    // Only update fields that make sense for instances (not recurrence settings)
    const instanceUpdateData: any = { updatedAt: new Date() };
    if (updates.tourId !== undefined) instanceUpdateData.tourId = updates.tourId;
    if (updates.boatId !== undefined) instanceUpdateData.boatId = updates.boatId;
    if (updates.startTime !== undefined) instanceUpdateData.startTime = updates.startTime;
    if (updates.endTime !== undefined) instanceUpdateData.endTime = updates.endTime;
    if (updates.maxParticipants !== undefined) instanceUpdateData.maxParticipants = updates.maxParticipants;
    if (updates.price !== undefined) instanceUpdateData.price = updates.price ? String(updates.price) : null;
    if (updates.notes !== undefined) instanceUpdateData.notes = updates.notes;
    if (updates.staffIds !== undefined) instanceUpdateData.staffIds = updates.staffIds;
    if (updates.weatherNotes !== undefined) instanceUpdateData.weatherNotes = updates.weatherNotes;

    const result = await db
      .update(trips)
      .set(instanceUpdateData)
      .where(and(
        eq(trips.organizationId, organizationId),
        eq(trips.recurringTemplateId, templateId),
        gte(trips.date, today),
        sql`${trips.status} NOT IN ('completed', 'cancelled')`
      ));

    // Note: Drizzle doesn't easily return affected count, estimate from query
    // In practice, you might want to count first or use a raw query
    updatedInstances = 0; // Placeholder - actual count depends on DB
  }

  return { updatedTemplate: true, updatedInstances };
}

/**
 * Cancel all future instances of a recurring series
 */
export async function cancelRecurringSeries(
  organizationId: string,
  templateId: string,
  options: { includeTemplate?: boolean; cancelDate?: string } = {}
): Promise<number> {
  const { includeTemplate = false, cancelDate } = options;
  const effectiveDate = cancelDate || new Date().toISOString().split("T")[0];

  // Cancel future instances
  await db
    .update(trips)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(
      eq(trips.organizationId, organizationId),
      eq(trips.recurringTemplateId, templateId),
      gte(trips.date, effectiveDate),
      sql`${trips.status} NOT IN ('completed', 'cancelled')`
    ));

  // Cancel template if requested
  if (includeTemplate) {
    await db
      .update(trips)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(trips.organizationId, organizationId),
        eq(trips.id, templateId),
        gte(trips.date, effectiveDate),
        sql`${trips.status} NOT IN ('completed', 'cancelled')`
      ));
  }

  // Return count of cancelled trips (estimate)
  const cancelled = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .where(and(
      eq(trips.organizationId, organizationId),
      or(
        eq(trips.id, templateId),
        eq(trips.recurringTemplateId, templateId)
      ),
      eq(trips.status, "cancelled")
    ));

  return Number(cancelled[0]?.count || 0);
}

/**
 * Get all instances of a recurring series
 */
export async function getRecurringSeriesInstances(
  organizationId: string,
  templateId: string,
  options: { futureOnly?: boolean; limit?: number } = {}
): Promise<Array<{
  id: string;
  date: string;
  startTime: string;
  status: string;
  recurrenceIndex: number | null;
  bookedParticipants?: number;
}>> {
  const { futureOnly = false, limit = 100 } = options;
  const today = new Date().toISOString().split("T")[0];

  let whereConditions = [
    eq(trips.organizationId, organizationId),
    or(
      eq(trips.id, templateId),
      eq(trips.recurringTemplateId, templateId)
    ),
  ];

  if (futureOnly) {
    whereConditions.push(gte(trips.date, today));
  }

  const instances = await db
    .select({
      id: trips.id,
      date: trips.date,
      startTime: trips.startTime,
      status: trips.status,
      recurrenceIndex: trips.recurrenceIndex,
    })
    .from(trips)
    .where(and(...whereConditions))
    .orderBy(trips.date, trips.startTime)
    .limit(limit);

  return instances;
}

/**
 * Get the template for a recurring trip instance
 */
export async function getRecurringTemplate(
  organizationId: string,
  tripId: string
): Promise<{ id: string; date: string; recurrencePattern: string | null } | null> {
  const [trip] = await db
    .select({
      id: trips.id,
      recurringTemplateId: trips.recurringTemplateId,
      isRecurring: trips.isRecurring,
    })
    .from(trips)
    .where(and(
      eq(trips.organizationId, organizationId),
      eq(trips.id, tripId)
    ))
    .limit(1);

  if (!trip || !trip.isRecurring) {
    return null;
  }

  // If this is the template itself (no parent)
  if (!trip.recurringTemplateId) {
    const [template] = await db
      .select({
        id: trips.id,
        date: trips.date,
        recurrencePattern: trips.recurrencePattern,
      })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);
    return template || null;
  }

  // Get the parent template
  const [template] = await db
    .select({
      id: trips.id,
      date: trips.date,
      recurrencePattern: trips.recurrencePattern,
    })
    .from(trips)
    .where(and(
      eq(trips.organizationId, organizationId),
      eq(trips.id, trip.recurringTemplateId)
    ))
    .limit(1);

  return template || null;
}

/**
 * Preview upcoming dates for a recurrence pattern (without creating trips)
 */
export function previewRecurrenceDates(
  startDate: string,
  pattern: RecurrencePattern,
  options: {
    recurrenceDays?: number[] | null;
    endDate?: string | null;
    maxCount?: number | null;
  }
): string[] {
  const defaultMax = options.maxCount || 12; // Show up to 12 preview dates
  const occurrences = calculateOccurrences(startDate, pattern, {
    ...options,
    maxCount: Math.min(defaultMax, options.maxCount || defaultMax),
    generateUntil: options.endDate || addDays(startDate, 365),
  });

  return occurrences.map((o) => o.date);
}
