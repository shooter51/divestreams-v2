// Test data fixtures for DiveStreams tests

export const testCustomers = [
  {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1-555-0101",
    certificationLevel: "Advanced Open Water",
    certificationAgency: "PADI",
    emergencyContact: "Jane Doe",
    emergencyPhone: "+1-555-0102",
  },
  {
    id: 2,
    firstName: "Sarah",
    lastName: "Smith",
    email: "sarah.smith@example.com",
    phone: "+1-555-0201",
    certificationLevel: "Open Water",
    certificationAgency: "SSI",
    emergencyContact: "Mike Smith",
    emergencyPhone: "+1-555-0202",
  },
  {
    id: 3,
    firstName: "Carlos",
    lastName: "Garcia",
    email: "carlos.garcia@example.com",
    phone: "+34-555-0301",
    certificationLevel: "Rescue Diver",
    certificationAgency: "PADI",
    emergencyContact: "Maria Garcia",
    emergencyPhone: "+34-555-0302",
  },
];

export const testDiveSites = [
  {
    id: 1,
    name: "Coral Paradise",
    location: "South Bay",
    maxDepth: 25.0,
    difficulty: "beginner",
    description: "Beautiful coral reef with abundant marine life",
    gpsCoordinates: "25.7617, -80.1918",
  },
  {
    id: 2,
    name: "Wreck of the Neptune",
    location: "Deep Water Marina",
    maxDepth: 40.0,
    difficulty: "advanced",
    description: "Historic shipwreck with excellent visibility",
    gpsCoordinates: "25.8000, -80.1200",
  },
  {
    id: 3,
    name: "Blue Hole",
    location: "North Point",
    maxDepth: 60.0,
    difficulty: "expert",
    description: "Deep cave system for technical divers",
    gpsCoordinates: "25.9000, -80.0500",
  },
];

export const testBoats = [
  {
    id: 1,
    name: "Sea Explorer",
    capacity: 12,
    description: "Comfortable dive boat with full amenities",
    isActive: true,
  },
  {
    id: 2,
    name: "Ocean Rider",
    capacity: 8,
    description: "Fast speedboat for quick trips",
    isActive: true,
  },
];

export const testTours = [
  {
    id: 1,
    name: "Beginner Discovery Dive",
    description: "Perfect for first-time divers",
    duration: "3 hours",
    price: 99.0,
    maxParticipants: 6,
    difficulty: "beginner",
    includes: "Equipment, instruction, snacks",
    isActive: true,
  },
  {
    id: 2,
    name: "Advanced Reef Exploration",
    description: "Deep reef dive for certified divers",
    duration: "4 hours",
    price: 149.0,
    maxParticipants: 8,
    difficulty: "advanced",
    includes: "Tanks, weights, lunch",
    isActive: true,
  },
  {
    id: 3,
    name: "Night Dive Adventure",
    description: "Experience the reef after dark",
    duration: "3 hours",
    price: 129.0,
    maxParticipants: 4,
    difficulty: "intermediate",
    includes: "Dive lights, equipment, refreshments",
    isActive: true,
  },
];

// Dynamic dates relative to now (avoid hardcoded past dates that break over time)
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

export const testTrips = [
  {
    id: 1,
    tourId: 1,
    boatId: 1,
    date: tomorrow,
    time: "09:00",
    availableSpots: 4,
    status: "scheduled",
  },
  {
    id: 2,
    tourId: 2,
    boatId: 1,
    date: tomorrow,
    time: "14:00",
    availableSpots: 6,
    status: "scheduled",
  },
  {
    id: 3,
    tourId: 3,
    boatId: 2,
    date: nextWeek,
    time: "19:00",
    availableSpots: 3,
    status: "scheduled",
  },
];

export const testBookings = [
  {
    id: 1,
    bookingNumber: "BK-2025-0001",
    customerId: 1,
    tripId: 1,
    participants: 2,
    total: 198.0,
    paidAmount: 198.0,
    status: "confirmed",
    createdAt: lastWeek,
  },
  {
    id: 2,
    bookingNumber: "BK-2025-0002",
    customerId: 2,
    tripId: 2,
    participants: 1,
    total: 149.0,
    paidAmount: 50.0,
    status: "pending",
    createdAt: lastWeek,
  },
  {
    id: 3,
    bookingNumber: "BK-2025-0003",
    customerId: 3,
    tripId: 3,
    participants: 2,
    total: 258.0,
    paidAmount: 0,
    status: "pending",
    createdAt: lastWeek,
  },
];

export const testPayments = [
  {
    id: 1,
    bookingId: 1,
    amount: 198.0,
    method: "card",
    stripePaymentId: "pi_test_001",
    status: "succeeded",
    createdAt: lastWeek,
  },
  {
    id: 2,
    bookingId: 2,
    amount: 50.0,
    method: "card",
    stripePaymentId: "pi_test_002",
    status: "succeeded",
    createdAt: lastWeek,
  },
];

export const testTenant = {
  id: 1,
  subdomain: "testshop",
  name: "Test Dive Shop",
  email: "owner@testshop.com",
  phone: "+1-555-1000",
  schemaName: "tenant_testshop",
  timezone: "America/New_York",
  currency: "USD",
  isActive: true,
  createdAt: lastWeek,
};

export const testAdminCredentials = {
  password: "TestAdmin123",
  invalidPassword: "wrongpassword",
};

// Helper to create a mock request with tenant context
export const createMockRequest = (
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    subdomain?: string;
  } = {}
) => {
  const { method = "GET", headers = {}, body, subdomain = "testshop" } = options;

  const requestUrl = new URL(url, `http://${subdomain}.localhost:5173`);

  return new Request(requestUrl.toString(), {
    method,
    headers: new Headers({
      host: `${subdomain}.localhost:5173`,
      ...headers,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
};

// Helper to create FormData for action tests
export const createFormData = (data: Record<string, string>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
};
