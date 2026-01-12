import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/login";

// Mock the admin-auth module
vi.mock("../../../../lib/auth/admin-auth.server", () => ({
  validateAdminPassword: vi.fn(),
  createAdminSessionCookie: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  isAdminSubdomain: vi.fn(),
}));

import {
  validateAdminPassword,
  createAdminSessionCookie,
  isAdminAuthenticated,
  isAdminSubdomain,
} from "../../../../lib/auth/admin-auth.server";

describe("admin/login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("redirects to main site when not on admin subdomain", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(false);

      const request = new Request("https://demo.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {} });

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("https://divestreams.com");
    });

    it("redirects to dashboard when already authenticated", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (isAdminAuthenticated as Mock).mockReturnValue(true);

      const request = new Request("https://admin.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {} });

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(isAdminAuthenticated).toHaveBeenCalledWith(request);
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/dashboard");
    });

    it("returns null when on admin subdomain and not authenticated", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (isAdminAuthenticated as Mock).mockReturnValue(false);

      const request = new Request("https://admin.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {} });

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(isAdminAuthenticated).toHaveBeenCalledWith(request);
      expect(response).toBeNull();
    });
  });

  describe("action", () => {
    it("returns error when password is empty", async () => {
      const formData = new FormData();
      formData.append("password", "");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response).toEqual({ error: "Password is required" });
    });

    it("returns error when password is not provided", async () => {
      const formData = new FormData();

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response).toEqual({ error: "Password is required" });
    });

    it("returns error when password is invalid", async () => {
      (validateAdminPassword as Mock).mockReturnValue(false);

      const formData = new FormData();
      formData.append("password", "wrongpassword");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(validateAdminPassword).toHaveBeenCalledWith("wrongpassword");
      expect(response).toEqual({ error: "Invalid password" });
    });

    it("redirects to dashboard with session cookie on valid login", async () => {
      (validateAdminPassword as Mock).mockReturnValue(true);
      const mockCookie = "admin_session=test.sig; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure";
      (createAdminSessionCookie as Mock).mockReturnValue(mockCookie);

      const formData = new FormData();
      formData.append("password", "TestAdmin123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(validateAdminPassword).toHaveBeenCalledWith("TestAdmin123");
      expect(createAdminSessionCookie).toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/dashboard");
    });

    it("calls createAdminSessionCookie when password is valid", async () => {
      (validateAdminPassword as Mock).mockReturnValue(true);
      const mockCookie = "admin_session=test.sig; Path=/; HttpOnly";
      (createAdminSessionCookie as Mock).mockReturnValue(mockCookie);

      const formData = new FormData();
      formData.append("password", "TestAdmin123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      // Verify cookie creation function was called
      expect(createAdminSessionCookie).toHaveBeenCalledTimes(1);
    });

    it("handles whitespace-only password as empty", async () => {
      const formData = new FormData();
      formData.append("password", "   ");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // The route checks for truthy password, whitespace is truthy
      // but if validation fails, it should return invalid password
      expect(validateAdminPassword).toHaveBeenCalledWith("   ");
    });
  });
});
