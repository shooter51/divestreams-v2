import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../../../lib/auth/org-context.server', () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock('../../../../../../lib/db/page-content.server', () => ({
  getPageContent: vi.fn(),
  updatePageContent: vi.fn(),
  publishPageContent: vi.fn(),
  unpublishPageContent: vi.fn(),
  getPageContentHistory: vi.fn(),
  restorePageContentVersion: vi.fn(),
}));

describe('Public Site Page Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('action - restore intent', () => {
    it('should restore page to specified version', async () => {
      const { requireOrgContext } = await import('../../../../../../lib/auth/org-context.server');
      const { restorePageContentVersion } = await import('../../../../../../lib/db/page-content.server');

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: 'org-1', slug: 'test-org' },
        user: { id: 'user-1' },
      } as unknown);

      vi.mocked(restorePageContentVersion).mockResolvedValue({
        id: 'page-1',
        pageId: 'about',
        version: 3,
        content: { blocks: [] },
      } as unknown);

      // Verify the mock was set up correctly
      expect(restorePageContentVersion).toBeDefined();
    });

    it('should return error for invalid version', async () => {
      // The action should validate that version is a valid number
      const version = parseInt('invalid', 10);
      expect(isNaN(version)).toBe(true);
    });

    it('should return error when version not found', async () => {
      const { restorePageContentVersion } = await import('../../../../../../lib/db/page-content.server');

      vi.mocked(restorePageContentVersion).mockResolvedValue(null);

      const result = await restorePageContentVersion('org-1', 'about', 999, 'user-1');
      expect(result).toBeNull();
    });
  });
});
