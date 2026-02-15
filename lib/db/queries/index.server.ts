/**
 * Barrel re-export file for all query modules.
 *
 * This file re-exports everything from the domain-specific query modules
 * so that existing imports from "lib/db/queries.server" continue to work
 * without modification.
 */

// Formatters (pure utility functions)
export {
  formatRelativeDate,
  formatRelativeTime,
  formatTime,
  formatDateString,
  formatTimeString,
} from "./formatters";

// Mappers (row-to-object transformations)
export {
  mapCustomer,
  mapTour,
  mapTrip,
  mapBooking,
  mapEquipment,
  mapBoat,
  mapDiveSite,
  mapProduct,
  type Product,
} from "./mappers";

// Customer queries
export {
  getCustomerBookings,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerReportStats,
  type CustomerStats,
} from "./customers.server";

// Tour queries
export {
  getTours,
  getAllTours,
  getTourById,
  createTour,
  duplicateTour,
  updateTourActiveStatus,
  deleteTour,
  getTourStats,
  getUpcomingTripsForTour,
  getTopTours,
  type TopTour,
} from "./tours.server";

// Trip queries
export {
  getUpcomingTrips,
  getTrips,
  getTripById,
  getCalendarTrips,
  createTrip,
  updateTripStatus,
  getTripWithFullDetails,
  getTripBookings,
  getTripRevenue,
  getTripBookedParticipants,
  type CalendarTrip,
} from "./trips.server";

// Booking queries
export {
  getRecentBookings,
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  getBookingsByStatus,
  getBookingWithFullDetails,
  getPaymentsByBookingId,
  recordPayment,
  getMonthlyBookingCount,
  type BookingsByStatus,
} from "./bookings.server";

// Equipment queries
export {
  getEquipment,
  getEquipmentById,
  createEquipment,
  getEquipmentRentalStats,
  getEquipmentRentalHistory,
  getEquipmentServiceHistory,
  updateEquipmentStatus,
  deleteEquipment,
  getEquipmentUtilization,
  type EquipmentServiceRecord,
  type EquipmentUtilization,
} from "./equipment.server";

// Boat queries
export {
  getBoats,
  getAllBoats,
  getBoatById,
  createBoat,
  getBoatRecentTrips,
  getBoatUpcomingTrips,
  getBoatStats,
  updateBoatActiveStatus,
  deleteBoat,
} from "./boats.server";

// Dive site queries
export {
  getDiveSites,
  getDiveSiteById,
  updateDiveSiteActiveStatus,
  deleteDiveSite,
  createDiveSite,
  getDiveSiteStats,
  getRecentTripsForDiveSite,
  getToursUsingDiveSite,
  getDiveSitesForTour,
} from "./dive-sites.server";

// Product queries (retail + POS)
export {
  getProducts,
  getProductById,
  getProductCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  createPOSTransaction,
  getPOSSummary,
  getLowStockProducts,
  getPOSTransactions,
  adjustProductStock,
  type POSTransaction,
} from "./products.server";

// Reports, stats, team, billing, staff queries
export {
  getOrganizationById,
  getDashboardStats,
  getRevenueOverview,
  getTeamMembers,
  getTeamMemberCount,
  getBillingHistory,
  getStaff,
} from "./reports.server";
