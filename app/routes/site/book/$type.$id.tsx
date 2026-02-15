/**
 * Public Site Booking Page
 *
 * Tasks 19-20: Booking Flow with Payment Placeholder
 *
 * Features:
 * - Display trip/course details
 * - Date/session selection (for courses)
 * - Participant count selector
 * - Equipment rental add-ons
 * - Price calculation with breakdown
 * - Customer info form (guest checkout or logged-in)
 * - "Proceed to Payment" button
 * - Creates booking with status "pending_payment"
 */

import { useState, useEffect } from "react";
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useSearchParams,
  Form,
  Link,
  redirect,
} from "react-router";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../../../lib/db";
import {
  trips,
  tours,
  bookings,
  customers,
  equipment,
  organization,
  trainingCourses,
  trainingSessions,
} from "../../../../lib/db/schema";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { nanoid } from "nanoid";

// ============================================================================
// TYPES
// ============================================================================

interface TripDetails {
  id: string;
  tourId: string;
  tourName: string;
  tourDescription: string | null;
  tourType: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  duration: number | null;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
}

interface CourseDetails {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: string;
  currency: string;
  duration: number | null;
  maxParticipants: number;
  includesEquipment: boolean | null;
  includesMeals: boolean | null;
  includesTransport: boolean | null;
  sessions: Array<{
    id: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    maxParticipants: number | null;
    availableSpots: number;
    price: string | null;
  }>;
}

interface RentalEquipment {
  id: string;
  name: string;
  category: string;
  rentalPrice: string;
}

interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface LoaderData {
  type: "trip" | "course";
  trip?: TripDetails;
  course?: CourseDetails;
  selectedSessionId?: string;
  equipment: RentalEquipment[];
  customer: CustomerData | null;
  organizationName: string;
  organizationId: string;
}

interface ActionData {
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

// ============================================================================
// META
// ============================================================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Booking" }];

  const itemName =
    data.type === "trip" ? data.trip?.tourName : data.course?.name;
  return [
    { title: `Book ${itemName || "Now"}` },
    { name: "description", content: `Complete your booking for ${itemName}` },
  ];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateBookingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(4).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<LoaderData> {
  const { type, id } = params;

  if (!type || !id || !["trip", "course"].includes(type)) {
    throw new Response("Invalid booking type", { status: 400 });
  }

  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);
  const sessionParam = url.searchParams.get("session");

