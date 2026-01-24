import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link, redirect, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
// Server-only imports for loader/action
import { requireOrgContext, getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
// API keys and webhooks removed - DIVE-031
// import { createApiKey, listApiKeys, revokeApiKey } from "../../../../lib/api-keys/index.server";
// import {
//   listWebhooks,
//   createWebhook,
//   updateWebhook,
//   deleteWebhook,
//   createTestDelivery,
//   regenerateWebhookSecret,
//   WEBHOOK_EVENTS,
//   WEBHOOK_EVENT_DESCRIPTIONS,
// } from "../../../../lib/webhooks/index.server";
// import { deliverWebhook } from "../../../../lib/webhooks/deliver.server";
import {
  listActiveIntegrations,
  disconnectIntegration,
  updateIntegrationSettings,
} from "../../../../lib/integrations/index.server";
import { getGoogleAuthUrl } from "../../../../lib/integrations/google-calendar.server";
import { connectTwilio, sendSMS } from "../../../../lib/integrations/twilio.server";
import {
  connectZapier,
  getZapierIntegration,
  updateZapierSettings,
  regenerateZapierSecret,
  testZapierWebhook,
  getZapierWebhookUrl,
  isValidZapierWebhookUrl,
  ZAPIER_TRIGGERS,
  ZAPIER_TRIGGER_DESCRIPTIONS,
} from "../../../../lib/integrations/zapier.server";
// OAuth and integration server imports (all used in loader/action)
import { getXeroAuthUrl } from "../../../../lib/integrations/xero.server";
import { getMailchimpAuthUrl, listAudiences } from "../../../../lib/integrations/mailchimp.server";
import { getQuickBooksAuthUrl } from "../../../../lib/integrations/quickbooks.server";
import { getStripeSettings, connectStripe } from "../../../../lib/integrations/stripe.server";
import { connectWhatsApp, sendWhatsApp } from "../../../../lib/integrations/whatsapp.server";

// Type-only imports (stripped at compile time)
// Webhooks removed - DIVE-031
// import type { Webhook } from "../../../../lib/db/schema/webhooks";

// Inline types from server modules to avoid client bundle issues
// These are duplicated here to prevent the bundler from pulling in .server.ts files
type IntegrationProvider = "stripe" | "google-calendar" | "mailchimp" | "quickbooks" | "zapier" | "twilio" | "whatsapp" | "xero";

// DIVE-031: Removed WebhookEventType

// DIVE-031: Removed ApiKeyPermissions interface

// DIVE-031: Removed ApiKeyDisplay interface

type ZapierTriggerType = "booking.created" | "booking.updated" | "booking.cancelled" | "customer.created" | "customer.updated" | "payment.received" | "payment.refunded" | "trip.completed" | "trip.created";

interface XeroSettings {
  tenantId?: string;
  tenantName?: string;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncContacts?: boolean;
  defaultRevenueAccountCode?: string;
  defaultTaxType?: string;
  invoicePrefix?: string;
}

interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
}

type WhatsAppCredentials =
  | { provider: "meta"; phoneNumberId: string; businessAccountId: string; accessToken: string }
  | { provider: "twilio"; accountSid: string; authToken: string; phoneNumber: string };

interface StripeSettings {
  liveMode?: boolean;
  webhookConfigured?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  accountId?: string | null;
  accountName?: string | null;
  publishableKeyPrefix?: string | null;
}

export const meta: MetaFunction = () => [{ title: "Integrations - DiveStreams" }];

const availableIntegrations = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Process payments, deposits, and refunds",
    category: "payments",
    icon: "CreditCard",
    features: ["Online payments", "Card processing", "Automatic refunds", "Invoice generation"],
    requiredPlan: "starter",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync trips and bookings with Google Calendar",
    category: "calendar",
    icon: "Calendar",
    features: ["Two-way sync", "Automatic updates", "Team calendars"],
    requiredPlan: "starter",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email marketing and customer newsletters",
    category: "marketing",
    icon: "Mail",
    features: ["Customer sync", "Automated campaigns", "Booking follow-ups"],
    requiredPlan: "professional",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting and financial reporting",
    category: "accounting",
    icon: "BarChart",
    features: ["Invoice sync", "Expense tracking", "Financial reports"],
    requiredPlan: "professional",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5,000+ apps with automation",
    category: "automation",
    icon: "Zap",
    features: ["Custom workflows", "Triggers", "Multi-step automations"],
    requiredPlan: "professional",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS notifications to customers",
    category: "notifications",
    icon: "MessageSquare",
    features: ["Booking confirmations", "Reminders", "Custom messages"],
    requiredPlan: "professional",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Chat with customers on WhatsApp",
    category: "notifications",
    icon: "MessageCircle",
    features: ["Booking updates", "Customer support", "Automated responses"],
    requiredPlan: "enterprise",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Cloud accounting software",
    category: "accounting",
    icon: "TrendingUp",
    features: ["Invoice sync", "Bank reconciliation", "Multi-currency"],
    requiredPlan: "enterprise",
  },
];

