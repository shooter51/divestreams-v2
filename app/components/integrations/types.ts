export type IntegrationProvider =
  | "stripe"
  | "google-calendar"
  | "mailchimp"
  | "quickbooks"
  | "zapier"
  | "twilio"
  | "whatsapp"
  | "xero";

export type ZapierTriggerType =
  | "booking.created"
  | "booking.updated"
  | "booking.cancelled"
  | "customer.created"
  | "customer.updated"
  | "payment.received"
  | "payment.refunded"
  | "trip.completed"
  | "trip.created";

export interface XeroSettings {
  tenantId?: string;
  tenantName?: string;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncContacts?: boolean;
  defaultRevenueAccountCode?: string;
  defaultTaxType?: string;
  invoicePrefix?: string;
}

export interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
}

export interface MailchimpSettings {
  selectedAudienceId?: string;
  syncOnBooking?: boolean;
  syncOnCustomerCreate?: boolean;
}

export type WhatsAppCredentials =
  | {
      provider: "meta";
      phoneNumberId: string;
      businessAccountId: string;
      accessToken: string;
    }
  | {
      provider: "twilio";
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };

export interface StripeSettings {
  liveMode?: boolean;
  webhookConfigured?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  accountId?: string | null;
  accountName?: string | null;
  publishableKeyPrefix?: string | null;
}

export interface ZapierSettings {
  webhookUrl?: string | null;
  enabledTriggers?: string[];
}

export interface ConnectedIntegration {
  id: string;
  accountName: string;
  accountEmail: string | null;
  lastSync: string;
  lastSyncError: string | null;
  connectedAt: Date;
  settings: unknown;
  integrationId: string;
}

export interface AvailableIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  features: string[];
  requiredPlan: string;
}
