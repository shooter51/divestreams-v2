import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigation, Link } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getBookingWithFullDetails, getEquipment } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Booking - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID required", { status: 400 });
  }

  const [bookingData, equipmentData] = await Promise.all([
    getBookingWithFullDetails(organizationId, bookingId),
    getEquipment(organizationId, { isRentable: true, status: "available" }),
  ]);

  if (!bookingData) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Group equipment by name+price (same pattern as new.tsx)
  const equipmentGroups = new Map<string, { name: string; price: string; count: number; ids: string[] }>();
  for (const e of equipmentData) {
    const price = e.rentalPrice ? e.rentalPrice.toFixed(2) : "0.00";
    const key = `${e.name}|${price}`;
    if (!equipmentGroups.has(key)) {
      equipmentGroups.set(key, { name: e.name, price, count: 0, ids: [] });
    }
    const entry = equipmentGroups.get(key)!;
    entry.count++;
    entry.ids.push(e.id);
  }
  const rentalEquipment = Array.from(equipmentGroups.values());

  // Get existing equipment rental items (names) for pre-selection
  const existingRentals = (bookingData.equipmentRental || []) as Array<{ item: string; price: number }>;
  const existingRentalNames = existingRentals.map((r) => r.item);

  const booking = {
    id: bookingData.id,
    bookingNumber: bookingData.bookingNumber,
    customerId: bookingData.customer.id,
    customerName: `${bookingData.customer.firstName} ${bookingData.customer.lastName}`,
    tripId: bookingData.trip.id,
    tripName: bookingData.trip.tourName,
    participants: bookingData.participants,
    status: bookingData.status,
    totalAmount: bookingData.pricing.total,
    specialRequests: bookingData.specialRequests || "",
    internalNotes: bookingData.internalNotes || "",
  };

  return { booking, rentalEquipment, existingRentalNames };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Get the values we can update
  const participants = parseInt(formData.get("participants") as string) || 1;
  const status = formData.get("status") as string;
  const specialRequests = formData.get("specialRequests") as string;
  const internalNotes = formData.get("internalNotes") as string;

  // Parse equipment rental selections
  const selectedEquipmentIds = formData.getAll("equipment") as string[];
  let equipmentRental: Array<{ item: string; price: number }> | null = null;

  if (selectedEquipmentIds.length > 0) {
    const allEquipment = await getEquipment(organizationId, { isRentable: true });
    equipmentRental = [];
    for (const eqId of selectedEquipmentIds) {
      const eq_item = allEquipment.find((e) => e.id === eqId);
      if (eq_item && eq_item.rentalPrice) {
        const price = eq_item.rentalPrice * participants;
        equipmentRental.push({ item: eq_item.name, price });
      }
    }
    if (equipmentRental.length === 0) equipmentRental = null;
  }

  // Update booking in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.bookings)
    .set({
      participants,
      status,
      specialRequests,
      internalNotes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      equipmentRental: equipmentRental as any,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.bookings.organizationId, organizationId), eq(schema.bookings.id, bookingId)));

  return redirect(redirectWithNotification(`/tenant/bookings/${bookingId}`, "Booking has been successfully updated", "success"));
}

export default function EditBookingPage() {
  const { booking, rentalEquipment, existingRentalNames } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const t = useT();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/bookings/${booking.id}`} className="text-brand hover:underline text-sm">
          {t("tenant.bookings.backToBooking")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.bookings.editBooking")}</h1>
        <p className="text-foreground-muted">{booking.bookingNumber}</p>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Booking Info (Read-only) */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.bookings.bookingDetails")}</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">{t("common.customer")}</span>
              <Link to={`/tenant/customers/${booking.customerId}`} className="text-brand hover:underline">
                {booking.customerName}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">{t("common.trip")}</span>
              <Link to={`/tenant/trips/${booking.tripId}`} className="text-brand hover:underline">
                {booking.tripName}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">{t("tenant.bookings.totalAmount")}</span>
              <span className="font-medium">${booking.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.bookings.updateBooking")}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="participants" className="block text-sm font-medium mb-1">
                  {t("tenant.bookings.numParticipants")} *
                </label>
                <input
                  type="number"
                  id="participants"
                  name="participants"
                  required
                  min="1"
                  max="20"
                  defaultValue={booking.participants}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1">
                  {t("common.status")} *
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  defaultValue={booking.status}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="pending">{t("tenant.bookings.statusPending")}</option>
                  <option value="confirmed">{t("tenant.bookings.statusConfirmed")}</option>
                  <option value="completed">{t("tenant.bookings.statusCompleted")}</option>
                  <option value="cancelled">{t("tenant.bookings.statusCancelled")}</option>
                  <option value="no_show">{t("tenant.bookings.statusNoShow")}</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="specialRequests" className="block text-sm font-medium mb-1">
                {t("tenant.bookings.specialRequestsLabel")}
              </label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                rows={3}
                placeholder={t("tenant.bookings.specialRequestsPlaceholder")}
                defaultValue={booking.specialRequests}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="internalNotes" className="block text-sm font-medium mb-1">
                {t("tenant.bookings.internalNotesLabel")}
              </label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                placeholder={t("tenant.bookings.internalNotesPlaceholder")}
                defaultValue={booking.internalNotes}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Equipment Rental */}
        {rentalEquipment.length > 0 && (
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.bookings.equipmentRentalTitle")}</h2>
            <p className="text-sm text-foreground-muted mb-4">{t("tenant.bookings.selectEquipment")}</p>
            <div className="grid grid-cols-2 gap-3">
              {rentalEquipment.map((item) => (
                <label
                  key={item.name}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-inset cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="equipment"
                      value={item.ids[0]}
                      defaultChecked={existingRentalNames.includes(item.name)}
                      className="w-4 h-4 text-brand rounded focus:ring-brand"
                    />
                    <span className="text-sm font-medium">
                      {item.name}
                      <span className="text-foreground-muted font-normal"> ({t("tenant.bookings.availableCount", { count: item.count })})</span>
                    </span>
                  </div>
                  <span className="text-sm text-foreground-muted">${item.price}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-foreground-subtle mt-3">
              {t("tenant.bookings.equipmentNote")}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.saving") : t("common.saveChanges")}
          </button>
          <Link
            to={`/tenant/bookings/${booking.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
