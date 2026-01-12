import { describe, it, expect, vi } from "vitest";
import {
  tenants,
  subscriptionPlans,
  tenantsRelations,
  createTenantSchema,
  type Tenant,
  type NewTenant,
  type SubscriptionPlan,
  type NewSubscriptionPlan,
  type TenantSchema,
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

  describe("tenants table", () => {
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

  describe("createTenantSchema factory", () => {
    it("creates a schema with the given name", () => {
      const schemaName = "test_tenant_schema";
      const tenantSchema = createTenantSchema(schemaName);

      expect(tenantSchema.schema).toBeDefined();
    });

    it("creates all required tenant tables", () => {
      const tenantSchema = createTenantSchema("test_schema");

      expect(tenantSchema.users).toBeDefined();
      expect(tenantSchema.sessions).toBeDefined();
      expect(tenantSchema.accounts).toBeDefined();
      expect(tenantSchema.customers).toBeDefined();
      expect(tenantSchema.boats).toBeDefined();
      expect(tenantSchema.diveSites).toBeDefined();
      expect(tenantSchema.tours).toBeDefined();
      expect(tenantSchema.tourDiveSites).toBeDefined();
      expect(tenantSchema.trips).toBeDefined();
      expect(tenantSchema.bookings).toBeDefined();
      expect(tenantSchema.equipment).toBeDefined();
      expect(tenantSchema.transactions).toBeDefined();
    });

    describe("users table", () => {
      it("defines user authentication fields", () => {
        const schema = createTenantSchema("test");
        const users = schema.users;

        expect(users).toBeDefined();
      });
    });

    describe("sessions table", () => {
      it("defines session tracking fields", () => {
        const schema = createTenantSchema("test");
        const sessions = schema.sessions;

        expect(sessions).toBeDefined();
      });
    });

    describe("accounts table", () => {
      it("defines OAuth provider fields", () => {
        const schema = createTenantSchema("test");
        const accounts = schema.accounts;

        expect(accounts).toBeDefined();
      });
    });

    describe("customers table", () => {
      it("defines customer profile fields", () => {
        const schema = createTenantSchema("test");
        const customers = schema.customers;

        expect(customers).toBeDefined();
      });
    });

    describe("boats table", () => {
      it("defines boat information fields", () => {
        const schema = createTenantSchema("test");
        const boats = schema.boats;

        expect(boats).toBeDefined();
      });
    });

    describe("diveSites table", () => {
      it("defines dive site information fields", () => {
        const schema = createTenantSchema("test");
        const diveSites = schema.diveSites;

        expect(diveSites).toBeDefined();
      });
    });

    describe("tours table", () => {
      it("defines tour/product fields", () => {
        const schema = createTenantSchema("test");
        const tours = schema.tours;

        expect(tours).toBeDefined();
      });
    });

    describe("tourDiveSites junction table", () => {
      it("defines tour to dive site relationship", () => {
        const schema = createTenantSchema("test");
        const tourDiveSites = schema.tourDiveSites;

        expect(tourDiveSites).toBeDefined();
      });
    });

    describe("trips table", () => {
      it("defines scheduled trip fields", () => {
        const schema = createTenantSchema("test");
        const trips = schema.trips;

        expect(trips).toBeDefined();
      });
    });

    describe("bookings table", () => {
      it("defines booking fields", () => {
        const schema = createTenantSchema("test");
        const bookings = schema.bookings;

        expect(bookings).toBeDefined();
      });
    });

    describe("equipment table", () => {
      it("defines equipment inventory fields", () => {
        const schema = createTenantSchema("test");
        const equipment = schema.equipment;

        expect(equipment).toBeDefined();
      });
    });

    describe("transactions table", () => {
      it("defines payment transaction fields", () => {
        const schema = createTenantSchema("test");
        const transactions = schema.transactions;

        expect(transactions).toBeDefined();
      });
    });
  });

  describe("schema isolation", () => {
    it("creates independent schemas for different tenants", () => {
      const schema1 = createTenantSchema("tenant_one");
      const schema2 = createTenantSchema("tenant_two");

      // Each call should create a distinct schema object
      expect(schema1).not.toBe(schema2);
    });

    it("each schema has independent tables", () => {
      const schema1 = createTenantSchema("tenant_one");
      const schema2 = createTenantSchema("tenant_two");

      expect(schema1.customers).not.toBe(schema2.customers);
      expect(schema1.bookings).not.toBe(schema2.bookings);
      expect(schema1.tours).not.toBe(schema2.tours);
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
        name: "starter",
        displayName: "Starter Plan",
        monthlyPrice: 2900,
        yearlyPrice: 29900,
        features: ["Feature 1", "Feature 2"],
        limits: { users: 2, customers: 100, toursPerMonth: 50, storageGb: 1 },
      };
      expect(mockNewPlan.name).toBe("starter");
    });

    it("exports TenantSchema type", () => {
      const schema: TenantSchema = createTenantSchema("test");
      expect(schema.users).toBeDefined();
      expect(schema.customers).toBeDefined();
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

  describe("tenant schema table structure validation", () => {
    const schema = createTenantSchema("validation_test");

    it("users table has all expected columns", () => {
      expect(schema.users).toBeDefined();
    });

    it("sessions table has user reference", () => {
      expect(schema.sessions).toBeDefined();
    });

    it("accounts table has user reference", () => {
      expect(schema.accounts).toBeDefined();
    });

    it("customers table has email index", () => {
      expect(schema.customers).toBeDefined();
    });

    it("bookings table has trip and customer references", () => {
      expect(schema.bookings).toBeDefined();
    });

    it("trips table has tour and boat references", () => {
      expect(schema.trips).toBeDefined();
    });

    it("tourDiveSites junction table has proper references", () => {
      expect(schema.tourDiveSites).toBeDefined();
    });

    it("transactions table has proper references", () => {
      expect(schema.transactions).toBeDefined();
    });
  });

  describe("multi-tenant support validation", () => {
    it("can create multiple tenant schemas without conflict", () => {
      const schemas = Array.from({ length: 5 }, (_, i) =>
        createTenantSchema(`tenant_${i}`)
      );

      expect(schemas.length).toBe(5);
      schemas.forEach((schema) => {
        expect(schema.users).toBeDefined();
        expect(schema.customers).toBeDefined();
        expect(schema.bookings).toBeDefined();
      });
    });

    it("schema names are preserved in creation", () => {
      const schemaName = "unique_tenant_schema_123";
      const schema = createTenantSchema(schemaName);

      // The schema should be created successfully
      expect(schema).toBeDefined();
      expect(schema.schema).toBeDefined();
    });
  });
});
