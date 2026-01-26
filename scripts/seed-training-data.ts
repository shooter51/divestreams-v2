#!/usr/bin/env tsx
/**
 * Training Data Seed Script (DIVE-8bl)
 *
 * Seeds comprehensive training certification data:
 * - Training agencies (PADI, SSI, NAUI, SDI/TDI, CMAS, BSAC, GUE)
 * - Certification levels (beginner, intermediate, professional, technical, specialties)
 * - Sample courses with pricing, duration, and prerequisites
 * - Prerequisite chains and validation rules
 *
 * Usage:
 *   npm run seed:training -- --subdomain=demo
 *   npm run seed:training -- --org-id=<uuid>
 */

import { db } from "../lib/db";
import {
  organization,
  certificationAgencies,
  certificationLevels,
  trainingCourses
} from "../lib/db/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// TRAINING AGENCIES DATA
// ============================================================================

const AGENCIES = [
  {
    code: "padi",
    name: "PADI",
    description: "Professional Association of Diving Instructors - The world's largest recreational diving membership organization",
    website: "https://www.padi.com",
    logoUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&q=80",
  },
  {
    code: "ssi",
    name: "SSI",
    description: "Scuba Schools International - Digital learning innovator in dive training",
    website: "https://www.divessi.com",
    logoUrl: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=200&q=80",
  },
  {
    code: "naui",
    name: "NAUI",
    description: "National Association of Underwater Instructors - Dive safety through education",
    website: "https://www.naui.org",
    logoUrl: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=200&q=80",
  },
  {
    code: "sdi-tdi",
    name: "SDI/TDI",
    description: "Scuba Diving International / Technical Diving International - Recreational and technical diving",
    website: "https://www.tdisdi.com",
    logoUrl: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=200&q=80",
  },
  {
    code: "cmas",
    name: "CMAS",
    description: "World Underwater Federation - International diving federation",
    website: "https://www.cmas.org",
    logoUrl: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=200&q=80",
  },
  {
    code: "bsac",
    name: "BSAC",
    description: "British Sub-Aqua Club - UK's national governing body for diving",
    website: "https://www.bsac.com",
    logoUrl: "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=200&q=80",
  },
  {
    code: "gue",
    name: "GUE",
    description: "Global Underwater Explorers - Technical and team-oriented diving education",
    website: "https://www.gue.com",
    logoUrl: "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=200&q=80",
  },
  {
    code: "raid",
    name: "RAID",
    description: "Rebreather Association of International Divers - Modern approach to dive training with rebreather specialization",
    website: "https://www.diveraid.com",
    logoUrl: "https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=200&q=80",
  },
  {
    code: "iantd",
    name: "IANTD",
    description: "International Association of Nitrox and Technical Divers - Pioneers in technical and cave diving education",
    website: "https://www.iantd.com",
    logoUrl: "https://images.unsplash.com/photo-1544551763-8dd44758c2dd?w=200&q=80",
  },
  {
    code: "andi",
    name: "ANDI",
    description: "American Nitrox Divers International - SafeAir innovators and technical diving specialists",
    website: "https://www.andihq.com",
    logoUrl: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=200&q=80",
  },
];

// ============================================================================
// CERTIFICATION LEVELS DATA
// ============================================================================

