/**
 * Tour Detail for Booking Widget
 *
 * Displays tour information and available dates for booking.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { getOrganizationBySlug, getPublicTourById, type PublicTourDetail } from "../../../lib/db/queries.public";
import { useState } from "react";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.tour ? `${data.tour.name} - Book Now` : "Tour Details" },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const { tenant: subdomain, id: tourId } = params;
  if (!subdomain || !tourId) {
    throw new Response("Not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const tour = await getPublicTourById(org.id, tourId);
  if (!tour) {
    throw new Response("Tour not found", { status: 404 });
  }

  return { tour, tenantSlug: subdomain };
}

const tourTypeLabels: Record<string, string> = {
  single_dive: "Single Dive",
  multi_dive: "Multi-Dive",
  course: "Course",
  snorkel: "Snorkel",
  night_dive: "Night Dive",
  other: "Experience",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function ImageGallery({ images }: { images: PublicTourDetail["images"] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <svg
          className="w-16 h-16 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div>
      {/* Main Image */}
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-2">
        <img
          src={images[selectedIndex].url}
          alt={images[selectedIndex].alt || "Tour image"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setSelectedIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 ${
                index === selectedIndex ? "border-brand" : "border-transparent"
              }`}
            >
              <img
                src={img.thumbnailUrl || img.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TourDetailPage() {
  const { tour, tenantSlug } = useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  const inclusions: string[] = [];
  if (tour.includesEquipment) inclusions.push("Equipment");
  if (tour.includesMeals) inclusions.push("Meals");
  if (tour.includesTransport) inclusions.push("Transport");
  if (Array.isArray(tour.inclusions) && tour.inclusions.length) inclusions.push(...tour.inclusions);

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/embed/${tenantSlug}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Tours
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column - Images and Details */}
        <div>
          <ImageGallery images={tour.images} />

          <div className="mt-6">
            <span className="text-sm text-gray-500">
              {tourTypeLabels[tour.type] || tour.type}
            </span>
            <h1 className="text-2xl font-bold mt-1">{tour.name}</h1>

            {tour.description && (
              <p className="text-gray-600 mt-3">{tour.description}</p>
            )}

            {/* Tour info */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              {tour.duration > 0 && (
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatDuration(tour.duration)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Max {tour.maxParticipants} participants</span>
              </div>
            </div>

            {/* Inclusions */}
            {inclusions.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">What's Included</h3>
                <ul className="space-y-1">
                  {inclusions.map((inc, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {inc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {(tour.minCertLevel || tour.minAge) && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Requirements</h3>
                <ul className="space-y-1 text-gray-600">
                  {tour.minCertLevel && (
                    <li>Minimum certification: {tour.minCertLevel}</li>
                  )}
                  {tour.minAge && <li>Minimum age: {tour.minAge} years</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Available Dates */}
        <div>
          <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                {formatPrice(tour.price, tour.currency)}
              </span>
              <span className="text-sm text-gray-500">per person</span>
            </div>

            <h3 className="font-semibold mb-4">Select a Date</h3>

            {tour.upcomingTrips.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p>No upcoming dates available.</p>
                <p className="text-sm mt-1">Check back soon!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tour.upcomingTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={
                      trip.availableSpots > 0
                        ? `/embed/${tenantSlug}/book?tripId=${trip.id}`
                        : "#"
                    }
                    className={`block p-3 rounded-lg border transition-colors ${
                      trip.availableSpots > 0
                        ? "hover:border-brand hover:bg-brand-muted cursor-pointer"
                        : "opacity-60 cursor-not-allowed bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{formatDate(trip.date)}</div>
                        <div className="text-sm text-gray-500">
                          {formatTime(trip.startTime)}
                          {trip.endTime && ` - ${formatTime(trip.endTime)}`}
                        </div>
                      </div>
                      <div className="text-right">
                        {trip.availableSpots > 0 ? (
                          <>
                            <div className="text-sm font-medium text-success">
                              {trip.availableSpots} spot{trip.availableSpots !== 1 ? "s" : ""} left
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatPrice(trip.price, trip.currency)}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-danger">
                            Fully Booked
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-4 text-center">
              Secure checkout • Instant confirmation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
