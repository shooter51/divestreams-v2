/**
 * DS-a0gj: Integration tests for recurring trip edit route
 *
 * Tests that the action correctly routes between single-trip updates
 * and series-wide updates via updateRecurringTrip().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/trips/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";
import * as recurringServer from "../../../../../../lib/trips/recurring.server";

vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");
vi.mock("../../../../../../lib/trips/recurring.server");

// CsrfInput reads cookies; stub it out
vi.mock("../../../../../../app/components/CsrfInput", () => ({
  CsrfInput: () => null,
}));

const mockOrgId = "org-abc";
const mockTripId = "trip-123";

const baseMockTrip = {
  id: mockTripId,
  tour: { id: "tour-1", name: "Reef Dive" },
  boat: { id: "boat-1", name: "Sea Bird" },
  date: "2026-07-01",
  startTime: "08:00",
  endTime: "12:00",
  maxParticipants: 10,
  price: 99,
  status: "open",
  weatherNotes: null,
  notes: null,
  isPublic: true,
  staffIds: [],
  diveSites: [],
  isRecurring: false,
  recurrencePattern: null,
  recurringTemplateId: null,
};

const mockOrgContext = {
  org: { id: mockOrgId, name: "Test Org", subdomain: "test" },
  membership: { role: "owner" },
  canAddCustomer: true,
  usage: { customers: 0 },
  limits: { customers: 100 },
  isPremium: false,
} as unknown;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(orgContext.requireOrgContext).mockResolvedValue(mockOrgContext);
  vi.mocked(orgContext.requireRole).mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// Loader tests
// ---------------------------------------------------------------------------

describe("loader", () => {
  it("throws 400 when trip ID is missing", async () => {
    const request = new Request("http://test.localhost/tenant/trips//edit");
    await expect(
      loader({ request, params: {}, context: {} })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 404 when trip is not found", async () => {
    vi.mocked(queries.getTripWithFullDetails).mockResolvedValue(null);
    vi.mocked(queries.getAllBoats).mockResolvedValue([]);
    vi.mocked(queries.getAllTours).mockResolvedValue([]);
    vi.mocked(queries.getStaff).mockResolvedValue([]);

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`);
    await expect(
      loader({ request, params: { id: mockTripId }, context: {} })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns trip data for a non-recurring trip", async () => {
    vi.mocked(queries.getTripWithFullDetails).mockResolvedValue(baseMockTrip as unknown);
    vi.mocked(queries.getAllBoats).mockResolvedValue([]);
    vi.mocked(queries.getAllTours).mockResolvedValue([]);
    vi.mocked(queries.getStaff).mockResolvedValue([]);

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`);
    const result = await loader({ request, params: { id: mockTripId }, context: {} });

    expect(result.trip.id).toBe(mockTripId);
    expect(result.trip.isRecurring).toBe(false);
    expect(result.trip.recurringTemplateId).toBeNull();
  });

  it("exposes isRecurring=true and recurringTemplateId for a recurring instance", async () => {
    const recurringTrip = {
      ...baseMockTrip,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurringTemplateId: "trip-template-1",
    };
    vi.mocked(queries.getTripWithFullDetails).mockResolvedValue(recurringTrip as unknown);
    vi.mocked(queries.getAllBoats).mockResolvedValue([]);
    vi.mocked(queries.getAllTours).mockResolvedValue([]);
    vi.mocked(queries.getStaff).mockResolvedValue([]);

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`);
    const result = await loader({ request, params: { id: mockTripId }, context: {} });

    expect(result.trip.isRecurring).toBe(true);
    expect(result.trip.recurringTemplateId).toBe("trip-template-1");
    expect(result.trip.recurrencePattern).toBe("weekly");
    expect(result.trip.isRecurringTemplate).toBe(false);
  });

  it("marks the trip as template when it has no parent (is the series root)", async () => {
    const templateTrip = {
      ...baseMockTrip,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurringTemplateId: null, // no parent = this IS the template
    };
    vi.mocked(queries.getTripWithFullDetails).mockResolvedValue(templateTrip as unknown);
    vi.mocked(queries.getAllBoats).mockResolvedValue([]);
    vi.mocked(queries.getAllTours).mockResolvedValue([]);
    vi.mocked(queries.getStaff).mockResolvedValue([]);

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`);
    const result = await loader({ request, params: { id: mockTripId }, context: {} });

    expect(result.trip.isRecurring).toBe(true);
    expect(result.trip.isRecurringTemplate).toBe(true);
    expect(result.trip.recurringTemplateId).toBe(mockTripId); // points to itself
  });
});

// ---------------------------------------------------------------------------
// Action tests
// ---------------------------------------------------------------------------

describe("action", () => {
  function buildMockDb() {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    return { db: { update: mockUpdate, set: mockSet, where: mockWhere }, mockUpdate, mockSet, mockWhere };
  }

  it("throws 400 when trip ID is missing", async () => {
    const formData = new FormData();
    formData.append("tourId", "tour-1");
    const request = new Request("http://test.localhost/tenant/trips//edit", {
      method: "POST",
      body: formData,
    });

    await expect(
      action({ request, params: {}, context: {} })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates a single (non-recurring) trip and redirects", async () => {
    const { db, mockUpdate } = buildMockDb();
    vi.mocked(tenantServer.getTenantDb).mockReturnValue({
      db,
      schema: { trips: {} },
    } as unknown);

    const formData = new FormData();
    formData.append("tourId", "tour-1");
    formData.append("boatId", "boat-1");
    formData.append("date", "2026-07-01");
    formData.append("startTime", "08:00");
    formData.append("endTime", "12:00");
    formData.append("maxParticipants", "10");
    formData.append("price", "99");
    formData.append("status", "open");
    formData.append("weatherNotes", "");
    formData.append("notes", "");
    formData.append("isPublic", "true");

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`, {
      method: "POST",
      body: formData,
    });

    const result = await action({ request, params: { id: mockTripId }, context: {} });

    expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrgId);
    expect(mockUpdate).toHaveBeenCalled();
    expect(recurringServer.updateRecurringTrip).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(
      `/tenant/trips/${mockTripId}`
    );
  });

  it("calls updateRecurringTrip when editScope=series with a templateId", async () => {
    vi.mocked(recurringServer.updateRecurringTrip).mockResolvedValue({
      updatedTemplate: true,
      updatedInstances: 3,
    });

    // getTenantDb still required to avoid errors (action reads it before the if-branch)
    const { db } = buildMockDb();
    vi.mocked(tenantServer.getTenantDb).mockReturnValue({
      db,
      schema: { trips: {} },
    } as unknown);

    const templateId = "trip-template-1";
    const formData = new FormData();
    formData.append("tourId", "tour-1");
    formData.append("boatId", "boat-1");
    formData.append("date", "2026-07-01");
    formData.append("startTime", "08:00");
    formData.append("endTime", "12:00");
    formData.append("maxParticipants", "10");
    formData.append("price", "99");
    formData.append("status", "open");
    formData.append("weatherNotes", "");
    formData.append("notes", "");
    formData.append("isPublic", "true");
    formData.append("editScope", "series");
    formData.append("recurringTemplateId", templateId);

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`, {
      method: "POST",
      body: formData,
    });

    const result = await action({ request, params: { id: mockTripId }, context: {} });

    expect(recurringServer.updateRecurringTrip).toHaveBeenCalledWith(
      mockOrgId,
      templateId,
      expect.objectContaining({ tourId: "tour-1", startTime: "08:00" }),
      { updateFutureInstances: true }
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(
      `/tenant/trips/${mockTripId}`
    );
  });

  it("falls through to single-trip update when editScope=series but no templateId", async () => {
    const { db, mockUpdate } = buildMockDb();
    vi.mocked(tenantServer.getTenantDb).mockReturnValue({
      db,
      schema: { trips: {} },
    } as unknown);

    const formData = new FormData();
    formData.append("tourId", "tour-1");
    formData.append("boatId", "boat-1");
    formData.append("date", "2026-07-01");
    formData.append("startTime", "08:00");
    formData.append("endTime", "12:00");
    formData.append("price", "99");
    formData.append("status", "open");
    formData.append("isPublic", "true");
    formData.append("editScope", "series");
    // no recurringTemplateId

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`, {
      method: "POST",
      body: formData,
    });

    await action({ request, params: { id: mockTripId }, context: {} });

    expect(recurringServer.updateRecurringTrip).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("falls through to single-trip update when editScope=single for a recurring trip", async () => {
    const { db, mockUpdate } = buildMockDb();
    vi.mocked(tenantServer.getTenantDb).mockReturnValue({
      db,
      schema: { trips: {} },
    } as unknown);

    const formData = new FormData();
    formData.append("tourId", "tour-1");
    formData.append("boatId", "boat-1");
    formData.append("date", "2026-07-08");
    formData.append("startTime", "08:00");
    formData.append("endTime", "12:00");
    formData.append("price", "99");
    formData.append("status", "open");
    formData.append("isPublic", "true");
    formData.append("editScope", "single");
    formData.append("recurringTemplateId", "trip-template-1");

    const request = new Request(`http://test.localhost/tenant/trips/${mockTripId}/edit`, {
      method: "POST",
      body: formData,
    });

    await action({ request, params: { id: mockTripId }, context: {} });

    expect(recurringServer.updateRecurringTrip).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
