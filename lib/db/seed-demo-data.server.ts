import { db } from "./index";
import * as schema from "./schema";
import { eq, and } from "drizzle-orm";
import { organization } from "./schema/auth";

// ============================================================================
// DEMO IMAGE URLS - Using Unsplash for realistic diving photos
// ============================================================================

const DEMO_IMAGES = {
  diveSites: {
    coralGarden: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200", // Coral reef
      "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200", // Underwater coral
      "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1200", // Fish on reef
    ],
    theWall: [
      "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1200", // Deep blue wall
      "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200", // Diver on wall
    ],
    shipwreck: [
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200", // Shipwreck underwater
      "https://images.unsplash.com/photo-1580019542155-247062e19ce4?w=1200", // Wreck dive
    ],
    blueHole: [
      "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200", // Blue underwater cave
      "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=1200", // Light in cave
    ],
    mantaPoint: [
      "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=1200", // Manta ray
      "https://images.unsplash.com/photo-1596414086775-0e7a7e6d381c?w=1200", // Ray underwater
    ],
  },
  boats: {
    catamaran: [
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200", // Dive boat
      "https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=1200", // Boat on water
    ],
    speedboat: [
      "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1200", // Speedboat
    ],
  },
  tours: {
    discoverScuba: [
      "https://images.unsplash.com/photo-1544551763-8dd44758c2dd?w=1200", // Beginner diver
      "https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=1200", // Pool training
    ],
    twoTankDive: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200", // Reef diving
      "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200", // Underwater
      "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200", // Group dive
    ],
    nightDive: [
      "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200", // Dark underwater
      "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=1200", // Light beam
    ],
    wreckExplorer: [
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200", // Wreck
      "https://images.unsplash.com/photo-1580019542155-247062e19ce4?w=1200", // Inside wreck
    ],
    snorkelSafari: [
      "https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=1200", // Snorkeling
      "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=1200", // Marine life
    ],
  },
  products: {
    bcdAqualung: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    bcdScubapro: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400",
    regScubapro: "https://images.unsplash.com/photo-1583531172005-814785a25a02?w=400",
    regAqualung: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
    maskCressi: "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=400",
    maskScubapro: "https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=400",
    finsMaresAvanti: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400",
    finsScubapro: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    wetsuitBare3mm: "https://images.unsplash.com/photo-1585155770005-76b2e4cf7c70?w=400",
    wetsuitBare5mm: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400",
    computerShearwater: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400",
    computerSuunto: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    lightBigblue: "https://images.unsplash.com/photo-1580019542155-247062e19ce0?w=400",
    lightTovatec: "https://images.unsplash.com/photo-1580019542155-247062e19ce0?w=400",
    smbKit: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    knife: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400",
    antiFog: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    slate: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    dryBag: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    sunscreen: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    maskStrap: "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=400",
    logbook: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    tshirt: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
    hoodie: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    rashGuard: "https://images.unsplash.com/photo-1585155770005-76b2e4cf7c70?w=400",
    truckerCap: "https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=400",
    stickerPack: "https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=400",
    cameraSeaLife: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
  },
};

/**
 * Seeds an organization with demo data for testing/demos
 * @param organizationId - The organization ID to seed data for
 */
