/**
 * Public Queries for Booking Widget
 *
 * These queries are used by the embed widget and do not require authentication.
 * They only return publicly-visible information.
 */

import postgres from "postgres";

function getClient(schemaName: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }
  return postgres(connectionString);
}

// ============================================================================
// Public Tour Queries
// ============================================================================

export interface PublicTour {
  id: string;
  name: string;
  description: string | null;
  type: string;
  duration: number;
  maxParticipants: number;
  price: string;
  currency: string;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
  inclusions: string[];
  minCertLevel: string | null;
  minAge: number | null;
  primaryImage: string | null;
  thumbnailImage: string | null;
  imageCount: number;
}

export async function getPublicTours(schemaName: string): Promise<PublicTour[]> {
  const client = getClient(schemaName);

  try {
    const tours = await client.unsafe(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.type,
        t.duration,
        t.max_participants,
        t.price,
        t.currency,
        t.includes_equipment,
        t.includes_meals,
        t.includes_transport,
        t.inclusions,
        t.min_cert_level,
        t.min_age,
        (
          SELECT url FROM "${schemaName}".images
          WHERE entity_type = 'tour' AND entity_id = t.id AND is_primary = true
          LIMIT 1
        ) as primary_image,
        (
          SELECT thumbnail_url FROM "${schemaName}".images
          WHERE entity_type = 'tour' AND entity_id = t.id AND is_primary = true
          LIMIT 1
        ) as thumbnail_image,
        (
          SELECT COUNT(*) FROM "${schemaName}".images
          WHERE entity_type = 'tour' AND entity_id = t.id
        ) as image_count
      FROM "${schemaName}".tours t
      WHERE t.is_active = true
      ORDER BY t.name
    `);

    return tours.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type,
      duration: Number(t.duration || 0),
      maxParticipants: Number(t.max_participants),
      price: t.price,
      currency: t.currency,
      includesEquipment: t.includes_equipment || false,
      includesMeals: t.includes_meals || false,
      includesTransport: t.includes_transport || false,
      inclusions: t.inclusions || [],
      minCertLevel: t.min_cert_level,
      minAge: t.min_age ? Number(t.min_age) : null,
      primaryImage: t.primary_image,
      thumbnailImage: t.thumbnail_image,
      imageCount: Number(t.image_count || 0),
    }));
  } finally {
    await client.end();
  }
}

// ============================================================================
// Public Trip Queries (Available dates)
// ============================================================================

export interface PublicTrip {
  id: string;
  tourId: string;
  tourName: string;
  date: string;
  startTime: string;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  status: string;
}

export async function getPublicTrips(
  schemaName: string,
  options: {
    tourId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  } = {}
): Promise<PublicTrip[]> {
  const client = getClient(schemaName);
  const { tourId, fromDate, toDate, limit = 30 } = options;

  // Default to today if no fromDate
  const startDate = fromDate || new Date().toISOString().split("T")[0];

  try {
    let whereClause = `
      WHERE t.status = 'scheduled'
      AND t.date >= '${startDate}'
      AND tr.is_active = true
    `;

    if (tourId) {
      whereClause += ` AND t.tour_id = '${tourId}'`;
    }
    if (toDate) {
      whereClause += ` AND t.date <= '${toDate}'`;
    }

    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.tour_id,
        tr.name as tour_name,
        t.date,
        t.start_time,
        t.end_time,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        COALESCE(t.price, tr.price) as price,
        tr.currency,
        t.status,
        (
          SELECT COALESCE(SUM(b.participants), 0)
          FROM "${schemaName}".bookings b
          WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      ${whereClause}
      ORDER BY t.date, t.start_time
      LIMIT ${limit}
    `);

    return trips.map((t: any) => {
      const maxParticipants = Number(t.max_participants);
      const bookedParticipants = Number(t.booked_participants || 0);

      return {
        id: t.id,
        tourId: t.tour_id,
        tourName: t.tour_name,
        date: t.date,
        startTime: t.start_time,
        endTime: t.end_time,
        maxParticipants,
        availableSpots: Math.max(0, maxParticipants - bookedParticipants),
        price: t.price,
        currency: t.currency,
        status: bookedParticipants >= maxParticipants ? "full" : t.status,
      };
    });
  } finally {
    await client.end();
  }
}

// ============================================================================
// Public Tour Detail
// ============================================================================

export interface PublicTourDetail extends PublicTour {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    alt: string | null;
    sortOrder: number;
  }>;
  upcomingTrips: PublicTrip[];
}