  // Get organization
  const [org] = subdomain
    ? await db
        .select()
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1)
    : await db
        .select()
        .from(organization)
        .where(eq(organization.customDomain, host.split(":")[0]))
        .limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get logged in customer if any
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split("; ")
      .filter(Boolean)
      .map((c) => {
        const [key, ...rest] = c.split("=");
        return [key, rest.join("=")];
      })
  );
  const sessionToken = cookies["customer_session"];
  const customer = sessionToken
    ? await getCustomerBySession(sessionToken)
    : null;

  // Get rentable equipment
  const rentableEquipment = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      rentalPrice: equipment.rentalPrice,
    })
    .from(equipment)
    .where(
      and(
        eq(equipment.organizationId, org.id),
        eq(equipment.isRentable, true),
        eq(equipment.status, "available"),
        eq(equipment.isPublic, true),
        sql`${equipment.rentalPrice} IS NOT NULL AND ${equipment.rentalPrice} > 0`
      )
    )
    .orderBy(equipment.category, equipment.name);

  const equipmentList: RentalEquipment[] = rentableEquipment.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    rentalPrice: e.rentalPrice!,
  }));

  const customerData: CustomerData | null = customer
    ? {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      }
    : null;

  if (type === "trip") {
    // Load trip details
    const [tripData] = await db
      .select({
        id: trips.id,
        tourId: trips.tourId,
        tourName: tours.name,
        tourDescription: tours.description,
        tourType: tours.type,
        date: trips.date,
        startTime: trips.startTime,
        endTime: trips.endTime,
        tripMaxParticipants: trips.maxParticipants,
        tourMaxParticipants: tours.maxParticipants,
        tripPrice: trips.price,
        tourPrice: tours.price,
        currency: tours.currency,
        duration: tours.duration,
        includesEquipment: tours.includesEquipment,
        includesMeals: tours.includesMeals,
        includesTransport: tours.includesTransport,
      })
      .from(trips)
      .innerJoin(tours, eq(trips.tourId, tours.id))
      .where(
        and(
          eq(trips.organizationId, org.id),
          eq(trips.id, id),
          eq(trips.isPublic, true),
          eq(trips.status, "scheduled"),
          eq(tours.isActive, true)
        )
      )
      .limit(1);

    if (!tripData) {
      throw new Response("Trip not found or not available", { status: 404 });
    }

    // Check trip is in the future
    const tripDate = new Date(tripData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (tripDate < today) {
      throw new Response("This trip has already passed", { status: 404 });
    }

    // Get booking count
    const [bookingCount] = await db
      .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.tripId, id),
          sql`${bookings.status} NOT IN ('canceled', 'no_show')`
        )
      );

    const maxParticipants = Number(
      tripData.tripMaxParticipants || tripData.tourMaxParticipants
    );
    const bookedParticipants = Number(bookingCount?.total || 0);

    const trip: TripDetails = {
      id: tripData.id,
      tourId: tripData.tourId,
      tourName: tripData.tourName,
      tourDescription: tripData.tourDescription,
      tourType: tripData.tourType,
      date: tripData.date,
      startTime: tripData.startTime,
      endTime: tripData.endTime,
      maxParticipants,
      availableSpots: Math.max(0, maxParticipants - bookedParticipants),
      price: tripData.tripPrice || tripData.tourPrice,
      currency: tripData.currency || "USD",
      duration: tripData.duration,
      includesEquipment: tripData.includesEquipment || false,
      includesMeals: tripData.includesMeals || false,
      includesTransport: tripData.includesTransport || false,
    };

    if (trip.availableSpots === 0) {
      throw new Response("This trip is fully booked", { status: 400 });
    }

    return {
      type: "trip",
      trip,
      equipment: tripData.includesEquipment ? [] : equipmentList,
      customer: customerData,
      organizationName: org.name,
      organizationId: org.id,
    };
  } else {
    // Load course details - first try training_courses, then fall back to tours
    let courseData: any = null;
    let sessionsData: any[] = [];
    let isTrainingCourse = false;

    // Try training_courses table first
    const trainingCourseResults = await db
      .select({
        id: trainingCourses.id,
        name: trainingCourses.name,
        description: trainingCourses.description,
        price: trainingCourses.price,
        currency: trainingCourses.currency,
        duration: trainingCourses.durationDays,
        maxParticipants: trainingCourses.maxStudents,
        includesEquipment: trainingCourses.equipmentIncluded,
      })
      .from(trainingCourses)
      .where(
        and(
          eq(trainingCourses.organizationId, org.id),
          eq(trainingCourses.id, id),
          eq(trainingCourses.isActive, true),
          eq(trainingCourses.isPublic, true)
        )
      )
      .limit(1);

    const trainingCourseData = trainingCourseResults[0]
      ? {
          ...trainingCourseResults[0],
          type: "course" as const,
          includesMeals: false,
          includesTransport: false,
        }
      : null;

    if (trainingCourseData) {
      courseData = trainingCourseData;
      isTrainingCourse = true;

      // Get scheduled sessions from training_sessions
      const today = new Date().toISOString().split("T")[0];
      sessionsData = await db
        .select({
          id: trainingSessions.id,
          date: trainingSessions.startDate,
          startTime: trainingSessions.startTime,
          endTime: trainingSessions.endDate, // Note: using endDate as endTime
          maxParticipants: trainingSessions.maxStudents,
          price: trainingSessions.priceOverride, // Note: using priceOverride
        })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.organizationId, org.id),
            eq(trainingSessions.courseId, id),
            eq(trainingSessions.status, "scheduled"),
            sql`${trainingSessions.startDate} >= ${today}`
          )
        )
        .orderBy(trainingSessions.startDate, trainingSessions.startTime);
    } else {
      // Fall back to tours table
      const [toursData] = await db
        .select({
          id: tours.id,
          name: tours.name,
          description: tours.description,
          type: tours.type,
          price: tours.price,
          currency: tours.currency,
          duration: tours.duration,
          maxParticipants: tours.maxParticipants,
          includesEquipment: tours.includesEquipment,
          includesMeals: tours.includesMeals,
          includesTransport: tours.includesTransport,
        })
        .from(tours)
        .where(
          and(
            eq(tours.organizationId, org.id),
            eq(tours.id, id),
            eq(tours.type, "course"),
            eq(tours.isActive, true)
          )
        )
        .limit(1);

      if (toursData) {
        courseData = toursData;

        // Get scheduled sessions from trips
        const today = new Date().toISOString().split("T")[0];
        sessionsData = await db
          .select({
            id: trips.id,
            date: trips.date,
            startTime: trips.startTime,
            endTime: trips.endTime,
            maxParticipants: trips.maxParticipants,
            price: trips.price,
          })
          .from(trips)
          .where(
            and(
              eq(trips.organizationId, org.id),
              eq(trips.tourId, id),
              eq(trips.isPublic, true),
              eq(trips.status, "scheduled"),
              sql`${trips.date} >= ${today}`
            )
          )
          .orderBy(trips.date, trips.startTime);
      }
    }

    if (!courseData) {
      throw new Response("Course not found or not available", { status: 404 });
    }

    // Get booking counts for each session
    const sessionsWithAvailability = await Promise.all(
      sessionsData.map(async (session) => {
        // For training courses, use training_enrollments; for tours, use bookings
        let bookedPart = 0;
        if (isTrainingCourse) {
          // TODO: Query training_enrollments when that table is created
          // For now, assume 0 bookings for training courses
          bookedPart = 0;
        } else {
          const [bookingCount] = await db
            .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
            .from(bookings)
            .where(
              and(
                eq(bookings.tripId, session.id),
                sql`${bookings.status} NOT IN ('canceled', 'no_show')`
              )
            );
          bookedPart = Number(bookingCount?.total || 0);
        }

        const maxPart = Number(
          session.maxParticipants || courseData.maxParticipants
        );

        return {
          id: session.id,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          maxParticipants: maxPart,
          availableSpots: Math.max(0, maxPart - bookedPart),
          price: session.price,
        };
      })
    );

    const course: CourseDetails = {
      id: courseData.id,
      name: courseData.name,
      description: courseData.description,
      type: courseData.type,
      price: courseData.price,
      currency: courseData.currency || "USD",
      duration: courseData.duration,
      maxParticipants: courseData.maxParticipants,
      includesEquipment: courseData.includesEquipment,
      includesMeals: courseData.includesMeals,
      includesTransport: courseData.includesTransport,
      sessions: sessionsWithAvailability.filter((s) => s.availableSpots > 0),
    };

    return {
      type: "course",
      course,
      selectedSessionId: sessionParam || undefined,
      equipment: courseData.includesEquipment ? [] : equipmentList,
      customer: customerData,
      organizationName: org.name,
      organizationId: org.id,
    };
  }
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<ActionData | Response> {
  const { type, id } = params;
  const formData = await request.formData();

  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  // Get organization
  const [org] = subdomain
    ? await db
        .select()
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1)
    : await db
        .select()
        .from(organization)
        .where(eq(organization.customDomain, host.split(":")[0]))
        .limit(1);

  if (!org) {
    return { errors: { _form: "Organization not found" } };
  }

  // Extract form data
  const sessionId = formData.get("sessionId") as string;
  const participants = parseInt(formData.get("participants") as string) || 1;
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const specialRequests = (formData.get("specialRequests") as string)?.trim();
  const customerId = formData.get("customerId") as string;
  const selectedEquipment = formData.getAll("equipment") as string[];

  // Validation
  const errors: Record<string, string> = {};

  if (!customerId) {
    if (!firstName) errors.firstName = "First name is required";
    if (!lastName) errors.lastName = "Last name is required";
    if (!email) errors.email = "Email is required";
    else if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = "Please enter a valid email address";
    }
  }

  if (participants < 1) {
    errors.participants = "At least 1 participant is required";
  }

  // For courses, session selection is required
  if (type === "course" && !sessionId) {
    errors.sessionId = "Please select a session date";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: Object.fromEntries(formData.entries()) as Record<string, string>,
    };
  }

  // Determine the trip ID to book
  const tripId = type === "trip" ? id! : sessionId;

  // Find or create customer (outside the booking transaction to avoid
  // holding the trip row lock longer than necessary)
  let finalCustomerId = customerId;

  if (!customerId) {
    // Check if customer already exists
    const [existingCustomer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.organizationId, org.id), eq(customers.email, email!))
      )
      .limit(1);

    if (existingCustomer) {
      // Update existing customer info
      await db
        .update(customers)
        .set({
          firstName: firstName!,
          lastName: lastName!,
          phone,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existingCustomer.id));

      finalCustomerId = existingCustomer.id;
    } else {
      // Create new customer
      const [newCustomer] = await db
        .insert(customers)
        .values({
          organizationId: org.id,
          email: email!,
          firstName: firstName!,
          lastName: lastName!,
          phone,
        })
        .returning({ id: customers.id });

      finalCustomerId = newCustomer.id;
    }
  }

  // Wrap availability check + booking insert in a transaction with
  // SELECT ... FOR UPDATE to prevent double-booking race conditions.
  let newBooking: {
    id: string;
    bookingNumber: string;
    tripDate: string;
    tripStartTime: string | null;
    tourName: string;
    total: string;
  };
  try {
    newBooking = await db.transaction(async (tx) => {
      // Lock the trip row to prevent concurrent bookings
      const [tripData] = await tx
        .select({
          id: trips.id,
          tourId: trips.tourId,
          tourName: tours.name,
          tripPrice: trips.price,
          tourPrice: tours.price,
          currency: tours.currency,
          tripMaxParticipants: trips.maxParticipants,
          tourMaxParticipants: tours.maxParticipants,
          status: trips.status,
          date: trips.date,
          startTime: trips.startTime,
        })
        .from(trips)
        .innerJoin(tours, eq(trips.tourId, tours.id))
        .where(
          and(
            eq(trips.organizationId, org.id),
            eq(trips.id, tripId),
            eq(trips.status, "scheduled")
          )
        )
        .for("update")
        .limit(1);

      if (!tripData) {
        throw new Error("SESSION_NOT_FOUND");
      }

      // Check trip is in the future
      const tripDate = new Date(tripData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (tripDate < today) {
        throw new Error("TRIP_IN_PAST");
      }

      // Check availability inside the transaction (while trip row is locked)
      const [bookingCount] = await tx
        .select({ total: sql<number>`COALESCE(SUM(${bookings.participants}), 0)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.tripId, tripId),
            sql`${bookings.status} NOT IN ('canceled', 'no_show')`
          )
        );

      const maxParticipants = Number(
        tripData.tripMaxParticipants || tripData.tourMaxParticipants
      );
      const bookedParticipants = Number(bookingCount?.total || 0);
      const availableSpots = maxParticipants - bookedParticipants;

      if (participants > availableSpots) {
        throw new Error(`INSUFFICIENT_SPOTS:${availableSpots}`);
      }

      // Calculate pricing
      const pricePerPerson = parseFloat(tripData.tripPrice || tripData.tourPrice);
      let subtotal = pricePerPerson * participants;

      // Add equipment rental costs
      const equipmentRental: Array<{ item: string; price: number }> = [];

      if (selectedEquipment.length > 0) {
        const equipmentData = await tx
          .select({
            id: equipment.id,
            name: equipment.name,
            rentalPrice: equipment.rentalPrice,
          })
          .from(equipment)
          .where(
            and(
              eq(equipment.organizationId, org.id),
              sql`${equipment.id} IN (${sql.join(
                selectedEquipment.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
          );

        for (const eq of equipmentData) {
          if (eq.rentalPrice) {
            const price = parseFloat(eq.rentalPrice) * participants; // Per person per rental
            subtotal += price;
            equipmentRental.push({ item: eq.name, price });
          }
        }
      }

      const tax = 0; // Tax calculation can be added later
      const total = subtotal + tax;

      // Generate booking number
      const bookingNumber = generateBookingNumber();

      // Insert booking within the same transaction
      const [booking] = await tx
        .insert(bookings)
        .values({
          organizationId: org.id,
          bookingNumber,
          tripId,
          customerId: finalCustomerId,
          participants,
          status: "pending",
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          currency: tripData.currency || "USD",
          paymentStatus: "pending",
          specialRequests: specialRequests || null,
          equipmentRental:
            equipmentRental.length > 0 ? (equipmentRental as any) : null,
          source: "website",
        })
        .returning({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
        });

      return {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        tripDate: tripData.date,
        tripStartTime: tripData.startTime,
        tourName: tripData.tourName,
        total: total.toFixed(2),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "SESSION_NOT_FOUND") {
      return { errors: { _form: "Session not found or no longer available" } };
    }
    if (message === "TRIP_IN_PAST") {
      return { errors: { _form: "Cannot book past trips" } };
    }
    if (message.startsWith("INSUFFICIENT_SPOTS:")) {
      const spots = message.split(":")[1];
      return {
        errors: {
          participants: `Only ${spots} spots available`,
        },
      };
    }
    throw error;
  }

  // Queue booking confirmation email (fire-and-forget, do not block redirect)
  try {
    const { getEmailQueue } = await import("../../../../lib/jobs");
    const emailQueue = getEmailQueue();
    await emailQueue.add("booking-confirmation", {
      to: email || "",
      customerName: `${firstName || ""} ${lastName || ""}`.trim(),
      tripName: newBooking.tourName,
      tripDate: newBooking.tripDate,
      tripTime: newBooking.tripStartTime || "",
      participants,
      total: newBooking.total,
      bookingNumber: newBooking.bookingNumber,
      shopName: org.name,
      tenantId: org.id,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  } catch (emailError) {
    // Log but do not block the booking flow
    console.error("Failed to queue booking confirmation email:", emailError);
  }

  // Redirect to confirmation page with booking details
  return redirect(
    `/site/book/confirm?id=${newBooking.id}&ref=${newBooking.bookingNumber}`
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmitting = navigation.state === "submitting";

  const [participants, setParticipants] = useState(1);
  const [selectedSession, setSelectedSession] = useState<string>(
    data.selectedSessionId || ""
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // For course, find the selected session details
  const session =
    data.type === "course" && selectedSession
      ? data.course?.sessions.find((s) => s.id === selectedSession)
      : null;

  // Calculate max participants
  const maxParticipants =
    data.type === "trip"
      ? data.trip?.availableSpots || 1
      : session?.availableSpots || 1;

  // Calculate pricing
  const basePrice =
    data.type === "trip"
      ? parseFloat(data.trip?.price || "0")
      : session
      ? parseFloat(session.price || data.course?.price || "0")
      : parseFloat(data.course?.price || "0");

  const equipmentTotal = selectedEquipment.reduce((total, eqId) => {
    const eq = data.equipment.find((e) => e.id === eqId);
    return total + (eq ? parseFloat(eq.rentalPrice) * participants : 0);
  }, 0);

  const subtotal = basePrice * participants + equipmentTotal;
  const total = subtotal; // Tax can be added here

  const currency =
    (data.type === "trip" ? data.trip?.currency : data.course?.currency) || "USD";

  // Handle equipment toggle
  const toggleEquipment = (eqId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(eqId) ? prev.filter((id) => id !== eqId) : [...prev, eqId]
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background-color)" }}>
      {/* Header */}
      <div
        className="border-b"
        style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            to={
              data.type === "trip"
                ? `/site/trips/${data.trip?.id}`
                : `/site/courses/${data.course?.id}`
            }
            className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity mb-4"
            style={{ color: "var(--primary-color)" }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to{" "}
            {data.type === "trip" ? data.trip?.tourName : data.course?.name}
          </Link>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-color)" }}
          >
            Complete Your Booking
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Form method="post" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* What You're Booking */}
            <div
              className="rounded-xl p-6 shadow-sm"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
                borderWidth: "1px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-color)" }}
              >
                {data.type === "trip" ? "Trip Details" : "Course Details"}
              </h2>

              {data.type === "trip" && data.trip && (
                <div className="space-y-3">
                  <p className="font-medium text-lg">{data.trip.tourName}</p>
                  <div className="flex flex-wrap gap-4 text-sm opacity-75">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDate(data.trip.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="w-4 h-4" />
                      {formatTime(data.trip.startTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="w-4 h-4" />
                      {data.trip.availableSpots} spots left
                    </span>
                  </div>
                  {data.trip.tourDescription && (
                    <p className="text-sm opacity-75 line-clamp-2">
                      {data.trip.tourDescription}
                    </p>
                  )}
                </div>
              )}

              {data.type === "course" && data.course && (
                <div className="space-y-4">
                  <p className="font-medium text-lg">{data.course.name}</p>
                  {data.course.description && (
                    <p className="text-sm opacity-75 line-clamp-2">
                      {data.course.description}
                    </p>
                  )}

                  {/* Session Selection */}
                  <div className="pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                    <label className="block text-sm font-medium mb-2">
                      Select a Session Date *
                    </label>
                    {data.course.sessions.length > 0 ? (
                      <div className="space-y-2">
                        {data.course.sessions.map((session) => (
                          <label
                            key={session.id}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedSession === session.id
                                ? "border-2"
                                : "border hover:border-gray-300"
                            }`}
                            style={{
                              borderColor:
                                selectedSession === session.id
                                  ? "var(--primary-color)"
                                  : "var(--accent-color)",
                              backgroundColor:
                                selectedSession === session.id
                                  ? "var(--accent-color)"
                                  : "var(--color-card-bg)",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="sessionId"
                                value={session.id}
                                checked={selectedSession === session.id}
                                onChange={(e) =>
                                  setSelectedSession(e.target.value)
                                }
                                className="w-4 h-4"
                                style={{ accentColor: "var(--primary-color)" }}
                              />
                              <div>
                                <p className="font-medium">
                                  {formatDate(session.date)}
                                </p>
                                <p className="text-sm opacity-75">
                                  {formatTime(session.startTime)}
                                  {session.endTime &&
                                    ` - ${formatTime(session.endTime)}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className="font-semibold"
                                style={{ color: "var(--primary-color)" }}
                              >
                                {formatCurrency(
                                  session.price || data.course!.price,
                                  data.course!.currency
                                )}
                              </p>
                              <p className="text-sm opacity-75">
                                {session.availableSpots} spots left
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm opacity-75 p-4 rounded-lg" style={{ backgroundColor: "var(--accent-color)" }}>
                        No sessions currently available. Please contact us to
                        schedule.
                      </p>
                    )}
                    {actionData?.errors?.sessionId && (
                      <p className="text-danger text-sm mt-1">
                        {actionData.errors.sessionId}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Participants */}
            <div
              className="rounded-xl p-6 shadow-sm"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
                borderWidth: "1px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-color)" }}
              >
                Number of Participants
              </h2>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setParticipants(Math.max(1, participants - 1))}
                  className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-90"
                  style={{ borderColor: "var(--color-border)" }}
                  disabled={participants <= 1}
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <input
                  type="number"
                  name="participants"
                  value={participants}
                  onChange={(e) =>
                    setParticipants(
                      Math.max(
                        1,
                        Math.min(maxParticipants, parseInt(e.target.value) || 1)
                      )
                    )
                  }
                  min="1"
                  max={maxParticipants}
                  className="w-20 text-center text-xl font-semibold border rounded-lg py-2"
                  style={{ borderColor: "var(--color-border)" }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setParticipants(Math.min(maxParticipants, participants + 1))
                  }
                  className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-90"
                  style={{ borderColor: "var(--color-border)" }}
                  disabled={participants >= maxParticipants}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
                <span className="text-sm opacity-75">
                  Max {maxParticipants} available
                </span>
              </div>
              {actionData?.errors?.participants && (
                <p className="text-danger text-sm mt-2">
                  {actionData.errors.participants}
                </p>
              )}
            </div>

            {/* Equipment Rental */}
            {data.equipment.length > 0 && (
              <div
                className="rounded-xl p-6 shadow-sm"
                style={{
                  backgroundColor: "var(--color-card-bg)",
                  borderColor: "var(--color-border)",
                  borderWidth: "1px",
                }}
              >
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--text-color)" }}
                >
                  Equipment Rental (Optional)
                </h2>
                <p className="text-sm opacity-75 mb-4">
                  Add equipment rental to your booking. Prices are per person.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.equipment.map((eq) => (
                    <label
                      key={eq.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedEquipment.includes(eq.id)
                          ? "border-2"
                          : "border hover:border-gray-300"
                      }`}
                      style={{
                        borderColor: selectedEquipment.includes(eq.id)
                          ? "var(--primary-color)"
                          : "var(--accent-color)",
                        backgroundColor: selectedEquipment.includes(eq.id)
                          ? "var(--accent-color)"
                          : "var(--color-card-bg)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="equipment"
                          value={eq.id}
                          checked={selectedEquipment.includes(eq.id)}
                          onChange={() => toggleEquipment(eq.id)}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: "var(--primary-color)" }}
                        />
                        <div>
                          <p className="font-medium text-sm">{eq.name}</p>
                          <p className="text-xs opacity-60">{eq.category}</p>
                        </div>
                      </div>
                      <p
                        className="font-medium text-sm"
                        style={{ color: "var(--primary-color)" }}
                      >
                        {formatCurrency(eq.rentalPrice, currency)}
                      </p>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Information */}
            <div
              className="rounded-xl p-6 shadow-sm"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
                borderWidth: "1px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-color)" }}
              >
                Your Information
              </h2>

              {data.customer ? (
                <div>
                  <input
                    type="hidden"
                    name="customerId"
                    value={data.customer.id}
                  />
                  <div
                    className="p-4 rounded-lg flex items-center justify-between"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <div>
                      <p className="font-medium">
                        {data.customer.firstName} {data.customer.lastName}
                      </p>
                      <p className="text-sm opacity-75">{data.customer.email}</p>
                      {data.customer.phone && (
                        <p className="text-sm opacity-75">
                          {data.customer.phone}
                        </p>
                      )}
                    </div>
                    <Link
                      to="/site/account/profile"
                      className="text-sm font-medium"
                      style={{ color: "var(--primary-color)" }}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm opacity-75 mb-4">
                    Enter your details below or{" "}
                    <Link
                      to={`/site/login?redirect=${encodeURIComponent(
                        `/site/book/${data.type}/${
                          data.type === "trip" ? data.trip?.id : data.course?.id
                        }`
                      )}`}
                      className="font-medium underline"
                      style={{ color: "var(--primary-color)" }}
                    >
                      log in
                    </Link>{" "}
                    to autofill.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="firstName"
                        className="block text-sm font-medium mb-1"
                      >
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        defaultValue={actionData?.values?.firstName}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2"
                        style={{
                          borderColor: actionData?.errors?.firstName
                            ? "#ef4444"
                            : "var(--accent-color)",
                        }}
                        required
                      />
                      {actionData?.errors?.firstName && (
                        <p className="text-danger text-sm mt-1">
                          {actionData.errors.firstName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="lastName"
                        className="block text-sm font-medium mb-1"
                      >
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        defaultValue={actionData?.values?.lastName}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2"
                        style={{
                          borderColor: actionData?.errors?.lastName
                            ? "#ef4444"
                            : "var(--accent-color)",
                        }}
                        required
                      />
                      {actionData?.errors?.lastName && (
                        <p className="text-danger text-sm mt-1">
                          {actionData.errors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium mb-1"
                    >
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      defaultValue={actionData?.values?.email}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2"
                      style={{
                        borderColor: actionData?.errors?.email
                          ? "#ef4444"
                          : "var(--accent-color)",
                      }}
                      required
                    />
                    {actionData?.errors?.email && (
                      <p className="text-danger text-sm mt-1">
                        {actionData.errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium mb-1"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      defaultValue={actionData?.values?.phone}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2"
                      style={{ borderColor: "var(--color-border)" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Special Requests */}
            <div
              className="rounded-xl p-6 shadow-sm"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
                borderWidth: "1px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-color)" }}
              >
                Special Requests (Optional)
              </h2>
              <textarea
                name="specialRequests"
                rows={3}
                placeholder="Any dietary requirements, medical conditions, or special requests..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 resize-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>

            {/* Form Error */}
            {actionData?.errors?._form && (
              <div className="p-4 bg-danger-muted border border-danger rounded-lg">
                <p className="text-danger">{actionData.errors._form}</p>
              </div>
            )}
          </div>

          {/* Booking Summary Sidebar */}
          <div className="lg:col-span-1">
            <div
              className="sticky top-24 rounded-xl p-6 shadow-lg"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
                borderWidth: "1px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--text-color)" }}
              >
                Booking Summary
              </h2>

              <div className="space-y-4">
                {/* Item */}
                <div className="flex justify-between text-sm">
                  <span>
                    {data.type === "trip"
                      ? data.trip?.tourName
                      : data.course?.name}
                  </span>
                  <span>{formatCurrency(String(basePrice), currency)}</span>
                </div>

                {/* Participants */}
                <div className="flex justify-between text-sm opacity-75">
                  <span>x {participants} participant(s)</span>
                  <span>
                    {formatCurrency(String(basePrice * participants), currency)}
                  </span>
                </div>

                {/* Equipment */}
                {selectedEquipment.length > 0 && (
                  <div
                    className="pt-3 border-t space-y-2"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <p className="text-sm font-medium">Equipment Rental:</p>
                    {selectedEquipment.map((eqId) => {
                      const eq = data.equipment.find((e) => e.id === eqId);
                      if (!eq) return null;
                      const price = parseFloat(eq.rentalPrice) * participants;
                      return (
                        <div
                          key={eqId}
                          className="flex justify-between text-sm opacity-75"
                        >
                          <span>{eq.name}</span>
                          <span>{formatCurrency(String(price), currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Total */}
                <div
                  className="pt-4 border-t flex justify-between"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span className="font-semibold">Total</span>
                  <span
                    className="text-xl font-bold"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {formatCurrency(String(total), currency)}
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (data.type === "course" &&
                      (!selectedSession || data.course!.sessions.length === 0))
                  }
                  className="w-full py-3 rounded-lg text-white font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Proceed to Payment"
                  )}
                </button>

                <p className="text-xs text-center opacity-60">
                  By clicking above, you agree to our terms and conditions.
                </p>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "Time TBA";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// Icons
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12H4"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
  );
}