const CERTIFICATION_LEVELS = {
  beginner: [
    {
      code: "discover-scuba",
      name: "Discover Scuba Diving",
      levelNumber: 1,
      description: "Introduction to scuba diving in a pool or calm water",
      minAge: 10,
      minDives: 0,
      prerequisites: "None - No prior experience required",
    },
    {
      code: "scuba-diver",
      name: "Scuba Diver",
      levelNumber: 2,
      description: "Entry-level certification for diving to 12 meters/40 feet with a professional",
      minAge: 10,
      minDives: 0,
      prerequisites: "None - Completion of confined water and open water training",
    },
    {
      code: "open-water",
      name: "Open Water Diver",
      levelNumber: 3,
      description: "Entry-level certification for independent diving to 18 meters/60 feet",
      minAge: 10,
      minDives: 0,
      prerequisites: "Medical clearance and completion of knowledge development",
    },
  ],
  intermediate: [
    {
      code: "advanced-ow",
      name: "Advanced Open Water",
      levelNumber: 4,
      description: "Explore specialty diving including deep, navigation, and three elective dives",
      minAge: 12,
      minDives: 0,
      prerequisites: "Open Water Diver certification",
    },
    {
      code: "rescue-diver",
      name: "Rescue Diver",
      levelNumber: 5,
      description: "Learn to prevent and manage dive emergencies",
      minAge: 12,
      minDives: 20,
      prerequisites: "Advanced Open Water and Emergency First Response (CPR/First Aid)",
    },
  ],
  professional: [
    {
      code: "divemaster",
      name: "Divemaster",
      levelNumber: 6,
      description: "First professional level - supervise and assist with dive activities",
      minAge: 18,
      minDives: 40,
      prerequisites: "Rescue Diver, Emergency First Response within 2 years, 40+ logged dives",
    },
    {
      code: "assistant-instructor",
      name: "Assistant Instructor",
      levelNumber: 7,
      description: "Certified assistant to an instructor during training",
      minAge: 18,
      minDives: 60,
      prerequisites: "Divemaster certification with 60+ logged dives",
    },
    {
      code: "instructor",
      name: "Open Water Scuba Instructor",
      levelNumber: 8,
      description: "Certified to teach and certify divers",
      minAge: 18,
      minDives: 100,
      prerequisites: "Divemaster, 6 months experience, 100+ logged dives",
    },
  ],
  specialties: [
    {
      code: "deep-diver",
      name: "Deep Diver",
      levelNumber: 4,
      description: "Techniques for diving to 40 meters/130 feet",
      minAge: 15,
      minDives: 0,
      prerequisites: "Advanced Open Water Diver",
    },
    {
      code: "wreck-diver",
      name: "Wreck Diver",
      levelNumber: 4,
      description: "Safe wreck diving and penetration techniques",
      minAge: 15,
      minDives: 0,
      prerequisites: "Advanced Open Water Diver",
    },
    {
      code: "night-diver",
      name: "Night Diver",
      levelNumber: 4,
      description: "Night diving techniques and navigation",
      minAge: 12,
      minDives: 0,
      prerequisites: "Open Water Diver",
    },
    {
      code: "nitrox",
      name: "Enriched Air (Nitrox)",
      levelNumber: 3,
      description: "Use of enriched air nitrox for extended bottom time",
      minAge: 12,
      minDives: 0,
      prerequisites: "Open Water Diver or equivalent",
    },
    {
      code: "navigation",
      name: "Underwater Navigator",
      levelNumber: 3,
      description: "Advanced compass and natural navigation techniques",
      minAge: 10,
      minDives: 0,
      prerequisites: "Open Water Diver",
    },
    {
      code: "peak-performance",
      name: "Peak Performance Buoyancy",
      levelNumber: 3,
      description: "Perfect buoyancy control and trim",
      minAge: 10,
      minDives: 0,
      prerequisites: "Open Water Diver",
    },
    {
      code: "search-recovery",
      name: "Search and Recovery",
      levelNumber: 4,
      description: "Underwater search patterns and object recovery",
      minAge: 12,
      minDives: 0,
      prerequisites: "Advanced Open Water Diver",
    },
  ],
  technical: [
    {
      code: "tec-40",
      name: "Tec 40",
      levelNumber: 7,
      description: "Limited decompression diving to 40 meters with enriched air",
      minAge: 18,
      minDives: 30,
      prerequisites: "Advanced Open Water, Enriched Air, 30+ dives",
    },
    {
      code: "tec-45",
      name: "Tec 45",
      levelNumber: 8,
      description: "Extended decompression diving to 45 meters",
      minAge: 18,
      minDives: 50,
      prerequisites: "Tec 40 or equivalent",
    },
    {
      code: "tec-50",
      name: "Tec 50",
      levelNumber: 9,
      description: "Full technical diving to 50 meters with multiple decompression gases",
      minAge: 18,
      minDives: 100,
      prerequisites: "Tec 45 or equivalent",
    },
    {
      code: "trimix",
      name: "Trimix Diver",
      levelNumber: 10,
      description: "Use of helium-based breathing gases for deep diving",
      minAge: 18,
      minDives: 150,
      prerequisites: "Tec 50 or equivalent advanced technical certification",
    },
  ],
};