export async function seedDemoData(organizationId: string): Promise<void> {
  // Verify organization exists
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  // Check if data already exists for this organization
  const [existingCustomer] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.organizationId, organizationId))
    .limit(1);

  if (existingCustomer) {
    console.log(`⚠️  Demo data already exists for organization ${organizationId}, skipping seed`);
    return;
  }

  // Demo Customers (14 total)
  const customers = [
    {
      email: "john.smith@example.com", firstName: "John", lastName: "Smith",
      phone: "+1-555-0101", dateOfBirth: "1985-03-15",
      emergencyContactName: "Jane Smith", emergencyContactPhone: "+1-555-0102", emergencyContactRelation: "Spouse",
      certifications: [
        { agency: "PADI", level: "Advanced Open Water", number: "1234567", date: "2020-06-15" },
        { agency: "PADI", level: "Nitrox", number: "1234568", date: "2021-03-20" },
      ],
      country: "USA", city: "Miami", address: "742 Ocean Drive", state: "FL", postalCode: "33139",
      medicalConditions: "Mild asthma, well-controlled", medications: "Albuterol inhaler (as needed)",
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 45, totalSpent: "2850.00", lastDiveAt: new Date("2026-01-20T14:00:00Z"),
    },
    {
      email: "sarah.jones@example.com", firstName: "Sarah", lastName: "Jones",
      phone: "+1-555-0103", dateOfBirth: "1990-07-22",
      emergencyContactName: "Mike Jones", emergencyContactPhone: "+1-555-0104", emergencyContactRelation: "Brother",
      certifications: [
        { agency: "SSI", level: "Open Water", number: "SSI-789", date: "2023-01-10" },
      ],
      country: "USA", city: "Los Angeles", address: "1250 Sunset Blvd Apt 4B", state: "CA", postalCode: "90026",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 12, totalSpent: "1450.00", lastDiveAt: new Date("2025-11-05T09:30:00Z"),
    },
    {
      email: "marco.rossi@example.com", firstName: "Marco", lastName: "Rossi",
      phone: "+39-555-0105", dateOfBirth: "1978-11-30",
      emergencyContactName: "Lucia Rossi", emergencyContactPhone: "+39-555-0106", emergencyContactRelation: "Wife",
      certifications: [
        { agency: "PADI", level: "Divemaster", number: "DM-45678", date: "2015-08-01" },
        { agency: "PADI", level: "Deep Diver", number: "DD-45679", date: "2016-02-15" },
      ],
      country: "Italy", city: "Rome", address: "Via del Corso 218", state: "Lazio", postalCode: "00186",
      medicalConditions: null, medications: null,
      preferredLanguage: "it", marketingOptIn: true,
      totalDives: 320, totalSpent: "4500.00", lastDiveAt: new Date("2026-02-08T08:00:00Z"),
    },
    {
      email: "yuki.tanaka@example.com", firstName: "Yuki", lastName: "Tanaka",
      phone: "+81-555-0107", dateOfBirth: "1995-04-18",
      emergencyContactName: "Hiro Tanaka", emergencyContactPhone: "+81-555-0108", emergencyContactRelation: "Father",
      certifications: [
        { agency: "NAUI", level: "Advanced Scuba Diver", number: "NAUI-12345", date: "2022-05-20" },
      ],
      country: "Japan", city: "Tokyo", address: "3-14-1 Shibuya", state: "Tokyo", postalCode: "150-0002",
      medicalConditions: null, medications: null,
      preferredLanguage: "ja", marketingOptIn: false,
      totalDives: 28, totalSpent: "1800.00", lastDiveAt: new Date("2025-12-28T10:00:00Z"),
    },
    {
      email: "emma.wilson@example.com", firstName: "Emma", lastName: "Wilson",
      phone: "+44-555-0108", dateOfBirth: "1988-09-05",
      emergencyContactName: "David Wilson", emergencyContactPhone: "+44-555-0109", emergencyContactRelation: "Father",
      certifications: [
        { agency: "BSAC", level: "Sports Diver", number: "BSAC-567", date: "2019-07-12" },
        { agency: "PADI", level: "Rescue Diver", number: "RD-890", date: "2021-09-30" },
      ],
      country: "UK", city: "London", address: "48 Camden High Street", state: "Greater London", postalCode: "NW1 0LT",
      medicalConditions: "Seasonal allergies", medications: "Cetirizine (seasonal)",
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 85, totalSpent: "2600.00", lastDiveAt: new Date("2026-01-15T11:00:00Z"),
    },
    {
      email: "carlos.garcia@example.com", firstName: "Carlos", lastName: "Garcia",
      phone: "+34-555-0110", dateOfBirth: "1992-12-01",
      emergencyContactName: "Maria Garcia", emergencyContactPhone: "+34-555-0111", emergencyContactRelation: "Mother",
      certifications: [
        { agency: "PADI", level: "Open Water", number: "OW-111", date: "2024-01-15" },
      ],
      country: "Spain", city: "Barcelona", address: "Carrer de Balmes 55", state: "Catalonia", postalCode: "08007",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 5, totalSpent: "680.00", lastDiveAt: new Date("2025-09-20T13:00:00Z"),
      notes: "New diver, eager to learn",
    },
    {
      email: "lisa.chen@example.com", firstName: "Lisa", lastName: "Chen",
      phone: "+1-555-0111", dateOfBirth: "1983-06-25",
      emergencyContactName: "Wei Chen", emergencyContactPhone: "+1-555-0112", emergencyContactRelation: "Husband",
      certifications: [
        { agency: "PADI", level: "Master Scuba Diver", number: "MSD-999", date: "2018-04-22" },
        { agency: "PADI", level: "Underwater Photography", number: "UP-1000", date: "2019-01-10" },
      ],
      country: "USA", city: "San Francisco", address: "1890 Pacific Ave", state: "CA", postalCode: "94109",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: false,
      totalDives: 210, totalSpent: "3200.00", lastDiveAt: new Date("2026-02-01T07:30:00Z"),
      tags: ["VIP", "Photography"],
    },
    {
      email: "james.brown@example.com", firstName: "James", lastName: "Brown",
      phone: "+1-555-0113", dateOfBirth: "1975-02-14",
      emergencyContactName: "Karen Brown", emergencyContactPhone: "+61-555-0114", emergencyContactRelation: "Wife",
      certifications: [
        { agency: "PADI", level: "Instructor", number: "INST-555", date: "2010-06-01" },
      ],
      country: "Australia", city: "Sydney", address: "22 Bondi Road", state: "NSW", postalCode: "2026",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: false,
      totalDives: 1500, totalSpent: "1200.00", lastDiveAt: new Date("2026-02-12T06:00:00Z"),
      tags: ["Instructor", "Referral Partner"],
    },
    {
      email: "fatima.alrashid@example.com", firstName: "Fatima", lastName: "Al-Rashid",
      phone: "+971-55-123-4567", dateOfBirth: "1991-08-12",
      emergencyContactName: "Ahmed Al-Rashid", emergencyContactPhone: "+971-55-987-6543", emergencyContactRelation: "Husband",
      certifications: [
        { agency: "PADI", level: "Advanced Open Water", number: "AOW-87234", date: "2023-03-18" },
        { agency: "PADI", level: "Nitrox", number: "NX-87235", date: "2023-04-02" },
      ],
      country: "UAE", city: "Dubai", address: "Building 14, Marina Walk", state: "Dubai", postalCode: "00000",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 65, totalSpent: "5200.00", lastDiveAt: new Date("2026-01-28T08:00:00Z"),
      notes: "Prefers luxury dive packages. Corporate event inquiries.",
      tags: ["VIP", "Corporate"],
    },
    {
      email: "hans.mueller@example.com", firstName: "Hans", lastName: "Mueller",
      phone: "+49-170-555-2233", dateOfBirth: "1980-05-22",
      emergencyContactName: "Greta Mueller", emergencyContactPhone: "+49-170-555-4455", emergencyContactRelation: "Wife",
      certifications: [
        { agency: "PADI", level: "Divemaster", number: "DM-DE-33201", date: "2012-07-15" },
        { agency: "PADI", level: "Nitrox", number: "NX-DE-33202", date: "2012-08-01" },
        { agency: "PADI", level: "Deep Diver", number: "DD-DE-33203", date: "2013-05-10" },
      ],
      country: "Germany", city: "Munich", address: "Leopoldstraße 42", state: "Bavaria", postalCode: "80802",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 450, totalSpent: "3800.00", lastDiveAt: new Date("2026-02-05T07:00:00Z"),
      notes: "Assists with beginner courses when visiting. Sends referrals regularly.",
      tags: ["Instructor", "Referral Partner"],
    },
    {
      email: "priya.sharma@example.com", firstName: "Priya", lastName: "Sharma",
      phone: "+91-98765-43210", dateOfBirth: "1997-01-09",
      emergencyContactName: "Raj Sharma", emergencyContactPhone: "+91-98765-43211", emergencyContactRelation: "Father",
      certifications: [
        { agency: "PADI", level: "Open Water", number: "OW-IN-56012", date: "2025-11-20" },
      ],
      country: "India", city: "Mumbai", address: "Flat 702, Sea Breeze Tower, Bandra West", state: "Maharashtra", postalCode: "400050",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 8, totalSpent: "720.00", lastDiveAt: new Date("2025-12-15T10:00:00Z"),
      notes: "First international dive trip. Very enthusiastic, wants to progress to Advanced OW.",
      tags: [],
    },
    {
      email: "diego.santos@example.com", firstName: "Diego", lastName: "Santos",
      phone: "+55-11-99876-5432", dateOfBirth: "1986-10-03",
      emergencyContactName: "Ana Santos", emergencyContactPhone: "+55-11-99876-5433", emergencyContactRelation: "Sister",
      certifications: [
        { agency: "PADI", level: "Rescue Diver", number: "RD-BR-44890", date: "2021-02-28" },
        { agency: "PADI", level: "Nitrox", number: "NX-BR-44891", date: "2020-06-15" },
      ],
      country: "Brazil", city: "São Paulo", address: "Rua Augusta 1508, Apt 12", state: "SP", postalCode: "01304-001",
      medicalConditions: "Corrective lenses (wears prescription mask)", medications: null,
      preferredLanguage: "en", marketingOptIn: false,
      totalDives: 180, totalSpent: "2950.00", lastDiveAt: new Date("2026-01-10T09:00:00Z"),
      notes: "Travels for dive trips 3-4 times per year. Owns all equipment.",
      tags: ["Repeat Customer"],
    },
    {
      email: "keiko.yamamoto@example.com", firstName: "Keiko", lastName: "Yamamoto",
      phone: "+81-90-1234-5678", dateOfBirth: "1993-06-14",
      emergencyContactName: "Takeshi Yamamoto", emergencyContactPhone: "+81-90-8765-4321", emergencyContactRelation: "Brother",
      certifications: [
        { agency: "PADI", level: "Advanced Open Water", number: "AOW-JP-78210", date: "2024-04-10" },
      ],
      country: "Japan", city: "Okinawa", address: "2-5-8 Makishi, Naha", state: "Okinawa", postalCode: "900-0013",
      medicalConditions: null, medications: null,
      preferredLanguage: "ja", marketingOptIn: true,
      totalDives: 95, totalSpent: "2100.00", lastDiveAt: new Date("2026-02-10T08:30:00Z"),
      notes: "Local diver, dives most weekends. Interested in underwater photography.",
      tags: [],
    },
    {
      email: "robert.obrien@example.com", firstName: "Robert", lastName: "O'Brien",
      phone: "+353-87-555-1234", dateOfBirth: "2000-03-28",
      emergencyContactName: "Siobhan O'Brien", emergencyContactPhone: "+353-87-555-5678", emergencyContactRelation: "Mother",
      certifications: [
        { agency: "PADI", level: "Open Water", number: "OW-IE-91003", date: "2026-01-25" },
      ],
      country: "Ireland", city: "Dublin", address: "15 Grafton Street, Apt 3", state: "Dublin", postalCode: "D02 VF25",
      medicalConditions: null, medications: null,
      preferredLanguage: "en", marketingOptIn: true,
      totalDives: 4, totalSpent: "520.00", lastDiveAt: new Date("2026-01-25T12:00:00Z"),
      notes: "Recently certified. Planning first dive trip abroad. University student.",
      tags: ["Student"],
    },
  ];

  // Insert customers into PUBLIC schema with organizationId
  const customerIds: string[] = [];
  for (const customer of customers) {
    const [result] = await db
      .insert(schema.customers)
      .values({
        organizationId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone || null,
        dateOfBirth: customer.dateOfBirth || null,
        emergencyContactName: customer.emergencyContactName || null,
        emergencyContactPhone: customer.emergencyContactPhone || null,
        emergencyContactRelation: customer.emergencyContactRelation || null,
        certifications: customer.certifications || [],
        country: customer.country || null,
        city: customer.city || null,
        address: customer.address || null,
        state: customer.state || null,
        postalCode: customer.postalCode || null,
        medicalConditions: customer.medicalConditions ?? null,
        medications: customer.medications ?? null,
        preferredLanguage: customer.preferredLanguage || null,
        marketingOptIn: customer.marketingOptIn ?? false,
        totalDives: customer.totalDives || 0,
        totalSpent: customer.totalSpent || null,
        lastDiveAt: customer.lastDiveAt || null,
        notes: customer.notes || null,
        tags: customer.tags || [],
      })
      .returning({ id: schema.customers.id });

    if (result) {
      customerIds.push(result.id);
    }
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
      images: DEMO_IMAGES.diveSites.coralGarden,
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
      images: DEMO_IMAGES.diveSites.theWall,
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
      images: DEMO_IMAGES.diveSites.shipwreck,
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
      images: DEMO_IMAGES.diveSites.blueHole,
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
      images: DEMO_IMAGES.diveSites.mantaPoint,
    },
  ];

  // Insert dive sites into PUBLIC schema with organizationId
  const diveSiteIds: string[] = [];
  for (const site of diveSites) {
    const [result] = await db
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
        images: site.images,
      })
      .returning({ id: schema.diveSites.id });

    if (result) {
      diveSiteIds.push(result.id);
    }
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
      images: DEMO_IMAGES.boats.catamaran,
    },
    {
      name: "Reef Runner",
      description: "Fast speedboat for quick trips to nearby dive sites. Perfect for small groups and private charters.",
      capacity: 8,
      type: "speedboat",
      registrationNumber: "DV-2024-002",
      amenities: ["Shade cover", "Cooler", "First aid kit"],
      images: DEMO_IMAGES.boats.speedboat,
    },
  ];

  // Insert boats into PUBLIC schema with organizationId
  const boatIds: string[] = [];
  for (const boat of boats) {
    const [result] = await db
      .insert(schema.boats)
      .values({
        organizationId,
        name: boat.name,
        description: boat.description,
        capacity: boat.capacity,
        type: boat.type,
        registrationNumber: boat.registrationNumber,
        amenities: boat.amenities,
        images: boat.images,
      })
      .returning({ id: schema.boats.id });

    if (result) {
      boatIds.push(result.id);
    }
  }

  // Demo Equipment (20 items with serial numbers, service dates, etc.)
  const equipmentItems = [
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "M", rentalPrice: "15.00", serialNumber: "AQL-2024-00001", barcode: "6901234000101", lastServiceDate: "2025-11-15", nextServiceDate: "2026-05-15", purchaseDate: "2024-03-10", purchasePrice: "540.00" },
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "L", rentalPrice: "15.00", serialNumber: "AQL-2024-00002", barcode: "6901234000118", lastServiceDate: "2025-11-15", nextServiceDate: "2026-05-15", purchaseDate: "2024-03-10", purchasePrice: "540.00" },
    { category: "bcd", name: "Aqua Lung Pro HD", brand: "Aqua Lung", size: "XL", rentalPrice: "15.00", serialNumber: "AQL-2024-00003", barcode: "6901234000125", lastServiceDate: "2025-10-20", nextServiceDate: "2026-04-20", purchaseDate: "2024-03-10", purchasePrice: "540.00" },
    { category: "regulator", name: "Scubapro MK25/S600", brand: "Scubapro", rentalPrice: "20.00", serialNumber: "SP-2024-00001", barcode: "6901234000132", lastServiceDate: "2025-12-01", nextServiceDate: "2026-06-01", purchaseDate: "2024-01-15", purchasePrice: "650.00" },
    { category: "regulator", name: "Scubapro MK25/S600", brand: "Scubapro", rentalPrice: "20.00", serialNumber: "SP-2024-00002", barcode: "6901234000149", lastServiceDate: "2025-12-01", nextServiceDate: "2026-06-01", purchaseDate: "2024-01-15", purchasePrice: "650.00" },
    { category: "regulator", name: "Aqualung Core", brand: "Aqua Lung", rentalPrice: "18.00", serialNumber: "AQL-2023-00010", barcode: "6901234000156", lastServiceDate: "2025-09-20", nextServiceDate: "2026-03-20", purchaseDate: "2023-07-22", purchasePrice: "420.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "S", rentalPrice: "10.00", serialNumber: "BARE-2024-00001", barcode: "6901234000163", lastServiceDate: "2025-08-10", nextServiceDate: "2026-08-10", purchaseDate: "2024-04-05", purchasePrice: "125.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "M", rentalPrice: "10.00", serialNumber: "BARE-2024-00002", barcode: "6901234000170", lastServiceDate: "2025-08-10", nextServiceDate: "2026-08-10", purchaseDate: "2024-04-05", purchasePrice: "125.00" },
    { category: "wetsuit", name: "3mm Full Suit", brand: "Bare", size: "L", rentalPrice: "10.00", serialNumber: "BARE-2024-00003", barcode: "6901234000187", lastServiceDate: "2025-08-10", nextServiceDate: "2026-08-10", purchaseDate: "2024-04-05", purchasePrice: "125.00" },
    { category: "wetsuit", name: "5mm Full Suit", brand: "Bare", size: "M", rentalPrice: "12.00", serialNumber: "BARE-2024-00004", barcode: "6901234000194", lastServiceDate: "2025-08-10", nextServiceDate: "2026-08-10", purchaseDate: "2024-04-05", purchasePrice: "175.00" },
    { category: "mask", name: "Cressi Big Eyes", brand: "Cressi", rentalPrice: "5.00", serialNumber: "CRS-2024-00001", barcode: "6901234000200", lastServiceDate: "2025-06-15", nextServiceDate: "2026-06-15", purchaseDate: "2024-02-20", purchasePrice: "32.00" },
    { category: "mask", name: "Cressi Big Eyes", brand: "Cressi", rentalPrice: "5.00", serialNumber: "CRS-2024-00002", barcode: "6901234000217", lastServiceDate: "2025-06-15", nextServiceDate: "2026-06-15", purchaseDate: "2024-02-20", purchasePrice: "32.00" },
    { category: "fins", name: "Mares Avanti", brand: "Mares", size: "M", rentalPrice: "8.00", serialNumber: "MRS-2024-00001", barcode: "6901234000224", lastServiceDate: "2025-07-01", nextServiceDate: "2026-07-01", purchaseDate: "2024-02-20", purchasePrice: "62.00" },
    { category: "fins", name: "Mares Avanti", brand: "Mares", size: "L", rentalPrice: "8.00", serialNumber: "MRS-2024-00002", barcode: "6901234000231", lastServiceDate: "2025-07-01", nextServiceDate: "2026-07-01", purchaseDate: "2024-02-20", purchasePrice: "62.00" },
    { category: "computer", name: "Suunto Zoop", brand: "Suunto", rentalPrice: "25.00", serialNumber: "SUN-2023-00001", barcode: "6901234000248", lastServiceDate: "2025-10-05", nextServiceDate: "2026-04-05", purchaseDate: "2023-05-18", purchasePrice: "280.00" },
    { category: "computer", name: "Shearwater Peregrine", brand: "Shearwater", rentalPrice: "35.00", serialNumber: "SHW-2024-00001", barcode: "6901234000255", lastServiceDate: "2025-11-20", nextServiceDate: "2026-05-20", purchaseDate: "2024-06-01", purchasePrice: "380.00" },
    { category: "tank", name: "Aluminum 80", brand: "Luxfer", rentalPrice: "10.00", serialNumber: "LUX-2022-00001", barcode: "6901234000262", lastServiceDate: "2025-09-01", nextServiceDate: "2026-09-01", purchaseDate: "2022-01-10", purchasePrice: "180.00" },
    { category: "tank", name: "Aluminum 80", brand: "Luxfer", rentalPrice: "10.00", serialNumber: "LUX-2022-00002", barcode: "6901234000279", lastServiceDate: "2025-09-01", nextServiceDate: "2026-09-01", purchaseDate: "2022-01-10", purchasePrice: "180.00" },
    { category: "tank", name: "Steel 100", brand: "Faber", rentalPrice: "12.00", serialNumber: "FAB-2023-00001", barcode: "6901234000286", lastServiceDate: "2025-09-01", nextServiceDate: "2026-09-01", purchaseDate: "2023-03-15", purchasePrice: "350.00" },
    { category: "torch", name: "BigBlue AL1200", brand: "BigBlue", rentalPrice: "15.00", serialNumber: "BB-2024-00001", barcode: "6901234000293", lastServiceDate: "2025-10-15", nextServiceDate: "2026-04-15", purchaseDate: "2024-05-20", purchasePrice: "120.00" },
  ];

  // Insert equipment into PUBLIC schema with organizationId
  const equipmentIds: string[] = [];
  for (const item of equipmentItems) {
    const [result] = await db
      .insert(schema.equipment)
      .values({
        organizationId,
        category: item.category,
        name: item.name,
        brand: item.brand,
        size: item.size || null,
        rentalPrice: item.rentalPrice,
        isRentable: true,
        status: "available",
        condition: "good",
        isPublic: false,
        serialNumber: item.serialNumber || null,
        barcode: item.barcode || null,
        lastServiceDate: item.lastServiceDate || null,
        nextServiceDate: item.nextServiceDate || null,
        purchaseDate: item.purchaseDate || null,
        purchasePrice: item.purchasePrice || null,
      })
      .returning({ id: schema.equipment.id });

    if (result) {
      equipmentIds.push(result.id);
    }
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
      images: DEMO_IMAGES.tours.discoverScuba,
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
      images: DEMO_IMAGES.tours.twoTankDive,
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
      images: DEMO_IMAGES.tours.nightDive,
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
      images: DEMO_IMAGES.tours.wreckExplorer,
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
      images: DEMO_IMAGES.tours.snorkelSafari,
    },
  ];

  // Insert tours into PUBLIC schema with organizationId
  const tourIds: string[] = [];
  for (const tour of tours) {
    const [result] = await db
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
        inclusions: tour.inclusions || [],
        exclusions: tour.exclusions || [],
        minCertLevel: tour.minCertLevel || null,
        minAge: tour.minAge || null,
        requirements: tour.requirements || [],
        images: tour.images || [],
      })
      .returning({ id: schema.tours.id });

    if (result) {
      tourIds.push(result.id);
    }
  }

  // Link tours to dive sites in PUBLIC schema
  const tourDiveSiteLinks = [
    { tourId: tourIds[0], diveSiteId: diveSiteIds[0], order: 1 }, // Discover -> Coral Garden
    { tourId: tourIds[1], diveSiteId: diveSiteIds[0], order: 1 }, // Two Tank -> Coral Garden
    { tourId: tourIds[1], diveSiteId: diveSiteIds[4], order: 2 }, // Two Tank -> Manta Point
    { tourId: tourIds[2], diveSiteId: diveSiteIds[0], order: 1 }, // Night Dive -> Coral Garden
    { tourId: tourIds[3], diveSiteId: diveSiteIds[2], order: 1 }, // Wreck -> Shipwreck Bay
    { tourId: tourIds[4], diveSiteId: diveSiteIds[0], order: 1 }, // Snorkel -> Coral Garden
  ];

  for (const link of tourDiveSiteLinks) {
    await db
      .insert(schema.tourDiveSites)
      .values({
        organizationId,
        tourId: link.tourId,
        diveSiteId: link.diveSiteId,
        order: link.order,
      });
  }

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

  // Insert trips into PUBLIC schema with organizationId
  const tripIds: string[] = [];
  for (const trip of trips) {
    const tripDate = new Date(today);
    tripDate.setDate(tripDate.getDate() + trip.daysFromNow);
    const dateStr = tripDate.toISOString().split("T")[0];

    const [result] = await db
      .insert(schema.trips)
      .values({
        organizationId,
        tourId: tourIds[trip.tourIdx],
        boatId: boatIds[trip.boatIdx],
        date: dateStr,
        startTime: trip.startTime,
        endTime: trip.endTime,
        status: "scheduled",
        isPublic: false,
      })
      .returning({ id: schema.trips.id });

    if (result) {
      tripIds.push(result.id);
    }
  }

  // Demo Bookings (enriched with participant details, waivers, equipment rentals)
  const bookings = [
    {
      tripIdx: 0, customerIdx: 0, participants: 2, status: "confirmed", paymentStatus: "paid",
      participantDetails: [
        { name: "John Smith", certLevel: "Advanced OW", equipment: ["own"] },
        { name: "Jane Smith", certLevel: "Open Water", equipment: ["rental_bcd", "rental_reg", "rental_wetsuit"] },
      ],
      waiverSignedAt: "2026-02-16T10:00:00Z", medicalFormSignedAt: "2026-02-16T10:00:00Z",
      specialRequests: "Wife needs rental equipment (BCD, reg, wetsuit M)",
      internalNotes: "Regular customer - complimentary dive photos included",
      equipmentRental: [{ item: "BCD", size: "M", price: 15 }, { item: "Regulator", size: "Standard", price: 15 }, { item: "Wetsuit", size: "M", price: 15 }],
      source: "direct",
    },
    {
      tripIdx: 0, customerIdx: 2, participants: 1, status: "confirmed", paymentStatus: "paid",
      participantDetails: [{ name: "Marco Rossi", certLevel: "Divemaster", equipment: ["own"] }],
      waiverSignedAt: "2026-02-15T14:30:00Z", medicalFormSignedAt: "2026-02-15T14:30:00Z",
      specialRequests: null, internalNotes: "Experienced diver, no assistance needed",
      equipmentRental: null, source: "direct",
    },
    {
      tripIdx: 1, customerIdx: 3, participants: 3, status: "confirmed", paymentStatus: "partial",
      participantDetails: [
        { name: "Yuki Tanaka", certLevel: "Advanced Scuba Diver", equipment: ["own"] },
        { name: "Kenji Tanaka", certLevel: "Open Water", equipment: ["rental_full"] },
        { name: "Ami Sato", certLevel: "Open Water", equipment: ["rental_full"] },
      ],
      waiverSignedAt: "2026-02-14T09:00:00Z", medicalFormSignedAt: "2026-02-14T09:15:00Z",
      specialRequests: "Friends are visiting from Osaka, need full rental gear for two",
      internalNotes: "50% deposit received. Balance due on arrival.",
      equipmentRental: [{ item: "Full Set", size: "M", price: 45 }, { item: "Full Set", size: "S", price: 45 }],
      source: "online",
    },
    {
      tripIdx: 2, customerIdx: 5, participants: 1, status: "pending", paymentStatus: "pending",
      participantDetails: [{ name: "Carlos Garcia", certLevel: "Open Water", equipment: ["rental_full"] }],
      waiverSignedAt: null, medicalFormSignedAt: null,
      specialRequests: "First time on a boat dive, may need extra guidance",
      internalNotes: "New diver - assign experienced buddy",
      equipmentRental: [{ item: "Full Set", size: "L", price: 45 }],
      depositAmount: "42.50", depositPaidAt: null, source: "online",
    },
    {
      tripIdx: 3, customerIdx: 4, participants: 2, status: "confirmed", paymentStatus: "paid",
      participantDetails: [
        { name: "Emma Wilson", certLevel: "Rescue Diver", equipment: ["own"] },
        { name: "David Wilson", certLevel: "Open Water", equipment: ["rental_bcd", "rental_reg"] },
      ],
      waiverSignedAt: "2026-02-10T16:00:00Z", medicalFormSignedAt: "2026-02-10T16:00:00Z",
      specialRequests: "Father joining - needs BCD and regulator only (has own wetsuit)",
      internalNotes: null,
      equipmentRental: [{ item: "BCD", size: "L", price: 15 }, { item: "Regulator", size: "Standard", price: 15 }],
      source: "direct",
    },
    {
      tripIdx: 4, customerIdx: 6, participants: 1, status: "confirmed", paymentStatus: "paid",
      participantDetails: [{ name: "Lisa Chen", certLevel: "Master Scuba Diver", equipment: ["own"] }],
      waiverSignedAt: "2026-02-12T11:00:00Z", medicalFormSignedAt: "2026-02-12T11:00:00Z",
      specialRequests: "Bringing underwater camera rig - needs extra space on boat",
      internalNotes: "VIP customer. Photography specialist - may want extended bottom time.",
      equipmentRental: null, source: "direct",
    },
    {
      tripIdx: 5, customerIdx: 1, participants: 2, status: "confirmed", paymentStatus: "partial",
      participantDetails: [
        { name: "Sarah Jones", certLevel: "Open Water", equipment: ["rental_full"] },
        { name: "Jessica Jones", certLevel: "Discover Scuba", equipment: ["rental_full"] },
      ],
      waiverSignedAt: "2026-02-13T10:30:00Z", medicalFormSignedAt: "2026-02-13T10:45:00Z",
      specialRequests: "Sister is doing Discover Scuba, needs constant supervision",
      internalNotes: "Partial payment received. Sister has no cert - DSD only, max 12m.",
      equipmentRental: [{ item: "Full Set", size: "S", price: 45 }, { item: "Full Set", size: "M", price: 45 }],
      source: "referral",
    },
    {
      tripIdx: 8, customerIdx: 7, participants: 4, status: "pending", paymentStatus: "pending",
      participantDetails: [
        { name: "James Brown", certLevel: "Instructor", equipment: ["own"] },
        { name: "Student A", certLevel: "Open Water (in training)", equipment: ["rental_full"] },
        { name: "Student B", certLevel: "Open Water (in training)", equipment: ["rental_full"] },
        { name: "Student C", certLevel: "Open Water (in training)", equipment: ["rental_full"] },
      ],
      waiverSignedAt: null, medicalFormSignedAt: null,
      specialRequests: "Instructor bringing 3 OW students for checkout dives. Need reserved boat space.",
      internalNotes: "Referral partner rate applies. Confirm student roster 48h before.",
      equipmentRental: [{ item: "Full Set", size: "M", price: 45 }, { item: "Full Set", size: "L", price: 45 }, { item: "Full Set", size: "M", price: 45 }],
      depositAmount: "190.00", depositPaidAt: null, source: "referral",
    },
  ];

  // Tour prices for calculating totals
  const tourPrices = [150, 120, 85, 95, 65];

  // Insert bookings into PUBLIC schema with organizationId
  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const tripData = trips[booking.tripIdx];
    const price = tourPrices[tripData.tourIdx];
    const subtotal = price * booking.participants;
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    const paidAmount = booking.paymentStatus === "paid" ? total : booking.paymentStatus === "partial" ? total * 0.5 : 0;

    await db
      .insert(schema.bookings)
      .values({
        organizationId,
        bookingNumber: `BK-${String(1000 + i).padStart(4, "0")}`,
        tripId: tripIds[booking.tripIdx],
        customerId: customerIds[booking.customerIdx],
        participants: booking.participants,
        participantDetails: booking.participantDetails,
        status: booking.status,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentStatus: booking.paymentStatus,
        paidAmount: paidAmount.toFixed(2),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        depositAmount: (booking as any).depositAmount || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        depositPaidAt: (booking as any).depositPaidAt ? new Date((booking as any).depositPaidAt) : null,
        equipmentRental: booking.equipmentRental,
        waiverSignedAt: booking.waiverSignedAt ? new Date(booking.waiverSignedAt) : null,
        medicalFormSignedAt: booking.medicalFormSignedAt ? new Date(booking.medicalFormSignedAt) : null,
        specialRequests: booking.specialRequests,
        internalNotes: booking.internalNotes,
        source: booking.source || "direct",
      });
  }

  // ============================================================================
  // PRODUCTS (POS Retail Items)
  // ============================================================================

  const products = [
    // ---- EQUIPMENT (12 items) ----
    { name: "Aqua Lung Pro HD BCD", sku: "EQP-BCD-001", barcode: "5901234123457", category: "equipment", description: "Professional-grade buoyancy compensator with integrated weight system and 40 lbs of lift. Features SwiveLock weight pockets, wraparound bladder, and multiple D-rings for accessories.", price: "899.00", costPrice: "540.00", taxRate: "8.25", stockQuantity: 8, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.bcdAqualung },
    { name: "Scubapro Hydros Pro BCD", sku: "EQP-BCD-002", barcode: "5901234123464", category: "equipment", description: "Multi-award winning back-inflate BCD with Monprene gel harness that conforms to your body. Includes AWLS III weight system and folds flat for travel.", price: "1099.00", costPrice: "660.00", taxRate: "8.25", stockQuantity: 5, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.bcdScubapro },
    { name: "Scubapro MK25 EVO/S620 Ti Regulator", sku: "EQP-REG-001", barcode: "5901234123471", category: "equipment", description: "Top-of-the-line first and second stage regulator set. The MK25 EVO delivers unmatched airflow performance in cold water, paired with the ultra-lightweight titanium S620 Ti second stage.", price: "749.00", costPrice: "450.00", taxRate: "8.25", stockQuantity: 6, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.regScubapro },
    { name: "Aqua Lung Core Supreme Regulator", sku: "EQP-REG-002", barcode: "5901234123488", category: "equipment", description: "Overbalanced diaphragm first stage with auto-closure device prevents water entry. Paired with the pneumatically balanced second stage featuring Venturi-Initiated Vacuum Assist (VIVA).", price: "549.00", costPrice: "330.00", taxRate: "8.25", stockQuantity: 4, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.regAqualung },
    { name: "Cressi Big Eyes Evolution Mask", sku: "EQP-MSK-001", barcode: "5901234123495", category: "equipment", description: "Low-volume dual-lens mask with inverted teardrop lenses for a wider field of vision. Tempered glass, hypoallergenic silicone skirt, and quick-adjust buckle system.", price: "69.00", costPrice: "32.00", taxRate: "8.25", stockQuantity: 22, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.maskCressi },
    { name: "Scubapro Synergy 2 Mask", sku: "EQP-MSK-002", barcode: "5901234123501", category: "equipment", description: "Dual-lens dive mask with ultra-clear lens technology and TruFit silicone skirt for excellent seal. Low profile design reduces internal volume for easy clearing.", price: "89.00", costPrice: "42.00", taxRate: "8.25", stockQuantity: 18, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.maskScubapro },
    { name: "Mares Avanti Quattro Plus Fins", sku: "EQP-FIN-001", barcode: "5901234123518", category: "equipment", description: "Channel Thrust technology open-heel fins with ABS Plus buckles. Four-channel blade design maximizes thrust while minimizing effort across all kick styles.", price: "129.00", costPrice: "62.00", taxRate: "8.25", stockQuantity: 14, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.finsMaresAvanti },
    { name: "Scubapro Seawing Nova Fins", sku: "EQP-FIN-002", barcode: "5901234123525", category: "equipment", description: "Pivot-blade technology fins that automatically adjust angle for optimal thrust. Articulating joint between blade and foot pocket reduces ankle strain on long dives.", price: "159.00", costPrice: "78.00", taxRate: "8.25", stockQuantity: 10, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.finsScubapro },
    { name: "Bare Velocity 3mm Wetsuit", sku: "EQP-WET-001", barcode: "5901234123532", category: "equipment", description: "Full-length 3mm neoprene wetsuit with progressive stretch panels and glued & blind-stitched seams. Ideal for tropical and warm water diving from 75-85°F.", price: "249.00", costPrice: "125.00", taxRate: "8.25", stockQuantity: 12, lowStockThreshold: 5, salePrice: "199.99", saleStartDate: new Date("2026-02-01"), saleEndDate: new Date("2026-03-15"), imageUrl: DEMO_IMAGES.products.wetsuitBare3mm },
    { name: "Bare Evoke 5mm Wetsuit", sku: "EQP-WET-002", barcode: "5901234123549", category: "equipment", description: "Premium 5mm full wetsuit with Celliant infrared technology lining for warmth and faster recovery. FlexAtom neoprene provides maximum stretch without sacrificing thermal protection.", price: "349.00", costPrice: "175.00", taxRate: "8.25", stockQuantity: 7, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.wetsuitBare5mm },
    { name: "Shearwater Peregrine TX Dive Computer", sku: "EQP-CMP-001", barcode: "5901234123556", category: "equipment", description: "Full-color 2.2-inch LCD dive computer with air integration via Swift transmitter. Supports Bühlmann and VPM-B algorithms with customizable conservatism. Wireless charging and Bluetooth connectivity.", price: "499.00", costPrice: "300.00", taxRate: "8.25", stockQuantity: 3, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.computerShearwater },
    { name: "Suunto D5 Dive Computer", sku: "EQP-CMP-002", barcode: "5901234123563", category: "equipment", description: "Stylish wrist-mounted dive computer with full-color display and customizable watch faces. Features wireless tank pressure reading, air/nitrox/gauge modes, and companion mobile app.", price: "699.00", costPrice: "420.00", taxRate: "8.25", stockQuantity: 2, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.computerSuunto },
    // ---- ACCESSORIES (10 items) ----
    { name: "BigBlue AL1800XWP Primary Light", sku: "ACC-LGT-001", barcode: "5901234123570", category: "accessories", description: "1800-lumen wide-beam primary dive light with magnetic rotary switch. 26650 rechargeable battery provides 2+ hours on high, with multiple power levels and SOS mode.", price: "189.00", costPrice: "95.00", taxRate: "8.25", stockQuantity: 9, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.lightBigblue },
    { name: "Tovatec Fusion 260 Backup Light", sku: "ACC-LGT-002", barcode: "5901234123587", category: "accessories", description: "Compact 260-lumen backup dive light with focused beam pattern. Twist-on activation, rated to 100m depth. Runs on 3 AAA batteries for up to 6 hours.", price: "59.00", costPrice: "28.00", taxRate: "8.25", stockQuantity: 15, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.lightTovatec },
    { name: "Surface Marker Buoy + Reel Kit", sku: "ACC-SMB-001", barcode: "5901234123594", category: "accessories", description: "High-visibility orange SMB with oral and dump valve inflation, paired with 150ft finger spool reel. Essential safety equipment for open water ascents and drift diving.", price: "45.00", costPrice: "22.00", taxRate: "8.25", stockQuantity: 20, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.smbKit },
    { name: "Aqua Lung Squeeze Lock Knife", sku: "ACC-KNF-001", barcode: "5901234123600", category: "accessories", description: "Titanium blade dive knife with squeeze-lock sheath for one-handed deployment. Blunt tip, serrated edge, and line cutter built into the sheath.", price: "39.00", costPrice: "18.00", taxRate: "8.25", stockQuantity: 15, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.knife },
    { name: "Sea Gold Anti-Fog Solution", sku: "ACC-FOG-001", barcode: "5901234123617", category: "accessories", description: "Professional-grade mask anti-fog gel that lasts multiple dives per application. Biodegradable formula safe for all mask lenses including tempered glass and polycarbonate.", price: "8.99", costPrice: "3.00", taxRate: "8.25", stockQuantity: 75, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.antiFog },
    { name: "Underwater Writing Slate", sku: "ACC-SLT-001", barcode: "5901234123624", category: "accessories", description: "Glow-in-the-dark underwater writing slate with attached graphite pencil. Wrist-mount strap for hands-free carrying. Erasable surface for unlimited use on every dive.", price: "14.99", costPrice: "5.50", taxRate: "8.25", stockQuantity: 40, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.slate },
    { name: "OverBoard 20L Dry Bag", sku: "ACC-BAG-001", barcode: "5901234123631", category: "accessories", description: "Waterproof 20-liter dry bag with welded seams and Fold Seal System closure. Padded shoulder strap and D-ring attachment points. Class 3 waterproof rating (submersible).", price: "34.99", costPrice: "14.00", taxRate: "8.25", stockQuantity: 35, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.dryBag },
    { name: "Stream2Sea Reef Safe Sunscreen SPF 50", sku: "ACC-SUN-001", barcode: "5901234123648", category: "accessories", description: "Mineral-based SPF 50 sunscreen tested and proven safe for coral reefs and marine life. Biodegradable, water-resistant for 80 minutes, and free of oxybenzone and octinoxate.", price: "18.99", costPrice: "8.50", taxRate: "8.25", stockQuantity: 100, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.sunscreen },
    { name: "Neoprene Comfort Mask Strap", sku: "ACC-STP-001", barcode: "5901234123655", category: "accessories", description: "Wide neoprene mask strap cover that prevents hair pulling and improves comfort. Universal fit for all dive and snorkel masks. Available in assorted colors.", price: "12.99", costPrice: "4.00", taxRate: "8.25", stockQuantity: 60, lowStockThreshold: 5, salePrice: "9.99", saleStartDate: new Date("2026-02-01"), saleEndDate: new Date("2026-02-28"), imageUrl: DEMO_IMAGES.products.maskStrap },
    { name: "PADI Dive Logbook", sku: "ACC-LOG-001", barcode: "5901234123662", category: "accessories", description: "Official PADI training record and dive logbook with space for 100+ dives. Includes training record pages, certification tracking, and underwater fish identification guides.", price: "24.99", costPrice: "10.00", taxRate: "8.25", stockQuantity: 30, lowStockThreshold: 5, salePrice: "19.99", saleStartDate: new Date("2026-01-15"), saleEndDate: new Date("2026-03-01"), imageUrl: DEMO_IMAGES.products.logbook },
    // ---- APPAREL (5 items) ----
    { name: "DiveStreams Logo T-Shirt", sku: "APP-TSH-001", barcode: "5901234123679", category: "apparel", description: "Soft ringspun cotton t-shirt with our DiveStreams logo on the front and a vintage dive flag graphic on the back. Pre-shrunk, comfortable fit in ocean blue.", price: "29.99", costPrice: "12.00", taxRate: "8.25", stockQuantity: 50, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.tshirt },
    { name: "DiveStreams Hoodie", sku: "APP-HOD-001", barcode: "5901234123686", category: "apparel", description: "Heavyweight fleece-lined hoodie with embroidered DiveStreams logo on the chest. Kangaroo pocket and double-lined hood. Perfect for boat rides and après-dive warmth.", price: "59.99", costPrice: "28.00", taxRate: "8.25", stockQuantity: 25, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.hoodie },
    { name: "O'Neill Rash Guard UPF 50+", sku: "APP-RSH-001", barcode: "5901234123693", category: "apparel", description: "Long-sleeve rash guard with UPF 50+ sun protection and quick-dry Hyperfreak fabric. Flatlock seams prevent chafing, ideal for snorkeling, surfing, and sun protection on dive boats.", price: "44.99", costPrice: "22.00", taxRate: "8.25", stockQuantity: 20, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.rashGuard },
    { name: "DiveStreams Trucker Cap", sku: "APP-CAP-001", barcode: "5901234123709", category: "apparel", description: "Classic trucker-style cap with embroidered DiveStreams logo. Adjustable snapback closure, mesh back panels for breathability, and curved brim.", price: "24.99", costPrice: "8.00", taxRate: "8.25", stockQuantity: 40, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.truckerCap },
    { name: "DiveStreams Sticker Pack", sku: "APP-STK-001", barcode: "5901234123716", category: "apparel", description: "Set of 10 waterproof vinyl stickers featuring DiveStreams branding and dive-themed designs. UV resistant and perfect for laptops, water bottles, and dive cases.", price: "9.99", costPrice: "2.50", taxRate: "8.25", stockQuantity: 80, lowStockThreshold: 5, salePrice: "7.99", saleStartDate: new Date("2026-02-01"), saleEndDate: new Date("2026-04-30"), imageUrl: DEMO_IMAGES.products.stickerPack },
    // ---- PHOTOGRAPHY (1 item) ----
    { name: "SeaLife Micro 3.0 Camera Kit", sku: "EQP-CAM-001", barcode: "5901234123723", category: "equipment", description: "Compact 16MP underwater camera rated to 200ft with built-in WiFi and 64GB internal memory. Kit includes Sea Dragon 2500 photo/video light and tray with grip. No housing needed.", price: "499.00", costPrice: "300.00", taxRate: "8.25", stockQuantity: 3, lowStockThreshold: 5, imageUrl: DEMO_IMAGES.products.cameraSeaLife },
  ];

  // Insert products into PUBLIC schema with organizationId
  const productIds: string[] = [];
  for (const product of products) {
    const [result] = await db
      .insert(schema.products)
      .values({
        organizationId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || null,
        category: product.category,
        description: product.description || null,
        price: product.price,
        costPrice: product.costPrice || null,
        taxRate: product.taxRate || null,
        stockQuantity: product.stockQuantity || 0,
        lowStockThreshold: product.lowStockThreshold || null,
        salePrice: product.salePrice || null,
        saleStartDate: product.saleStartDate || null,
        saleEndDate: product.saleEndDate || null,
        imageUrl: product.imageUrl || null,
        trackInventory: true,
        isActive: true,
      })
      .returning({ id: schema.products.id });

    if (result) {
      productIds.push(result.id);
    }
  }

  // ============================================================================
  // DISCOUNT CODES
  // ============================================================================

  const discountCodes = [
    { code: "WELCOME10", description: "10% off for new customers", discountType: "percentage", discountValue: "10.00", minBookingAmount: "50.00", maxUses: 100, usedCount: 23, applicableTo: "all" },
    { code: "SUMMER2026", description: "Summer special - $25 off any booking over $150", discountType: "fixed", discountValue: "25.00", minBookingAmount: "150.00", maxUses: 50, usedCount: 8, applicableTo: "tours" },
    { code: "DIVEPRO", description: "15% off for certified divemasters and instructors", discountType: "percentage", discountValue: "15.00", applicableTo: "all", usedCount: 5 },
    { code: "GROUP5", description: "5% off for groups of 5 or more", discountType: "percentage", discountValue: "5.00", minBookingAmount: "300.00", applicableTo: "tours" },
    { code: "EARLYBIRD", description: "Early bird - 20% off bookings 30+ days in advance", discountType: "percentage", discountValue: "20.00", maxUses: 25, usedCount: 12, applicableTo: "tours" },
    { code: "RETURNING15", description: "15% off for returning customers", discountType: "percentage", discountValue: "15.00", applicableTo: "all" },
    { code: "WEEKDAY10", description: "10% off weekday bookings", discountType: "percentage", discountValue: "10.00", applicableTo: "tours", usedCount: 17 },
    { code: "BUNDLE20", description: "$20 off when booking tour + equipment rental", discountType: "fixed", discountValue: "20.00", minBookingAmount: "100.00", applicableTo: "tours" },
  ];

  // Calculate validity dates for discount codes
  const validFrom = new Date();
  const validTo = new Date();
  validTo.setMonth(validTo.getMonth() + 6); // Valid for 6 months

  // Insert discount codes into PUBLIC schema with organizationId
  for (const discount of discountCodes) {
    await db
      .insert(schema.discountCodes)
      .values({
        organizationId,
        code: discount.code,
        description: discount.description,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        minBookingAmount: discount.minBookingAmount || null,
        maxUses: discount.maxUses || null,
        usedCount: discount.usedCount || 0,
        applicableTo: discount.applicableTo,
        validFrom: validFrom,
        validTo: validTo,
        isActive: true,
      });
  }

  // ============================================================================
  // TRANSACTIONS (for paid bookings)
  // ============================================================================

  // Create transactions for the paid/partial bookings
  const transactionData = [
    { bookingIdx: 0, amount: 264.00, method: "card" }, // BK-1000 - paid
    { bookingIdx: 1, amount: 132.00, method: "card" }, // BK-1001 - paid
    { bookingIdx: 2, amount: 107.25, method: "cash" }, // BK-1002 - partial (50%)
    { bookingIdx: 4, amount: 264.00, method: "stripe" }, // BK-1004 - paid
    { bookingIdx: 5, amount: 93.50, method: "card" }, // BK-1005 - paid
    { bookingIdx: 6, amount: 132.00, method: "cash" }, // BK-1006 - partial (50%)
  ];

  // Insert transactions into PUBLIC schema with organizationId
  for (let i = 0; i < transactionData.length; i++) {
    const txn = transactionData[i];
    const booking = bookings[txn.bookingIdx];
    const tripData = trips[booking.tripIdx];
    const price = tourPrices[tripData.tourIdx];

    await db
      .insert(schema.transactions)
      .values({
        organizationId,
        type: "payment",
        customerId: customerIds[booking.customerIdx],
        amount: txn.amount.toFixed(2),
        paymentMethod: txn.method,
        items: [
          {
            description: tours[tripData.tourIdx].name,
            quantity: booking.participants,
            unitPrice: price,
            total: price * booking.participants,
          },
        ],
        notes: `Payment for booking BK-${String(1000 + txn.bookingIdx).padStart(4, "0")}`,
      });
  }

  // Standalone POS transactions (retail sales, not tied to bookings)
  const posTransactions = [
    { type: "sale", customerIdx: null, amount: "53.99", method: "cash", items: [{ description: "Surface Marker Buoy + Reel Kit", quantity: 1, unitPrice: 45.0, total: 45.0, type: "product" }, { description: "Sea Gold Anti-Fog Solution", quantity: 1, unitPrice: 8.99, total: 8.99, type: "product" }], notes: "Walk-in customer, cash sale" },
    { type: "sale", customerIdx: 0, amount: "78.99", method: "card", items: [{ description: "Cressi Big Eyes Evolution Mask", quantity: 1, unitPrice: 69.0, total: 69.0, type: "product" }, { description: "Neoprene Comfort Mask Strap", quantity: 1, unitPrice: 9.99, total: 9.99, type: "product" }], notes: "Customer purchased mask with comfort strap upgrade" },
    { type: "sale", customerIdx: 2, amount: "2247.00", method: "stripe", items: [{ description: "Scubapro Hydros Pro BCD", quantity: 1, unitPrice: 1099.0, total: 1099.0, type: "product" }, { description: "Scubapro MK25 EVO/S620 Ti Regulator", quantity: 1, unitPrice: 749.0, total: 749.0, type: "product" }, { description: "Shearwater Peregrine TX Dive Computer", quantity: 1, unitPrice: 499.0, total: 499.0, type: "product" }], notes: "Full equipment package for new Open Water diver" },
    { type: "refund", customerIdx: 4, amount: "29.99", method: "card", items: [{ description: "DiveStreams Logo T-Shirt", quantity: 1, unitPrice: 29.99, total: 29.99, type: "product" }], notes: "Customer returned t-shirt - wrong size", refundReason: "Wrong size, customer exchanged for correct size" },
    { type: "sale", customerIdx: 1, amount: "84.98", method: "card", items: [{ description: "DiveStreams Hoodie", quantity: 1, unitPrice: 59.99, total: 59.99, type: "product" }, { description: "DiveStreams Trucker Cap", quantity: 1, unitPrice: 24.99, total: 24.99, type: "product" }], notes: "Gift purchase for dive buddy" },
    { type: "sale", customerIdx: 3, amount: "263.98", method: "stripe", items: [{ description: "BigBlue AL1800XWP Primary Light", quantity: 1, unitPrice: 189.0, total: 189.0, type: "product" }, { description: "Underwater Writing Slate", quantity: 1, unitPrice: 14.99, total: 14.99, type: "product" }, { description: "PADI Dive Logbook", quantity: 2, unitPrice: 19.99, total: 39.98, type: "product" }, { description: "DiveStreams Sticker Pack", quantity: 1, unitPrice: 7.99, total: 7.99, type: "product" }], notes: "Night dive prep purchases plus gifts" },
    { type: "sale", customerIdx: null, amount: "53.98", method: "cash", items: [{ description: "Stream2Sea Reef Safe Sunscreen SPF 50", quantity: 1, unitPrice: 18.99, total: 18.99, type: "product" }, { description: "OverBoard 20L Dry Bag", quantity: 1, unitPrice: 34.99, total: 34.99, type: "product" }], notes: "Walk-in tourist heading to boat trip" },
    { type: "sale", customerIdx: 5, amount: "543.99", method: "stripe", items: [{ description: "SeaLife Micro 3.0 Camera Kit", quantity: 1, unitPrice: 499.0, total: 499.0, type: "product" }, { description: "Aqua Lung Squeeze Lock Knife", quantity: 1, unitPrice: 39.0, total: 39.0, type: "product" }, { description: "DiveStreams Sticker Pack", quantity: 1, unitPrice: 7.99, total: 7.99, type: "product" }], notes: "Customer upgrading to dedicated underwater camera" },
  ];

  for (const txn of posTransactions) {
    await db
      .insert(schema.transactions)
      .values({
        organizationId,
        type: txn.type,
        customerId: txn.customerIdx !== null ? customerIds[txn.customerIdx] : null,
        amount: txn.amount,
        paymentMethod: txn.method,
        items: txn.items,
        notes: txn.notes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        refundReason: (txn as any).refundReason || null,
      });
  }

  // ============================================================================
  // IMAGES TABLE (Polymorphic images for enhanced image management)
  // ============================================================================

  // Add images to the images table for dive sites
  const imageEntries: Array<{
    entityType: string;
    entityId: string;
    url: string;
    filename: string;
    sortOrder: number;
    isPrimary: boolean;
  }> = [];

  // Dive site images
  diveSiteIds.forEach((siteId, siteIdx) => {
    const siteImages = diveSites[siteIdx].images || [];
    siteImages.forEach((url, imgIdx) => {
      imageEntries.push({
        entityType: "dive-site",
        entityId: siteId,
        url,
        filename: `dive-site-${siteIdx + 1}-${imgIdx + 1}.jpg`,
        sortOrder: imgIdx,
        isPrimary: imgIdx === 0,
      });
    });
  });

  // Boat images
  boatIds.forEach((boatId, boatIdx) => {
    const boatImages = boats[boatIdx].images || [];
    boatImages.forEach((url, imgIdx) => {
      imageEntries.push({
        entityType: "boat",
        entityId: boatId,
        url,
        filename: `boat-${boatIdx + 1}-${imgIdx + 1}.jpg`,
        sortOrder: imgIdx,
        isPrimary: imgIdx === 0,
      });
    });
  });

  // Tour images
  tourIds.forEach((tourId, tourIdx) => {
    const tourImages = tours[tourIdx].images || [];
    tourImages.forEach((url, imgIdx) => {
      imageEntries.push({
        entityType: "tour",
        entityId: tourId,
        url,
        filename: `tour-${tourIdx + 1}-${imgIdx + 1}.jpg`,
        sortOrder: imgIdx,
        isPrimary: imgIdx === 0,
      });
    });
  });

  // Product images
  productIds.forEach((productId, idx) => {
    imageEntries.push({
      entityType: "product",
      entityId: productId,
      url: products[idx].imageUrl.replace("w=400", "w=1200"),
      filename: `product-${idx + 1}.jpg`,
      sortOrder: 0,
      isPrimary: true,
    });
  });

  // Insert all images into PUBLIC schema with organizationId
  for (const img of imageEntries) {
    await db
      .insert(schema.images)
      .values({
        organizationId,
        entityType: img.entityType,
        entityId: img.entityId,
        url: img.url,
        thumbnailUrl: img.url.replace("w=1200", "w=200"), // Generate thumbnail URL
        filename: img.filename,
        mimeType: "image/jpeg",
        sizeBytes: 150000 + Math.floor(Math.random() * 100000), // Random size 150-250KB
        width: 1200,
        height: 800,
        alt: `${img.entityType.replace("_", " ")} image`,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
      });
  }

  // ============================================================================
  // RENTALS (Equipment Rentals)
  // ============================================================================

  // Create some rental records - mix of active, returned, and overdue
  const rentalRecords = [
    {
      customerIdx: 0, // John Smith
      equipmentIdx: 0, // BCD M
      daysAgo: 2,
      durationDays: 3,
      status: "active",
      dailyRate: "15.00",
    },
    {
      customerIdx: 0, // John Smith
      equipmentIdx: 3, // Regulator
      daysAgo: 2,
      durationDays: 3,
      status: "active",
      dailyRate: "20.00",
    },
    {
      customerIdx: 2, // Marco Rossi
      equipmentIdx: 14, // Dive computer (Suunto)
      daysAgo: 1,
      durationDays: 5,
      status: "active",
      dailyRate: "25.00",
    },
    {
      customerIdx: 4, // Emma Wilson
      equipmentIdx: 7, // Wetsuit M
      daysAgo: 5,
      durationDays: 3,
      status: "returned",
      dailyRate: "10.00",
    },
    {
      customerIdx: 4, // Emma Wilson
      equipmentIdx: 10, // Mask
      daysAgo: 5,
      durationDays: 3,
      status: "returned",
      dailyRate: "5.00",
    },
    {
      customerIdx: 1, // Sarah Jones
      equipmentIdx: 6, // Wetsuit S
      daysAgo: 7,
      durationDays: 3,
      status: "overdue", // Was due 4 days ago
      dailyRate: "10.00",
    },
    {
      customerIdx: 3, // Yuki Tanaka
      equipmentIdx: 15, // Dive computer (Shearwater)
      daysAgo: 0, // Today
      durationDays: 7,
      status: "active",
      dailyRate: "35.00",
    },
    {
      customerIdx: 6, // Lisa Chen
      equipmentIdx: 19, // Torch
      daysAgo: 3,
      durationDays: 1,
      status: "returned",
      dailyRate: "15.00",
    },
  ];

  let rentalCount = 0;
  for (const rental of rentalRecords) {
    const rentedAt = new Date();
    rentedAt.setDate(rentedAt.getDate() - rental.daysAgo);

    const dueAt = new Date(rentedAt);
    dueAt.setDate(dueAt.getDate() + rental.durationDays);

    // For returned rentals, set returnedAt
    let returnedAt: Date | null = null;
    if (rental.status === "returned") {
      returnedAt = new Date(dueAt);
      returnedAt.setDate(returnedAt.getDate() - 1); // Returned a day before due
    }

    // Calculate total charge
    const dailyRate = parseFloat(rental.dailyRate);
    const actualDays = rental.status === "returned"
      ? rental.durationDays - 1
      : rental.durationDays;
    const totalCharge = dailyRate * actualDays;

    // Generate agreement number
    const agreementNum = `RNT-${String(2024001 + rentalCount).padStart(7, "0")}`;

    // Insert rental into PUBLIC schema with organizationId
    await db
      .insert(schema.rentals)
      .values({
        organizationId,
        customerId: customerIds[rental.customerIdx],
        equipmentId: equipmentIds[rental.equipmentIdx],
        rentedAt: rentedAt,
        dueAt: dueAt,
        returnedAt: returnedAt,
        dailyRate: rental.dailyRate,
        totalCharge: totalCharge.toFixed(2),
        status: rental.status,
        agreementNumber: agreementNum,
        agreementSignedAt: rentedAt,
        agreementSignedBy: customers[rental.customerIdx].firstName + " " + customers[rental.customerIdx].lastName,
        notes: rental.status === "overdue" ? "OVERDUE - Customer contacted" : null,
      });

    rentalCount++;
  }

  // ============================================================================
  // TRAINING DATA (Agencies, Levels, Courses)
  // ============================================================================

  console.log("\n📚 Seeding training data...");

  // Check if PADI/SSI/NAUI agencies already exist (not just any agency)
  const existingAgencies = await db
    .select()
    .from(schema.certificationAgencies)
    .where(eq(schema.certificationAgencies.organizationId, organizationId));

  // Check specifically for PADI, SSI, or NAUI agencies
  const hasPadi = existingAgencies.some((a) => a.code.toLowerCase() === "padi");
  const hasSsi = existingAgencies.some((a) => a.code.toLowerCase() === "ssi");
  const hasNaui = existingAgencies.some((a) => a.code.toLowerCase() === "naui");

  let trainingStats = { agencies: 0, levels: 0, courses: 0, sessions: 0 };

  // Seed each agency individually if it doesn't exist
  let agenciesSeeded = 0;
  let levelsSeeded = 0;

  try {
    // Seed PADI if missing
    if (!hasPadi) {
      const [padiAgency] = await db
        .insert(schema.certificationAgencies)
        .values({
          organizationId,
          code: "padi",
          name: "PADI",
          description: "Professional Association of Diving Instructors",
          website: "https://www.padi.com",
        })
        .returning();

      // Seed PADI certification levels
      await db
        .insert(schema.certificationLevels)
        .values({
          organizationId,
          agencyId: padiAgency.id,
          code: "open-water",
          name: "Open Water Diver",
          levelNumber: 3,
          description: "Entry-level certification for independent diving",
          minAge: 10,
          minDives: 0,
        })
        .returning();

      await db
        .insert(schema.certificationLevels)
        .values({
          organizationId,
          agencyId: padiAgency.id,
          code: "advanced-ow",
          name: "Advanced Open Water",
          levelNumber: 4,
          description: "Explore specialty diving",
          minAge: 12,
          minDives: 0,
        })
        .returning();

      // Note: Course seeding removed (KAN-650) - users should import courses via training import feature
      // Only seeding agencies and certification levels (reference data)

      agenciesSeeded++;
      levelsSeeded += 2;
      console.log("  ✓ PADI agency seeded (agencies and levels only)");
    }

    // Seed SSI if missing
    if (!hasSsi) {
      const [ssiAgency] = await db
        .insert(schema.certificationAgencies)
        .values({
          organizationId,
          code: "ssi",
          name: "SSI",
          description: "Scuba Schools International",
          website: "https://www.divessi.com",
        })
        .returning();

      // Seed SSI certification levels
      await db.insert(schema.certificationLevels).values([
        {
          organizationId,
          agencyId: ssiAgency.id,
          code: "ssi-open-water",
          name: "Open Water Diver",
          levelNumber: 3,
          description: "SSI entry-level certification",
          minAge: 10,
          minDives: 0,
        },
        {
          organizationId,
          agencyId: ssiAgency.id,
          code: "ssi-advanced",
          name: "Advanced Adventurer",
          levelNumber: 4,
          description: "SSI advanced certification",
          minAge: 12,
          minDives: 0,
        },
      ]);

      agenciesSeeded++;
      levelsSeeded += 2;
      console.log("  ✓ SSI agency seeded");
    }

    // Seed NAUI if missing
    if (!hasNaui) {
      const [nauiAgency] = await db
        .insert(schema.certificationAgencies)
        .values({
          organizationId,
          code: "naui",
          name: "NAUI",
          description: "National Association of Underwater Instructors",
          website: "https://www.naui.org",
        })
        .returning();

      // Seed NAUI certification levels
      await db.insert(schema.certificationLevels).values([
        {
          organizationId,
          agencyId: nauiAgency.id,
          code: "naui-scuba-diver",
          name: "Scuba Diver",
          levelNumber: 3,
          description: "NAUI entry-level certification",
          minAge: 10,
          minDives: 0,
        },
        {
          organizationId,
          agencyId: nauiAgency.id,
          code: "naui-advanced",
          name: "Advanced Scuba Diver",
          levelNumber: 4,
          description: "NAUI advanced certification",
          minAge: 15,
          minDives: 0,
        },
      ]);

      agenciesSeeded++;
      levelsSeeded += 2;
      console.log("  ✓ NAUI agency seeded");
    }

    if (agenciesSeeded > 0) {
      console.log(`  ✓ Training data seeded (${agenciesSeeded} agencies, ${levelsSeeded} levels)`);
    } else {
      console.log("  ℹ️  All training agencies already exist");
    }

    // Seed training courses if missing
    const existingCourses = await db
      .select()
      .from(schema.trainingCourses)
      .where(eq(schema.trainingCourses.organizationId, organizationId));

    let coursesSeeded = 0;
    let sessionsSeeded = 0;

    if (existingCourses.length === 0) {
      console.log("  → Seeding training courses and sessions...");

      // Get agency IDs for course creation
      const [padiAgency] = await db
        .select()
        .from(schema.certificationAgencies)
        .where(
          and(
            eq(schema.certificationAgencies.organizationId, organizationId),
            eq(schema.certificationAgencies.code, "padi")
          )
        )
        .limit(1);

      const [ssiAgency] = await db
        .select()
        .from(schema.certificationAgencies)
        .where(
          and(
            eq(schema.certificationAgencies.organizationId, organizationId),
            eq(schema.certificationAgencies.code, "ssi")
          )
        )
        .limit(1);

      // Get certification level IDs
      const [owdLevel] = await db
        .select()
        .from(schema.certificationLevels)
        .where(
          and(
            eq(schema.certificationLevels.organizationId, organizationId),
            eq(schema.certificationLevels.code, "padi-owd")
          )
        )
        .limit(1);

      const [aowdLevel] = await db
        .select()
        .from(schema.certificationLevels)
        .where(
          and(
            eq(schema.certificationLevels.organizationId, organizationId),
            eq(schema.certificationLevels.code, "padi-aowd")
          )
        )
        .limit(1);

      const [rescueLevel] = await db
        .select()
        .from(schema.certificationLevels)
        .where(
          and(
            eq(schema.certificationLevels.organizationId, organizationId),
            eq(schema.certificationLevels.code, "padi-rescue")
          )
        )
        .limit(1);

      // Create 4 demo courses
      const courses = [];

      // Course 1: PADI Open Water Diver (beginner, 4 days, $450)
      if (padiAgency && owdLevel) {
        const [course1] = await db
          .insert(schema.trainingCourses)
          .values({
            organizationId,
            agencyId: padiAgency.id,
            levelId: owdLevel.id,
            name: "PADI Open Water Diver",
            code: "OWD",
            description: "Learn to dive with PADI, the world's leading scuba diving training organization. This entry-level course teaches you the skills and knowledge to become a certified diver.",
            durationDays: 4,
            classroomHours: 8,
            poolHours: 8,
            openWaterDives: 4,
            price: "450.00",
            currency: "USD",
            minStudents: 2,
            maxStudents: 8,
            materialsIncluded: true,
            equipmentIncluded: false,
            minAge: 10,
            prerequisites: "Basic swimming ability, comfort in water",
            medicalRequirements: "PADI Medical Statement required",
            images: [
              "https://images.unsplash.com/photo-1544551763-8dd44758c2dd?w=1200",
              "https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=1200",
            ],
            isPublic: true,
            isActive: true,
            sortOrder: 1,
          })
          .returning();
        courses.push(course1);
        coursesSeeded++;
      }

      // Course 2: PADI Advanced Open Water (intermediate, 2 days, $350)
      if (padiAgency && aowdLevel) {
        const [course2] = await db
          .insert(schema.trainingCourses)
          .values({
            organizationId,
            agencyId: padiAgency.id,
            levelId: aowdLevel.id,
            name: "PADI Advanced Open Water",
            code: "AOWD",
            description: "Build on your Open Water skills with adventure dives including deep diving, underwater navigation, and three specialty dives of your choice.",
            durationDays: 2,
            classroomHours: 0,
            poolHours: 0,
            openWaterDives: 5,
            price: "350.00",
            currency: "USD",
            minStudents: 2,
            maxStudents: 6,
            materialsIncluded: true,
            equipmentIncluded: false,
            minAge: 12,
            prerequisites: "PADI Open Water Diver or equivalent",
            requiredCertLevel: owdLevel.id,
            images: [
              "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
              "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200",
            ],
            isPublic: true,
            isActive: true,
            sortOrder: 2,
          })
          .returning();
        courses.push(course2);
        coursesSeeded++;
      }

      // Course 3: SSI Enriched Air Nitrox (specialty, 1 day, $175)
      if (ssiAgency) {
        const [course3] = await db
          .insert(schema.trainingCourses)
          .values({
            organizationId,
            agencyId: ssiAgency.id,
            name: "SSI Enriched Air Nitrox",
            code: "EAN",
            description: "Learn to safely dive with enriched air (nitrox) to extend your bottom time and reduce nitrogen loading.",
            durationDays: 1,
            classroomHours: 4,
            poolHours: 0,
            openWaterDives: 0,
            price: "175.00",
            currency: "USD",
            minStudents: 2,
            maxStudents: 10,
            materialsIncluded: true,
            equipmentIncluded: false,
            minAge: 12,
            prerequisites: "Any entry-level certification",
            images: [
              "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200",
            ],
            isPublic: true,
            isActive: true,
            sortOrder: 3,
          })
          .returning();
        courses.push(course3);
        coursesSeeded++;
      }

      // Course 4: PADI Rescue Diver (advanced, 3 days, $550)
      if (padiAgency && rescueLevel) {
        const [course4] = await db
          .insert(schema.trainingCourses)
          .values({
            organizationId,
            agencyId: padiAgency.id,
            levelId: rescueLevel.id,
            name: "PADI Rescue Diver",
            code: "RESCUE",
            description: "Challenge yourself to become a better dive buddy by learning to prevent and manage diving emergencies.",
            durationDays: 3,
            classroomHours: 12,
            poolHours: 8,
            openWaterDives: 4,
            price: "550.00",
            currency: "USD",
            minStudents: 2,
            maxStudents: 6,
            materialsIncluded: true,
            equipmentIncluded: false,
            minAge: 12,
            prerequisites: "PADI Advanced Open Water + 20 logged dives + CPR/First Aid certification within 24 months",
            requiredCertLevel: aowdLevel?.id,
            images: [
              "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1200",
              "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200",
            ],
            isPublic: true,
            isActive: true,
            sortOrder: 4,
          })
          .returning();
        courses.push(course4);
        coursesSeeded++;
      }

      // Create 2-3 sessions per course (mix of scheduled and open status)
      for (const course of courses) {
        // Session 1: Near future (2 weeks out) - scheduled
        await db
          .insert(schema.trainingSessions)
          .values({
            organizationId,
            courseId: course.id,
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            startTime: "09:00:00",
            location: "Dive Shop Classroom & Pool",
            meetingPoint: "Front desk at 8:45 AM",
            instructorName: "Sarah Johnson",
            maxStudents: course.maxStudents,
            status: "scheduled",
            notes: "All materials provided. Bring swimsuit and towel.",
          })
          .returning();
        sessionsSeeded++;

        // Session 2: Next month - open for enrollment
        await db
          .insert(schema.trainingSessions)
          .values({
            organizationId,
            courseId: course.id,
            startDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            startTime: null, // Test nullable startTime
            location: "Dive Shop Classroom",
            instructorName: "Mike Torres",
            maxStudents: course.maxStudents,
            status: "open",
            notes: "Schedule flexible - time TBA based on student availability.",
          })
          .returning();
        sessionsSeeded++;

        // Session 3: Weekend session (if not specialty course)
        if (course.durationDays > 1) {
          await db
            .insert(schema.trainingSessions)
            .values({
              organizationId,
              courseId: course.id,
              startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              startTime: "08:00:00",
              location: "Dive Shop & Local Beach",
              meetingPoint: "Meet at shop, carpool to beach",
              instructorName: "David Chen",
              maxStudents: course.maxStudents - 2, // Smaller weekend class
              priceOverride: (parseFloat(course.price) + 50).toString(), // Weekend premium
              status: "open",
              notes: "Weekend intensive format. Lunch included.",
            })
            .returning();
          sessionsSeeded++;
        }
      }

      console.log(`  ✓ Created ${coursesSeeded} courses and ${sessionsSeeded} sessions`);

      // Training Enrollments
      const allSessions = await db
        .select()
        .from(schema.trainingSessions)
        .where(eq(schema.trainingSessions.organizationId, organizationId))
        .orderBy(schema.trainingSessions.createdAt);

      const sessionIds = allSessions.map((s) => s.id);

      const enrollments = [
        { sessionIdx: 0, customerIdx: 5, status: "enrolled", paymentStatus: "paid", amountPaid: "450.00", progress: { classroomComplete: false, poolComplete: false, openWaterDivesCompleted: 0 }, skillCheckoffs: null, certificationNumber: null, certificationDate: null, completedAt: null, notes: "Beginner student, very motivated" },
        { sessionIdx: 0, customerIdx: 13, status: "in_progress", paymentStatus: "paid", amountPaid: "450.00", progress: { classroomComplete: true, poolComplete: true, openWaterDivesCompleted: 2 }, skillCheckoffs: [{ skill: "Mask clearing", completedAt: "2026-02-10T10:00:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Regulator recovery", completedAt: "2026-02-10T10:30:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Buoyancy control", completedAt: "2026-02-11T09:00:00Z", signedOffBy: "Sarah Johnson" }], certificationNumber: null, certificationDate: null, completedAt: null, notes: "Good progress, 2 OW dives remaining" },
        { sessionIdx: 1, customerIdx: 10, status: "enrolled", paymentStatus: "partial", amountPaid: "225.00", progress: { classroomComplete: false, poolComplete: false, openWaterDivesCompleted: 0 }, skillCheckoffs: null, certificationNumber: null, certificationDate: null, completedAt: null, notes: "First international dive trip - deposit paid, balance due on first day" },
        { sessionIdx: 3, customerIdx: 3, status: "completed", paymentStatus: "paid", amountPaid: "350.00", progress: { classroomComplete: true, poolComplete: true, openWaterDivesCompleted: 5, finalExamScore: 92 }, skillCheckoffs: [{ skill: "Deep dive - 30m descent", completedAt: "2026-02-08T09:30:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Navigation - compass course", completedAt: "2026-02-08T11:00:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Night dive procedures", completedAt: "2026-02-09T19:00:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Drift dive technique", completedAt: "2026-02-10T10:00:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Peak performance buoyancy", completedAt: "2026-02-10T14:00:00Z", signedOffBy: "Sarah Johnson" }], certificationNumber: "PADI-AOWD-2026-0042", certificationDate: "2026-02-11", completedAt: new Date("2026-02-11T16:00:00Z"), notes: "Excellent student, passed all adventure dives on first attempt" },
        { sessionIdx: 3, customerIdx: 12, status: "in_progress", paymentStatus: "paid", amountPaid: "350.00", progress: { classroomComplete: true, poolComplete: true, openWaterDivesCompleted: 3 }, skillCheckoffs: [{ skill: "Deep dive - 30m descent", completedAt: "2026-02-08T09:30:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Navigation - compass course", completedAt: "2026-02-08T11:00:00Z", signedOffBy: "Sarah Johnson" }, { skill: "Night dive procedures", completedAt: "2026-02-09T19:00:00Z", signedOffBy: "Sarah Johnson" }], certificationNumber: null, certificationDate: null, completedAt: null, notes: "2 adventure dives remaining - drift and PPB scheduled for weekend" },
        { sessionIdx: 6, customerIdx: 0, status: "completed", paymentStatus: "paid", amountPaid: "175.00", progress: { classroomComplete: true, finalExamScore: 88 }, skillCheckoffs: [{ skill: "Nitrox analyzer operation", completedAt: "2026-01-20T10:00:00Z", signedOffBy: "Mike Torres" }, { skill: "MOD calculation", completedAt: "2026-01-20T11:00:00Z", signedOffBy: "Mike Torres" }], certificationNumber: "SSI-EAN-2026-0018", certificationDate: "2026-01-20", completedAt: new Date("2026-01-20T15:00:00Z"), notes: "Already had Nitrox from PADI, wanted SSI cross-cert" },
        { sessionIdx: 7, customerIdx: 11, status: "enrolled", paymentStatus: "paid", amountPaid: "175.00", progress: { classroomComplete: false }, skillCheckoffs: null, certificationNumber: null, certificationDate: null, completedAt: null, notes: "Rescue diver looking to add Nitrox specialty" },
        { sessionIdx: 8, customerIdx: 4, status: "in_progress", paymentStatus: "paid", amountPaid: "550.00", progress: { classroomComplete: true, poolComplete: true, openWaterDivesCompleted: 2 }, skillCheckoffs: [{ skill: "Tired diver tow", completedAt: "2026-02-12T09:00:00Z", signedOffBy: "David Chen" }, { skill: "Panicked diver response", completedAt: "2026-02-12T10:30:00Z", signedOffBy: "David Chen" }, { skill: "Unconscious diver at surface", completedAt: "2026-02-13T09:00:00Z", signedOffBy: "David Chen" }, { skill: "Underwater rescue breathing", completedAt: "2026-02-13T11:00:00Z", signedOffBy: "David Chen" }], certificationNumber: null, certificationDate: null, completedAt: null, notes: "Already has BSAC Sports Diver & PADI Rescue crossover. Strong skills." },
        { sessionIdx: 9, customerIdx: 8, status: "enrolled", paymentStatus: "partial", amountPaid: "275.00", progress: { classroomComplete: false, poolComplete: false, openWaterDivesCompleted: 0 }, skillCheckoffs: null, certificationNumber: null, certificationDate: null, completedAt: null, notes: "VIP customer, upgrading certification path. 50% deposit paid." },
        { sessionIdx: 2, customerIdx: 1, status: "dropped", paymentStatus: "refunded", amountPaid: "0.00", progress: { classroomComplete: false, poolComplete: false, openWaterDivesCompleted: 0 }, skillCheckoffs: null, certificationNumber: null, certificationDate: null, completedAt: null, notes: "Scheduling conflict - rescheduling to next month's session" },
      ];

      for (const enrollment of enrollments) {
        if (sessionIds[enrollment.sessionIdx]) {
          await db
            .insert(schema.trainingEnrollments)
            .values({
              organizationId,
              sessionId: sessionIds[enrollment.sessionIdx],
              customerId: customerIds[enrollment.customerIdx],
              status: enrollment.status,
              paymentStatus: enrollment.paymentStatus,
              amountPaid: enrollment.amountPaid,
              progress: enrollment.progress,
              skillCheckoffs: enrollment.skillCheckoffs,
              certificationNumber: enrollment.certificationNumber,
              certificationDate: enrollment.certificationDate,
              completedAt: enrollment.completedAt,
              notes: enrollment.notes,
            });
        }
      }
      console.log(`  ✓ Created ${enrollments.length} training enrollments`);
    } else {
      console.log("  ℹ️  Training courses already exist, skipping...");
    }

    trainingStats = {
      agencies: agenciesSeeded,
      levels: levelsSeeded,
      courses: coursesSeeded,
      sessions: sessionsSeeded
    };
  } catch (error) {
    console.warn("  ⚠️  Warning: Training data seeding failed:", error);
  }

  // ============================================================================
  // GALLERY DATA (Albums and Images)
  // ============================================================================

  console.log("\n📸 Seeding gallery data...");

  // Check if gallery data already exists
  const existingAlbums = await db
    .select()
    .from(schema.galleryAlbums)
    .where(eq(schema.galleryAlbums.organizationId, organizationId));

  let galleryStats = { albums: 0, images: 0 };

  if (existingAlbums.length === 0) {
    try {
      // Album 1: Reef Explorations
      const [reefAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Reef Explorations", slug: "reef-explorations", description: "Vibrant coral formations, colorful reef fish, and stunning underwater landscapes from our most popular reef dive sites.", coverImageUrl: "https://images.unsplash.com/photo-1708649290066-5f617003b93f?w=1200", sortOrder: 0, isPublic: true }).returning();

      // Album 2: Wreck Adventures
      const [wreckAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Wreck Adventures", slug: "wreck-adventures", description: "Explore sunken ships, aircraft, and artificial reefs encrusted with marine life. Our wreck dives offer history and adventure beneath the waves.", coverImageUrl: "https://images.unsplash.com/photo-1639501840591-9dbca7be82b2?w=1200", sortOrder: 1, isPublic: true }).returning();

      // Album 3: Marine Life Encounters
      const [marineLifeAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Marine Life Encounters", slug: "marine-life-encounters", description: "Up-close encounters with sea turtles, manta rays, reef sharks, seahorses, and octopus captured by our staff and guests.", coverImageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200", sortOrder: 2, isPublic: true }).returning();

      // Album 4: Our Team
      const [teamAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Our Team", slug: "our-team", description: "Meet the instructors, divemasters, and crew who make every dive safe and memorable.", coverImageUrl: "https://images.unsplash.com/photo-1682686581551-867e0b208bd1?w=1200", sortOrder: 3, isPublic: true }).returning();

      // Album 5: Customer Highlights
      const [customerAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Customer Highlights", slug: "customer-highlights", description: "Our favorite moments from happy divers — first-time experiences, group adventures, and surface celebrations.", coverImageUrl: "https://images.unsplash.com/photo-1646947009718-1cb77aaa2a6d?w=1200", sortOrder: 4, isPublic: true }).returning();

      // Album 6: Night Diving
      const [nightAlbum] = await db.insert(schema.galleryAlbums).values({ organizationId, name: "Night Diving", slug: "night-diving", description: "The reef transforms after dark — bioluminescence, nocturnal creatures, and flashlight-lit reef walls create an otherworldly experience.", coverImageUrl: "https://images.unsplash.com/photo-1742325989789-b42912a531dd?w=1200", sortOrder: 5, isPublic: true }).returning();

      // Gallery Images (~27 total)
      const galleryImageData = [
        // Reef Explorations (5)
        { albumId: reefAlbum.id, title: "Elkhorn Coral Formation", description: "Massive elkhorn coral colony thriving at 15 meters depth on the outer reef wall.", category: "coral-reefs", tags: ["coral", "reef", "elkhorn", "caribbean"], imageUrl: "https://images.unsplash.com/photo-1708649290066-5f617003b93f?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1708649290066-5f617003b93f?w=400", dateTaken: "2026-01-15", location: "Coral Garden, 15m depth", photographer: "Sarah Johnson", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Sony A7R IV", lens: "28-70mm f/2.8", settings: "1/250s f/5.6 ISO 400", altText: "Large elkhorn coral formation with branching arms against blue water", downloadable: true } },
        { albumId: reefAlbum.id, title: "Diver Over the Coral Garden", description: "A diver glides over an expansive field of hard and soft corals at our signature Coral Garden site.", category: "coral-reefs", tags: ["diver", "coral", "reef", "wide-angle"], imageUrl: "https://images.unsplash.com/photo-1682687981907-170c006e3744?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1682687981907-170c006e3744?w=400", dateTaken: "2025-11-22", location: "Coral Garden, 12m depth", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/200s f/8 ISO 320", altText: "Scuba diver swimming above a colorful coral reef garden", downloadable: true } },
        { albumId: reefAlbum.id, title: "Rabbitfish on the Reef", description: "Colorful rabbitfish and chromis darting between vibrant hard coral heads on the shallow reef flat.", category: "coral-reefs", tags: ["fish", "reef", "rabbitfish", "tropical"], imageUrl: "https://images.unsplash.com/photo-1747352293509-af072817ea86?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1747352293509-af072817ea86?w=400", dateTaken: "2025-12-08", location: "Coral Garden, 8m depth", photographer: "Sarah Johnson", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Sony A7R IV", lens: "90mm f/2.8 Macro", settings: "1/320s f/7.1 ISO 500", altText: "Colorful reef fish swimming among vibrant coral formations", downloadable: true } },
        { albumId: reefAlbum.id, title: "Crystal Blue Reef Wall", description: "The outer reef wall drops into crystal-clear blue water, with soft corals and sea fans catching the current.", category: "coral-reefs", tags: ["reef", "wall", "blue", "wide-angle"], imageUrl: "https://images.unsplash.com/photo-1768851719323-61ab229fb60e?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1768851719323-61ab229fb60e?w=400", dateTaken: "2026-01-28", location: "The Wall, 18m depth", photographer: "David Chen", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/160s f/9 ISO 250", altText: "Underwater coral reef wall descending into deep blue water", downloadable: true } },
        { albumId: reefAlbum.id, title: "Schooling Fish Over the Reef", description: "A shimmering school of fusiliers passes over a coral bommie, creating a living curtain of silver and blue.", category: "coral-reefs", tags: ["fish", "school", "reef", "fusilier"], imageUrl: "https://images.unsplash.com/photo-1690029628803-15ff2c883018?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1690029628803-15ff2c883018?w=400", dateTaken: "2025-10-14", location: "Coral Garden, 10m depth", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 4, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/400s f/5.6 ISO 640", altText: "Large school of fish swimming over a colorful coral reef", downloadable: true } },
        // Wreck Adventures (4)
        { albumId: wreckAlbum.id, title: "The Wreck of the MV Dorado", description: "A diver explores the bow section of the MV Dorado, a cargo vessel scuttled in 1998 to create an artificial reef.", category: "wrecks", tags: ["wreck", "ship", "exploration", "bow"], imageUrl: "https://images.unsplash.com/photo-1639501840591-9dbca7be82b2?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1639501840591-9dbca7be82b2?w=400", dateTaken: "2025-09-18", location: "Shipwreck Bay, 22m depth", photographer: "David Chen", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/125s f/4 ISO 800", altText: "Scuba diver swimming alongside a large sunken ship hull", downloadable: true } },
        { albumId: wreckAlbum.id, title: "Flag in the Deep", description: "A diver illuminates a preserved flag inside the wreck's wheelhouse.", category: "wrecks", tags: ["wreck", "interior", "flag", "penetration"], imageUrl: "https://images.unsplash.com/photo-1751677524360-978c93b2c0b2?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1751677524360-978c93b2c0b2?w=400", dateTaken: "2025-10-05", location: "Shipwreck Bay, 25m depth", photographer: "David Chen", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/80s f/4 ISO 1600", altText: "Scuba diver shining torch on a flag inside a shipwreck", downloadable: true } },
        { albumId: wreckAlbum.id, title: "Wreck Penetration Dive", description: "Exploring the dark corridors of the wreck interior. Advanced certification required.", category: "wrecks", tags: ["wreck", "penetration", "advanced", "dark"], imageUrl: "https://images.unsplash.com/photo-1758968611255-af2c6f31370a?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1758968611255-af2c6f31370a?w=400", dateTaken: "2026-01-10", location: "Shipwreck Bay, 28m depth", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/60s f/4 ISO 3200", altText: "Diver exploring a dark underwater wreck corridor with dive light", downloadable: true } },
        { albumId: wreckAlbum.id, title: "Coral-Encrusted Swim-Through", description: "Years of growth have transformed this wreck passage into a living tunnel of sponges, corals, and sea fans.", category: "wrecks", tags: ["wreck", "coral", "swim-through", "encrusted"], imageUrl: "https://images.unsplash.com/photo-1682687982167-d7fb3ed8541d?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1682687982167-d7fb3ed8541d?w=400", dateTaken: "2025-12-20", location: "Shipwreck Bay, 20m depth", photographer: "Sarah Johnson", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "Sony A7R IV", lens: "28-70mm f/2.8", settings: "1/100s f/5.6 ISO 1000", altText: "Diver swimming through a coral-covered passage inside a shipwreck", downloadable: true } },
        // Marine Life Encounters (5)
        { albumId: marineLifeAlbum.id, title: "Green Sea Turtle Cruising", description: "A graceful green sea turtle glides over the reef, pausing occasionally to graze on sea grass.", category: "marine-life", tags: ["turtle", "green", "wildlife", "reef"], imageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=400", dateTaken: "2025-11-05", location: "Coral Garden, 8m depth", photographer: "Sarah Johnson", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Sony A7R IV", lens: "28-70mm f/2.8", settings: "1/320s f/5.6 ISO 400", altText: "Green sea turtle swimming gracefully over a coral reef", downloadable: true } },
        { albumId: marineLifeAlbum.id, title: "Manta Ray Flyby", description: "A massive oceanic manta ray soars overhead at Manta Point, its wingspan exceeding three meters.", category: "marine-life", tags: ["manta", "ray", "pelagic", "manta-point"], imageUrl: "https://images.unsplash.com/photo-1542443605-fcefd6550d4a?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1542443605-fcefd6550d4a?w=400", dateTaken: "2025-12-15", location: "Manta Point, 14m depth", photographer: "David Chen", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/500s f/7.1 ISO 320", altText: "Large manta ray with black and white markings gliding through open water", downloadable: true } },
        { albumId: marineLifeAlbum.id, title: "Reef Shark Patrol", description: "A Caribbean reef shark cruises along the drop-off, keeping a watchful eye on divers.", category: "marine-life", tags: ["shark", "reef-shark", "predator", "caribbean"], imageUrl: "https://images.unsplash.com/photo-1670740307661-3e3a9805c45c?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1670740307661-3e3a9805c45c?w=400", dateTaken: "2026-01-22", location: "The Wall, 20m depth", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/400s f/5.6 ISO 500", altText: "Caribbean reef shark swimming along an underwater reef wall", downloadable: true } },
        { albumId: marineLifeAlbum.id, title: "Pygmy Seahorse Portrait", description: "Tiny pygmy seahorse clinging to a sea fan — barely two centimeters long and perfectly camouflaged.", category: "marine-life", tags: ["seahorse", "pygmy", "macro", "camouflage"], imageUrl: "https://images.unsplash.com/photo-1523585895729-a4bb980d5c14?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1523585895729-a4bb980d5c14?w=400", dateTaken: "2025-10-30", location: "Coral Garden, 16m depth", photographer: "Sarah Johnson", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "Sony A7R IV", lens: "90mm f/2.8 Macro", settings: "1/160s f/11 ISO 200", altText: "Tiny seahorse clinging to a pink sea fan branch", downloadable: true } },
        { albumId: marineLifeAlbum.id, title: "Octopus on the Move", description: "A common reef octopus caught mid-stride across the sandy bottom, its chromatophores shifting colors in real-time.", category: "marine-life", tags: ["octopus", "cephalopod", "camouflage", "reef"], imageUrl: "https://images.unsplash.com/photo-1510637234398-d25c9570a0a0?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1510637234398-d25c9570a0a0?w=400", dateTaken: "2026-02-01", location: "Blue Hole, 12m depth", photographer: "David Chen", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 4, metadata: { camera: "Canon R5", lens: "100mm f/2.8 Macro", settings: "1/200s f/8 ISO 640", altText: "Reef octopus moving across the ocean floor with tentacles extended", downloadable: true } },
        // Our Team (4)
        { albumId: teamAlbum.id, title: "Pre-Dive Gear Check", description: "Instructor Sarah Johnson runs through the buddy check with a student before their first open-water descent.", category: "team", tags: ["instructor", "gear", "safety", "training"], imageUrl: "https://images.unsplash.com/photo-1682686581551-867e0b208bd1?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1682686581551-867e0b208bd1?w=400", dateTaken: "2025-11-10", location: "Dive Center Dock", photographer: "Mike Torres", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Nikon Z8", lens: "24-70mm f/2.8", settings: "1/500s f/5.6 ISO 200", altText: "Diving instructor helping student check scuba gear on the dock", downloadable: true } },
        { albumId: teamAlbum.id, title: "Classroom Briefing", description: "David Chen leads the morning dive briefing, covering site conditions and safety protocols.", category: "team", tags: ["instructor", "briefing", "training", "classroom"], imageUrl: "https://images.unsplash.com/photo-1645453352382-4528c269cd5d?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1645453352382-4528c269cd5d?w=400", dateTaken: "2025-12-01", location: "Dive Center Classroom", photographer: "Sarah Johnson", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Sony A7R IV", lens: "24-70mm f/2.8", settings: "1/125s f/4 ISO 800", altText: "Scuba instructor leading a dive briefing session with students", downloadable: true } },
        { albumId: teamAlbum.id, title: "Boat Operations", description: "Captain Mike Torres at the helm of our dive boat, navigating to the morning's dive site.", category: "team", tags: ["boat", "captain", "operations", "sea"], imageUrl: "https://images.unsplash.com/photo-1708961571391-29a62c082300?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1708961571391-29a62c082300?w=400", dateTaken: "2026-01-05", location: "Offshore, en route to Manta Point", photographer: "David Chen", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Canon R5", lens: "24-70mm f/2.8", settings: "1/1000s f/8 ISO 100", altText: "Dive boat captain navigating toward the dive site on calm seas", downloadable: true } },
        { albumId: teamAlbum.id, title: "Team Photo — 2026 Season", description: "The full crew: instructors, divemasters, and boat staff ready for another season of world-class diving.", category: "team", tags: ["team", "group", "staff", "photo"], imageUrl: "https://images.unsplash.com/photo-1736943993933-c1a407ed783c?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1736943993933-c1a407ed783c?w=400", dateTaken: "2026-01-02", location: "Dive Center", photographer: "Guest submission", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "iPhone 15 Pro", lens: "Built-in 24mm", settings: "Auto", altText: "Group photo of the dive center team standing together at the dock", downloadable: true } },
        // Customer Highlights (5)
        { albumId: customerAlbum.id, title: "Group Dive at Coral Garden", description: "A group of certified divers explores the Coral Garden together on a gorgeous morning dive.", category: "customers", tags: ["group", "divers", "coral-garden", "fun"], imageUrl: "https://images.unsplash.com/photo-1646947009718-1cb77aaa2a6d?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1646947009718-1cb77aaa2a6d?w=400", dateTaken: "2025-11-20", location: "Coral Garden, 10m depth", photographer: "Mike Torres", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/250s f/7.1 ISO 400", altText: "Group of scuba divers swimming together over a coral reef", downloadable: true } },
        { albumId: customerAlbum.id, title: "Thumbs Up from the Deep", description: "A happy diver gives the thumbs-up signal at 15 meters — all good down here!", category: "customers", tags: ["diver", "thumbs-up", "happy", "underwater"], imageUrl: "https://images.unsplash.com/photo-1742461399600-3ded0fe5bb0e?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1742461399600-3ded0fe5bb0e?w=400", dateTaken: "2026-01-18", location: "Blue Hole, 15m depth", photographer: "Sarah Johnson", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Sony A7R IV", lens: "28-70mm f/2.8", settings: "1/200s f/5.6 ISO 500", altText: "Scuba diver giving thumbs-up signal underwater", downloadable: true } },
        { albumId: customerAlbum.id, title: "First Open Water Dive", description: "Nothing beats the smile after your first real open water dive. Welcome to the underwater world!", category: "customers", tags: ["first-dive", "student", "open-water", "milestone"], imageUrl: "https://images.unsplash.com/photo-1502209524164-acea936639a2?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1502209524164-acea936639a2?w=400", dateTaken: "2025-12-12", location: "Coral Garden, 6m depth", photographer: "David Chen", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/320s f/6.3 ISO 320", altText: "New diver descending into open water for the first time", downloadable: true } },
        { albumId: customerAlbum.id, title: "Surface Celebration", description: "Back on the surface after an amazing deep dive — high fives and big smiles all around.", category: "customers", tags: ["surface", "celebration", "happy", "post-dive"], imageUrl: "https://images.unsplash.com/photo-1682695796497-31a44224d6d6?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1682695796497-31a44224d6d6?w=400", dateTaken: "2026-02-02", location: "Dive Boat, surface", photographer: "Guest submission", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "GoPro Hero 12", lens: "Built-in wide", settings: "Auto", altText: "Divers celebrating on the surface after emerging from a dive", downloadable: true } },
        { albumId: customerAlbum.id, title: "Ascending from the Blue", description: "A diver ascends toward the boat after a spectacular wall dive, silhouetted against the afternoon sun.", category: "customers", tags: ["ascent", "silhouette", "wall-dive", "scenic"], imageUrl: "https://images.unsplash.com/photo-1758968571011-af0157c61d7b?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1758968571011-af0157c61d7b?w=400", dateTaken: "2025-10-25", location: "The Wall, 5m safety stop", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 4, metadata: { camera: "Nikon Z8", lens: "14-30mm f/4", settings: "1/500s f/8 ISO 200", altText: "Silhouette of diver ascending toward the surface with sunlight above", downloadable: true } },
        // Night Diving (4)
        { albumId: nightAlbum.id, title: "Into the Darkness", description: "A diver descends into the black water with only a dive torch for company.", category: "night-dive", tags: ["night", "dark", "torch", "descent"], imageUrl: "https://images.unsplash.com/photo-1742325989789-b42912a531dd?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1742325989789-b42912a531dd?w=400", dateTaken: "2025-11-28", location: "Coral Garden, 12m depth", photographer: "David Chen", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 0, metadata: { camera: "Canon R5", lens: "16-35mm f/2.8", settings: "1/60s f/2.8 ISO 3200", altText: "Scuba diver exploring a reef at night using a dive torch", downloadable: true } },
        { albumId: nightAlbum.id, title: "Bioluminescent Jellyfish", description: "Bioluminescent jellyfish drift through the dark water column, their translucent bells pulsing with ethereal blue light.", category: "night-dive", tags: ["jellyfish", "bioluminescence", "night", "glow"], imageUrl: "https://images.unsplash.com/photo-1760710461795-d6199296eb50?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1760710461795-d6199296eb50?w=400", dateTaken: "2026-01-08", location: "Blue Hole, 10m depth", photographer: "Sarah Johnson", isFeatured: true, width: 1200, height: 800, status: "published", sortOrder: 1, metadata: { camera: "Sony A7R IV", lens: "90mm f/2.8 Macro", settings: "1/100s f/4 ISO 2000", altText: "Glowing jellyfish drifting through dark blue water at night", downloadable: true } },
        { albumId: nightAlbum.id, title: "Nocturnal Reef Hunters", description: "A moray eel emerges from its crevice to hunt under cover of darkness.", category: "night-dive", tags: ["moray", "eel", "nocturnal", "predator"], imageUrl: "https://images.unsplash.com/photo-1753644350251-406de7f5f3ae?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1753644350251-406de7f5f3ae?w=400", dateTaken: "2025-12-22", location: "Coral Garden, 14m depth", photographer: "Mike Torres", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 2, metadata: { camera: "Nikon Z8", lens: "60mm f/2.8 Macro", settings: "1/125s f/5.6 ISO 1600", altText: "Jellyfish gliding through dark underwater scene illuminated by dive light", downloadable: true } },
        { albumId: nightAlbum.id, title: "Blue Glow", description: "Bioluminescent plankton creates an otherworldly blue glow around a jellyfish in the dark water column.", category: "night-dive", tags: ["bioluminescence", "plankton", "blue", "glow"], imageUrl: "https://images.unsplash.com/photo-1513570050319-4797c2aef25e?w=1200", thumbnailUrl: "https://images.unsplash.com/photo-1513570050319-4797c2aef25e?w=400", dateTaken: "2026-02-05", location: "Blue Hole, 8m depth", photographer: "Sarah Johnson", isFeatured: false, width: 1200, height: 800, status: "published", sortOrder: 3, metadata: { camera: "Sony A7R IV", lens: "90mm f/2.8 Macro", settings: "1/80s f/3.5 ISO 2500", altText: "Blue bioluminescent glow surrounding a jellyfish in dark water", downloadable: true } },
      ];

      for (const img of galleryImageData) {
        await db.insert(schema.galleryImages).values({
          organizationId,
          ...img,
        });
      }

      galleryStats = { albums: 6, images: galleryImageData.length };
      console.log("  ✓ Gallery data seeded");
    } catch (error) {
      console.warn("  ⚠️  Warning: Gallery data seeding failed:", error);
    }
  } else {
    console.log("  ℹ️  Gallery data already exists, skipping...");
  }

  console.log(`Demo data seeded for organization: ${organizationId}`);
  console.log(`  - ${customers.length} customers`);
  console.log(`  - ${diveSites.length} dive sites`);
  console.log(`  - ${boats.length} boats`);
  console.log(`  - ${equipmentItems.length} equipment items`);
  console.log(`  - ${tours.length} tours`);
  console.log(`  - ${trips.length} scheduled trips`);
  console.log(`  - ${bookings.length} bookings`);
  console.log(`  - ${products.length} products`);
  console.log(`  - ${discountCodes.length} discount codes`);
  console.log(`  - ${transactionData.length + posTransactions.length} transactions`);
  console.log(`  - ${imageEntries.length} images`);
  console.log(`  - ${rentalCount} rentals`);
  console.log(`  - ${trainingStats.agencies} training agencies`);
  console.log(`  - ${trainingStats.levels} certification levels`);
  console.log(`  - ${trainingStats.courses || 0} training courses`);
  console.log(`  - ${trainingStats.sessions || 0} training sessions`);
  console.log(`  - ${galleryStats.albums} gallery albums`);
  console.log(`  - ${galleryStats.images} gallery images`);
}
