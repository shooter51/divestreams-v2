/**
 * Scale Test Configuration
 *
 * Generates 200 unique dive shop tenant configurations for scalability testing.
 */

export const TENANT_COUNT = 200;
export const OWNER_PASSWORD = "ScaleTest2026!";
export const DEFAULT_PLAN = "pro"; // All features enabled for testing

// Concurrency limits
export const CREATE_CONCURRENCY = 5;  // Tenants created in parallel
export const SEED_CONCURRENCY = 3;    // Tenants seeded in parallel (HTTP-heavy)

// Dive shop name components for generating unique names
const ADJECTIVES = [
  "Blue", "Deep", "Crystal", "Coral", "Pacific", "Atlantic", "Aqua", "Ocean",
  "Reef", "Tropical", "Azure", "Golden", "Silver", "Emerald", "Sapphire",
  "Tidal", "Coastal", "Island", "Marine", "Nautical", "Seaside", "Harbor",
  "Bay", "Lagoon", "Sunset", "Sunrise", "Neptune", "Poseidon", "Triton",
  "Meridian", "Horizon", "Current", "Wave", "Surf", "Pearl", "Anchor",
  "Compass", "Abyss", "Pelagic", "Benthic",
];

const NOUNS = [
  "Divers", "Diving", "Scuba", "Adventures", "Explorers", "Center",
  "Academy", "School", "Club", "Excursions", "Expeditions", "Charters",
  "Aquatics", "Dive Shop", "Dive Co", "Marine", "Underwater", "Sub-Aqua",
  "Dive Team", "Dive Hub",
];

const LOCATIONS = [
  "Key Largo", "Cozumel", "Maui", "Bali", "Phuket", "Bonaire", "Roatan",
  "Grand Cayman", "Cancun", "Tulum", "Koh Tao", "Red Sea", "Maldives",
  "Palau", "Raja Ampat", "Galapagos", "Fiji", "Sipadan", "Komodo",
  "Great Barrier", "Turks", "Bahamas", "Bermuda", "Curacao", "Aruba",
];

export interface TenantConfig {
  slug: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  location: string;
  index: number;
}

export function generateTenantConfigs(count: number = TENANT_COUNT): TenantConfig[] {
  const configs: TenantConfig[] = [];

  for (let i = 1; i <= count; i++) {
    const adj = ADJECTIVES[(i - 1) % ADJECTIVES.length];
    const noun = NOUNS[Math.floor((i - 1) / ADJECTIVES.length) % NOUNS.length];
    const location = LOCATIONS[(i - 1) % LOCATIONS.length];
    const num = String(i).padStart(3, "0");

    const name = `${adj} ${noun} ${num}`;
    const slug = `scale-${num}`;

    configs.push({
      slug,
      name,
      ownerEmail: `owner@${slug}.test`,
      ownerName: `Owner ${num}`,
      location,
      index: i,
    });
  }

  return configs;
}

// Smaller data sets for scale testing (lighter than demo seed)
export const SCALE_TOURS = [
  { name: "Discover Scuba", type: "single_dive", duration: 240, price: 149, maxParticipants: 4, minParticipants: 1, description: "Try scuba diving with expert instructors.", inclusionsStr: "Equipment rental,Instructor guidance", minCertLevel: "" },
  { name: "Morning Reef Dive", type: "multi_dive", duration: 300, price: 129, maxParticipants: 12, minParticipants: 2, description: "Two-tank morning dive on pristine reefs.", inclusionsStr: "Tanks,Weights,Dive guide", minCertLevel: "Open Water" },
  { name: "Night Dive", type: "night_dive", duration: 180, price: 89, maxParticipants: 8, minParticipants: 2, description: "Experience the reef after dark.", inclusionsStr: "Dive torch,Tanks,Weights", minCertLevel: "Open Water" },
  { name: "Wreck Explorer", type: "single_dive", duration: 180, price: 99, maxParticipants: 6, minParticipants: 2, description: "Explore a sunken wreck.", inclusionsStr: "Tanks,Weights,Briefing", minCertLevel: "Open Water" },
];

export const SCALE_BOATS = [
  { name: "Reef Runner", type: "Dive Boat", capacity: 12, description: "Purpose-built dive boat.", registrationNumber: "SC-001", amenities: ["Dive platform", "Sun deck", "First aid kit"] },
  { name: "Sea Spirit", type: "RIB", capacity: 8, description: "Fast rigid inflatable.", registrationNumber: "SC-002", amenities: ["Dive platform", "Shade cover", "First aid kit"] },
  { name: "Ocean Star", type: "Catamaran", capacity: 16, description: "Stable catamaran for groups.", registrationNumber: "SC-003", amenities: ["Dive platform", "Sun deck", "Toilet", "Freshwater shower"] },
];

