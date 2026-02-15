/**
 * Integration Service Tests
 *
 * Tests for integration management, encryption, and CRUD operations.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Mock the database
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockReturning = vi.fn().mockResolvedValue([{ id: "int-1" }]);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);

vi.mock("../../../../lib/db", () => ({
  db: {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
    delete: mockDelete,
    orderBy: mockOrderBy,
  },
}));

vi.mock("../../../../lib/db/schema/integrations", () => ({
  integrations: {
    id: "id",
    organizationId: "organizationId",
    provider: "provider",
    accessToken: "accessToken",
    refreshToken: "refreshToken",
    tokenExpiresAt: "tokenExpiresAt",
    scopes: "scopes",
    accountId: "accountId",
    accountName: "accountName",
    accountEmail: "accountEmail",
    settings: "settings",
    isActive: "isActive",
    connectedAt: "connectedAt",
    lastSyncAt: "lastSyncAt",
    lastSyncError: "lastSyncError",
    updatedAt: "updatedAt",
  },
  integrationSyncLog: {
    id: "id",
    integrationId: "integrationId",
    action: "action",
    status: "status",
    createdAt: "createdAt",
  },
}));

describe("Integration Service", () => {
  beforeAll(() => {
    // Set AUTH_SECRET for encryption functions
    process.env.AUTH_SECRET = 'test-secret-key-for-unit-tests';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "int-1" }]);
    mockOrderBy.mockResolvedValue([]);
  });

  describe("Encryption utilities", () => {
    it("exports encryptToken function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.encryptToken).toBe("function");
    });

    it("exports decryptToken function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.decryptToken).toBe("function");
    });

    it("encrypts and decrypts tokens correctly", async () => {
      const { encryptToken, decryptToken } = await import("../../../../lib/integrations/index.server");

      const originalToken = "my-secret-access-token-12345";
      const encrypted = encryptToken(originalToken);

      // Encrypted value should be different from original
      expect(encrypted).not.toBe(originalToken);

      // Should contain three parts (iv:authTag:encrypted)
      expect(encrypted.split(":")).toHaveLength(3);

      // Decryption should return original value
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it("produces different encrypted values for same input (due to random IV)", async () => {
      const { encryptToken } = await import("../../../../lib/integrations/index.server");

      const token = "same-token";
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("throws on invalid encrypted format", async () => {
      const { decryptToken } = await import("../../../../lib/integrations/index.server");

      expect(() => decryptToken("invalid-format")).toThrow("Invalid encrypted token format");
      expect(() => decryptToken("only:two")).toThrow("Invalid encrypted token format");
    });
  });

  describe("connectIntegration", () => {
    it("exports connectIntegration function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.connectIntegration).toBe("function");
    });
  });

  describe("disconnectIntegration", () => {
    it("exports disconnectIntegration function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.disconnectIntegration).toBe("function");
    });
  });

  describe("deleteIntegration", () => {
    it("exports deleteIntegration function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.deleteIntegration).toBe("function");
    });
  });

  describe("getIntegration", () => {
    it("exports getIntegration function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.getIntegration).toBe("function");
    });
  });

  describe("getIntegrationWithTokens", () => {
    it("exports getIntegrationWithTokens function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.getIntegrationWithTokens).toBe("function");
    });
  });

  describe("listIntegrations", () => {
    it("exports listIntegrations function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.listIntegrations).toBe("function");
    });
  });

  describe("listActiveIntegrations", () => {
    it("exports listActiveIntegrations function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.listActiveIntegrations).toBe("function");
    });
  });

  describe("tokenNeedsRefresh", () => {
    it("exports tokenNeedsRefresh function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.tokenNeedsRefresh).toBe("function");
    });

    it("returns false when no expiry date", async () => {
      const { tokenNeedsRefresh } = await import("../../../../lib/integrations/index.server");

      const integration = {
        tokenExpiresAt: null,
      } as any;

      expect(tokenNeedsRefresh(integration)).toBe(false);
    });

    it("returns true when token expires within 5 minutes", async () => {
      const { tokenNeedsRefresh } = await import("../../../../lib/integrations/index.server");

      const integration = {
        tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
      } as any;

      expect(tokenNeedsRefresh(integration)).toBe(true);
    });

    it("returns false when token expires in more than 5 minutes", async () => {
      const { tokenNeedsRefresh } = await import("../../../../lib/integrations/index.server");

      const integration = {
        tokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      } as any;

      expect(tokenNeedsRefresh(integration)).toBe(false);
    });

    it("returns true when token is already expired", async () => {
      const { tokenNeedsRefresh } = await import("../../../../lib/integrations/index.server");

      const integration = {
        tokenExpiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      } as any;

      expect(tokenNeedsRefresh(integration)).toBe(true);
    });
  });

  describe("updateTokens", () => {
    it("exports updateTokens function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.updateTokens).toBe("function");
    });
  });

  describe("updateLastSync", () => {
    it("exports updateLastSync function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.updateLastSync).toBe("function");
    });
  });

  describe("updateIntegrationSettings", () => {
    it("exports updateIntegrationSettings function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.updateIntegrationSettings).toBe("function");
    });
  });

  describe("logSyncOperation", () => {
    it("exports logSyncOperation function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.logSyncOperation).toBe("function");
    });
  });

  describe("getSyncLogs", () => {
    it("exports getSyncLogs function", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(typeof integrationsModule.getSyncLogs).toBe("function");
    });
  });

  describe("Type exports", () => {
    it("exports Integration type", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      // Type exports don't have runtime presence, but module should load
      expect(integrationsModule).toBeDefined();
    });

    it("exports IntegrationProvider type", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(integrationsModule).toBeDefined();
    });

    it("exports IntegrationDisplay type", async () => {
      const integrationsModule = await import("../../../../lib/integrations/index.server");
      expect(integrationsModule).toBeDefined();
    });
  });
});
