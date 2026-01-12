import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/tenants.new";

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    isActive: "isActive",
  },
}));

vi.mock("../../../../lib/db/tenant.server", () => ({
  createTenant: vi.fn(),
  isSubdomainAvailable: vi.fn(),
}));

vi.mock("../../../../lib/db/seed-demo-data.server", () => ({
  seedDemoData: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { db } from "../../../../lib/db";
import { createTenant, isSubdomainAvailable } from "../../../../lib/db/tenant.server";
import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";

const mockPlans = [
  {
    id: "plan-1",
    name: "starter",
    displayName: "Starter",
    monthlyPrice: 2900,
    isActive: true,
  },
  {
    id: "plan-2",
    name: "professional",
    displayName: "Professional",
    monthlyPrice: 7900,
    isActive: true,
  },
  {
    id: "plan-3",
    name: "enterprise",
    displayName: "Enterprise",
    monthlyPrice: 19900,
    isActive: true,
  },
];

describe("admin/tenants.new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns active subscription plans", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockPlans),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/tenants/new");

      const response = await loader({ request, params: {}, context: {} });

      expect(response.plans).toHaveLength(3);
      expect(response.plans[0].displayName).toBe("Starter");
    });

    it("returns empty array when no active plans exist", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const request = new Request("https://admin.divestreams.com/tenants/new");

      const response = await loader({ request, params: {}, context: {} });

      expect(response.plans).toHaveLength(0);
    });
  });

  describe("action", () => {
    describe("validation", () => {
      it("returns error when subdomain is missing", async () => {
        const formData = new FormData();
        formData.append("subdomain", "");
        formData.append("name", "Test Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.subdomain).toBe("Subdomain is required");
      });

      it("returns error when subdomain format is invalid", async () => {
        const formData = new FormData();
        formData.append("subdomain", "-invalid");
        formData.append("name", "Test Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.subdomain).toBe("Invalid subdomain format");
      });

      it("returns error when subdomain has invalid characters", async () => {
        const formData = new FormData();
        formData.append("subdomain", "test_shop!");
        formData.append("name", "Test Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.subdomain).toBe("Invalid subdomain format");
      });

      it("returns error when name is missing", async () => {
        const formData = new FormData();
        formData.append("subdomain", "testshop");
        formData.append("name", "");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.name).toBe("Name is required");
      });

      it("returns error when email is missing", async () => {
        const formData = new FormData();
        formData.append("subdomain", "testshop");
        formData.append("name", "Test Shop");
        formData.append("email", "");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.email).toBe("Email is required");
      });

      it("returns multiple errors when multiple fields are invalid", async () => {
        const formData = new FormData();
        formData.append("subdomain", "");
        formData.append("name", "");
        formData.append("email", "");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.subdomain).toBe("Subdomain is required");
        expect(response.errors.name).toBe("Name is required");
        expect(response.errors.email).toBe("Email is required");
      });

      it("accepts valid single-character subdomain", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_a",
        });

        const formData = new FormData();
        formData.append("subdomain", "a");
        formData.append("name", "Test Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(isSubdomainAvailable).toHaveBeenCalledWith("a");
        expect(response).toBeInstanceOf(Response);
      });

      it("accepts valid subdomain with hyphens", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_my_dive_shop",
        });

        const formData = new FormData();
        formData.append("subdomain", "my-dive-shop");
        formData.append("name", "My Dive Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(isSubdomainAvailable).toHaveBeenCalledWith("my-dive-shop");
        expect(response).toBeInstanceOf(Response);
      });
    });

    describe("subdomain availability", () => {
      it("returns error when subdomain is already taken", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(false);

        const formData = new FormData();
        formData.append("subdomain", "existingshop");
        formData.append("name", "Test Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(isSubdomainAvailable).toHaveBeenCalledWith("existingshop");
        expect(response).toHaveProperty("errors");
        expect(response.errors.subdomain).toBe("This subdomain is already taken");
      });

      it("converts subdomain to lowercase before checking availability", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_myshop",
        });

        const formData = new FormData();
        formData.append("subdomain", "MyShop");
        formData.append("name", "My Shop");
        formData.append("email", "test@example.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        expect(isSubdomainAvailable).toHaveBeenCalledWith("myshop");
      });
    });

    describe("tenant creation", () => {
      it("creates tenant with required fields only", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_testshop",
        });

        const formData = new FormData();
        formData.append("subdomain", "testshop");
        formData.append("name", "Test Shop");
        formData.append("email", "owner@testshop.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(createTenant).toHaveBeenCalledWith({
          subdomain: "testshop",
          name: "Test Shop",
          email: "owner@testshop.com",
          phone: undefined,
          timezone: "UTC",
          currency: "USD",
          planId: undefined,
        });
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe("/dashboard");
      });

      it("creates tenant with all optional fields", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_fullshop",
        });

        const formData = new FormData();
        formData.append("subdomain", "fullshop");
        formData.append("name", "Full Featured Shop");
        formData.append("email", "owner@fullshop.com");
        formData.append("phone", "+1-555-1234");
        formData.append("timezone", "America/New_York");
        formData.append("currency", "EUR");
        formData.append("planId", "plan-2");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        expect(createTenant).toHaveBeenCalledWith({
          subdomain: "fullshop",
          name: "Full Featured Shop",
          email: "owner@fullshop.com",
          phone: "+1-555-1234",
          timezone: "America/New_York",
          currency: "EUR",
          planId: "plan-2",
        });
      });

      it("seeds demo data when checkbox is checked", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_demoshop",
        });
        (seedDemoData as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("subdomain", "demoshop");
        formData.append("name", "Demo Shop");
        formData.append("email", "demo@demoshop.com");
        formData.append("populateDemoData", "on");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        expect(seedDemoData).toHaveBeenCalledWith("tenant_demoshop");
      });

      it("does not seed demo data when checkbox is not checked", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_nodemoshop",
        });

        const formData = new FormData();
        formData.append("subdomain", "nodemoshop");
        formData.append("name", "No Demo Shop");
        formData.append("email", "nodemo@shop.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        expect(seedDemoData).not.toHaveBeenCalled();
      });

      it("continues even if demo data seeding fails", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockResolvedValue({
          id: "tenant-1",
          schemaName: "tenant_failseed",
        });
        (seedDemoData as Mock).mockRejectedValue(new Error("Seed failed"));

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const formData = new FormData();
        formData.append("subdomain", "failseed");
        formData.append("name", "Fail Seed Shop");
        formData.append("email", "fail@seed.com");
        formData.append("populateDemoData", "on");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe("error handling", () => {
      it("returns form error when tenant creation fails", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(true);
        (createTenant as Mock).mockRejectedValue(new Error("Database error"));

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const formData = new FormData();
        formData.append("subdomain", "errorshop");
        formData.append("name", "Error Shop");
        formData.append("email", "error@shop.com");

        const request = new Request("https://admin.divestreams.com/tenants/new", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        expect(response).toHaveProperty("errors");
        expect(response.errors.form).toBe("Failed to create tenant. Please try again.");
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });
});