export async function getPublicTourById(
  schemaName: string,
  tourId: string
): Promise<PublicTourDetail | null> {
  const client = getClient(schemaName);

  try {
    // Get tour details
    const tours = await client.unsafe(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.type,
        t.duration,
        t.max_participants,
        t.price,
        t.currency,
        t.includes_equipment,
        t.includes_meals,
        t.includes_transport,
        t.inclusions,
        t.min_cert_level,
        t.min_age
      FROM "${schemaName}".tours t
      WHERE t.id = '${tourId}' AND t.is_active = true
    `);

    if (tours.length === 0) {
      return null;
    }

    const tour = tours[0];

    // Get images
    const images = await client.unsafe(`
      SELECT id, url, thumbnail_url, alt, sort_order
      FROM "${schemaName}".images
      WHERE entity_type = 'tour' AND entity_id = '${tourId}'
      ORDER BY is_primary DESC, sort_order
    `);

    // Get upcoming trips
    const today = new Date().toISOString().split("T")[0];
    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.tour_id,
        t.date,
        t.start_time,
        t.end_time,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        COALESCE(t.price, tr.price) as price,
        tr.currency,
        t.status,
        (
          SELECT COALESCE(SUM(b.participants), 0)
          FROM "${schemaName}".bookings b
          WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.tour_id = '${tourId}'
        AND t.status = 'scheduled'
        AND t.date >= '${today}'
      ORDER BY t.date, t.start_time
      LIMIT 10
    `);

    return {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      type: tour.type,
      duration: Number(tour.duration || 0),
      maxParticipants: Number(tour.max_participants),
      price: tour.price,
      currency: tour.currency,
      includesEquipment: tour.includes_equipment || false,
      includesMeals: tour.includes_meals || false,
      includesTransport: tour.includes_transport || false,
      inclusions: tour.inclusions || [],
      minCertLevel: tour.min_cert_level,
      minAge: tour.min_age ? Number(tour.min_age) : null,
      primaryImage: images[0]?.url || null,
      thumbnailImage: images[0]?.thumbnail_url || null,
      imageCount: images.length,
      images: images.map((img: any) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnail_url,
        alt: img.alt,
        sortOrder: Number(img.sort_order),
      })),
      upcomingTrips: trips.map((t: any) => {
        const maxParticipants = Number(t.max_participants);
        const bookedParticipants = Number(t.booked_participants || 0);

        return {
          id: t.id,
          tourId: t.tour_id,
          tourName: tour.name,
          date: t.date,
          startTime: t.start_time,
          endTime: t.end_time,
          maxParticipants,
          availableSpots: Math.max(0, maxParticipants - bookedParticipants),
          price: t.price,
          currency: t.currency,
          status: bookedParticipants >= maxParticipants ? "full" : t.status,
        };
      }),
    };
  } finally {
    await client.end();
  }
}

// ============================================================================
// Public Trip Detail (for booking)
// ============================================================================

export interface PublicTripDetail {
  id: string;
  tourId: string;
  tourName: string;
  tourDescription: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
  minCertLevel: string | null;
  minAge: number | null;
  primaryImage: string | null;
}

export async function getPublicTripById(
  schemaName: string,
  tripId: string
): Promise<PublicTripDetail | null> {
  const client = getClient(schemaName);

  try {
    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.tour_id,
        tr.name as tour_name,
        tr.description as tour_description,
        t.date,
        t.start_time,
        t.end_time,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        COALESCE(t.price, tr.price) as price,
        tr.currency,
        t.status,
        tr.includes_equipment,
        tr.includes_meals,
        tr.includes_transport,
        tr.min_cert_level,
        tr.min_age,
        (
          SELECT COALESCE(SUM(b.participants), 0)
          FROM "${schemaName}".bookings b
          WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')
        ) as booked_participants,
        (
          SELECT url FROM "${schemaName}".images
          WHERE entity_type = 'tour' AND entity_id = tr.id AND is_primary = true
          LIMIT 1
        ) as primary_image
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.id = '${tripId}'
        AND t.status = 'scheduled'
        AND tr.is_active = true
    `);

    if (trips.length === 0) {
      return null;
    }

    const trip = trips[0];
    const maxParticipants = Number(trip.max_participants);
    const bookedParticipants = Number(trip.booked_participants || 0);

    // Check if trip is in the past
    const tripDate = new Date(trip.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (tripDate < today) {
      return null; // Trip is in the past
    }

    return {
      id: trip.id,
      tourId: trip.tour_id,
      tourName: trip.tour_name,
      tourDescription: trip.tour_description,
      date: trip.date,
      startTime: trip.start_time,
      endTime: trip.end_time,
      maxParticipants,
      availableSpots: Math.max(0, maxParticipants - bookedParticipants),
      price: trip.price,
      currency: trip.currency,
      includesEquipment: trip.includes_equipment || false,
      includesMeals: trip.includes_meals || false,
      includesTransport: trip.includes_transport || false,
      minCertLevel: trip.min_cert_level,
      minAge: trip.min_age ? Number(trip.min_age) : null,
      primaryImage: trip.primary_image,
    };
  } finally {
    await client.end();
  }
}