// ============================================================================
// TRAINING COURSES DATA
// ============================================================================

const COURSES = [
  // BEGINNER COURSES
  {
    levelCode: "discover-scuba",
    name: "Discover Scuba Diving Experience",
    code: "DSD",
    description: "Try scuba diving for the first time in a pool or confined water. Perfect for those who want to see if diving is for them before committing to a full certification course.",
    durationDays: 1,
    classroomHours: 1,
    poolHours: 2,
    openWaterDives: 0,
    price: "99.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 1,
    maxStudents: 4,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Pool session", "Equipment rental", "Basic instruction manual", "Digital certification"],
    requiredItems: ["Swimsuit", "Towel", "Medical questionnaire (completed)"],
    minAge: 10,
    prerequisites: "None",
    medicalRequirements: "PADI Medical Statement - physician approval if any 'Yes' answers",
    isPublic: true,
    sortOrder: 1,
  },
  {
    levelCode: "open-water",
    name: "Open Water Diver Certification",
    code: "OWD",
    description: "Become a certified diver! This comprehensive course teaches you the fundamentals of scuba diving. Complete classroom sessions, pool training, and four open water dives.",
    durationDays: 3,
    classroomHours: 8,
    poolHours: 8,
    openWaterDives: 4,
    price: "449.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "150.00",
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: [
      "PADI eLearning or manual",
      "Confined water training (pool)",
      "4 open water training dives",
      "Full equipment rental",
      "Digital certification card",
      "Logbook",
    ],
    requiredItems: [
      "Swimsuit",
      "Towel",
      "Sunscreen",
      "Completed medical form",
      "Photo ID",
    ],
    minAge: 10,
    prerequisites: "Adequate swimming skills and comfort in water",
    medicalRequirements: "PADI Medical Statement clearance required",
    isPublic: true,
    sortOrder: 2,
  },
  {
    levelCode: "scuba-diver",
    name: "Scuba Diver (Subset Certification)",
    code: "SD",
    description: "A subset of Open Water Diver - perfect if you're short on time. Allows diving to 12m/40ft with a professional.",
    durationDays: 2,
    classroomHours: 4,
    poolHours: 4,
    openWaterDives: 2,
    price: "299.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Training materials", "Equipment rental", "2 training dives", "Certification"],
    requiredItems: ["Swimsuit", "Towel", "Medical clearance"],
    minAge: 10,
    prerequisites: "Basic swimming ability",
    medicalRequirements: "PADI Medical Statement required",
    isPublic: true,
    sortOrder: 3,
  },

  // INTERMEDIATE COURSES
  {
    levelCode: "advanced-ow",
    name: "Advanced Open Water Diver",
    code: "AOWD",
    description: "Build confidence and skills with 5 Adventure Dives: Deep, Navigation, and 3 electives of your choice. Great way to explore different diving specialties.",
    durationDays: 2,
    classroomHours: 4,
    poolHours: 0,
    openWaterDives: 5,
    price: "399.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "100.00",
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: [
      "5 Adventure dives",
      "Deep dive (mandatory)",
      "Navigation dive (mandatory)",
      "3 elective adventure dives",
      "Equipment rental",
      "Digital certification",
    ],
    requiredItems: ["Current dive certification card", "Logbook", "Personal dive computer (recommended)"],
    minAge: 12,
    prerequisites: "Open Water Diver certification",
    requiredCertLevelCode: "open-water",
    medicalRequirements: "Current medical clearance",
    isPublic: true,
    sortOrder: 4,
  },
  {
    levelCode: "rescue-diver",
    name: "Rescue Diver Course",
    code: "RD",
    description: "Challenge yourself and learn to prevent and manage problems. This rewarding course teaches you to help other divers and builds confidence and awareness.",
    durationDays: 3,
    classroomHours: 12,
    poolHours: 6,
    openWaterDives: 4,
    price: "499.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "150.00",
    minStudents: 2,
    maxStudents: 8,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: [
      "Rescue Diver manual",
      "Pool rescue scenarios",
      "Open water rescue scenarios",
      "Equipment rental",
      "Certification",
    ],
    requiredItems: [
      "Advanced Open Water certification",
      "EFR or CPR certification (within 2 years)",
      "First aid kit",
      "Oxygen provider certification (recommended)",
    ],
    minAge: 12,
    prerequisites: "Advanced Open Water Diver, Emergency First Response (CPR/First Aid) within 2 years, 20+ logged dives recommended",
    requiredCertLevelCode: "advanced-ow",
    medicalRequirements: "Physical fitness required - physician approval recommended",
    isPublic: true,
    sortOrder: 5,
  },

  // PROFESSIONAL COURSES
  {
    levelCode: "divemaster",
    name: "Divemaster Course",
    code: "DM",
    description: "Take the first step into the professional world of diving. Learn to supervise dive activities and assist instructors with student divers.",
    durationDays: 14,
    classroomHours: 40,
    poolHours: 20,
    openWaterDives: 15,
    price: "1299.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "400.00",
    minStudents: 1,
    maxStudents: 4,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: [
      "PADI Divemaster Crew-Pak",
      "Training dives and workshops",
      "Divemaster certification",
      "Professional liability insurance (first year)",
    ],
    requiredItems: [
      "Personal dive equipment (BCD, regulator, wetsuit, etc.)",
      "Dive computer",
      "SMB and reel",
      "Rescue Diver certification",
      "EFR certification (current)",
      "Medical clearance",
      "40+ logged dives to start",
    ],
    minAge: 18,
    prerequisites: "Rescue Diver, EFR within 2 years, 40+ logged dives, medical clearance",
    requiredCertLevelCode: "rescue-diver",
    medicalRequirements: "Physician examination required within 12 months",
    isPublic: true,
    sortOrder: 10,
  },

  // SPECIALTY COURSES
  {
    levelCode: "deep-diver",
    name: "Deep Diver Specialty",
    code: "DEEP",
    description: "Learn to plan and execute dives to 40 meters/130 feet. Understand nitrogen narcosis, safety stops, and deep diving procedures.",
    durationDays: 2,
    classroomHours: 4,
    poolHours: 0,
    openWaterDives: 4,
    price: "349.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Deep Diver manual", "4 deep training dives", "Equipment rental", "Certification"],
    requiredItems: ["Advanced certification", "Dive computer", "Surface marker buoy"],
    minAge: 15,
    prerequisites: "Advanced Open Water Diver certification",
    requiredCertLevelCode: "advanced-ow",
    medicalRequirements: "Current medical clearance",
    isPublic: true,
    sortOrder: 20,
  },
  {
    levelCode: "wreck-diver",
    name: "Wreck Diver Specialty",
    code: "WRECK",
    description: "Explore sunken ships and artificial reefs safely. Learn wreck diving techniques, hazard identification, and limited penetration.",
    durationDays: 2,
    classroomHours: 4,
    poolHours: 0,
    openWaterDives: 4,
    price: "369.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Wreck Diver manual", "4 wreck training dives", "Reel and line training", "Certification"],
    requiredItems: ["Advanced certification", "Dive light", "Reel with line", "Wreck penetration reel"],
    minAge: 15,
    prerequisites: "Advanced Open Water Diver certification",
    requiredCertLevelCode: "advanced-ow",
    medicalRequirements: "Current medical clearance",
    isPublic: true,
    sortOrder: 21,
  },
  {
    levelCode: "night-diver",
    name: "Night Diver Specialty",
    code: "NIGHT",
    description: "Experience the underwater world after dark. See nocturnal marine life and learn night navigation and light communication.",
    durationDays: 2,
    classroomHours: 2,
    poolHours: 0,
    openWaterDives: 3,
    price: "299.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Night diving manual", "3 night dives", "Dive light rental", "Chemical light sticks", "Certification"],
    requiredItems: ["Open Water certification", "Primary dive light", "Backup light", "Reflective markers"],
    minAge: 12,
    prerequisites: "Open Water Diver certification",
    requiredCertLevelCode: "open-water",
    medicalRequirements: "Standard medical clearance",
    isPublic: true,
    sortOrder: 22,
  },
  {
    levelCode: "nitrox",
    name: "Enriched Air (Nitrox) Specialty",
    code: "EAN",
    description: "Extend your bottom time and reduce surface intervals with enriched air nitrox. Learn gas analysis and dive planning with EANx.",
    durationDays: 1,
    classroomHours: 4,
    poolHours: 0,
    openWaterDives: 2,
    price: "249.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 8,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: ["Nitrox manual", "Oxygen analyzer training", "2 training dives with EANx", "Certification"],
    requiredItems: ["Open Water certification", "Dive computer with nitrox capability"],
    minAge: 12,
    prerequisites: "Open Water Diver or Junior Open Water certification",
    requiredCertLevelCode: "open-water",
    medicalRequirements: "Standard medical clearance",
    isPublic: true,
    sortOrder: 23,
  },
  {
    levelCode: "navigation",
    name: "Underwater Navigator Specialty",
    code: "NAV",
    description: "Master compass navigation and natural navigation. Learn to find your way underwater and navigate back to your exit point.",
    durationDays: 2,
    classroomHours: 3,
    poolHours: 0,
    openWaterDives: 3,
    price: "279.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Navigation manual", "Compass navigation training", "3 training dives", "Certification"],
    requiredItems: ["Open Water certification", "Compass", "Dive slate and pencil"],
    minAge: 10,
    prerequisites: "Open Water Diver certification",
    requiredCertLevelCode: "open-water",
    medicalRequirements: "Standard medical clearance",
    isPublic: true,
    sortOrder: 24,
  },
  {
    levelCode: "peak-performance",
    name: "Peak Performance Buoyancy",
    code: "PPB",
    description: "Perfect your buoyancy control and streamlining. Hover effortlessly, conserve air, and protect the reef environment.",
    durationDays: 1,
    classroomHours: 2,
    poolHours: 2,
    openWaterDives: 2,
    price: "249.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["PPB manual", "Weight and trim evaluation", "2 training dives", "Certification"],
    requiredItems: ["Open Water certification", "Well-maintained equipment"],
    minAge: 10,
    prerequisites: "Open Water Diver certification",
    requiredCertLevelCode: "open-water",
    medicalRequirements: "Standard medical clearance",
    isPublic: true,
    sortOrder: 25,
  },
  {
    levelCode: "search-recovery",
    name: "Search and Recovery Specialty",
    code: "S&R",
    description: "Learn underwater search patterns and object recovery techniques. Use lift bags and specialized equipment.",
    durationDays: 2,
    classroomHours: 4,
    poolHours: 2,
    openWaterDives: 4,
    price: "349.00",
    currency: "USD",
    depositRequired: false,
    minStudents: 2,
    maxStudents: 6,
    materialsIncluded: true,
    equipmentIncluded: true,
    includedItems: ["Search & Recovery manual", "Lift bag training", "4 training dives", "Certification"],
    requiredItems: ["Advanced certification", "Lift bag", "Reel and line", "Search markers"],
    minAge: 12,
    prerequisites: "Advanced Open Water Diver certification",
    requiredCertLevelCode: "advanced-ow",
    medicalRequirements: "Standard medical clearance",
    isPublic: true,
    sortOrder: 26,
  },

  // TECHNICAL COURSES
  {
    levelCode: "tec-40",
    name: "Tec 40 - Intro to Technical Diving",
    code: "TEC40",
    description: "First step into technical diving. Limited decompression diving to 40 meters using enriched air and single stage cylinder.",
    durationDays: 4,
    classroomHours: 16,
    poolHours: 8,
    openWaterDives: 6,
    price: "899.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "300.00",
    minStudents: 1,
    maxStudents: 4,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: ["Tec 40 manual", "Training dives", "Certification", "Decompression software training"],
    requiredItems: [
      "Advanced Open Water",
      "Enriched Air certification",
      "Technical diving equipment (doubles or sidemount)",
      "Dive computer with decompression capability",
      "Stage cylinder with rigging",
      "Surface marker buoy and reel",
      "30+ logged dives",
    ],
    minAge: 18,
    prerequisites: "Advanced Open Water, Enriched Air, 30+ logged dives, technical diving equipment",
    requiredCertLevelCode: "nitrox",
    medicalRequirements: "Physician examination required - fitness for technical diving",
    isPublic: true,
    sortOrder: 30,
  },
  {
    levelCode: "tec-45",
    name: "Tec 45 - Extended Range",
    code: "TEC45",
    description: "Extended decompression diving to 45 meters. Learn accelerated decompression with two stage cylinders.",
    durationDays: 5,
    classroomHours: 20,
    poolHours: 10,
    openWaterDives: 8,
    price: "1199.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "400.00",
    minStudents: 1,
    maxStudents: 4,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: ["Tec 45 manual", "Extended range training", "8 training dives", "Certification"],
    requiredItems: [
      "Tec 40 certification",
      "Full technical equipment configuration",
      "Two stage cylinders with rigging",
      "Redundant dive computers",
      "50+ logged dives",
    ],
    minAge: 18,
    prerequisites: "Tec 40 certification, 50+ logged dives including 15 decompression dives",
    requiredCertLevelCode: "tec-40",
    medicalRequirements: "Current physician examination for technical diving",
    isPublic: true,
    sortOrder: 31,
  },
  {
    levelCode: "tec-50",
    name: "Tec 50 - Full Technical Diver",
    code: "TEC50",
    description: "Full technical diving certification to 50 meters. Multiple decompression gases and extended runtime planning.",
    durationDays: 6,
    classroomHours: 24,
    poolHours: 12,
    openWaterDives: 10,
    price: "1499.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "500.00",
    minStudents: 1,
    maxStudents: 4,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: ["Tec 50 manual", "Advanced decompression training", "10 training dives", "Certification"],
    requiredItems: [
      "Tec 45 certification",
      "Complete technical diving rig",
      "Multiple stage cylinders",
      "Redundant everything",
      "100+ logged dives",
    ],
    minAge: 18,
    prerequisites: "Tec 45 certification, 100+ logged dives including 25 decompression dives to 45m",
    requiredCertLevelCode: "tec-45",
    medicalRequirements: "Current physician examination - advanced technical diving fitness",
    isPublic: true,
    sortOrder: 32,
  },
  {
    levelCode: "trimix",
    name: "Trimix Diver - Helium Diving",
    code: "TRIMIX",
    description: "Learn to dive with helium-based breathing gases. Deep diving beyond recreational limits with reduced narcosis.",
    durationDays: 6,
    classroomHours: 24,
    poolHours: 8,
    openWaterDives: 8,
    price: "1799.00",
    currency: "USD",
    depositRequired: true,
    depositAmount: "600.00",
    minStudents: 1,
    maxStudents: 3,
    materialsIncluded: true,
    equipmentIncluded: false,
    includedItems: ["Trimix manual", "Gas blending theory", "8 training dives", "Certification"],
    requiredItems: [
      "Tec 50 or equivalent",
      "Technical diving rig with multiple cylinders",
      "Helium-compatible equipment",
      "Trimix analyzer",
      "150+ logged dives",
    ],
    minAge: 18,
    prerequisites: "Tec 50 or advanced technical certification, 150+ dives including 50+ decompression dives",
    requiredCertLevelCode: "tec-50",
    medicalRequirements: "Comprehensive physician examination for extreme technical diving",
    isPublic: true,
    sortOrder: 33,
  },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function getOrganizationId(subdomain?: string, orgId?: string): Promise<string> {
  if (orgId) {
    return orgId;
  }

  if (subdomain) {
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (!org) {
      throw new Error(`Organization with subdomain "${subdomain}" not found`);
    }

    return org.id;
  }

  throw new Error("Either --subdomain or --org-id must be provided");
}

