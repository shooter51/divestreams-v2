/**
 * Integration Sync Dispatcher
 *
 * Routes sync requests to the appropriate integration handler.
 * Each integration type has its own sync logic and data flow.
 */

import type { IntegrationProvider } from './index.server';
import { integrationLogger } from '../logger';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors?: string[];
  details?: Record<string, unknown>;
}

export interface SyncOptions {
  organizationId: string;
  integrationId: IntegrationProvider;
  /** Optional: sync specific items only */
  itemIds?: string[];
  /** Optional: sync direction for bidirectional integrations */
  direction?: 'push' | 'pull' | 'both';
  /** Optional: dry run - report what would be synced without making changes */
  dryRun?: boolean;
}

/**
 * Dispatch sync request to appropriate handler
 */
export async function dispatchSync(options: SyncOptions): Promise<SyncResult> {
  const { integrationId } = options;

  switch (integrationId) {
    case 'google-calendar':
      return syncGoogleCalendar(options);

    case 'xero':
      return syncXero(options);

    case 'quickbooks':
      return syncQuickBooks(options);

    case 'mailchimp':
      return syncMailchimp(options);

    case 'zapier':
      return syncZapier(options);

    case 'twilio':
    case 'whatsapp':
      // Communication integrations don't have traditional sync
      return {
        success: true,
        synced: 0,
        failed: 0,
        details: { message: 'Communication integrations sync messages in real-time' },
      };

    default:
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [`Sync not implemented for integration: ${integrationId}`],
      };
  }
}

/**
 * Get sync capabilities for an integration
 */
export function getSyncCapabilities(integrationId: IntegrationProvider): {
  canSync: boolean;
  syncTypes: string[];
  supportsDirection: boolean;
  description: string;
} {
  const capabilities: Record<string, ReturnType<typeof getSyncCapabilities>> = {
    'google-calendar': {
      canSync: true,
      syncTypes: ['trips', 'training-sessions'],
      supportsDirection: true,
      description: 'Sync dive trips and training sessions to Google Calendar',
    },
    'xero': {
      canSync: true,
      syncTypes: ['invoices', 'payments', 'contacts'],
      supportsDirection: true,
      description: 'Sync invoices, payments, and customer contacts with Xero',
    },
    'quickbooks': {
      canSync: true,
      syncTypes: ['invoices', 'payments', 'customers'],
      supportsDirection: true,
      description: 'Sync invoices, payments, and customers with QuickBooks',
    },
    'mailchimp': {
      canSync: true,
      syncTypes: ['contacts', 'tags'],
      supportsDirection: false,
      description: 'Push customer contacts and tags to Mailchimp audience',
    },
    'zapier': {
      canSync: true,
      syncTypes: ['webhooks'],
      supportsDirection: false,
      description: 'Trigger Zapier webhooks for automated workflows',
    },
    'twilio': {
      canSync: false,
      syncTypes: [],
      supportsDirection: false,
      description: 'Real-time SMS messaging - no sync needed',
    },
    'whatsapp': {
      canSync: false,
      syncTypes: [],
      supportsDirection: false,
      description: 'Real-time WhatsApp messaging - no sync needed',
    },
  };

  return capabilities[integrationId] || {
    canSync: false,
    syncTypes: [],
    supportsDirection: false,
    description: 'Sync not available for this integration',
  };
}

// ============================================================================
// Integration-specific sync handlers
// ============================================================================

async function syncGoogleCalendar(options: SyncOptions): Promise<SyncResult> {
  // This is already implemented - just import and call
  try {
    const { syncTripsToCalendar } = await import('./google-calendar-bookings.server');
    const result = await syncTripsToCalendar(options.organizationId);
    return result;
  } catch (error) {
    integrationLogger.error({ err: error, provider: 'google_calendar' }, "Google Calendar sync error");
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function syncXero(options: SyncOptions): Promise<SyncResult> {
  try {
    const { syncInvoicesToXero, syncContactsToXero } = await import('./xero.server');

    let totalSynced = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    // Sync contacts first (invoices may reference them)
    try {
      const contactResult = await syncContactsToXero(options.organizationId);
      totalSynced += contactResult.synced;
      totalFailed += contactResult.failed;
      if (contactResult.errors) errors.push(...contactResult.errors);
    } catch (e) {
      errors.push(`Contacts sync failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Then sync invoices
    try {
      const invoiceResult = await syncInvoicesToXero(options.organizationId);
      totalSynced += invoiceResult.synced;
      totalFailed += invoiceResult.failed;
      if (invoiceResult.errors) errors.push(...invoiceResult.errors);
    } catch (e) {
      errors.push(`Invoices sync failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    return {
      success: errors.length === 0,
      synced: totalSynced,
      failed: totalFailed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    integrationLogger.error({ err: error, provider: 'xero' }, "Xero sync error");
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function syncQuickBooks(options: SyncOptions): Promise<SyncResult> {
  try {
    const { syncToQuickBooks } = await import('./quickbooks.server');
    const result = await syncToQuickBooks(options.organizationId);
    return result;
  } catch (error) {
    integrationLogger.error({ err: error, provider: 'quickbooks' }, "QuickBooks sync error");
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function syncMailchimp(options: SyncOptions): Promise<SyncResult> {
  try {
    const { syncContactsToMailchimp } = await import('./mailchimp.server');
    const result = await syncContactsToMailchimp(options.organizationId);
    return result;
  } catch (error) {
    integrationLogger.error({ err: error, provider: 'mailchimp' }, "Mailchimp sync error");
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function syncZapier(options: SyncOptions): Promise<SyncResult> {
  try {
    const { triggerSyncWebhook } = await import('./zapier.server');
    const result = await triggerSyncWebhook(options.organizationId);
    return {
      success: true,
      synced: result.triggered ? 1 : 0,
      failed: result.triggered ? 0 : 1,
      details: { webhookTriggered: result.triggered },
    };
  } catch (error) {
    integrationLogger.error({ err: error, provider: 'zapier' }, "Zapier sync error");
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