export const SCALE_DIVE_SITES = [
  { name: "Coral Garden", location: "South Bay", description: "Shallow reef with abundant corals.", maxDepth: 12, difficulty: "beginner" as const, conditions: "Calm waters", latitude: 7.165, longitude: 134.271, highlights: ["Corals", "Clownfish"] },
  { name: "The Wall", location: "North Reef", description: "Dramatic vertical wall dive.", maxDepth: 40, difficulty: "advanced" as const, conditions: "Strong currents", latitude: 7.185, longitude: 134.265, highlights: ["Wall dive", "Pelagics"] },
  { name: "Turtle Cove", location: "East Bay", description: "Sheltered bay with turtles.", maxDepth: 14, difficulty: "beginner" as const, conditions: "Calm, sheltered", latitude: 7.158, longitude: 134.268, highlights: ["Turtles", "Seagrass"] },
  { name: "Shark Point", location: "Outer Reef", description: "Deep channel with sharks.", maxDepth: 35, difficulty: "advanced" as const, conditions: "Strong currents", latitude: 7.182, longitude: 134.275, highlights: ["Reef sharks", "Drift dive"] },
  { name: "Sunset Reef", location: "West Bay", description: "Beautiful reef for dusk dives.", maxDepth: 18, difficulty: "intermediate" as const, conditions: "Mild currents", latitude: 7.170, longitude: 134.260, highlights: ["Soft corals", "Lionfish"] },
];

export const SCALE_EQUIPMENT = [
  { category: "bcd", name: "BCD Rental", brand: "Scubapro", model: "Hydros", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "regulator", name: "Regulator Rental", brand: "Aqualung", model: "Legend", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 3mm", brand: "Bare", model: "Sport", size: "M", rentalPrice: 15, isRentable: true, isPublic: true },
];

export const SCALE_CUSTOMERS = [
  { firstName: "Sarah", lastName: "Johnson", email: "sarah@example.com", phone: "+1-555-0101", dateOfBirth: "1985-03-15", emergencyContactName: "David Johnson", emergencyContactPhone: "+1-555-0201", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Michael", lastName: "Chen", email: "michael@example.com", phone: "+1-555-0102", dateOfBirth: "1978-07-22", emergencyContactName: "Lisa Chen", emergencyContactPhone: "+1-555-0202", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },
  { firstName: "Emma", lastName: "Davis", email: "emma@example.com", phone: "+1-555-0103", dateOfBirth: "1992-11-08", emergencyContactName: "Tom Davis", emergencyContactPhone: "+1-555-0203", emergencyContactRelation: "Parent", certAgency: "SSI", certLevel: "Open Water" },
  { firstName: "James", lastName: "Wilson", email: "james@example.com", phone: "+1-555-0104", dateOfBirth: "1965-01-30", emergencyContactName: "Carol Wilson", emergencyContactPhone: "+1-555-0204", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Rescue Diver" },
  { firstName: "Olivia", lastName: "Brown", email: "olivia@example.com", phone: "+1-555-0105", dateOfBirth: "1990-05-12", emergencyContactName: "Henry Brown", emergencyContactPhone: "+1-555-0205", emergencyContactRelation: "Parent", certAgency: "NAUI", certLevel: "Open Water" },
  { firstName: "Carlos", lastName: "Silva", email: "carlos@example.com", phone: "+55-555-0106", dateOfBirth: "1984-03-28", emergencyContactName: "Lucia Silva", emergencyContactPhone: "+55-555-0206", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Yuki", lastName: "Nakamura", email: "yuki@example.com", phone: "+81-555-0107", dateOfBirth: "1991-09-05", emergencyContactName: "Kenji Nakamura", emergencyContactPhone: "+81-555-0207", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Fatima", lastName: "Hassan", email: "fatima@example.com", phone: "+971-555-0108", dateOfBirth: "1987-06-22", emergencyContactName: "Omar Hassan", emergencyContactPhone: "+971-555-0208", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Marco", lastName: "Rossi", email: "marco@example.com", phone: "+39-555-0109", dateOfBirth: "1979-11-14", emergencyContactName: "Sofia Rossi", emergencyContactPhone: "+39-555-0209", emergencyContactRelation: "Spouse", certAgency: "SSI", certLevel: "Divemaster" },
  { firstName: "Aisha", lastName: "Okafor", email: "aisha@example.com", phone: "+234-555-0110", dateOfBirth: "1994-02-08", emergencyContactName: "Emeka Okafor", emergencyContactPhone: "+234-555-0210", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
];

export const SCALE_PRODUCTS = [
  { name: "BCD Rental", category: "rental", price: 25, sku: "RNT-BCD", description: "Full day BCD rental", trackInventory: false },
  { name: "Regulator Rental", category: "rental", price: 20, sku: "RNT-REG", description: "Full day regulator rental", trackInventory: false },
  { name: "Dive T-Shirt", category: "apparel", price: 25, sku: "APP-TSH", description: "Shop t-shirt", trackInventory: true, stockQuantity: 50, lowStockThreshold: 10 },
  { name: "Reef Sunscreen", category: "accessories", price: 12, sku: "CON-SUN", description: "Reef-safe SPF 50", trackInventory: true, stockQuantity: 40, lowStockThreshold: 10 },
  { name: "Log Book", category: "courses", price: 15, sku: "CRS-LOG", description: "Dive log book", trackInventory: true, stockQuantity: 30, lowStockThreshold: 5 },
];
