/**
 * API Response Helper Unit Tests
 *
 * Verifies that apiSuccess and apiError produce the expected JSON response shape,
 * status codes, and Content-Type headers.
 */

import { describe, it, expect } from "vitest";
import { apiSuccess, apiError } from "../../../../lib/api/response";

describe("apiSuccess", () => {
  it("returns a Response with success: true and the provided data", async () => {
    const res = apiSuccess({ id: "123", name: "Test" });
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: "123", name: "Test" } });
  });

  it("defaults to HTTP 200", async () => {
    const res = apiSuccess({ ok: true });
    expect(res.status).toBe(200);
  });

  it("accepts a custom status code", async () => {
    const res = apiSuccess({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it("sets Content-Type to application/json", () => {
    const res = apiSuccess({});
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("works with null data", async () => {
    const res = apiSuccess(null);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: null });
  });

  it("works with array data", async () => {
    const res = apiSuccess([1, 2, 3]);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: [1, 2, 3] });
  });
});

describe("apiError", () => {
  it("returns a Response with success: false and the error message", async () => {
    const res = apiError("Something went wrong");
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Something went wrong" });
  });

  it("defaults to HTTP 400", async () => {
    const res = apiError("Bad request");
    expect(res.status).toBe(400);
  });

  it("accepts a custom status code", async () => {
    const res = apiError("Not found", 404);
    expect(res.status).toBe(404);
  });

  it("accepts 401 Unauthorized", async () => {
    const res = apiError("Unauthorized", 401);
    expect(res.status).toBe(401);
  });

  it("accepts 429 Too Many Requests", async () => {
    const res = apiError("Rate limit exceeded", 429);
    expect(res.status).toBe(429);
  });

  it("accepts 500 Internal Server Error", async () => {
    const res = apiError("Internal error", 500);
    expect(res.status).toBe(500);
  });

  it("sets Content-Type to application/json", () => {
    const res = apiError("Oops");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
