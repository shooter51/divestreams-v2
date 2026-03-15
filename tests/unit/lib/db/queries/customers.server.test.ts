import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module and schema before importing the module under test
vi.mock("../../../../../lib/db/index", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  customers: { organizationId: "organizationId", id: "id", email: "email" },
  bookings: {},
  trips: {},
  tours: {},
}));

vi.mock("../../../../../lib/db/queries/mappers", () => ({
  mapCustomer: vi.fn((row) => row),
}));

import { db } from "../../../../../lib/db/index";

describe("customers.server createCustomer data shaping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes preferredLanguage in insert values when provided", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: "cust-1",
      organizationId: "org-1",
      email: "test@example.com",
      firstName: "Jane",
      lastName: "Doe",
      phone: null,
      dateOfBirth: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      medicalConditions: null,
      medications: null,
      certifications: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      preferredLanguage: "fr",
      marketingOptIn: false,
      hasAccount: false,
      notes: null,
      tags: null,
      totalDives: 0,
      totalSpent: "0",
      lastDiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const { createCustomer } = await import("../../../../../lib/db/queries/customers.server");

    await createCustomer("org-1", {
      email: "test@example.com",
      firstName: "Jane",
      lastName: "Doe",
      preferredLanguage: "fr",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ preferredLanguage: "fr" })
    );
  });

  it("defaults preferredLanguage to 'en' when not provided", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: "cust-2",
      organizationId: "org-1",
      email: "test2@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: null,
      dateOfBirth: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      medicalConditions: null,
      medications: null,
      certifications: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      preferredLanguage: "en",
      marketingOptIn: false,
      hasAccount: false,
      notes: null,
      tags: null,
      totalDives: 0,
      totalSpent: "0",
      lastDiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const { createCustomer } = await import("../../../../../lib/db/queries/customers.server");

    await createCustomer("org-1", {
      email: "test2@example.com",
      firstName: "John",
      lastName: "Doe",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ preferredLanguage: "en" })
    );
  });

  it("includes certifications in insert values when provided", async () => {
    const certifications = [{ agency: "PADI", level: "Open Water", number: "12345" }];
    const returningMock = vi.fn().mockResolvedValue([{
      id: "cust-3",
      organizationId: "org-1",
      email: "test3@example.com",
      firstName: "Alice",
      lastName: "Smith",
      phone: null,
      dateOfBirth: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      medicalConditions: null,
      medications: null,
      certifications,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      preferredLanguage: "en",
      marketingOptIn: false,
      hasAccount: false,
      notes: null,
      tags: null,
      totalDives: 0,
      totalSpent: "0",
      lastDiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const { createCustomer } = await import("../../../../../lib/db/queries/customers.server");

    await createCustomer("org-1", {
      email: "test3@example.com",
      firstName: "Alice",
      lastName: "Smith",
      certifications,
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ certifications })
    );
  });

  it("sets certifications to null when not provided", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: "cust-4",
      organizationId: "org-1",
      email: "test4@example.com",
      firstName: "Bob",
      lastName: "Jones",
      phone: null,
      dateOfBirth: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      medicalConditions: null,
      medications: null,
      certifications: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      preferredLanguage: "en",
      marketingOptIn: false,
      hasAccount: false,
      notes: null,
      tags: null,
      totalDives: 0,
      totalSpent: "0",
      lastDiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const { createCustomer } = await import("../../../../../lib/db/queries/customers.server");

    await createCustomer("org-1", {
      email: "test4@example.com",
      firstName: "Bob",
      lastName: "Jones",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ certifications: null })
    );
  });
});
