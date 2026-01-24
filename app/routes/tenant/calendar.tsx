/**
 * Calendar View
 *
 * Displays scheduled trips in a calendar format with month and week views.
 * Clicking an event shows trip details in a modal.
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { trips as tripsTable, tours, boats, bookings } from "../../../lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { useState, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg } from "@fullcalendar/core";

export const meta: MetaFunction = () => [{ title: "Calendar - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Get date range from URL or default to current month
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const fromDate = url.searchParams.get("from") || defaultStart.toISOString().split("T")[0];
  const toDate = url.searchParams.get("to") || defaultEnd.toISOString().split("T")[0];

  // Query trips with tour and boat info
  const rawTrips = await db
    .select({
      id: tripsTable.id,
      date: tripsTable.date,
      startTime: tripsTable.startTime,
      endTime: tripsTable.endTime,
      maxParticipants: tripsTable.maxParticipants,
      status: tripsTable.status,
      tourId: tripsTable.tourId,
      tourName: tours.name,
      tourType: tours.type,
      boatName: boats.name,
    })
    .from(tripsTable)
    .leftJoin(tours, eq(tripsTable.tourId, tours.id))
    .leftJoin(boats, eq(tripsTable.boatId, boats.id))
    .where(
      and(
        eq(tripsTable.organizationId, ctx.org.id),
        gte(tripsTable.date, fromDate),
        lte(tripsTable.date, toDate)
      )
    )
    .orderBy(tripsTable.date, tripsTable.startTime);

  // Get booking counts per trip
  const tripIds = rawTrips.map(t => t.id);
  const bookingCounts = tripIds.length > 0 ? await db
    .select({
      tripId: bookings.tripId,
      count: sql<number>`SUM(${bookings.participants})`,
    })
    .from(bookings)
    .where(sql`${bookings.tripId} IN ${tripIds}`)
    .groupBy(bookings.tripId) : [];

  const bookingCountMap = new Map(bookingCounts.map(b => [b.tripId, Number(b.count) || 0]));

  const trips = rawTrips.map(t => ({
    id: t.id,
    tourId: t.tourId,
    tourName: t.tourName || "Unknown Tour",
    tourType: t.tourType || "other",
    date: t.date,
    startTime: t.startTime,
    endTime: t.endTime,
    boatName: t.boatName,
    maxParticipants: t.maxParticipants || 0,
    bookedParticipants: bookingCountMap.get(t.id) || 0,
    status: t.status,
  }));

  return { trips, isPremium: ctx.isPremium };
}

// Tour type colors
const tourTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  single_dive: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  multi_dive: { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
  course: { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  snorkel: { bg: "#cffafe", border: "#06b6d4", text: "#155e75" },
  night_dive: { bg: "#f1f5f9", border: "#64748b", text: "#334155" },
  other: { bg: "#f3f4f6", border: "#6b7280", text: "#374151" },
};

// Status colors for capacity indicator
function getCapacityColor(booked: number, max: number): string {
  const ratio = booked / max;
  if (ratio >= 1) return "#ef4444"; // Full - red
  if (ratio >= 0.75) return "#f97316"; // Almost full - orange
  if (ratio >= 0.5) return "#eab308"; // Half - yellow
  return "#22c55e"; // Available - green
}

interface CalendarTrip {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  date: string;
  startTime: string;
  endTime: string | null;
  boatName: string | null;
  maxParticipants: number;
  bookedParticipants: number;
  status: string;
}

interface TripModalProps {
  trip: CalendarTrip | null;
  onClose: () => void;
}

function TripModal({ trip, onClose }: TripModalProps) {
  if (!trip) return null;

  const colors = tourTypeColors[trip.tourType] || tourTypeColors.other;
  const capacityColor = getCapacityColor(trip.bookedParticipants, trip.maxParticipants);
  const isFull = trip.bookedParticipants >= trip.maxParticipants;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {trip.tourType.replace("_", " ")}
            </span>
            <h2 className="text-xl font-bold mt-2">{trip.tourName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(trip.date)}</span>
          </div>

          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {formatTime(trip.startTime)}
              {trip.endTime && ` - ${formatTime(trip.endTime)}`}
            </span>
          </div>

          {trip.boatName && (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{trip.boatName}</span>
            </div>
          )}

          {/* Capacity */}
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="flex items-center gap-2">
              <span>{trip.bookedParticipants} / {trip.maxParticipants} booked</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: capacityColor }}
              />
              {isFull && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                  FULL
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="capitalize">{trip.status}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Link
            to={`/app/trips/${trip.id}`}
            className="flex-1 text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Trip
          </Link>
          <Link
            to={`/app/bookings/new?tripId=${trip.id}`}
            className={`flex-1 text-center py-2 rounded-lg transition-colors ${
              isFull
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={isFull ? (e) => e.preventDefault() : undefined}
          >
            {isFull ? "Full" : "Add Booking"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { trips } = useLoaderData<typeof loader>();
  const [selectedTrip, setSelectedTrip] = useState<CalendarTrip | null>(null);
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");

  // Convert trips to FullCalendar events
  const events = useMemo(() => {
    return trips.map((trip: CalendarTrip) => {
      const colors = tourTypeColors[trip.tourType] || tourTypeColors.other;
      const capacityColor = getCapacityColor(trip.bookedParticipants, trip.maxParticipants);

      // Create datetime strings
      const startDateTime = `${trip.date}T${trip.startTime}`;
      const endDateTime = trip.endTime ? `${trip.date}T${trip.endTime}` : undefined;

      return {
        id: trip.id,
        title: trip.tourName,
        start: startDateTime,
        end: endDateTime,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        extendedProps: {
          trip,
          capacityColor,
          booked: trip.bookedParticipants,
          max: trip.maxParticipants,
        },
      };
    });
  }, [trips]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const trip = info.event.extendedProps.trip as CalendarTrip;
    setSelectedTrip(trip);
  }, []);

  // Custom event content renderer
  const renderEventContent = useCallback((eventInfo: any) => {
    const { capacityColor, booked, max } = eventInfo.event.extendedProps;
    const timeText = eventInfo.timeText;

    return (
      <div className="p-1 overflow-hidden">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: capacityColor }}
          />
          <span className="font-medium truncate text-xs">{eventInfo.event.title}</span>
        </div>
        {timeText && (
          <div className="text-xs opacity-75 mt-0.5">{timeText}</div>
        )}
        <div className="text-xs opacity-75">{booked}/{max} booked</div>
      </div>
    );
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentView("dayGridMonth")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentView === "dayGridMonth"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCurrentView("timeGridWeek")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentView === "timeGridWeek"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Week
            </button>
          </div>
          <Link
            to="/tenant/trips/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            Schedule Trip
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Capacity:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            Half
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            Almost Full
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            Full
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView={currentView}
          events={events}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          height="auto"
          dayMaxEvents={3}
          moreLinkClick="popover"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          nowIndicator={true}
          eventDisplay="block"
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          key={currentView}
        />
      </div>

      {/* Trip Detail Modal */}
      <TripModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </div>
  );
}
