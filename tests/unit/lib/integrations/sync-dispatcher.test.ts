import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchSync, getSyncCapabilities } from '../../../../lib/integrations/sync-dispatcher.server';

// Mock all integration modules
vi.mock('../../../../lib/integrations/google-calendar-bookings.server', () => ({
  syncTripsToCalendar: vi.fn().mockResolvedValue({ success: true, synced: 5, failed: 0 }),
}));

vi.mock('../../../../lib/integrations/xero.server', () => ({
  syncContactsToXero: vi.fn().mockResolvedValue({ success: true, synced: 3, failed: 0 }),
  syncInvoicesToXero: vi.fn().mockResolvedValue({ success: true, synced: 2, failed: 1, errors: ['Invoice #123 failed'] }),
  getIntegration: vi.fn().mockResolvedValue({ isActive: true }),
}));

vi.mock('../../../../lib/integrations/mailchimp.server', () => ({
  syncContactsToMailchimp: vi.fn().mockResolvedValue({ success: true, synced: 10, failed: 0 }),
  getIntegration: vi.fn().mockResolvedValue({ isActive: true }),
}));

vi.mock('../../../../lib/integrations/quickbooks.server', () => ({
  syncToQuickBooks: vi.fn().mockResolvedValue({ success: true, synced: 5, failed: 0 }),
  getIntegration: vi.fn().mockResolvedValue({ isActive: true }),
}));

vi.mock('../../../../lib/integrations/zapier.server', () => ({
  triggerSyncWebhook: vi.fn().mockResolvedValue({ triggered: true }),
  getIntegration: vi.fn().mockResolvedValue({ isActive: true }),
}));

describe('Sync Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dispatchSync', () => {
    it('should dispatch Google Calendar sync', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'google-calendar',
      });

      expect(result.success).toBe(true);
      expect(result.synced).toBe(5);
    });

    it('should dispatch Xero sync and combine results', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'xero',
      });

      // Contacts (3) + Invoices (2) = 5 synced
      expect(result.synced).toBe(5);
      // Invoices had 1 failure
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Invoice #123 failed');
    });

    it('should dispatch Mailchimp sync', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'mailchimp',
      });

      expect(result.success).toBe(true);
      expect(result.synced).toBe(10);
    });

    it('should dispatch QuickBooks sync', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'quickbooks',
      });

      expect(result.success).toBe(true);
      expect(result.synced).toBe(5);
    });

    it('should dispatch Zapier webhook', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'zapier',
      });

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
    });

    it('should handle Twilio/WhatsApp as real-time (no sync)', async () => {
      const twilioResult = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'twilio',
      });

      expect(twilioResult.success).toBe(true);
      expect(twilioResult.synced).toBe(0);
      expect(twilioResult.details?.message).toContain('real-time');
    });

    it('should handle WhatsApp as real-time (no sync)', async () => {
      const whatsappResult = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'whatsapp',
      });

      expect(whatsappResult.success).toBe(true);
      expect(whatsappResult.synced).toBe(0);
      expect(whatsappResult.details?.message).toContain('real-time');
    });

    it('should return error for unknown integration', async () => {
      const result = await dispatchSync({
        organizationId: 'org-1',
        integrationId: 'unknown-integration' as unknown,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('not implemented');
    });
  });

  describe('getSyncCapabilities', () => {
    it('should return Google Calendar capabilities', () => {
      const caps = getSyncCapabilities('google-calendar');

      expect(caps.canSync).toBe(true);
      expect(caps.syncTypes).toContain('trips');
      expect(caps.syncTypes).toContain('training-sessions');
      expect(caps.supportsDirection).toBe(true);
    });

    it('should return Xero capabilities', () => {
      const caps = getSyncCapabilities('xero');

      expect(caps.canSync).toBe(true);
      expect(caps.syncTypes).toContain('invoices');
      expect(caps.syncTypes).toContain('payments');
      expect(caps.syncTypes).toContain('contacts');
      expect(caps.supportsDirection).toBe(true);
    });

    it('should return QuickBooks capabilities', () => {
      const caps = getSyncCapabilities('quickbooks');

      expect(caps.canSync).toBe(true);
      expect(caps.syncTypes).toContain('invoices');
      expect(caps.syncTypes).toContain('payments');
      expect(caps.syncTypes).toContain('customers');
      expect(caps.supportsDirection).toBe(true);
    });

    it('should return Mailchimp capabilities', () => {
      const caps = getSyncCapabilities('mailchimp');

      expect(caps.canSync).toBe(true);
      expect(caps.syncTypes).toContain('contacts');
      expect(caps.syncTypes).toContain('tags');
      expect(caps.supportsDirection).toBe(false);
    });

    it('should return Zapier capabilities', () => {
      const caps = getSyncCapabilities('zapier');

      expect(caps.canSync).toBe(true);
      expect(caps.syncTypes).toContain('webhooks');
      expect(caps.supportsDirection).toBe(false);
    });

    it('should return Twilio as non-syncable', () => {
      const caps = getSyncCapabilities('twilio');

      expect(caps.canSync).toBe(false);
      expect(caps.syncTypes).toHaveLength(0);
      expect(caps.description).toContain('Real-time SMS messaging');
    });

    it('should return WhatsApp as non-syncable', () => {
      const caps = getSyncCapabilities('whatsapp');

      expect(caps.canSync).toBe(false);
      expect(caps.syncTypes).toHaveLength(0);
      expect(caps.description).toContain('Real-time WhatsApp messaging');
    });

    it('should return default capabilities for unknown integration', () => {
      const caps = getSyncCapabilities('unknown-integration' as unknown);

      expect(caps.canSync).toBe(false);
      expect(caps.syncTypes).toHaveLength(0);
      expect(caps.supportsDirection).toBe(false);
    });
  });
});