// Icon components (simple SVG icons)
const Icons: Record<string, React.FC<{ className?: string }>> = {
  CreditCard: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  Calendar: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Mail: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  BarChart: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Zap: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  MessageSquare: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  MessageCircle: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  TrendingUp: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Key: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Copy: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Check: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  X: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Plus: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const subdomain = getSubdomainFromRequest(request);

  // Parse metadata if it exists
  const metadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  // Get connected integrations from database
  const dbIntegrations = await listActiveIntegrations(ctx.org.id);

  // Transform database integrations to display format
  const connectedIntegrations = dbIntegrations.map((int) => ({
    id: int.provider,
    accountName: int.accountName || int.accountEmail || "Connected",
    accountEmail: int.accountEmail,
    lastSync: int.lastSyncAt
      ? new Date(int.lastSyncAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Never synced",
    lastSyncError: int.lastSyncError,
    connectedAt: int.connectedAt,
    settings: int.settings,
    integrationId: int.id,
  }));

  // Check for Stripe connection from metadata (legacy)
  if (metadata.stripeCustomerId && !connectedIntegrations.find((i) => i.id === "stripe")) {
    connectedIntegrations.push({
      id: "stripe" as const,
      accountName: ctx.org.name,
      accountEmail: null,
      lastSync: "Recently",
      lastSyncError: null,
      connectedAt: new Date(),
      settings: null,
      integrationId: "legacy-stripe",
    });
  }

  // Get current plan name from subscription
  const currentPlan = ctx.subscription?.plan || "free";

  // Get API keys for this organization
  // DIVE-031: Removed API keys loading

  // Get webhooks for this organization
  // DIVE-031: Removed webhooks loading

  // Check if Google OAuth is configured
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  // Check if Xero OAuth is configured
  const xeroConfigured = !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);

  // Check if QuickBooks OAuth is configured
  const quickbooksConfigured = !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);

  // Get Xero integration details if connected
  const xeroIntegration = connectedIntegrations.find((i) => i.id === "xero");
  const xeroSettings = xeroIntegration?.settings as XeroSettings | null;

  // Get Zapier integration details if connected
  const zapierIntegration = await getZapierIntegration(ctx.org.id);
  const zapierWebhookUrl = getZapierWebhookUrl(subdomain || ctx.org.id);

  // Check if Mailchimp OAuth is configured
  const mailchimpConfigured = !!(process.env.MAILCHIMP_CLIENT_ID && process.env.MAILCHIMP_CLIENT_SECRET);

  // Get Mailchimp integration details if connected
  const mailchimpIntegration = connectedIntegrations.find((i) => i.id === "mailchimp");
  let mailchimpAudiences: MailchimpAudience[] = [];
  if (mailchimpIntegration) {
    try {
      const audiences = await listAudiences(ctx.org.id);
      if (audiences) {
        mailchimpAudiences = audiences;
      }
    } catch (error) {
      console.error("Error fetching Mailchimp audiences:", error);
    }
  }
  const mailchimpSettings = mailchimpIntegration?.settings as {
    selectedAudienceId?: string;
    syncOnBooking?: boolean;
    syncOnCustomerCreate?: boolean;
  } | null;

  // Get Stripe integration details if connected
  const stripeSettingsData = await getStripeSettings(ctx.org.id);

  return {
    connectedIntegrations,
    availableIntegrations,
    currentPlan,
    isPremium: ctx.isPremium,
    // DIVE-031: Removed apiKeys
    // DIVE-031: Removed webhooks
    orgId: ctx.org.id,
    orgSlug: subdomain,
    // DIVE-031: Removed webhookEvents
    // DIVE-031: Removed webhookEventDescriptions
    googleConfigured,
    xeroConfigured,
    xeroSettings,
    zapierTriggers: ZAPIER_TRIGGERS as unknown as string[],
    zapierTriggerDescriptions: ZAPIER_TRIGGER_DESCRIPTIONS as Record<string, string>,
    zapierWebhookUrl,
    zapierSettings: zapierIntegration?.settings || null,
    quickbooksConfigured,
    mailchimpConfigured,
    mailchimpSettings,
    mailchimpAudiences,
    stripeSettings: stripeSettingsData,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // DIVE-031: Removed API key action handlers

  // Integration actions
  if (intent === "connect") {
    const integrationId = formData.get("integrationId") as string;
    const subdomain = getSubdomainFromRequest(request);

    // Handle OAuth-based integrations
    if (integrationId === "google-calendar") {
      return { showGoogleOAuthModal: true };
    }

    // Handle API-key based integrations (Twilio)
    if (integrationId === "twilio") {
      return { showTwilioModal: true };
    }

    // Handle Zapier (webhook-based)
    if (integrationId === "zapier") {
      return { showZapierModal: true };
    }

    // Handle Mailchimp OAuth
    if (integrationId === "mailchimp") {
      return { showMailchimpOAuthModal: true };
    }

    // Handle Xero OAuth
    if (integrationId === "xero") {
      return { showXeroOAuthModal: true };
    }

    // Handle QuickBooks OAuth
    if (integrationId === "quickbooks") {
      return { showQuickBooksOAuthModal: true };
    }

    // Handle WhatsApp Business (API-key based)
    if (integrationId === "whatsapp") {
      return { showWhatsAppModal: true };
    }

    // Handle Stripe (API-key based)
    if (integrationId === "stripe") {
      return { showStripeModal: true };
    }

    // For other integrations, show coming soon
    return { error: `${integrationId} integration is coming soon!` };
  }

  // Connect Twilio with API credentials
  if (intent === "connectTwilio") {
    const accountSid = formData.get("accountSid") as string;
    const authToken = formData.get("authToken") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const messagingServiceSid = formData.get("messagingServiceSid") as string;

    if (!accountSid || !authToken || !phoneNumber) {
      return { error: "Account SID, Auth Token, and Phone Number are required" };
    }

    try {
      const result = await connectTwilio(ctx.org.id, {
        accountSid,
        authToken,
        phoneNumber,
        messagingServiceSid: messagingServiceSid || undefined,
      });

      if (!result.success) {
        return { error: result.error || "Failed to connect Twilio" };
      }

      return { success: true, message: "Twilio connected successfully!" };
    } catch (error) {
      console.error("Error connecting Twilio:", error);
      return { error: "Failed to connect Twilio" };
    }
  }

  // Connect WhatsApp with API credentials
  if (intent === "connectWhatsApp") {
    const apiType = formData.get("apiType") as "meta" | "twilio";
    const phoneNumberId = formData.get("phoneNumberId") as string;
    const businessAccountId = formData.get("businessAccountId") as string;
    const accessToken = formData.get("accessToken") as string;
    const twilioAccountSid = formData.get("twilioAccountSid") as string;
    const twilioAuthToken = formData.get("twilioAuthToken") as string;
    const twilioWhatsAppNumber = formData.get("twilioWhatsAppNumber") as string;

    // Validate based on API type
    if (apiType === "meta") {
      if (!phoneNumberId || !businessAccountId || !accessToken) {
        return { error: "Phone Number ID, Business Account ID, and Access Token are required for Meta API" };
      }
    } else if (apiType === "twilio") {
      if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
        return { error: "Account SID, Auth Token, and WhatsApp Number are required for Twilio" };
      }
    } else {
      return { error: "Please select an API type" };
    }

    try {
      const credentials: WhatsAppCredentials = apiType === "meta"
        ? {
            provider: "meta" as const,
            phoneNumberId,
            businessAccountId,
            accessToken,
          }
        : {
            provider: "twilio" as const,
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            phoneNumber: twilioWhatsAppNumber,
          };

      const result = await connectWhatsApp(ctx.org.id, credentials);

      if (!result.success) {
        return { error: result.error || "Failed to connect WhatsApp" };
      }

      return { success: true, message: "WhatsApp Business connected successfully!" };
    } catch (error) {
      console.error("Error connecting WhatsApp:", error);
      return { error: "Failed to connect WhatsApp" };
    }
  }

  // Test WhatsApp message
  if (intent === "testWhatsApp") {
    const phoneNumber = formData.get("phoneNumber") as string;

    if (!phoneNumber) {
      return { error: "Phone number is required" };
    }

    try {
      const result = await sendWhatsApp(ctx.org.id, {
        to: phoneNumber,
        body: "Test message from DiveStreams! Your WhatsApp Business integration is working.",
      });

      if (!result.success) {
        return { error: result.error || "Failed to send test WhatsApp message" };
      }

      return { success: true, message: "Test WhatsApp message sent successfully!" };
    } catch (error) {
      console.error("Error sending test WhatsApp message:", error);
      return { error: "Failed to send test WhatsApp message" };
    }
  }

  // Connect Stripe with API credentials
  if (intent === "connectStripe") {
    const secretKey = formData.get("secretKey") as string;
    const publishableKey = formData.get("publishableKey") as string;

    if (!secretKey || !publishableKey) {
      return { error: "Both Secret Key and Publishable Key are required" };
    }

    try {
      const result = await connectStripe(ctx.org.id, {
        secretKey,
        publishableKey,
      });

      if (!result.success) {
        return { error: result.error || "Failed to connect Stripe" };
      }

      return { success: true, message: "Stripe connected successfully!" };
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      return { error: "Failed to connect Stripe" };
    }
  }

  // Connect Google Calendar with OAuth credentials
  if (intent === "connectGoogle") {
    const clientId = formData.get("clientId") as string;
    const clientSecret = formData.get("clientSecret") as string;

    if (!clientId || !clientSecret) {
      return { error: "Client ID and Client Secret are required" };
    }

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getGoogleAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);

      // Store credentials in integration settings before redirecting
      // They will be retrieved during callback
      await updateIntegrationSettings(ctx.org.id, "google-calendar", {
        oauthClientId: clientId,
        oauthClientSecret: clientSecret,
      });

      return redirect(authUrl);
    } catch (error) {
      console.error("Error connecting Google Calendar:", error);
      return { error: error instanceof Error ? error.message : "Failed to connect Google Calendar" };
    }
  }

  // Connect Mailchimp with OAuth credentials
  if (intent === "connectMailchimp") {
    const clientId = formData.get("clientId") as string;
    const clientSecret = formData.get("clientSecret") as string;

    if (!clientId || !clientSecret) {
      return { error: "Client ID and Client Secret are required" };
    }

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getMailchimpAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);

      // Store credentials in integration settings before redirecting
      await updateIntegrationSettings(ctx.org.id, "mailchimp", {
        oauthClientId: clientId,
        oauthClientSecret: clientSecret,
      });

      return redirect(authUrl);
    } catch (error) {
      console.error("Error connecting Mailchimp:", error);
      return { error: error instanceof Error ? error.message : "Failed to connect Mailchimp" };
    }
  }

  // Connect QuickBooks with OAuth credentials
  if (intent === "connectQuickBooks") {
    const clientId = formData.get("clientId") as string;
    const clientSecret = formData.get("clientSecret") as string;

    if (!clientId || !clientSecret) {
      return { error: "Client ID and Client Secret are required" };
    }

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getQuickBooksAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);

      // Store credentials in integration settings before redirecting
      await updateIntegrationSettings(ctx.org.id, "quickbooks", {
        oauthClientId: clientId,
        oauthClientSecret: clientSecret,
      });

      return redirect(authUrl);
    } catch (error) {
      console.error("Error connecting QuickBooks:", error);
      return { error: error instanceof Error ? error.message : "Failed to connect QuickBooks" };
    }
  }

  // Connect Xero with OAuth credentials
  if (intent === "connectXero") {
    const clientId = formData.get("clientId") as string;
    const clientSecret = formData.get("clientSecret") as string;

    if (!clientId || !clientSecret) {
      return { error: "Client ID and Client Secret are required" };
    }

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getXeroAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);

      // Store credentials in integration settings before redirecting
      await updateIntegrationSettings(ctx.org.id, "xero", {
        oauthClientId: clientId,
        oauthClientSecret: clientSecret,
      });

      return redirect(authUrl);
    } catch (error) {
      console.error("Error connecting Xero:", error);
      return { error: error instanceof Error ? error.message : "Failed to connect Xero" };
    }
  }

  if (intent === "disconnect") {
    const integrationId = formData.get("integrationId") as IntegrationProvider;

    try {
      const success = await disconnectIntegration(ctx.org.id, integrationId);
      if (!success) {
        return { error: "Integration not found" };
      }
      return { success: true, message: "Integration disconnected" };
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      return { error: "Failed to disconnect integration" };
    }
  }

  if (intent === "sync") {
    const integrationId = formData.get("integrationId") as IntegrationProvider;

    try {
      const { dispatchSync, getSyncCapabilities } = await import("../../../../lib/integrations/sync-dispatcher.server");

      // Check if this integration supports sync
      const capabilities = getSyncCapabilities(integrationId);
      if (!capabilities.canSync) {
        return {
          success: true,
          message: capabilities.description,
        };
      }

      // Dispatch the sync
      const result = await dispatchSync({
        organizationId: ctx.org.id,
        integrationId,
      });

      if (!result.success) {
        return {
          error: result.errors?.join(', ') || 'Sync failed',
        };
      }

      if (result.synced === 0 && result.failed === 0) {
        return {
          success: true,
          message: 'Everything is already synced!',
        };
      }

      return {
        success: true,
        message: `Successfully synced ${result.synced} items${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        syncDetails: result,
      };
    } catch (error) {
      console.error("Error during sync:", error);
      return { error: error instanceof Error ? error.message : "Sync failed" };
    }
  }

  if (intent === "configure") {
    const integrationId = formData.get("integrationId") as string;
    return { openConfig: true, integrationId };
  }

  if (intent === "updateSettings") {
    const integrationId = formData.get("integrationId") as IntegrationProvider;
    const settingsJson = formData.get("settings") as string;

    try {
      const settings = JSON.parse(settingsJson);
      await updateIntegrationSettings(ctx.org.id, integrationId, settings);
      return { success: true, message: "Settings updated" };
    } catch (error) {
      console.error("Error updating settings:", error);
      return { error: "Failed to update settings" };
    }
  }

  // Update Xero settings
  if (intent === "updateXeroSettings") {
    const syncInvoices = formData.get("syncInvoices") === "true";
    const syncPayments = formData.get("syncPayments") === "true";
    const syncContacts = formData.get("syncContacts") === "true";
    const defaultRevenueAccountCode = formData.get("defaultRevenueAccountCode") as string;
    const defaultTaxType = formData.get("defaultTaxType") as string;
    const invoicePrefix = formData.get("invoicePrefix") as string;

    try {
      const settings: XeroSettings = {
        syncInvoices,
        syncPayments,
        syncContacts,
        defaultRevenueAccountCode: defaultRevenueAccountCode || undefined,
        defaultTaxType: defaultTaxType || undefined,
        invoicePrefix: invoicePrefix || undefined,
      };
      await updateIntegrationSettings(ctx.org.id, "xero", settings as Record<string, unknown>);
      return { success: true, message: "Xero settings updated" };
    } catch (error) {
      console.error("Error updating Xero settings:", error);
      return { error: "Failed to update Xero settings" };
    }
  }

  // Open Xero settings modal
  if (intent === "configureXero") {
    return { showXeroConfigModal: true };
  }

  // Test SMS (for Twilio)
  if (intent === "testSMS") {
    const phoneNumber = formData.get("phoneNumber") as string;

    if (!phoneNumber) {
      return { error: "Phone number is required" };
    }

    try {
      const result = await sendSMS(ctx.org.id, {
        to: phoneNumber,
        body: "Test message from DiveStreams! Your Twilio integration is working.",
      });

      if (!result.success) {
        return { error: result.error || "Failed to send test SMS" };
      }

      return { success: true, message: "Test SMS sent successfully!" };
    } catch (error) {
      console.error("Error sending test SMS:", error);
      return { error: "Failed to send test SMS" };
    }
  }

  // Zapier actions
  if (intent === "connectZapier") {
    const zapierWebhookUrl = formData.get("zapierWebhookUrl") as string;
    const enabledTriggersRaw = formData.getAll("zapierTriggers") as string[];

    // Validate webhook URL if provided
    if (zapierWebhookUrl && !isValidZapierWebhookUrl(zapierWebhookUrl)) {
      return { error: "Invalid webhook URL. Must be HTTPS." };
    }

    try {
      const result = await connectZapier(ctx.org.id, {
        webhookUrl: zapierWebhookUrl || undefined,
        enabledTriggers: enabledTriggersRaw.length > 0
          ? enabledTriggersRaw as ZapierTriggerType[]
          : undefined,
      });

      if (!result.success) {
        return { error: result.error || "Failed to connect Zapier" };
      }

      return {
        success: true,
        message: "Zapier connected successfully!",
        zapierConnected: true,
        zapierSecret: result.webhookSecret,
      };
    } catch (error) {
      console.error("Error connecting Zapier:", error);
      return { error: "Failed to connect Zapier" };
    }
  }

  if (intent === "updateZapierSettings") {
    const zapierWebhookUrl = formData.get("zapierWebhookUrl") as string;
    const enabledTriggersRaw = formData.getAll("zapierTriggers") as string[];

    // Validate webhook URL if provided
    if (zapierWebhookUrl && !isValidZapierWebhookUrl(zapierWebhookUrl)) {
      return { error: "Invalid webhook URL. Must be HTTPS." };
    }

    try {
      const result = await updateZapierSettings(ctx.org.id, {
        webhookUrl: zapierWebhookUrl || null,
        enabledTriggers: enabledTriggersRaw as ZapierTriggerType[],
      });

      if (!result.success) {
        return { error: result.error || "Failed to update Zapier settings" };
      }

      return { success: true, message: "Zapier settings updated!" };
    } catch (error) {
      console.error("Error updating Zapier settings:", error);
      return { error: "Failed to update Zapier settings" };
    }
  }

  if (intent === "testZapierWebhook") {
    try {
      const result = await testZapierWebhook(ctx.org.id);

      if (!result.success) {
        return { error: result.error || "Failed to test Zapier webhook" };
      }

      return {
        success: true,
        message: "Test webhook sent successfully!",
        zapierTestSuccess: true,
      };
    } catch (error) {
      console.error("Error testing Zapier webhook:", error);
      return { error: "Failed to test Zapier webhook" };
    }
  }

  if (intent === "regenerateZapierSecret") {
    try {
      const result = await regenerateZapierSecret(ctx.org.id);

      if (!result.success) {
        return { error: result.error || "Failed to regenerate Zapier secret" };
      }

      return {
        success: true,
        zapierSecretRegenerated: true,
        newZapierSecret: result.newSecret,
      };
    } catch (error) {
      console.error("Error regenerating Zapier secret:", error);
      return { error: "Failed to regenerate Zapier secret" };
    }
  }

  // Webhook actions - DIVE-031: Removed webhook action handlers

  return null;
}

// Plan hierarchy - free/starter is base level, maps to both "free" and "starter"
const planHierarchy = ["free", "starter", "professional", "enterprise"];
// Also handle "premium" as equivalent to "professional"
const normalizePlan = (plan: string): string => {
  if (plan === "premium") return "professional";
  return plan;
};

export default function IntegrationsPage() {
  const {
    connectedIntegrations,
    availableIntegrations,
    currentPlan,
    googleConfigured,
    xeroConfigured,
    xeroSettings,
    zapierTriggers,
    zapierTriggerDescriptions,
    zapierWebhookUrl,
    quickbooksConfigured,
    mailchimpConfigured,
    mailchimpSettings,
    mailchimpAudiences,
    stripeSettings,
    zapierSettings,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher();
  const [copied, setCopied] = useState(false);

  // Twilio modal state
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] = useState("");

  // Test SMS modal state
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState("");

  // Zapier modal state
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [showZapierConfigModal, setShowZapierConfigModal] = useState(false);
  const [zapierUserWebhookUrl, setZapierUserWebhookUrl] = useState(zapierSettings?.webhookUrl || "");
  const [zapierEnabledTriggers, setZapierEnabledTriggers] = useState<string[]>(
    zapierSettings?.enabledTriggers || [...zapierTriggers]
  );
  const [showZapierSecretModal, setShowZapierSecretModal] = useState(false);
  const [zapierSecret, setZapierSecret] = useState<string | null>(null);

  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppApiType, setWhatsAppApiType] = useState<"meta" | "twilio" | "">("");
  const [whatsAppPhoneNumberId, setWhatsAppPhoneNumberId] = useState("");
  const [whatsAppBusinessAccountId, setWhatsAppBusinessAccountId] = useState("");
  const [whatsAppAccessToken, setWhatsAppAccessToken] = useState("");
  const [whatsAppTwilioAccountSid, setWhatsAppTwilioAccountSid] = useState("");
  const [whatsAppTwilioAuthToken, setWhatsAppTwilioAuthToken] = useState("");
  const [whatsAppTwilioNumber, setWhatsAppTwilioNumber] = useState("");

  // Test WhatsApp modal state
  const [showTestWhatsAppModal, setShowTestWhatsAppModal] = useState(false);
  const [testWhatsAppNumber, setTestWhatsAppNumber] = useState("");

  // Stripe modal state
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [showStripeSettingsModal, setShowStripeSettingsModal] = useState(false);

  // Xero modal state
  const [showXeroConfigModal, setShowXeroConfigModal] = useState(false);
  const [xeroSyncInvoices, setXeroSyncInvoices] = useState(xeroSettings?.syncInvoices || false);
  const [xeroSyncPayments, setXeroSyncPayments] = useState(xeroSettings?.syncPayments || false);
  const [xeroSyncContacts, setXeroSyncContacts] = useState(xeroSettings?.syncContacts || false);
  const [xeroRevenueAccountCode, setXeroRevenueAccountCode] = useState(xeroSettings?.defaultRevenueAccountCode || "");
  const [xeroTaxType, setXeroTaxType] = useState(xeroSettings?.defaultTaxType || "");
  const [xeroInvoicePrefix, setXeroInvoicePrefix] = useState(xeroSettings?.invoicePrefix || "");

  // Mailchimp modal state
  const [showMailchimpConfigModal, setShowMailchimpConfigModal] = useState(false);
  const [mailchimpSelectedAudience, setMailchimpSelectedAudience] = useState(mailchimpSettings?.selectedAudienceId || "");
  const [mailchimpSyncOnBooking, setMailchimpSyncOnBooking] = useState(mailchimpSettings?.syncOnBooking ?? true);
  const [mailchimpSyncOnCustomerCreate, setMailchimpSyncOnCustomerCreate] = useState(mailchimpSettings?.syncOnCustomerCreate ?? true);

  // OAuth configuration modal state
  const [showGoogleOAuthModal, setShowGoogleOAuthModal] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");

  const [showMailchimpOAuthModal, setShowMailchimpOAuthModal] = useState(false);
  const [mailchimpClientId, setMailchimpClientId] = useState("");
  const [mailchimpClientSecret, setMailchimpClientSecret] = useState("");

  const [showQuickBooksOAuthModal, setShowQuickBooksOAuthModal] = useState(false);
  const [quickBooksClientId, setQuickBooksClientId] = useState("");
  const [quickBooksClientSecret, setQuickBooksClientSecret] = useState("");

  const [showXeroOAuthModal, setShowXeroOAuthModal] = useState(false);
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");

  // Success/error messages from URL params (OAuth callbacks)
  const urlSuccess = searchParams.get("success");
  const urlError = searchParams.get("error");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(
    urlSuccess ? { type: "success", message: urlSuccess } : urlError ? { type: "error", message: urlError } : null
  );

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle fetcher responses
  useEffect(() => {
    // DIVE-031: Removed API key and webhook response handlers

    // Handle Twilio modal request
    if (fetcher.data && "showTwilioModal" in fetcher.data && fetcher.data.showTwilioModal) {
      setShowTwilioModal(true);
    }

    // Handle WhatsApp modal request
    if (fetcher.data && "showWhatsAppModal" in fetcher.data && fetcher.data.showWhatsAppModal) {
      setShowWhatsAppModal(true);
    }

    // Handle Stripe modal request
    if (fetcher.data && "showStripeModal" in fetcher.data && fetcher.data.showStripeModal) {
      setShowStripeModal(true);
    }

    // Handle Mailchimp config modal request
    if (fetcher.data && "showMailchimpConfigModal" in fetcher.data && fetcher.data.showMailchimpConfigModal) {
      setShowMailchimpConfigModal(true);
    }

    // Handle Xero config modal request
    if (fetcher.data && "showXeroConfigModal" in fetcher.data && fetcher.data.showXeroConfigModal) {
      setShowXeroConfigModal(true);
    }

    // Handle OAuth configuration modal requests
    if (fetcher.data && "showGoogleOAuthModal" in fetcher.data && fetcher.data.showGoogleOAuthModal) {
      setShowGoogleOAuthModal(true);
    }

    if (fetcher.data && "showMailchimpOAuthModal" in fetcher.data && fetcher.data.showMailchimpOAuthModal) {
      setShowMailchimpOAuthModal(true);
    }

    if (fetcher.data && "showQuickBooksOAuthModal" in fetcher.data && fetcher.data.showQuickBooksOAuthModal) {
      setShowQuickBooksOAuthModal(true);
    }

    if (fetcher.data && "showXeroOAuthModal" in fetcher.data && fetcher.data.showXeroOAuthModal) {
      setShowXeroOAuthModal(true);
    }

    // Handle success messages from integration actions
    if (fetcher.data && "success" in fetcher.data && fetcher.data.success && "message" in fetcher.data) {
      setNotification({ type: "success", message: fetcher.data.message as string });
      setShowTwilioModal(false);
      setShowTestSmsModal(false);
      setShowWhatsAppModal(false);
      setShowTestWhatsAppModal(false);
      setShowStripeModal(false);
      setShowStripeSettingsModal(false);
      setShowMailchimpConfigModal(false);
      setShowXeroConfigModal(false);
      setShowGoogleOAuthModal(false);
      setShowMailchimpOAuthModal(false);
      setShowQuickBooksOAuthModal(false);
      setShowXeroOAuthModal(false);
      // Reset Twilio form
      setTwilioAccountSid("");
      setTwilioAuthToken("");
      setTwilioPhoneNumber("");
      setTwilioMessagingServiceSid("");
      setTestSmsNumber("");
      // Reset WhatsApp form
      setWhatsAppApiType("");
      setWhatsAppPhoneNumberId("");
      setWhatsAppBusinessAccountId("");
      setWhatsAppAccessToken("");
      setWhatsAppTwilioAccountSid("");
      setWhatsAppTwilioAuthToken("");
      setWhatsAppTwilioNumber("");
      setTestWhatsAppNumber("");
      // Reset Stripe form
      setStripeSecretKey("");
      setStripePublishableKey("");
      // Reset OAuth forms
      setGoogleClientId("");
      setGoogleClientSecret("");
      setMailchimpClientId("");
      setMailchimpClientSecret("");
      setQuickBooksClientId("");
      setQuickBooksClientSecret("");
      setXeroClientId("");
      setXeroClientSecret("");
    }

    // Handle error messages
    if (fetcher.data && "error" in fetcher.data) {
      setNotification({ type: "error", message: fetcher.data.error as string });
    }
  }, [fetcher.data]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isIntegrationAvailable = (requiredPlan: string) => {
    const normalizedCurrent = normalizePlan(currentPlan);
    const normalizedRequired = normalizePlan(requiredPlan);
    return planHierarchy.indexOf(normalizedCurrent) >= planHierarchy.indexOf(normalizedRequired);
  };

  const isConnected = (integrationId: string) => {
    return connectedIntegrations.some((i) => i.id === integrationId);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const categories = [
    { id: "payments", name: "Payments" },
    { id: "calendar", name: "Calendar" },
    { id: "marketing", name: "Marketing" },
    { id: "accounting", name: "Accounting" },
    { id: "notifications", name: "Notifications" },
    { id: "automation", name: "Automation" },
  ];

  return (
    <div className="max-w-4xl">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-4 text-current opacity-70 hover:opacity-100"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-6">
        <Link to="/tenant/settings" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Integrations</h1>
        <p className="text-gray-500">Connect third-party services to enhance DiveStreams</p>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold mb-4">Connected</h2>
          <div className="space-y-4">
            {connectedIntegrations.map((connection) => {
              const integration = availableIntegrations.find((i) => i.id === connection.id);
              if (!integration) return null;
              const IconComponent = Icons[integration.icon];

              return (
                <div
                  key={connection.id}
                  className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 text-gray-600">
                        {IconComponent && <IconComponent className="w-8 h-8" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{integration.name}</h3>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{integration.description}</p>
                        <div className="mt-2 text-xs text-gray-400">
                          <span>Account: {connection.accountName}</span>
                          <span className="mx-2">-</span>
                          <span>Last sync: {connection.lastSync}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* Show Sync button only for syncable integrations */}
                      {connection.id === "google-calendar" && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="sync" />
                          <input type="hidden" name="integrationId" value={connection.id} />
                          <button
                            type="submit"
                            disabled={fetcher.state !== "idle"}
                            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {fetcher.state !== "idle" ? "Syncing..." : "Sync Now"}
                          </button>
                        </fetcher.Form>
                      )}
                      {/* Show Test SMS button for Twilio */}
                      {connection.id === "twilio" && (
                        <button
                          type="button"
                          onClick={() => setShowTestSmsModal(true)}
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          Send Test SMS
                        </button>
                      )}
                      {/* Show Test WhatsApp button for WhatsApp */}
                      {connection.id === "whatsapp" && (
                        <button
                          type="button"
                          onClick={() => setShowTestWhatsAppModal(true)}
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          Send Test Message
                        </button>
                      )}
                      {/* Show Configure button for Xero */}
                      {connection.id === "xero" && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="configureXero" />
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                          >
                            Configure
                          </button>
                        </fetcher.Form>
                      )}
                      {/* Show Manage Settings button for QuickBooks */}
                      {connection.id === "quickbooks" && (
                        <Link
                          to="/tenant/settings/integrations/quickbooks"
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 inline-block"
                        >
                          Manage Settings
                        </Link>
                      )}
                      {/* Show View Settings button for Stripe */}
                      {connection.id === "stripe" && stripeSettings && (
                        <button
                          type="button"
                          onClick={() => setShowStripeSettingsModal(true)}
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          View Settings
                        </button>
                      )}
                      <fetcher.Form
                        method="post"
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              `Are you sure you want to disconnect ${integration.name}?`
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="disconnect" />
                        <input type="hidden" name="integrationId" value={connection.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations by Category */}
      {categories.map((category) => {
        const categoryIntegrations = availableIntegrations.filter(
          (i) => i.category === category.id && !isConnected(i.id)
        );

        if (categoryIntegrations.length === 0) return null;

        return (
          <div key={category.id} className="mb-8">
            <h2 className="font-semibold mb-4">{category.name}</h2>
            <div className="grid grid-cols-2 gap-4">
              {categoryIntegrations.map((integration) => {
                const available = isIntegrationAvailable(integration.requiredPlan);
                const IconComponent = Icons[integration.icon];

                return (
                  <div
                    key={integration.id}
                    className={`bg-white rounded-xl p-6 shadow-sm ${
                      !available ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 text-gray-600">
                          {IconComponent && <IconComponent className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-gray-500">{integration.description}</p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 mb-4">
                      {integration.features.map((feature) => (
                        <li key={feature} className="text-xs text-gray-500 flex items-center gap-1">
                          <Icons.Check className="w-3 h-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {available ? (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="connect" />
                        <input type="hidden" name="integrationId" value={integration.id} />
                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Connect
                        </button>
                      </fetcher.Form>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">
                          Requires {integration.requiredPlan} plan
                        </p>
                        <Link
                          to="/tenant/settings/billing"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Upgrade to unlock
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}



      {/* Twilio Configuration Modal */}
      {showTwilioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Twilio SMS</h2>
                <p className="text-sm text-gray-500">
                  Enter your Twilio credentials to enable SMS notifications
                </p>
              </div>
              <button
                onClick={() => setShowTwilioModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectTwilio" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Account SID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountSid"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in your Twilio Console Dashboard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Auth Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="authToken"
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={twilioPhoneNumber}
                  onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your Twilio phone number in E.164 format
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Messaging Service SID (Optional)
                </label>
                <input
                  type="text"
                  name="messagingServiceSid"
                  value={twilioMessagingServiceSid}
                  onChange={(e) => setTwilioMessagingServiceSid(e.target.value)}
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full border rounded-lg p-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If using a Messaging Service instead of a phone number
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Get your credentials from the{" "}
                  <a
                    href="https://console.twilio.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Twilio Console
                  </a>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTwilioModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect Twilio"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Test SMS Modal */}
      {showTestSmsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Send Test SMS</h2>
                <p className="text-sm text-gray-500">
                  Send a test message to verify your Twilio integration
                </p>
              </div>
              <button
                onClick={() => setShowTestSmsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="testSMS" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={testSmsNumber}
                  onChange={(e) => setTestSmsNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Phone number to send test message to
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestSmsModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Sending..." : "Send Test"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Stripe Configuration Modal */}
      {showStripeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Stripe</h2>
                <p className="text-sm text-gray-500">
                  Enter your Stripe API keys to enable payment processing
                </p>
              </div>
              <button
                onClick={() => setShowStripeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectStripe" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Secret Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="secretKey"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_test_... or sk_live_..."
                  className="w-full border rounded-lg p-2 text-sm font-mono"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your Stripe Secret Key (starts with sk_test_ or sk_live_)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Publishable Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="publishableKey"
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_test_... or pk_live_..."
                  className="w-full border rounded-lg p-2 text-sm font-mono"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your Stripe Publishable Key (starts with pk_test_ or pk_live_)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Where to find your API keys:</strong>
                  <br />
                  Visit your{" "}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900"
                  >
                    Stripe Dashboard → API Keys
                  </a>
                  <br />
                  Use test keys for development and live keys for production.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStripeModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect Stripe"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Stripe Settings Modal */}
      {showStripeSettingsModal && stripeSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Stripe Settings</h2>
                <p className="text-sm text-gray-500">
                  View your Stripe integration configuration
                </p>
              </div>
              <button
                onClick={() => setShowStripeSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Account ID</p>
                    <p className="text-sm font-mono">{stripeSettings.accountId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Account Name</p>
                    <p className="text-sm">{stripeSettings.accountName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Mode</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${
                        stripeSettings.liveMode
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {stripeSettings.liveMode ? "Live Mode" : "Test Mode"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Publishable Key</p>
                    <p className="text-sm font-mono">{stripeSettings.publishableKeyPrefix || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Capabilities</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Charges Enabled</span>
                    {stripeSettings.chargesEnabled ? (
                      <Icons.Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Payouts Enabled</span>
                    {stripeSettings.payoutsEnabled ? (
                      <Icons.Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Webhook Configured</span>
                    {stripeSettings.webhookConfigured ? (
                      <Icons.Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Dashboard Access:</strong>
                  <br />
                  Manage your Stripe account at{" "}
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900"
                  >
                    dashboard.stripe.com
                  </a>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStripeSettingsModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zapier Connect Modal */}
      {showZapierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Zapier</h2>
                <p className="text-sm text-gray-500">
                  Automate workflows by connecting DiveStreams to 6,000+ apps
                </p>
              </div>
              <button
                onClick={() => setShowZapierModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="connectZapier" />

              {/* Webhook URL from DiveStreams */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Your DiveStreams Webhook URL</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Use this URL in your Zapier "Webhooks by Zapier" trigger to receive events from DiveStreams.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={zapierWebhookUrl}
                    className="flex-1 bg-white border rounded-lg p-2 text-sm font-mono text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(zapierWebhookUrl)}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    title="Copy URL"
                  >
                    <Icons.Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Optional: Zapier Webhook URL for Catch Hook */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Zapier Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  name="zapierWebhookUrl"
                  value={zapierUserWebhookUrl}
                  onChange={(e) => setZapierUserWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full border rounded-lg p-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If you want DiveStreams to push events to Zapier, enter your Zapier Catch Hook URL here.
                </p>
              </div>

              {/* Available Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">Available Triggers</label>
                <p className="text-xs text-gray-500 mb-3">
                  Select which events should be sent to Zapier
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {zapierTriggers.map((trigger) => (
                    <label
                      key={trigger}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="zapierTriggers"
                        value={trigger}
                        checked={zapierEnabledTriggers.includes(trigger)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setZapierEnabledTriggers([...zapierEnabledTriggers, trigger]);
                          } else {
                            setZapierEnabledTriggers(zapierEnabledTriggers.filter(t => t !== trigger));
                          }
                        }}
                        className="mt-1"
                      />
                      <div>
                        <span className="text-sm font-medium">{trigger}</span>
                        <p className="text-xs text-gray-500">
                          {zapierTriggerDescriptions[trigger]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <h4 className="font-medium text-blue-800 mb-1">How to use with Zapier:</h4>
                <ol className="list-decimal list-inside text-blue-700 space-y-1 text-xs">
                  <li>Create a new Zap in Zapier</li>
                  <li>Choose "Webhooks by Zapier" as your trigger</li>
                  <li>Select "Catch Hook" and copy the provided URL</li>
                  <li>Paste that URL in the field above</li>
                  <li>DiveStreams will send events to your Zap automatically</li>
                </ol>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowZapierModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect Zapier"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Zapier Config Modal (for connected integrations) */}
      {showZapierConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Zapier Settings</h2>
                <p className="text-sm text-gray-500">
                  Manage your Zapier integration settings
                </p>
              </div>
              <button
                onClick={() => setShowZapierConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="updateZapierSettings" />

              {/* Webhook URL from DiveStreams */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Your DiveStreams Webhook URL</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={zapierWebhookUrl}
                    className="flex-1 bg-white border rounded-lg p-2 text-sm font-mono text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(zapierWebhookUrl)}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    title="Copy URL"
                  >
                    <Icons.Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Zapier Webhook URL */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Zapier Webhook URL
                </label>
                <input
                  type="url"
                  name="zapierWebhookUrl"
                  value={zapierUserWebhookUrl}
                  onChange={(e) => setZapierUserWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              {/* Enabled Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">Enabled Triggers</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {zapierTriggers.map((trigger) => (
                    <label
                      key={trigger}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="zapierTriggers"
                        value={trigger}
                        checked={zapierEnabledTriggers.includes(trigger)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setZapierEnabledTriggers([...zapierEnabledTriggers, trigger]);
                          } else {
                            setZapierEnabledTriggers(zapierEnabledTriggers.filter(t => t !== trigger));
                          }
                        }}
                        className="mt-1"
                      />
                      <div>
                        <span className="text-sm font-medium">{trigger}</span>
                        <p className="text-xs text-gray-500">
                          {zapierTriggerDescriptions[trigger]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowZapierConfigModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </fetcher.Form>

            {/* Test Webhook & Regenerate Secret */}
            <div className="mt-4 pt-4 border-t space-y-3">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="testZapierWebhook" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle" || !zapierUserWebhookUrl}
                  className="w-full py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  {fetcher.state !== "idle" ? "Testing..." : "Test Webhook Connection"}
                </button>
              </fetcher.Form>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="regenerateZapierSecret" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="w-full py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 text-sm"
                >
                  Regenerate Webhook Secret
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>
      )}

      {/* Zapier Secret Modal */}
      {showZapierSecretModal && zapierSecret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-green-700">Zapier Connected!</h2>
                <p className="text-sm text-gray-500">
                  Save your webhook secret - you won't be able to see it again
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Important:</strong> Copy this secret now. For security reasons,
                  it will not be displayed again. You'll need it to verify webhook signatures.
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Webhook Secret</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={zapierSecret}
                  className="flex-1 bg-gray-50 border rounded-lg p-3 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(zapierSecret)}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  title="Copy Secret"
                >
                  <Icons.Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowZapierSecretModal(false);
                setZapierSecret(null);
              }}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              I've Saved My Secret
            </button>
          </div>
        </div>
      )}

      {/* Xero Configuration Modal */}
      {showXeroConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Xero Settings</h2>
                <p className="text-sm text-gray-500">
                  Configure sync options and account mapping
                </p>
                {xeroSettings?.tenantName && (
                  <p className="text-xs text-gray-400 mt-1">
                    Connected to: {xeroSettings.tenantName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowXeroConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-6">
              <input type="hidden" name="intent" value="updateXeroSettings" />

              {/* Sync Options */}
              <div>
                <h3 className="text-sm font-medium mb-3">Sync Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncInvoices"
                      value="true"
                      checked={xeroSyncInvoices}
                      onChange={(e) => setXeroSyncInvoices(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Invoices</span>
                      <p className="text-xs text-gray-500">
                        Automatically create invoices in Xero when bookings are confirmed
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncPayments"
                      value="true"
                      checked={xeroSyncPayments}
                      onChange={(e) => setXeroSyncPayments(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Payments</span>
                      <p className="text-xs text-gray-500">
                        Record payments in Xero when received via Stripe
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncContacts"
                      value="true"
                      checked={xeroSyncContacts}
                      onChange={(e) => setXeroSyncContacts(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Contacts</span>
                      <p className="text-xs text-gray-500">
                        Create and update contacts in Xero from customer data
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Account Mapping */}
              <div>
                <h3 className="text-sm font-medium mb-3">Account Mapping</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Default Revenue Account Code
                    </label>
                    <input
                      type="text"
                      name="defaultRevenueAccountCode"
                      value={xeroRevenueAccountCode}
                      onChange={(e) => setXeroRevenueAccountCode(e.target.value)}
                      placeholder="e.g., 200 or 4000"
                      className="w-full border rounded-lg p-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The account code for booking revenue in your Xero chart of accounts
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Default Tax Type
                    </label>
                    <select
                      name="defaultTaxType"
                      value={xeroTaxType}
                      onChange={(e) => setXeroTaxType(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm"
                    >
                      <option value="">Select tax type...</option>
                      <option value="OUTPUT">OUTPUT (Standard Tax)</option>
                      <option value="OUTPUT2">OUTPUT2 (Reduced Rate)</option>
                      <option value="NONE">NONE (No Tax)</option>
                      <option value="ZERORATEDOUTPUT">Zero Rated</option>
                      <option value="EXEMPTOUTPUT">Exempt</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Tax type to apply to invoices
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Invoice Reference Prefix
                    </label>
                    <input
                      type="text"
                      name="invoicePrefix"
                      value={xeroInvoicePrefix}
                      onChange={(e) => setXeroInvoicePrefix(e.target.value)}
                      placeholder="e.g., DS-"
                      className="w-full border rounded-lg p-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Prefix added to invoice references (e.g., DS-12345)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Changes to sync settings will apply to new bookings and transactions.
                  Existing records will not be automatically synced.
                </p>
              </div>

              {fetcher.data && "error" in fetcher.data && (
                <p className="text-red-600 text-sm">{fetcher.data.error as string}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowXeroConfigModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
      {/* WhatsApp Business Configuration Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect WhatsApp Business</h2>
                <p className="text-sm text-gray-500">
                  Choose your WhatsApp Business API provider
                </p>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectWhatsApp" />

              {/* API Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Provider <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-colors \${
                      whatsAppApiType === "meta"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="apiType"
                      value="meta"
                      checked={whatsAppApiType === "meta"}
                      onChange={() => setWhatsAppApiType("meta")}
                      className="sr-only"
                    />
                    <Icons.MessageCircle className="w-8 h-8 text-green-600 mb-1" />
                    <span className="text-sm font-medium">Meta Business API</span>
                    <span className="text-xs text-gray-500 text-center mt-1">
                      Direct from Meta
                    </span>
                  </label>
                  <label
                    className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-colors \${
                      whatsAppApiType === "twilio"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="apiType"
                      value="twilio"
                      checked={whatsAppApiType === "twilio"}
                      onChange={() => setWhatsAppApiType("twilio")}
                      className="sr-only"
                    />
                    <Icons.MessageSquare className="w-8 h-8 text-red-500 mb-1" />
                    <span className="text-sm font-medium">Twilio WhatsApp</span>
                    <span className="text-xs text-gray-500 text-center mt-1">
                      Via Twilio
                    </span>
                  </label>
                </div>
              </div>

              {/* Meta Business API Fields */}
              {whatsAppApiType === "meta" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone Number ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="phoneNumberId"
                      value={whatsAppPhoneNumberId}
                      onChange={(e) => setWhatsAppPhoneNumberId(e.target.value)}
                      placeholder="123456789012345"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "meta"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      From Meta Business Suite &gt; WhatsApp &gt; Settings
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Business Account ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessAccountId"
                      value={whatsAppBusinessAccountId}
                      onChange={(e) => setWhatsAppBusinessAccountId(e.target.value)}
                      placeholder="123456789012345"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "meta"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your WhatsApp Business Account ID
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="accessToken"
                      value={whatsAppAccessToken}
                      onChange={(e) => setWhatsAppAccessToken(e.target.value)}
                      placeholder="Your permanent access token"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "meta"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      System user access token with whatsapp_business_messaging permission
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Setup Guide:</strong> Create a system user in Meta Business Settings,
                      generate a permanent token, and add the whatsapp_business_messaging permission.{" "}
                      <a
                        href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>
                </>
              )}

              {/* Twilio WhatsApp Fields */}
              {whatsAppApiType === "twilio" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Account SID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="twilioAccountSid"
                      value={whatsAppTwilioAccountSid}
                      onChange={(e) => setWhatsAppTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "twilio"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      From your Twilio Console Dashboard
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Auth Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="twilioAuthToken"
                      value={whatsAppTwilioAuthToken}
                      onChange={(e) => setWhatsAppTwilioAuthToken(e.target.value)}
                      placeholder="Your Twilio Auth Token"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "twilio"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be encrypted and stored securely
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="twilioWhatsAppNumber"
                      value={whatsAppTwilioNumber}
                      onChange={(e) => setWhatsAppTwilioNumber(e.target.value)}
                      placeholder="+14155238886"
                      className="w-full border rounded-lg p-2 text-sm"
                      required={whatsAppApiType === "twilio"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your Twilio WhatsApp-enabled phone number
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> You can use Twilio's sandbox number for testing.
                      For production, you'll need a Twilio-approved WhatsApp sender.{" "}
                      <a
                        href="https://www.twilio.com/docs/whatsapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>
                </>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> WhatsApp Business has a 24-hour messaging window.
                  You can only send freeform messages to customers who have messaged you in the last 24 hours.
                  For proactive messages, use pre-approved message templates.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle" || !whatsAppApiType}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect WhatsApp"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Test WhatsApp Modal */}
      {showTestWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Send Test WhatsApp Message</h2>
                <p className="text-sm text-gray-500">
                  Send a test message to verify your WhatsApp integration
                </p>
              </div>
              <button
                onClick={() => setShowTestWhatsAppModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="testWhatsApp" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={testWhatsAppNumber}
                  onChange={(e) => setTestWhatsAppNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  WhatsApp number to send test message to (must have opted-in)
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> The recipient must have sent a message to your WhatsApp
                  Business number in the last 24 hours to receive freeform messages.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestWhatsAppModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Sending..." : "Send Test"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Google Calendar OAuth Configuration Modal */}
      {showGoogleOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Google Calendar</h2>
                <p className="text-sm text-gray-500">
                  Enter your Google OAuth credentials to enable calendar sync
                </p>
              </div>
              <button
                onClick={() => setShowGoogleOAuthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectGoogle" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="your-client-id.apps.googleusercontent.com"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="Your Google Client Secret"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Get your credentials:</strong>
                  <br />
                  1. Go to{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Google Cloud Console
                  </a>
                  <br />
                  2. Create OAuth 2.0 Client ID
                  <br />
                  3. Add redirect URI: <code className="bg-white px-1">{window.location.origin}/api/integrations/google/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to Google"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Mailchimp OAuth Configuration Modal */}
      {showMailchimpOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Mailchimp</h2>
                <p className="text-sm text-gray-500">
                  Enter your Mailchimp OAuth credentials to enable email marketing
                </p>
              </div>
              <button
                onClick={() => setShowMailchimpOAuthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectMailchimp" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={mailchimpClientId}
                  onChange={(e) => setMailchimpClientId(e.target.value)}
                  placeholder="Your Mailchimp Client ID"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={mailchimpClientSecret}
                  onChange={(e) => setMailchimpClientSecret(e.target.value)}
                  placeholder="Your Mailchimp Client Secret"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Get your credentials:</strong>
                  <br />
                  1. Go to{" "}
                  <a
                    href="https://admin.mailchimp.com/account/oauth2/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Mailchimp Developer Portal
                  </a>
                  <br />
                  2. Register your OAuth app
                  <br />
                  3. Add redirect URI: <code className="bg-white px-1">{window.location.origin}/api/integrations/mailchimp/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMailchimpOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to Mailchimp"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* QuickBooks OAuth Configuration Modal */}
      {showQuickBooksOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect QuickBooks</h2>
                <p className="text-sm text-gray-500">
                  Enter your QuickBooks OAuth credentials to enable accounting sync
                </p>
              </div>
              <button
                onClick={() => setShowQuickBooksOAuthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectQuickBooks" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={quickBooksClientId}
                  onChange={(e) => setQuickBooksClientId(e.target.value)}
                  placeholder="Your QuickBooks Client ID"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={quickBooksClientSecret}
                  onChange={(e) => setQuickBooksClientSecret(e.target.value)}
                  placeholder="Your QuickBooks Client Secret"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Get your credentials:</strong>
                  <br />
                  1. Go to{" "}
                  <a
                    href="https://developer.intuit.com/app/developer/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Intuit Developer Portal
                  </a>
                  <br />
                  2. Create an app with QuickBooks Online API
                  <br />
                  3. Add redirect URI: <code className="bg-white px-1">{window.location.origin}/api/integrations/quickbooks/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickBooksOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to QuickBooks"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Xero OAuth Configuration Modal */}
      {showXeroOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Xero</h2>
                <p className="text-sm text-gray-500">
                  Enter your Xero OAuth credentials to enable accounting sync
                </p>
              </div>
              <button
                onClick={() => setShowXeroOAuthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectXero" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={xeroClientId}
                  onChange={(e) => setXeroClientId(e.target.value)}
                  placeholder="Your Xero Client ID"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={xeroClientSecret}
                  onChange={(e) => setXeroClientSecret(e.target.value)}
                  placeholder="Your Xero Client Secret"
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Get your credentials:</strong>
                  <br />
                  1. Go to{" "}
                  <a
                    href="https://developer.xero.com/app/manage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Xero Developer Portal
                  </a>
                  <br />
                  2. Create an OAuth 2.0 app
                  <br />
                  3. Add redirect URI: <code className="bg-white px-1">{window.location.origin}/api/integrations/xero/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowXeroOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to Xero"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
