/**
 * Google Calendar Manual Sync Route Tests
 *
 * Tests the manual bulk sync endpoint for Google Calendar integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../../app/routes/api/integrations/google/sync";

// Mock modules
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../../lib/integrations/google-calendar.server", () => ({
  syncAllTrips: vi.fn(),
}));

// Import mocked modules
import { requireOrgContext } from "../../../../../../lib/auth/org-context.server";
import { syncAllTrips } from "../../../../../../lib/integrations/google-calendar.server";

describe("Route: api/integrations/google/sync.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("should return 405 for non-POST methods", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "GET",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data).toEqual({ error: "Method not allowed" });
    });

    it("should sync with default date range when no dates provided", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123", name: "Test Org" },
      });
      (syncAllTrips as any).mockResolvedValue({
        synced: 10,
        failed: 0,
        errors: [],
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(requireOrgContext).toHaveBeenCalledWith(request);
      expect(syncAllTrips).toHaveBeenCalledWith(
        "org-123",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // Today's date
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // 90 days from now
        "UTC"
      );
      expect(data).toEqual({
        success: true,
        synced: 10,
        failed: 0,
        errors: [],
        message: "Successfully synced 10 trips",
      });
    });

    it("should sync with custom date range when provided", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        }),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-456", name: "Test Org" },
      });
      (syncAllTrips as any).mockResolvedValue({
        synced: 25,
        failed: 0,
        errors: [],
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(syncAllTrips).toHaveBeenCalledWith("org-456", "2024-01-01", "2024-12-31", "UTC");
      expect(data).toEqual({
        success: true,
        synced: 25,
        failed: 0,
        errors: [],
        message: "Successfully synced 25 trips",
      });
    });

    it("should return success with partial failures", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-789", name: "Test Org" },
      });
      (syncAllTrips as any).mockResolvedValue({
        synced: 8,
        failed: 2,
        errors: ["Trip 1 missing date", "Trip 2 invalid timezone"],
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(data).toEqual({
        success: true,
        synced: 8,
        failed: 2,
        errors: ["Trip 1 missing date", "Trip 2 invalid timezone"],
        message: "Synced 8 trips with 2 failures",
      });
    });

    it("should return 500 when all trips fail to sync", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-999", name: "Test Org" },
      });
      (syncAllTrips as any).mockResolvedValue({
        synced: 0,
        failed: 5,
        errors: [
          "Connection timeout",
          "API rate limit exceeded",
          "Invalid credentials",
          "Trip data missing",
          "Calendar not found",
        ],
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to sync trips: Connection timeout, API rate limit exceeded, Invalid credentials, Trip data missing, Calendar not found",
      });
    });

    it("should return 500 when syncAllTrips throws Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-111", name: "Test Org" },
      });
      (syncAllTrips as any).mockRejectedValue(new Error("Google Calendar API unavailable"));

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Google Calendar API unavailable",
      });
    });

    it("should return 500 with generic error for non-Error exceptions", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-222", name: "Test Org" },
      });
      (syncAllTrips as any).mockRejectedValue("String error");

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to sync Google Calendar",
      });
    });

    it("should handle empty request body", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-333", name: "Test Org" },
      });
      (syncAllTrips as any).mockResolvedValue({
        synced: 3,
        failed: 0,
        errors: [],
      });

      // Act - Will throw due to invalid JSON, caught by error handler
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