async function seedAgencies(organizationId: string) {
  console.log("\n📚 Seeding certification agencies...");

  const insertedAgencies = [];

  for (const agency of AGENCIES) {
    const [inserted] = await db
      .insert(certificationAgencies)
      .values({
        organizationId,
        ...agency,
      })
      .returning();

    insertedAgencies.push(inserted);
    console.log(`  ✓ Created ${agency.name} (${agency.code})`);
  }

  return insertedAgencies;
}

async function seedCertificationLevels(organizationId: string, padiAgencyId: string) {
  console.log("\n🎯 Seeding certification levels...");

  const insertedLevels = new Map();
  let totalCount = 0;

  for (const [category, levels] of Object.entries(CERTIFICATION_LEVELS)) {
    console.log(`\n  ${category.toUpperCase()}:`);

    for (const level of levels) {
      const [inserted] = await db
        .insert(certificationLevels)
        .values({
          organizationId,
          agencyId: padiAgencyId, // Default to PADI, shops can add others
          ...level,
        })
        .returning();

      insertedLevels.set(level.code, inserted);
      totalCount++;
      console.log(`    ✓ Created ${level.name} (${level.code}) - Level ${level.levelNumber}`);
    }
  }

  console.log(`\n  Total: ${totalCount} certification levels created`);
  return insertedLevels;
}

