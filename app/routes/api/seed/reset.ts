import type { ActionFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { eq } from "drizzle-orm";
import {
  tours,
  trips,
  bookings,
  customers,
  equipment,
} from "../../../../lib/db/schema";
import {
  trainingCourses,
  trainingSessions,
  trainingEnrollments,
} from "../../../../lib/db/schema/training";
import {
  galleryAlbums,
  galleryImages,
} from "../../../../lib/db/schema/gallery";
import { organization } from "../../../../lib/db/schema/auth";

async function deleteAndCount(
  deletePromise: Promise<unknown[]>
): Promise<number> {
  const rows = await deletePromise;
  return rows.length;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const seedKey = process.env.SEED_KEY;
  if (!seedKey) {
    return Response.json({ error: "Seed endpoint not enabled" }, { status: 403 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const tenant = url.searchParams.get("tenant") || "demo";

  if (key !== seedKey) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find org
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, tenant))
    .limit(1);

  if (!org) {
    return Response.json({ error: `Organization '${tenant}' not found` }, { status: 404 });
  }

  const orgId = org.id;

  // Delete in dependency order to respect foreign key constraints
  // Use .returning() to get deleted row counts

  // 1. Enrollments
  const enrollmentsDeleted = await deleteAndCount(
    db.delete(trainingEnrollments)
      .where(eq(trainingEnrollments.organizationId, orgId))
      .returning({ id: trainingEnrollments.id })
  );

  // 2. Sessions
  const sessionsDeleted = await deleteAndCount(
    db.delete(trainingSessions)
      .where(eq(trainingSessions.organizationId, orgId))
      .returning({ id: trainingSessions.id })
  );

  // 3. Courses
  const coursesDeleted = await deleteAndCount(
    db.delete(trainingCourses)
      .where(eq(trainingCourses.organizationId, orgId))
      .returning({ id: trainingCourses.id })
  );

  // 4. Bookings
  const bookingsDeleted = await deleteAndCount(
    db.delete(bookings)
      .where(eq(bookings.organizationId, orgId))
      .returning({ id: bookings.id })
  );

  // 5. Trips
  const tripsDeleted = await deleteAndCount(
    db.delete(trips)
      .where(eq(trips.organizationId, orgId))
      .returning({ id: trips.id })
  );

  // 6. Tours
  const toursDeleted = await deleteAndCount(
    db.delete(tours)
      .where(eq(tours.organizationId, orgId))
      .returning({ id: tours.id })
  );

  // 7. Equipment
  const equipmentDeleted = await deleteAndCount(
    db.delete(equipment)
      .where(eq(equipment.organizationId, orgId))
      .returning({ id: equipment.id })
  );

  // 8. Customers
  const customersDeleted = await deleteAndCount(
    db.delete(customers)
      .where(eq(customers.organizationId, orgId))
      .returning({ id: customers.id })
  );

  // 9. Gallery images
  const galleryImagesDeleted = await deleteAndCount(
    db.delete(galleryImages)
      .where(eq(galleryImages.organizationId, orgId))
      .returning({ id: galleryImages.id })
  );

  // 10. Gallery albums
  const galleryAlbumsDeleted = await deleteAndCount(
    db.delete(galleryAlbums)
      .where(eq(galleryAlbums.organizationId, orgId))
      .returning({ id: galleryAlbums.id })
  );

  return Response.json({
    ok: true,
    tenant,
    deleted: {
      enrollments: enrollmentsDeleted,
      sessions: sessionsDeleted,
      courses: coursesDeleted,
      bookings: bookingsDeleted,
      trips: tripsDeleted,
      tours: toursDeleted,
      equipment: equipmentDeleted,
      customers: customersDeleted,
      galleryImages: galleryImagesDeleted,
      galleryAlbums: galleryAlbumsDeleted,
    },
  });
}

export async function loader() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
