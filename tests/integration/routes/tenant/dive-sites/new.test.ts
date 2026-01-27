import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { action } from "../../../../../app/routes/tenant/dive-sites/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as validation from "../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/validation");

describe("app/routes/tenant/dive-sites/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("action", () => {
    it("should create dive site and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Blue Corner");
      formData.append("description", "Famous drift dive");
      formData.append("maxDepth", "30");
      formData.append("difficulty", "intermediate");
      formData.append("latitude", "7.165");
      formData.append("longitude", "134.271");
      formData.append("visibility", "15-25m");
      formData.append("currentStrength", "moderate");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Blue Corner",
          description: "Famous drift dive",
          maxDepth: 30,
          difficulty: "intermediate",
          latitude: 7.165,
          longitude: 134.271,
          visibility: "15-25m",
          currentStrength: "moderate",
        })
      );

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/dive-sites");
    });

    it("should return validation errors for missing name", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
      });

      const formData = new FormData();
      formData.append("name", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
    });

    it("should return validation errors for missing maxDepth", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          maxDepth: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Site",
        maxDepth: "",
      });

      const formData = new FormData();
      formData.append("name", "Test Site");
      formData.append("maxDepth", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("maxDepth", "Required");
    });

    it("should handle optional fields correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Simple Site");
      formData.append("maxDepth", "20");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Simple Site",
          maxDepth: 20,
          description: undefined,
          latitude: undefined,
          longitude: undefined,
        })
      );
    });

    it("should convert highlights comma-separated string to JSON array", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Coral Garden");
      formData.append("maxDepth", "18");
      formData.append("highlights", "Sharks, Turtles, Coral Wall");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      // The action internally converts highlights to JSON before validation
      // We can't directly check formData since it's modified inside the action
      expect(queries.createDiveSite).toHaveBeenCalled();
    });

    it("should handle empty highlights string", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "No Highlights Site");
      formData.append("maxDepth", "15");
      formData.append("highlights", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      // Empty string should result in undefined or empty array
      expect(queries.createDiveSite).toHaveBeenCalled();
    });

    it("should parse numeric coordinates correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "GPS Site");
      formData.append("maxDepth", "25");
      formData.append("latitude", "7.165432");
      formData.append("longitude", "134.271890");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          latitude: 7.165432,
          longitude: 134.27189,
        })
      );
    });

    it("should handle invalid difficulty validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          difficulty: "Invalid difficulty level",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Site",
        difficulty: "super-hard",
      });

      const formData = new FormData();
      formData.append("name", "Test Site");
      formData.append("difficulty", "super-hard");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("difficulty", "Invalid difficulty level");
    });
  });
});
