/**
 * Booking Form for Widget
 *
 * Collects customer details and creates booking.
 * Redirects to Stripe Checkout for payment (Phase 1).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useOutletContext, Form, useActionData, useNavigation, Link } from "react-router";
import { redirect } from "react-router";
import { getOrganizationBySlug, getPublicTripById, type PublicTripDetail } from "../../../lib/db/queries.public";
import { createWidgetBooking } from "../../../lib/db/mutations.public";
import { useState } from "react";

export const meta: MetaFunction = () => [{ title: "Complete Your Booking" }];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const url = new URL(request.url);
  const tripId = url.searchParams.get("tripId");
  if (!tripId) {
    throw new Response("Trip not specified", { status: 400 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const trip = await getPublicTripById(org.id, tripId);
  if (!trip) {
    throw new Response("Trip not found or no longer available", { status: 404 });
  }

  if (trip.availableSpots <= 0) {
    throw new Response("This trip is fully booked", { status: 400 });
  }

  return {
    trip,
    tenantSlug: subdomain,
    organizationId: org.id,
  };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const formData = await request.formData();
  const tripId = formData.get("tripId") as string;
  const participants = parseInt(formData.get("participants") as string, 10) || 1;
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim();
  const specialRequests = (formData.get("specialRequests") as string)?.trim();

  // Validation
  const errors: Record<string, string> = {};

  if (!tripId) errors.form = "Trip not specified";
  if (!firstName) errors.firstName = "First name is required";
  if (!lastName) errors.lastName = "Last name is required";
  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
  }

  // Check trip availability
  const trip = await getPublicTripById(org.id, tripId);
  if (!trip) {
    errors.form = "This trip is no longer available";
  } else if (trip.availableSpots < participants) {
    errors.participants = `Only ${trip.availableSpots} spot(s) available`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    // Create the booking
    const booking = await createWidgetBooking(org.id, {
      tripId,
      participants,
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      specialRequests: specialRequests || undefined,
    });

    // For Phase 1: Redirect to confirmation page
    // Phase 2 will integrate Stripe Checkout here
    return redirect(`/embed/${subdomain}/confirm?bookingId=${booking.id}&bookingNumber=${booking.bookingNumber}`);
  } catch (error) {
    console.error("Booking creation failed:", error);
    return {
      errors: { form: "Failed to create booking. Please try again." },
    };
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatPrice(price: string | number, currency: string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

export default function BookingFormPage() {
  const { trip, tenantSlug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  const [participants, setParticipants] = useState(1);
  const isSubmitting = navigation.state === "submitting";

  const pricePerPerson = parseFloat(trip.price);
  const total = pricePerPerson * participants;

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/embed/${tenantSlug}/tour/${trip.tourId}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Complete Your Booking</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="md:col-span-2">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="tripId" value={trip.id} />

            {actionData?.errors?.form && (
              <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded">
                {actionData.errors.form}
              </div>
            )}

            {/* Participants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Participants
              </label>
              <select
                name="participants"
                value={participants}
                onChange={(e) => setParticipants(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              >
                {Array.from({ length: Math.min(trip.availableSpots, 10) }, (_, i) => i + 1).map(
                  (num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "person" : "people"}
                    </option>
                  )
                )}
              </select>
              {actionData?.errors?.participants && (
                <p className="text-danger text-sm mt-1">{actionData.errors.participants}</p>
              )}
            </div>

            {/* Contact Details */}
            <fieldset>
              <legend className="text-lg font-semibold mb-4">Contact Details</legend>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  {actionData?.errors?.firstName && (
                    <p className="text-danger text-sm mt-1">{actionData.errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  {actionData?.errors?.lastName && (
                    <p className="text-danger text-sm mt-1">{actionData.errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  {actionData?.errors?.email && (
                    <p className="text-danger text-sm mt-1">{actionData.errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
              </div>
            </fieldset>

            {/* Special Requests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests or Notes
              </label>
              <textarea
                name="specialRequests"
                rows={3}
                placeholder="Allergies, dietary requirements, accessibility needs, etc."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {isSubmitting ? "Processing..." : `Book Now - ${formatPrice(total, trip.currency)}`}
            </button>

            <p className="text-xs text-gray-500 text-center">
              By booking, you agree to the cancellation policy and terms of service.
            </p>
          </Form>
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
            <h3 className="font-semibold mb-4">Booking Summary</h3>

            {trip.primaryImage && (
              <img
                src={trip.primaryImage}
                alt={trip.tourName}
                className="w-full aspect-video object-cover rounded-lg mb-4"
              />
            )}

            <h4 className="font-medium">{trip.tourName}</h4>

            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(trip.date)}
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(trip.startTime)}
                {trip.endTime && ` - ${formatTime(trip.endTime)}`}
              </div>
            </div>

            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {formatPrice(pricePerPerson, trip.currency)} × {participants}
                </span>
                <span>{formatPrice(total, trip.currency)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span style={{ color: branding.primaryColor }}>
                  {formatPrice(total, trip.currency)}
                </span>
              </div>
            </div>

            {/* Whats included */}
            <div className="border-t mt-4 pt-4">
              <h4 className="text-sm font-medium mb-2">What's Included</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {trip.includesEquipment && (
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Equipment
                  </li>
                )}
                {trip.includesMeals && (
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Meals
                  </li>
                )}
                {trip.includesTransport && (
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Transport
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
