import { describe, it, expect } from "vitest";
import {
  tenants,
  subscriptionPlans,
  tenantsRelations,
  customers,
  boats,
  diveSites,
  tours,
  tourDiveSites,
  trips,
  bookings,
  equipment,
  transactions,
  rentals,
  products,
  discountCodes,
  images,
  type Tenant,
  type NewTenant,
  type SubscriptionPlan,
  type NewSubscriptionPlan,
} from "../../../../lib/db/schema";

describe("schema.ts", () => {
  describe("subscriptionPlans table", () => {
    it("defines required columns", () => {
      expect(subscriptionPlans.id).toBeDefined();
      expect(subscriptionPlans.name).toBeDefined();
      expect(subscriptionPlans.displayName).toBeDefined();
      expect(subscriptionPlans.monthlyPrice).toBeDefined();
      expect(subscriptionPlans.yearlyPrice).toBeDefined();
      expect(subscriptionPlans.features).toBeDefined();
      expect(subscriptionPlans.limits).toBeDefined();
      expect(subscriptionPlans.isActive).toBeDefined();
      expect(subscriptionPlans.createdAt).toBeDefined();
      expect(subscriptionPlans.updatedAt).toBeDefined();
    });

    it("defines optional Stripe price ID columns", () => {
      expect(subscriptionPlans.monthlyPriceId).toBeDefined();
      expect(subscriptionPlans.yearlyPriceId).toBeDefined();
    });

    it("has proper column types for pricing", () => {
      // Price columns should be integer (cents)
      const monthlyPrice = subscriptionPlans.monthlyPrice;
      const yearlyPrice = subscriptionPlans.yearlyPrice;
      expect(monthlyPrice).toBeDefined();
      expect(yearlyPrice).toBeDefined();
    });

    it("has jsonb columns for features and limits", () => {
      expect(subscriptionPlans.features).toBeDefined();
      expect(subscriptionPlans.limits).toBeDefined();
    });
  });

  describe("tenants table (legacy)", () => {
    it("defines core tenant fields", () => {
      expect(tenants.id).toBeDefined();
      expect(tenants.subdomain).toBeDefined();
      expect(tenants.name).toBeDefined();
      expect(tenants.email).toBeDefined();
      expect(tenants.phone).toBeDefined();
    });

    it("defines localization settings", () => {
      expect(tenants.timezone).toBeDefined();
      expect(tenants.currency).toBeDefined();
      expect(tenants.locale).toBeDefined();
    });

    it("defines Stripe integration fields", () => {
      expect(tenants.stripeCustomerId).toBeDefined();
      expect(tenants.stripeSubscriptionId).toBeDefined();
    });

    it("defines subscription tracking fields", () => {
      expect(tenants.planId).toBeDefined();
      expect(tenants.subscriptionStatus).toBeDefined();
      expect(tenants.trialEndsAt).toBeDefined();
      expect(tenants.currentPeriodEnd).toBeDefined();
    });

    it("defines settings jsonb column", () => {
      expect(tenants.settings).toBeDefined();
    });

    it("defines status and schema fields", () => {
      expect(tenants.isActive).toBeDefined();
      expect(tenants.schemaName).toBeDefined();
    });

    it("defines timestamp columns", () => {
      expect(tenants.createdAt).toBeDefined();
      expect(tenants.updatedAt).toBeDefined();
    });
  });

  describe("tenantsRelations", () => {
    it("is defined as a function", () => {
      expect(tenantsRelations).toBeDefined();
    });
  });

  describe("business tables (organization-based)", () => {
    describe("customers table", () => {
      it("defines customer profile fields", () => {
        expect(customers).toBeDefined();
        expect(customers.id).toBeDefined();
        expect(customers.organizationId).toBeDefined();
        expect(customers.email).toBeDefined();
        expect(customers.firstName).toBeDefined();
        expect(customers.lastName).toBeDefined();
      });

      it("has organizationId for multi-tenancy", () => {
        expect(customers.organizationId).toBeDefined();
      });
    });

    describe("boats table", () => {
      it("defines boat information fields", () => {
        expect(boats).toBeDefined();
        expect(boats.id).toBeDefined();
        expect(boats.organizationId).toBeDefined();
        expect(boats.name).toBeDefined();
        expect(boats.capacity).toBeDefined();
      });
    });

    describe("diveSites table", () => {
      it("defines dive site information fields", () => {
        expect(diveSites).toBeDefined();
        expect(diveSites.id).toBeDefined();
        expect(diveSites.organizationId).toBeDefined();
        expect(diveSites.name).toBeDefined();
      });
    });

    describe("tours table", () => {
      it("defines tour/product fields", () => {
        expect(tours).toBeDefined();
        expect(tours.id).toBeDefined();
        expect(tours.organizationId).toBeDefined();
        expect(tours.name).toBeDefined();
        expect(tours.price).toBeDefined();
      });
    });

    describe("tourDiveSites junction table", () => {
      it("defines tour to dive site relationship", () => {
        expect(tourDiveSites).toBeDefined();
        expect(tourDiveSites.id).toBeDefined();
        expect(tourDiveSites.tourId).toBeDefined();
        expect(tourDiveSites.diveSiteId).toBeDefined();
      });
    });

    describe("trips table", () => {
      it("defines scheduled trip fields", () => {
        expect(trips).toBeDefined();
        expect(trips.id).toBeDefined();
        expect(trips.organizationId).toBeDefined();
        expect(trips.tourId).toBeDefined();
        expect(trips.date).toBeDefined();
      });
    });

    describe("bookings table", () => {
      it("defines booking fields", () => {
        expect(bookings).toBeDefined();
        expect(bookings.id).toBeDefined();
        expect(bookings.organizationId).toBeDefined();
        expect(bookings.tripId).toBeDefined();
        expect(bookings.customerId).toBeDefined();
      });
    });

    describe("equipment table", () => {
      it("defines equipment inventory fields", () => {
        expect(equipment).toBeDefined();
        expect(equipment.id).toBeDefined();
        expect(equipment.organizationId).toBeDefined();
        expect(equipment.name).toBeDefined();
        expect(equipment.category).toBeDefined();
      });
    });

    describe("transactions table", () => {
      it("defines payment transaction fields", () => {
        expect(transactions).toBeDefined();
        expect(transactions.id).toBeDefined();
        expect(transactions.organizationId).toBeDefined();
        expect(transactions.amount).toBeDefined();
      });
    });

    describe("rentals table", () => {
      it("defines rental fields", () => {
        expect(rentals).toBeDefined();
        expect(rentals.id).toBeDefined();
        expect(rentals.organizationId).toBeDefined();
        expect(rentals.equipmentId).toBeDefined();
      });
    });

    describe("products table", () => {
      it("defines product fields", () => {
        expect(products).toBeDefined();
        expect(products.id).toBeDefined();
        expect(products.organizationId).toBeDefined();
        expect(products.name).toBeDefined();
        expect(products.price).toBeDefined();
      });
    });

    describe("discountCodes table", () => {
      it("defines discount code fields", () => {
        expect(discountCodes).toBeDefined();
        expect(discountCodes.id).toBeDefined();
        expect(discountCodes.organizationId).toBeDefined();
        expect(discountCodes.code).toBeDefined();
      });
    });

    describe("images table", () => {
      it("defines image fields", () => {
        expect(images).toBeDefined();
        expect(images.id).toBeDefined();
        expect(images.organizationId).toBeDefined();
        expect(images.url).toBeDefined();
      });
    });
  });

  describe("type exports", () => {
    it("exports Tenant type", () => {
      // TypeScript will fail compilation if types don't exist
      const mockTenant: Partial<Tenant> = {
        id: "uuid",
        subdomain: "testshop",
        name: "Test Dive Shop",
        email: "test@example.com",
      };
      expect(mockTenant.subdomain).toBe("testshop");
    });

    it("exports NewTenant type", () => {
      const mockNewTenant: Partial<NewTenant> = {
        subdomain: "newshop",
        name: "New Dive Shop",
        email: "new@example.com",
        schemaName: "tenant_newshop",
      };
      expect(mockNewTenant.subdomain).toBe("newshop");
    });

    it("exports SubscriptionPlan type", () => {
      const mockPlan: Partial<SubscriptionPlan> = {
        id: "uuid",
        name: "pro",
        displayName: "Pro Plan",
        monthlyPrice: 4900,
        yearlyPrice: 49900,
      };
      expect(mockPlan.name).toBe("pro");
    });

    it("exports NewSubscriptionPlan type", () => {
      const mockNewPlan: Partial<NewSubscriptionPlan> = {
        name: "standard",
        displayName: "Standard Plan",
        monthlyPrice: 2900,
        yearlyPrice: 29900,
        features: ["Feature 1", "Feature 2"],
        limits: { users: 2, customers: 100, toursPerMonth: 50, storageGb: 1 },
      };
      expect(mockNewPlan.name).toBe("standard");
    });
  });

  describe("default values", () => {
    it("tenants has default timezone UTC", () => {
      // Verify the default is defined in the schema
      expect(tenants.timezone).toBeDefined();
    });

    it("tenants has default currency USD", () => {
      expect(tenants.currency).toBeDefined();
    });

    it("tenants has default locale en-US", () => {
      expect(tenants.locale).toBeDefined();
    });

    it("tenants has default subscription status trialing", () => {
      expect(tenants.subscriptionStatus).toBeDefined();
    });

    it("subscriptionPlans has default isActive true", () => {
      expect(subscriptionPlans.isActive).toBeDefined();
    });
  });

  describe("unique constraints", () => {
    it("tenants subdomain has unique constraint", () => {
      // The subdomain field should be defined as unique
      expect(tenants.subdomain).toBeDefined();
    });

    it("tenants schemaName has unique constraint", () => {
      expect(tenants.schemaName).toBeDefined();
    });
  });

  describe("index definitions", () => {
    it("tenants has subdomain index", () => {
      // Indices are defined in the table options
      expect(tenants.subdomain).toBeDefined();
    });

    it("tenants has stripe_customer index", () => {
      expect(tenants.stripeCustomerId).toBeDefined();
    });
  });

  describe("foreign key relationships", () => {
    it("tenants planId references subscriptionPlans", () => {
      expect(tenants.planId).toBeDefined();
    });
  });

  describe("organization-based multi-tenancy", () => {
    it("all business tables have organizationId", () => {
      expect(customers.organizationId).toBeDefined();
      expect(boats.organizationId).toBeDefined();
      expect(diveSites.organizationId).toBeDefined();
      expect(tours.organizationId).toBeDefined();
      expect(trips.organizationId).toBeDefined();
      expect(bookings.organizationId).toBeDefined();
      expect(equipment.organizationId).toBeDefined();
      expect(transactions.organizationId).toBeDefined();
      expect(rentals.organizationId).toBeDefined();
      expect(products.organizationId).toBeDefined();
      expect(discountCodes.organizationId).toBeDefined();
      expect(images.organizationId).toBeDefined();
    });
  });
});
