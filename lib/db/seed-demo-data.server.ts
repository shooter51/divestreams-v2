import { db } from "./index";
import * as schema from "./schema";

/**
 * Seeds an organization with demo data for testing/demos
 * @param organizationId - The organization ID to seed data for
 */
export async function seedDemoData(organizationId: string): Promise<void> {

  // Demo Customers
  const customers = [
    {
      email: "john.smith@example.com",
      firstName: "John",
      lastName: "Smith",
      phone: "+1-555-0101",
      dateOfBirth: "1985-03-15",
      emergencyContactName: "Jane Smith",
      emergencyContactPhone: "+1-555-0102",
      emergencyContactRelation: "Spouse",
      certifications: [
        { agency: "PADI", level: "Advanced Open Water", number: "1234567", date: "2020-06-15" },
        { agency: "PADI", level: "Nitrox", number: "1234568", date: "2021-03-20" },
      ],
      country: "USA",
      city: "Miami",
      totalDives: 45,
    },
    {
      email: "sarah.jones@example.com",
      firstName: "Sarah",
      lastName: "Jones",
      phone: "+1-555-0103",
      dateOfBirth: "1990-07-22",
      emergencyContactName: "Mike Jones",
      emergencyContactPhone: "+1-555-0104",
      emergencyContactRelation: "Brother",
      certifications: [
        { agency: "SSI", level: "Open Water", number: "SSI-789", date: "2023-01-10" },
      ],
      country: "USA",
      city: "Los Angeles",
      totalDives: 12,
    },
    {
      email: "marco.rossi@example.com",
      firstName: "Marco",
      lastName: "Rossi",
      phone: "+39-555-0105",
      dateOfBirth: "1978-11-30",
      emergencyContactName: "Lucia Rossi",
      emergencyContactPhone: "+39-555-0106",
      emergencyContactRelation: "Wife",
      certifications: [
        { agency: "PADI", level: "Divemaster", number: "DM-45678", date: "2015-08-01" },
        { agency: "PADI", level: "Deep Diver", number: "DD-45679", date: "2016-02-15" },
      ],
      country: "Italy",
      city: "Rome",
      totalDives: 320,
    },
    {
      email: "yuki.tanaka@example.com",
      firstName: "Yuki",
      lastName: "Tanaka",
      phone: "+81-555-0107",
      dateOfBirth: "1995-04-18",
      certifications: [
        { agency: "NAUI", level: "Advanced Scuba Diver", number: "NAUI-12345", date: "2022-05-20" },
      ],
      country: "Japan",
      city: "Tokyo",
      totalDives: 28,
    },
    {
      email: "emma.wilson@example.com",
      firstName: "Emma",
      lastName: "Wilson",
      phone: "+44-555-0108",
      dateOfBirth: "1988-09-05",
      emergencyContactName: "David Wilson",
      emergencyContactPhone: "+44-555-0109",
      emergencyContactRelation: "Father",
      certifications: [
        { agency: "BSAC", level: "Sports Diver", number: "BSAC-567", date: "2019-07-12" },
        { agency: "PADI", level: "Rescue Diver", number: "RD-890", date: "2021-09-30" },
      ],
      country: "UK",
      city: "London",
      totalDives: 85,
    },
    {
      email: "carlos.garcia@example.com",
      firstName: "Carlos",
      lastName: "Garcia",
      phone: "+34-555-0110",
      dateOfBirth: "1992-12-01",
      certifications: [
        { agency: "PADI", level: "Open Water", number: "OW-111", date: "2024-01-15" },
      ],
      country: "Spain",
      city: "Barcelona",
      totalDives: 5,
      notes: "New diver, eager to learn",
    },
    {
      email: "lisa.chen@example.com",
      firstName: "Lisa",
      lastName: "Chen",
      phone: "+1-555-0111",
      dateOfBirth: "1983-06-25",
      emergencyContactName: "Wei Chen",
      emergencyContactPhone: "+1-555-0112",
      emergencyContactRelation: "Husband",
      certifications: [
        { agency: "PADI", level: "Master Scuba Diver", number: "MSD-999", date: "2018-04-22" },
        { agency: "PADI", level: "Underwater Photography", number: "UP-1000", date: "2019-01-10" },
      ],
      country: "USA",
      city: "San Francisco",
      totalDives: 210,
      tags: ["VIP", "Photography"],
    },
    {
      email: "james.brown@example.com",
      firstName: "James",
      lastName: "Brown",
      phone: "+1-555-0113",
      dateOfBirth: "1975-02-14",
      certifications: [
        { agency: "PADI", level: "Instructor", number: "INST-555", date: "2010-06-01" },
      ],
      country: "Australia",
      city: "Sydney",
      totalDives: 1500,
      tags: ["Instructor", "Referral Partner"],
    },
  ];

  const customerIds: string[] = [];
  for (const customer of customers) {
    const [inserted] = await db
      .insert(schema.customers)
      .values({
        organizationId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        dateOfBirth: customer.dateOfBirth,
        emergencyContactName: customer.emergencyContactName,
        emergencyContactPhone: customer.emergencyContactPhone,
        emergencyContactRelation: customer.emergencyContactRelation,
        certifications: customer.certifications,
        country: customer.country,
        city: customer.city,
        totalDives: customer.totalDives || 0,
        notes: customer.notes,
        tags: customer.tags,
      })
      .returning({ id: schema.customers.id });
    customerIds.push(inserted.id);
  }

  // Demo Dive Sites
  const diveSites = [
    {
      name: "Coral Garden",
      description: "Beautiful shallow reef perfect for beginners and snorkelers. Abundant coral formations and tropical fish.",
      latitude: "18.4655",
      longitude: "-64.6321",
      maxDepth: 12,
      minDepth: 3,
      difficulty: "beginner",
      currentStrength: "mild",
      visibility: "20-30m",
      highlights: ["Coral formations", "Tropical fish", "Sea turtles", "Easy entry"],
    },
    {
      name: "The Wall",
      description: "Dramatic drop-off starting at 15m, descending to 40m+. Advanced site with strong currents and pelagic life.",
      latitude: "18.4521",
      longitude: "-64.6489",
      maxDepth: 40,
      minDepth: 15,
      difficulty: "advanced",
      currentStrength: "strong",
      visibility: "25-40m",
      highlights: ["Wall dive", "Eagle rays", "Sharks", "Barracuda"],
    },
    {
      name: "Shipwreck Bay",
      description: "Historic cargo ship sunk in 1985, now home to diverse marine life. Penetration possible for certified divers.",
      latitude: "18.4789",
      longitude: "-64.6156",
      maxDepth: 28,
      minDepth: 18,
      difficulty: "intermediate",
      currentStrength: "moderate",
      visibility: "15-25m",
      highlights: ["Wreck penetration", "Moray eels", "Lobsters", "Groupers"],
    },
    {
      name: "Blue Hole",
      description: "Stunning underwater sinkhole with crystal clear water. Features unique geological formations and cave systems.",
      latitude: "18.4412",
      longitude: "-64.6578",
      maxDepth: 35,
      minDepth: 10,
      difficulty: "intermediate",
      currentStrength: "calm",
      visibility: "30-50m",
      highlights: ["Cave diving", "Stalactites", "Crystal clear water", "Light effects"],
    },
    {
      name: "Manta Point",
      description: "Cleaning station where manta rays are frequently spotted. Seasonal but spectacular when conditions are right.",
      latitude: "18.4856",
      longitude: "-64.6234",
      maxDepth: 22,
      minDepth: 8,
      difficulty: "intermediate",
      currentStrength: "moderate",
      visibility: "20-35m",
      highlights: ["Manta rays", "Cleaning station", "Reef sharks", "Schooling fish"],
    },
  ];

  const diveSiteIds: string[] = [];
  for (const site of diveSites) {
    const [inserted] = await db
      .insert(schema.diveSites)
      .values({
        organizationId,
        name: site.name,
        description: site.description,
        latitude: site.latitude,
        longitude: site.longitude,
        maxDepth: site.maxDepth,
        minDepth: site.minDepth,
        difficulty: site.difficulty,
        currentStrength: site.currentStrength,
        visibility: site.visibility,
        highlights: site.highlights,
      })
      .returning({ id: schema.diveSites.id });
    diveSiteIds.push(inserted.id);
  }

  // Demo Boats
  const boats = [
    {
      name: "Ocean Explorer",
      description: "Our flagship dive boat with spacious deck, rinse tanks, and comfortable seating for up to 20 divers.",
      capacity: 20,
      type: "catamaran",
      registrationNumber: "DV-2024-001",
      amenities: ["Rinse tanks", "Camera table", "Shaded deck", "Hot drinks", "Restroom"],
    },
    {
      name: "Reef Runner",
      description: "Fast speedboat for quick trips to nearby dive sites. Perfect for small groups and private charters.",
      capacity: 8,
      type: "speedboat",
      registrationNumber: "DV-2024-002",
      amenities: ["Shade cover", "Cooler", "First aid kit"],
    },
  ];

  const boatIds: string[] = [];
  for (const boat of boats) {
    const [inserted] = await db
      .insert(schema.boats)
      .values({
        organizationId,
        name: boat.name,
        description: boat.description,
        capacity: boat.capacity,
        type: boat.type,
        registrationNumber: boat.registrationNumber,
        amenities: boat.amenities,
      })
      .returning({ id: schema.boats.id });
    boatIds.push(inserted.id);
  }

  // Demo Equipment
  const equipmentItems = [
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "M", rentalPrice: "15.00" },
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "L", rentalPrice: "15.00" },
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "XL", rentalPrice: "15.00" },
    { category: "regulator", name: "Scubapro MK25/S600", brand: "Scubapro", rentalPrice: "20.00" },
    { category: "regulator", name: "Scubapro MK25/S600", brand: "Scubapro", rentalPrice: "20.00" },
    { category: "regulator", name: "Aqualung Core", brand: "Aqua Lung", rentalPrice: "18.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "S", rentalPrice: "10.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "M", rentalPrice: "10.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "L", rentalPrice: "10.00" },
    { category: "wetsuit", name: "5mm Full Suit", brand: "Bare", size: "M", rentalPrice: "12.00" },
    { category: "mask", name: "Cressi Big Eyes", brand: "Cressi", rentalPrice: "5.00" },
    { category: "mask", name: "Cressi Big Eyes", brand: "Cressi", rentalPrice: "5.00" },
    { category: "fins", name: "Mares Avanti", brand: "Mares", size: "M", rentalPrice: "8.00" },
    { category: "fins", name: "Mares Avanti", brand: "Mares", size: "L", rentalPrice: "8.00" },
    { category: "computer", name: "Suunto Zoop", brand: "Suunto", rentalPrice: "25.00" },
    { category: "computer", name: "Shearwater Peregrine", brand: "Shearwater", rentalPrice: "35.00" },
    { category: "tank", name: "Aluminum 80", brand: "Luxfer", rentalPrice: "10.00" },
    { category: "tank", name: "Aluminum 80", brand: "Luxfer", rentalPrice: "10.00" },
    { category: "tank", name: "Steel 100", brand: "Faber", rentalPrice: "12.00" },
    { category: "torch", name: "BigBlue AL1200", brand: "BigBlue", rentalPrice: "15.00" },
  ];

  for (const item of equipmentItems) {
    await db.insert(schema.equipment).values({
      organizationId,
      category: item.category,
      name: item.name,
      brand: item.brand,
      size: item.size,
      rentalPrice: item.rentalPrice,
      isRentable: true,
      status: "available",
      condition: "good",
    });
  }

  // Demo Tours
  const tours = [
    {
      name: "Discover Scuba Diving",
      description: "Perfect introduction to diving! No experience needed. Learn basics in confined water then enjoy a shallow reef dive.",
      type: "course",
      duration: 240,
      maxParticipants: 4,
      minParticipants: 1,
      price: "150.00",
      includesEquipment: true,
      includesMeals: false,
      includesTransport: false,
      inclusions: ["All equipment", "Professional instructor", "Pool session", "One reef dive", "Photos"],
      minAge: 10,
    },
    {
      name: "Two Tank Morning Dive",
      description: "Our most popular trip! Two dives at different sites with surface interval snacks and drinks.",
      type: "multi_dive",
      duration: 300,
      maxParticipants: 16,
      minParticipants: 4,
      price: "120.00",
      includesEquipment: false,
      includesMeals: true,
      includesTransport: false,
      inclusions: ["Two tank dives", "Light snacks", "Drinks", "Towels"],
      exclusions: ["Equipment rental", "Gratuity"],
      minCertLevel: "Open Water",
    },
    {
      name: "Night Dive Adventure",
      description: "Experience the reef after dark! See nocturnal creatures and bioluminescence on this magical evening dive.",
      type: "single_dive",
      duration: 180,
      maxParticipants: 8,
      minParticipants: 2,
      price: "85.00",
      includesEquipment: false,
      includesMeals: false,
      includesTransport: false,
      inclusions: ["Torch rental", "Light sticks", "Hot drinks after dive"],
      minCertLevel: "Advanced Open Water",
      requirements: ["Minimum 20 logged dives", "Must bring own primary light"],
    },
    {
      name: "Wreck Explorer",
      description: "Explore the famous cargo ship wreck with an experienced guide. External and limited penetration available.",
      type: "single_dive",
      duration: 180,
      maxParticipants: 6,
      minParticipants: 2,
      price: "95.00",
      includesEquipment: false,
      includesMeals: false,
      includesTransport: false,
      inclusions: ["Wreck briefing", "Experienced guide"],
      minCertLevel: "Advanced Open Water",
      requirements: ["Wreck certification for penetration"],
    },
    {
      name: "Snorkel Safari",
      description: "Perfect for non-divers! Visit three snorkel spots and see turtles, rays, and colorful fish.",
      type: "snorkel",
      duration: 240,
      maxParticipants: 20,
      minParticipants: 4,
      price: "65.00",
      includesEquipment: true,
      includesMeals: true,
      includesTransport: false,
      inclusions: ["Snorkel equipment", "Light lunch", "Drinks", "Three snorkel spots"],
      minAge: 6,
    },
  ];

  const tourIds: string[] = [];
  for (const tour of tours) {
    const [inserted] = await db
      .insert(schema.tours)
      .values({
        organizationId,
        name: tour.name,
        description: tour.description,
        type: tour.type,
        duration: tour.duration,
        maxParticipants: tour.maxParticipants,
        minParticipants: tour.minParticipants,
        price: tour.price,
        includesEquipment: tour.includesEquipment,
        includesMeals: tour.includesMeals,
        includesTransport: tour.includesTransport,
        inclusions: tour.inclusions,
        exclusions: tour.exclusions,
        minCertLevel: tour.minCertLevel,
        minAge: tour.minAge,
        requirements: tour.requirements,
      })
      .returning({ id: schema.tours.id });
    tourIds.push(inserted.id);
  }

  // Link tours to dive sites
  await db.insert(schema.tourDiveSites).values([
    { organizationId, tourId: tourIds[0], diveSiteId: diveSiteIds[0], order: 1 }, // Discover -> Coral Garden
    { organizationId, tourId: tourIds[1], diveSiteId: diveSiteIds[0], order: 1 }, // Two Tank -> Coral Garden
    { organizationId, tourId: tourIds[1], diveSiteId: diveSiteIds[4], order: 2 }, // Two Tank -> Manta Point
    { organizationId, tourId: tourIds[2], diveSiteId: diveSiteIds[0], order: 1 }, // Night Dive -> Coral Garden
    { organizationId, tourId: tourIds[3], diveSiteId: diveSiteIds[2], order: 1 }, // Wreck -> Shipwreck Bay
    { organizationId, tourId: tourIds[4], diveSiteId: diveSiteIds[0], order: 1 }, // Snorkel -> Coral Garden
  ]);

  // Demo Trips (scheduled in the coming weeks)
  const today = new Date();
  const trips = [
    // Tomorrow
    { tourIdx: 1, boatIdx: 0, daysFromNow: 1, startTime: "08:00", endTime: "13:00" },
    { tourIdx: 4, boatIdx: 1, daysFromNow: 1, startTime: "09:00", endTime: "13:00" },
    // Day after
    { tourIdx: 0, boatIdx: 1, daysFromNow: 2, startTime: "09:00", endTime: "13:00" },
    { tourIdx: 1, boatIdx: 0, daysFromNow: 2, startTime: "08:00", endTime: "13:00" },
    // 3 days
    { tourIdx: 2, boatIdx: 0, daysFromNow: 3, startTime: "17:30", endTime: "20:30" },
    { tourIdx: 1, boatIdx: 0, daysFromNow: 3, startTime: "08:00", endTime: "13:00" },
    // 5 days
    { tourIdx: 3, boatIdx: 0, daysFromNow: 5, startTime: "08:30", endTime: "12:00" },
    { tourIdx: 1, boatIdx: 0, daysFromNow: 5, startTime: "13:30", endTime: "18:00" },
    // Week out
    { tourIdx: 1, boatIdx: 0, daysFromNow: 7, startTime: "08:00", endTime: "13:00" },
    { tourIdx: 4, boatIdx: 1, daysFromNow: 7, startTime: "09:00", endTime: "13:00" },
    { tourIdx: 0, boatIdx: 1, daysFromNow: 8, startTime: "09:00", endTime: "13:00" },
    // Two weeks
    { tourIdx: 1, boatIdx: 0, daysFromNow: 14, startTime: "08:00", endTime: "13:00" },
    { tourIdx: 2, boatIdx: 0, daysFromNow: 15, startTime: "17:30", endTime: "20:30" },
  ];

  const tripIds: string[] = [];
  for (const trip of trips) {
    const tripDate = new Date(today);
    tripDate.setDate(tripDate.getDate() + trip.daysFromNow);
    const dateStr = tripDate.toISOString().split("T")[0];

    const [inserted] = await db
      .insert(schema.trips)
      .values({
        organizationId,
        tourId: tourIds[trip.tourIdx],
        boatId: boatIds[trip.boatIdx],
        date: dateStr,
        startTime: trip.startTime,
        endTime: trip.endTime,
        status: "scheduled",
      })
      .returning({ id: schema.trips.id });
    tripIds.push(inserted.id);
  }

  // Demo Bookings
  const bookings = [
    { tripIdx: 0, customerIdx: 0, participants: 2, status: "confirmed", paymentStatus: "paid" },
    { tripIdx: 0, customerIdx: 2, participants: 1, status: "confirmed", paymentStatus: "paid" },
    { tripIdx: 1, customerIdx: 3, participants: 3, status: "confirmed", paymentStatus: "partial" },
    { tripIdx: 2, customerIdx: 5, participants: 1, status: "pending", paymentStatus: "pending" },
    { tripIdx: 3, customerIdx: 4, participants: 2, status: "confirmed", paymentStatus: "paid" },
    { tripIdx: 4, customerIdx: 6, participants: 1, status: "confirmed", paymentStatus: "paid" },
    { tripIdx: 5, customerIdx: 1, participants: 2, status: "confirmed", paymentStatus: "partial" },
    { tripIdx: 8, customerIdx: 7, participants: 4, status: "pending", paymentStatus: "pending" },
  ];

  // Tour prices for calculating totals
  const tourPrices = [150, 120, 85, 95, 65];

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const tripData = trips[booking.tripIdx];
    const price = tourPrices[tripData.tourIdx];
    const subtotal = price * booking.participants;
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    const paidAmount = booking.paymentStatus === "paid" ? total : booking.paymentStatus === "partial" ? total * 0.5 : 0;

    await db.insert(schema.bookings).values({
      organizationId,
      bookingNumber: `BK-${String(1000 + i).padStart(4, "0")}`,
      tripId: tripIds[booking.tripIdx],
      customerId: customerIds[booking.customerIdx],
      participants: booking.participants,
      status: booking.status,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      paymentStatus: booking.paymentStatus,
      paidAmount: paidAmount.toFixed(2),
      source: "direct",
    });
  }

  console.log(`Demo data seeded for organization: ${organizationId}`);
}
