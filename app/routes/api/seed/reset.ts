import type { ActionFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { eq } from "drizzle-orm";
import {
  tours,
  trips,
  bookings,
  customers,
  equipment,
  transactions,
  rentals,
  customerCommunications,
  tourDiveSites,
  serviceRecords,
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

  // Delete in FK dependency order
  const enrollmentsDeleted = await deleteAndCount(
    db.delete(trainingEnrollments).where(eq(trainingEnrollments.organizationId, orgId)).returning({ id: trainingEnrollments.id })
  );
  const sessionsDeleted = await deleteAndCount(
    db.delete(trainingSessions).where(eq(trainingSessions.organizationId, orgId)).returning({ id: trainingSessions.id })
  );
  const coursesDeleted = await deleteAndCount(
    db.delete(trainingCourses).where(eq(trainingCourses.organizationId, orgId)).returning({ id: trainingCourses.id })
  );
  await deleteAndCount(
    db.delete(serviceRecords).where(eq(serviceRecords.organizationId, orgId)).returning({ id: serviceRecords.id })
  );
  await deleteAndCount(
    db.delete(customerCommunications).where(eq(customerCommunications.organizationId, orgId)).returning({ id: customerCommunications.id })
  );
  const transactionsDeleted = await deleteAndCount(
    db.delete(transactions).where(eq(transactions.organizationId, orgId)).returning({ id: transactions.id })
  );
  const rentalsDeleted = await deleteAndCount(
    db.delete(rentals).where(eq(rentals.organizationId, orgId)).returning({ id: rentals.id })
  );
  const galleryImagesDeleted = await deleteAndCount(
    db.delete(galleryImages).where(eq(galleryImages.organizationId, orgId)).returning({ id: galleryImages.id })
  );
  const bookingsDeleted = await deleteAndCount(
    db.delete(bookings).where(eq(bookings.organizationId, orgId)).returning({ id: bookings.id })
  );
  const tripsDeleted = await deleteAndCount(
    db.delete(trips).where(eq(trips.organizationId, orgId)).returning({ id: trips.id })
  );
  await deleteAndCount(
    db.delete(tourDiveSites).where(eq(tourDiveSites.organizationId, orgId)).returning({ id: tourDiveSites.id })
  );
  const toursDeleted = await deleteAndCount(
    db.delete(tours).where(eq(tours.organizationId, orgId)).returning({ id: tours.id })
  );
  const equipmentDeleted = await deleteAndCount(
    db.delete(equipment).where(eq(equipment.organizationId, orgId)).returning({ id: equipment.id })
  );
  const customersDeleted = await deleteAndCount(
    db.delete(customers).where(eq(customers.organizationId, orgId)).returning({ id: customers.id })
  );
  const galleryAlbumsDeleted = await deleteAndCount(
    db.delete(galleryAlbums).where(eq(galleryAlbums.organizationId, orgId)).returning({ id: galleryAlbums.id })
  );

  return Response.json({
    ok: true,
    tenant,
    deleted: {
      enrollments: enrollmentsDeleted,
      sessions: sessionsDeleted,
      courses: coursesDeleted,
      transactions: transactionsDeleted,
      rentals: rentalsDeleted,
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
