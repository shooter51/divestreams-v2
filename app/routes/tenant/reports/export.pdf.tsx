/**
 * PDF Export Route for Reports
 *
 * Generates a PDF report containing:
 * - Formatted report title with date range
 * - Revenue overview section
 * - Customer insights section
 * - Tables with data
 */

import type { LoaderFunctionArgs } from "react-router";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { bookings, customers, trips, tours } from "../../../../lib/db/schema";
import { eq, gte, and, sql, count, desc } from "drizzle-orm";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Parse date range from query params
  const url = new URL(request.url);
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  // Default to current month if no dates provided
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startDate = startDateParam ? new Date(startDateParam) : startOfMonth;
  const endDate = endDateParam ? new Date(endDateParam) : new Date();

  const lastMonth = new Date(startOfMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Fetch data
  let currentMonthRevenue = 0;
  let lastMonthRevenue = 0;
  let bookingsThisMonth = 0;
  let avgBookingValue = 0;
  let totalCustomers = 0;
  let newCustomersThisMonth = 0;

  try {
    // Current month revenue
    const [currentMonthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      );
    currentMonthRevenue = Number(currentMonthResult?.total || 0);

    // Last month revenue
    const [lastMonthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, lastMonth),
          sql`${bookings.createdAt} < ${startOfMonth}`
        )
      );
    lastMonthRevenue = Number(lastMonthResult?.total || 0);

    // Bookings count
    const [bookingCountResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      );
    bookingsThisMonth = bookingCountResult?.count || 0;
    avgBookingValue = bookingsThisMonth > 0 ? Math.round(currentMonthRevenue / bookingsThisMonth) : 0;

    // Total customers
    const [customerCountResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, ctx.org.id));
    totalCustomers = customerCountResult?.count || 0;

    // New customers this month
    const [newCustomerResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.org.id),
          gte(customers.createdAt, startDate)
        )
      );
    newCustomersThisMonth = newCustomerResult?.count || 0;
  } catch (error) {
    console.error("Error fetching report data for PDF export:", error);
  }

  // Fetch recent bookings with joins
  let recentBookings: Array<{
    id: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    tourName: string | null;
    total: string;
    status: string;
    createdAt: Date | null;
  }> = [];

  try {
    const bookingsData = await db
      .select({
        id: bookings.id,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        tourName: tours.name,
        total: bookings.total,
        status: bookings.status,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(trips, eq(bookings.tripId, trips.id))
      .leftJoin(tours, eq(trips.tourId, tours.id))
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      )
      .orderBy(desc(bookings.createdAt))
      .limit(20);

    recentBookings = bookingsData;
  } catch (error) {
    console.error("Error fetching recent bookings for PDF:", error);
  }

  // Calculate change percent
  const changePercent = lastMonthRevenue > 0
    ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page dimensions
  const pageWidth = 612; // US Letter width
  const pageHeight = 792; // US Letter height
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Add first page
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // Helper function to add text
  const drawText = (
    text: string,
    x: number,
    y: number,
    options: { font?: typeof helvetica; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const { font = helvetica, size = 12, color = rgb(0, 0, 0) } = options;
    page.drawText(text, { x, y, size, font, color });
  };

  // Helper function to draw a line
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  };

  // Helper function to draw a box
  const drawBox = (
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: ReturnType<typeof rgb>
  ) => {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: bgColor,
    });
  };

  // Title
  const orgName = ctx.org.name || ctx.org.slug;
  drawText("DiveStreams Reports", margin, yPosition, { font: helveticaBold, size: 24, color: rgb(0.1, 0.4, 0.7) });
  yPosition -= 25;

  drawText(orgName, margin, yPosition, { font: helveticaBold, size: 14 });
  yPosition -= 20;

  // Date range
  const dateRangeText = `Report Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  drawText(dateRangeText, margin, yPosition, { size: 11, color: rgb(0.4, 0.4, 0.4) });
  yPosition -= 15;

  const generatedText = `Generated: ${new Date().toLocaleString()}`;
  drawText(generatedText, margin, yPosition, { size: 10, color: rgb(0.5, 0.5, 0.5) });
  yPosition -= 30;

  // Separator line
  drawLine(margin, yPosition, pageWidth - margin, yPosition);
  yPosition -= 30;

  // Revenue Overview Section
  drawText("Revenue Overview", margin, yPosition, { font: helveticaBold, size: 16, color: rgb(0.2, 0.2, 0.2) });
  yPosition -= 25;

  // Revenue cards (4 boxes in a row)
  const boxWidth = (contentWidth - 30) / 4;
  const boxHeight = 60;
  const boxSpacing = 10;

  const revenueMetrics = [
    { label: "This Month", value: `$${currentMonthRevenue.toLocaleString()}`, color: rgb(0.9, 0.95, 1) },
    { label: "Last Month", value: `$${lastMonthRevenue.toLocaleString()}`, color: rgb(0.95, 0.95, 0.95) },
    { label: "Year to Date", value: `$${(currentMonthRevenue + lastMonthRevenue).toLocaleString()}`, color: rgb(0.95, 0.95, 0.95) },
    { label: "Avg Booking", value: `$${avgBookingValue.toLocaleString()}`, color: rgb(0.95, 0.95, 0.95) },
  ];

  revenueMetrics.forEach((metric, index) => {
    const boxX = margin + index * (boxWidth + boxSpacing);
    const boxY = yPosition - boxHeight;

    drawBox(boxX, boxY, boxWidth, boxHeight, metric.color);

    // Label
    drawText(metric.label, boxX + 10, boxY + boxHeight - 20, { size: 10, color: rgb(0.4, 0.4, 0.4) });

    // Value
    drawText(metric.value, boxX + 10, boxY + boxHeight - 40, { font: helveticaBold, size: 16 });
  });

  yPosition -= boxHeight + 20;

  // Change percentage
  const changeColor = changePercent >= 0 ? rgb(0.2, 0.6, 0.2) : rgb(0.7, 0.2, 0.2);
  const changeText = `${changePercent >= 0 ? "+" : ""}${changePercent}% vs last month`;
  drawText(changeText, margin, yPosition, { size: 11, color: changeColor });
  yPosition -= 35;

  // Customer Insights Section
  drawText("Customer Insights", margin, yPosition, { font: helveticaBold, size: 16, color: rgb(0.2, 0.2, 0.2) });
  yPosition -= 25;

  const customerMetrics = [
    { label: "Total Customers", value: totalCustomers.toString(), color: rgb(0.9, 0.95, 1) },
    { label: "New This Month", value: newCustomersThisMonth.toString(), color: rgb(0.9, 1, 0.9) },
    { label: "Bookings", value: bookingsThisMonth.toString(), color: rgb(1, 0.95, 0.9) },
    { label: "Avg/Customer", value: totalCustomers > 0 ? (bookingsThisMonth / totalCustomers).toFixed(1) : "0", color: rgb(0.95, 0.9, 1) },
  ];

  customerMetrics.forEach((metric, index) => {
    const boxX = margin + index * (boxWidth + boxSpacing);
    const boxY = yPosition - boxHeight;

    drawBox(boxX, boxY, boxWidth, boxHeight, metric.color);

    // Label
    drawText(metric.label, boxX + 10, boxY + boxHeight - 20, { size: 10, color: rgb(0.4, 0.4, 0.4) });

    // Value
    drawText(metric.value, boxX + 10, boxY + boxHeight - 40, { font: helveticaBold, size: 18 });
  });

  yPosition -= boxHeight + 35;

  // Recent Bookings Table
  drawText("Recent Bookings", margin, yPosition, { font: helveticaBold, size: 16, color: rgb(0.2, 0.2, 0.2) });
  yPosition -= 25;

  // Table header
  const colWidths = [100, 130, 130, 80, 70];
  const headers = ["Customer", "Tour", "Amount", "Status", "Date"];
  let xPos = margin;

  // Header background
  drawBox(margin, yPosition - 15, contentWidth, 20, rgb(0.9, 0.9, 0.9));

  headers.forEach((header, index) => {
    drawText(header, xPos + 5, yPosition - 10, { font: helveticaBold, size: 10 });
    xPos += colWidths[index];
  });

  yPosition -= 25;

  // Table rows
  const rowHeight = 20;
  const maxRows = Math.min(recentBookings.length, 15);

  for (let i = 0; i < maxRows; i++) {
    const booking = recentBookings[i];

    // Check if we need a new page
    if (yPosition < margin + rowHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }

    // Alternate row background
    if (i % 2 === 0) {
      drawBox(margin, yPosition - 15, contentWidth, rowHeight, rgb(0.97, 0.97, 0.97));
    }

    xPos = margin;

    // Customer name (truncate if too long)
    const customerName = ([booking.customerFirstName, booking.customerLastName].filter(Boolean).join(" ") || "N/A").substring(0, 18);
    drawText(customerName, xPos + 5, yPosition - 10, { size: 9 });
    xPos += colWidths[0];

    // Tour name (truncate if too long)
    const tourName = (booking.tourName || "N/A").substring(0, 22);
    drawText(tourName, xPos + 5, yPosition - 10, { size: 9 });
    xPos += colWidths[1];

    // Amount
    const amount = booking.total ? `$${Number(booking.total).toLocaleString()}` : "$0";
    drawText(amount, xPos + 5, yPosition - 10, { size: 9 });
    xPos += colWidths[2];

    // Status
    const status = (booking.status || "N/A").replace("_", " ");
    drawText(status, xPos + 5, yPosition - 10, { size: 9 });
    xPos += colWidths[3];

    // Date
    const date = booking.createdAt ? booking.createdAt.toLocaleDateString() : "N/A";
    drawText(date, xPos + 5, yPosition - 10, { size: 9 });

    yPosition -= rowHeight;
  }

  if (recentBookings.length === 0) {
    yPosition -= 10;
    drawText("No bookings in selected period", margin, yPosition, { size: 11, color: rgb(0.5, 0.5, 0.5) });
  }

  // Footer
  const footerY = margin - 20;
  page.drawText(
    "Generated by DiveStreams - Dive Shop Management Software",
    { x: margin, y: footerY, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.6) }
  );

  // Serialize PDF
  const pdfBytes = await pdfDoc.save();

  // Generate filename
  const filename = `reports-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.pdf`;

  // Convert Uint8Array to standard ArrayBuffer for Response compatibility
  return new Response(pdfBytes.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