async function seedCourses(
  organizationId: string,
  padiAgencyId: string,
  levelsMap: Map<string, any>
) {
  console.log("\n🏊 Seeding training courses...");

  let totalCount = 0;

  for (const course of COURSES) {
    const levelId = levelsMap.get(course.levelCode)?.id;
    const requiredCertLevelId = course.requiredCertLevelCode
      ? levelsMap.get(course.requiredCertLevelCode)?.id
      : null;

    if (!levelId) {
      console.warn(`  ⚠️  Skipping ${course.name} - level "${course.levelCode}" not found`);
      continue;
    }

    await db.insert(trainingCourses).values({
      organizationId,
      agencyId: padiAgencyId,
      levelId,
      requiredCertLevel: requiredCertLevelId,
      name: course.name,
      code: course.code,
      description: course.description,
      durationDays: course.durationDays,
      classroomHours: course.classroomHours,
      poolHours: course.poolHours,
      openWaterDives: course.openWaterDives,
      price: course.price,
      currency: course.currency,
      depositRequired: course.depositRequired,
      depositAmount: course.depositAmount || null,
      minStudents: course.minStudents,
      maxStudents: course.maxStudents,
      materialsIncluded: course.materialsIncluded,
      equipmentIncluded: course.equipmentIncluded,
      includedItems: course.includedItems,
      requiredItems: course.requiredItems,
      minAge: course.minAge,
      prerequisites: course.prerequisites,
      medicalRequirements: course.medicalRequirements,
      isPublic: course.isPublic,
      sortOrder: course.sortOrder,
    });

    totalCount++;
    console.log(`  ✓ Created ${course.name} ($${course.price})`);
  }

  console.log(`\n  Total: ${totalCount} courses created`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const subdomain = args.find((arg) => arg.startsWith("--subdomain="))?.split("=")[1];
  const orgId = args.find((arg) => arg.startsWith("--org-id="))?.split("=")[1];

  console.log("\n🌱 DIVE-8bl: Training Data Seed");
  console.log("================================\n");

  try {
    // Get organization ID
    const organizationId = await getOrganizationId(subdomain, orgId);
    console.log(`Organization ID: ${organizationId}`);

    // Check if data already exists
    const existingAgencies = await db
      .select()
      .from(certificationAgencies)
      .where(eq(certificationAgencies.organizationId, organizationId));

    if (existingAgencies.length > 0) {
      console.log("\n⚠️  Training data already exists for this organization.");
      console.log("Skipping seed to avoid duplicates.\n");
      process.exit(0);
    }

    // Seed agencies
    const agencies = await seedAgencies(organizationId);
    const padiAgency = agencies.find((a) => a.code === "padi");

    if (!padiAgency) {
      throw new Error("PADI agency not created");
    }

    // Seed certification levels
    const levelsMap = await seedCertificationLevels(organizationId, padiAgency.id);

    // Seed courses
    await seedCourses(organizationId, padiAgency.id, levelsMap);

    console.log("\n✅ Training data seeding complete!");
    console.log("\nSummary:");
    console.log(`  • ${agencies.length} certification agencies`);
    console.log(`  • ${levelsMap.size} certification levels`);
    console.log(`  • ${COURSES.length} training courses`);
    console.log("\nYou can now view these courses at:");
    console.log(`  ${subdomain ? `https://${subdomain}.divestreams.com` : 'your-domain'}/training\n`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
