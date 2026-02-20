import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link, redirect, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
// Server-only imports for loader/action
import { requireOrgContext, getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES, FEATURE_UPGRADE_INFO, type PlanFeaturesObject } from "../../../../lib/plan-features";
import { db } from "../../../../lib/db";
import { subscriptionPlans } from "../../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";
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
import { getXeroAuthUrl } from "../../../../lib/integrations/xero.server";
import { getMailchimpAuthUrl, listAudiences } from "../../../../lib/integrations/mailchimp.server";
import { getQuickBooksAuthUrl } from "../../../../lib/integrations/quickbooks.server";
import { getStripeSettings, connectStripe } from "../../../../lib/integrations/stripe.server";
import { connectWhatsApp, sendWhatsApp } from "../../../../lib/integrations/whatsapp.server";

// Per-provider UI components
import {
  StripeIntegration,
  GoogleCalendarIntegration,
  MailchimpIntegration,
  QuickBooksIntegration,
  XeroIntegration,
  ZapierIntegration,
  TwilioIntegration,
  WhatsAppIntegration,
  Icons,
} from "../../../components/integrations";
import type {
  IntegrationProvider,
  ZapierTriggerType,
  XeroSettings,
  MailchimpAudience,
  StripeSettings,
} from "../../../components/integrations";

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

// ─── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_INTEGRATIONS);
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

  // Get current plan name and features from subscription
  const currentPlan = ctx.subscription?.plan || "free";
  const planFeatures = ctx.subscription?.planDetails?.features || {};

  // Load all active plans to determine which plan is required for each integration
  const allPlans = await db
    .select({
      name: subscriptionPlans.name,
      displayName: subscriptionPlans.displayName,
      monthlyPrice: subscriptionPlans.monthlyPrice,
      features: subscriptionPlans.features,
    })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.monthlyPrice));

  // Build a map of integration feature -> required plan (cheapest plan that has it enabled)
  const integrationFeatures = [
    "has_stripe",
    "has_google_calendar",
    "has_mailchimp",
    "has_quickbooks",
    "has_zapier",
    "has_twilio",
    "has_whatsapp",
    "has_xero",
  ] as const;

  const requiredPlanForIntegration: Record<string, string | null> = {};
  for (const feature of integrationFeatures) {
    const requiredPlan = allPlans.find((plan) => {
      const features = plan.features as PlanFeaturesObject | null;
      return features?.[feature] === true;
    });
    requiredPlanForIntegration[feature] = requiredPlan?.displayName || null;
  }

  // Check if OAuth providers are configured
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const xeroConfigured = !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
  const quickbooksConfigured = !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
  const mailchimpConfigured = !!(process.env.MAILCHIMP_CLIENT_ID && process.env.MAILCHIMP_CLIENT_SECRET);

  // Get Xero integration details if connected
  const xeroIntegration = connectedIntegrations.find((i) => i.id === "xero");
  const xeroSettings = xeroIntegration?.settings as XeroSettings | null;

  // Get Zapier integration details if connected
  const zapierIntegration = await getZapierIntegration(ctx.org.id);
  const zapierWebhookUrl = getZapierWebhookUrl(subdomain || ctx.org.id);

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
    orgId: ctx.org.id,
    orgSlug: subdomain,
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
    planFeatures: planFeatures as PlanFeaturesObject,
    featureUpgradeInfo: FEATURE_UPGRADE_INFO,
    requiredPlanForIntegration,
  };
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Connect intent - show provider-specific modal
  if (intent === "connect") {
    const integrationId = formData.get("integrationId") as string;

    if (integrationId === "google-calendar") return { showGoogleOAuthModal: true };
    if (integrationId === "twilio") return { showTwilioModal: true };
    if (integrationId === "zapier") return { showZapierModal: true };
    if (integrationId === "mailchimp") return { showMailchimpOAuthModal: true };
    if (integrationId === "xero") return { showXeroOAuthModal: true };
    if (integrationId === "quickbooks") return { showQuickBooksOAuthModal: true };
    if (integrationId === "whatsapp") return { showWhatsAppModal: true };
    if (integrationId === "stripe") return { showStripeModal: true };

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
      if (!result.success) return { error: result.error || "Failed to connect Twilio" };
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
      type WhatsAppCredentials =
        | { provider: "meta"; phoneNumberId: string; businessAccountId: string; accessToken: string }
        | { provider: "twilio"; accountSid: string; authToken: string; phoneNumber: string };

      const credentials: WhatsAppCredentials = apiType === "meta"
        ? { provider: "meta" as const, phoneNumberId, businessAccountId, accessToken }
        : { provider: "twilio" as const, accountSid: twilioAccountSid, authToken: twilioAuthToken, phoneNumber: twilioWhatsAppNumber };

      const result = await connectWhatsApp(ctx.org.id, credentials);
      if (!result.success) return { error: result.error || "Failed to connect WhatsApp" };
      return { success: true, message: "WhatsApp Business connected successfully!" };
    } catch (error) {
      console.error("Error connecting WhatsApp:", error);
      return { error: "Failed to connect WhatsApp" };
    }
  }

  // Test WhatsApp message
  if (intent === "testWhatsApp") {
    const phoneNumber = formData.get("phoneNumber") as string;
    if (!phoneNumber) return { error: "Phone number is required" };

    try {
      const result = await sendWhatsApp(ctx.org.id, {
        to: phoneNumber,
        body: "Test message from DiveStreams! Your WhatsApp Business integration is working.",
      });
      if (!result.success) return { error: result.error || "Failed to send test WhatsApp message" };
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
    if (!secretKey || !publishableKey) return { error: "Both Secret Key and Publishable Key are required" };

    try {
      const result = await connectStripe(ctx.org.id, { secretKey, publishableKey });
      if (!result.success) return { error: result.error || "Failed to connect Stripe" };
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
    if (!clientId || !clientSecret) return { error: "Client ID and Client Secret are required" };

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getGoogleAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);
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
    if (!clientId || !clientSecret) return { error: "Client ID and Client Secret are required" };

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getMailchimpAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);
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
    if (!clientId || !clientSecret) return { error: "Client ID and Client Secret are required" };

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getQuickBooksAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);
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
    if (!clientId || !clientSecret) return { error: "Client ID and Client Secret are required" };

    try {
      const subdomain = getSubdomainFromRequest(request);
      const authUrl = getXeroAuthUrl(ctx.org.id, subdomain || undefined, clientId, clientSecret);
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

  // Disconnect integration
  if (intent === "disconnect") {
    const integrationId = formData.get("integrationId") as IntegrationProvider;
    try {
      const success = await disconnectIntegration(ctx.org.id, integrationId);
      if (!success) return { error: "Integration not found" };
      return { success: true, message: "Integration disconnected" };
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      return { error: "Failed to disconnect integration" };
    }
  }

  // Sync integration
  if (intent === "sync") {
    const integrationId = formData.get("integrationId") as IntegrationProvider;
    try {
      const { dispatchSync, getSyncCapabilities } = await import("../../../../lib/integrations/sync-dispatcher.server");
      const capabilities = getSyncCapabilities(integrationId);
      if (!capabilities.canSync) return { success: true, message: capabilities.description };

      const result = await dispatchSync({ organizationId: ctx.org.id, integrationId });
      if (!result.success) return { error: result.errors?.join(', ') || 'Sync failed' };
      if (result.synced === 0 && result.failed === 0) return { success: true, message: 'Everything is already synced!' };
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

  // Configure intent
  if (intent === "configure") {
    const integrationId = formData.get("integrationId") as string;
    return { openConfig: true, integrationId };
  }

  // Update integration settings (generic)
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
    if (!phoneNumber) return { error: "Phone number is required" };

    try {
      const result = await sendSMS(ctx.org.id, {
        to: phoneNumber,
        body: "Test message from DiveStreams! Your Twilio integration is working.",
      });
      if (!result.success) return { error: result.error || "Failed to send test SMS" };
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

    if (zapierWebhookUrl && !isValidZapierWebhookUrl(zapierWebhookUrl)) {
      return { error: "Invalid webhook URL. Must be HTTPS." };
    }

    try {
      const result = await connectZapier(ctx.org.id, {
        webhookUrl: zapierWebhookUrl || undefined,
        enabledTriggers: enabledTriggersRaw.length > 0 ? enabledTriggersRaw as ZapierTriggerType[] : undefined,
      });
      if (!result.success) return { error: result.error || "Failed to connect Zapier" };
      return { success: true, message: "Zapier connected successfully!", zapierConnected: true, zapierSecret: result.webhookSecret };
    } catch (error) {
      console.error("Error connecting Zapier:", error);
      return { error: "Failed to connect Zapier" };
    }
  }

  if (intent === "updateZapierSettings") {
    const zapierWebhookUrl = formData.get("zapierWebhookUrl") as string;
    const enabledTriggersRaw = formData.getAll("zapierTriggers") as string[];

    if (zapierWebhookUrl && !isValidZapierWebhookUrl(zapierWebhookUrl)) {
      return { error: "Invalid webhook URL. Must be HTTPS." };
    }

    try {
      const result = await updateZapierSettings(ctx.org.id, {
        webhookUrl: zapierWebhookUrl || null,
        enabledTriggers: enabledTriggersRaw as ZapierTriggerType[],
      });
      if (!result.success) return { error: result.error || "Failed to update Zapier settings" };
      return { success: true, message: "Zapier settings updated!" };
    } catch (error) {
      console.error("Error updating Zapier settings:", error);
      return { error: "Failed to update Zapier settings" };
    }
  }

  if (intent === "testZapierWebhook") {
    try {
      const result = await testZapierWebhook(ctx.org.id);
      if (!result.success) return { error: result.error || "Failed to test Zapier webhook" };
      return { success: true, message: "Test webhook sent successfully!", zapierTestSuccess: true };
    } catch (error) {
      console.error("Error testing Zapier webhook:", error);
      return { error: "Failed to test Zapier webhook" };
    }
  }

  if (intent === "regenerateZapierSecret") {
    try {
      const result = await regenerateZapierSecret(ctx.org.id);
      if (!result.success) return { error: result.error || "Failed to regenerate Zapier secret" };
      return { success: true, zapierSecretRegenerated: true, newZapierSecret: result.newSecret };
    } catch (error) {
      console.error("Error regenerating Zapier secret:", error);
      return { error: "Failed to regenerate Zapier secret" };
    }
  }

  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const {
    connectedIntegrations,
    availableIntegrations: integrations,
    xeroSettings,
    zapierTriggers,
    zapierTriggerDescriptions,
    zapierWebhookUrl,
    zapierSettings,
    mailchimpSettings,
    mailchimpAudiences,
    stripeSettings,
    planFeatures,
    requiredPlanForIntegration,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher();


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

  // Handle fetcher responses for the main page fetcher (connect/disconnect forms)
  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data && (fetcher.data as Record<string, unknown>).success && "message" in fetcher.data) {
      setNotification({ type: "success", message: (fetcher.data as Record<string, unknown>).message as string });
    }
    if (fetcher.data && "error" in fetcher.data) {
      setNotification({ type: "error", message: (fetcher.data as Record<string, unknown>).error as string });
    }
  }, [fetcher.data]);

  // Map integration IDs to their feature keys
  const integrationFeatureMap: Record<string, string> = {
    stripe: "has_stripe",
    "google-calendar": "has_google_calendar",
    mailchimp: "has_mailchimp",
    quickbooks: "has_quickbooks",
    zapier: "has_zapier",
    twilio: "has_twilio",
    whatsapp: "has_whatsapp",
    xero: "has_xero",
  };

  const isIntegrationEnabled = (integrationId: string): boolean => {
    const featureKey = integrationFeatureMap[integrationId];
    if (!featureKey) return true;
    return planFeatures?.[featureKey as keyof typeof planFeatures] === true;
  };

  const getRequiredPlanName = (integrationId: string): string | null => {
    const featureKey = integrationFeatureMap[integrationId];
    if (!featureKey) return null;
    return requiredPlanForIntegration[featureKey] || null;
  };

  const isConnected = (integrationId: string) => {
    return connectedIntegrations.some((i) => i.id === integrationId);
  };

  const categories = [
    { id: "payments", name: "Payments" },
    { id: "calendar", name: "Calendar" },
    { id: "marketing", name: "Marketing" },
    { id: "accounting", name: "Accounting" },
    { id: "notifications", name: "Notifications" },
    { id: "automation", name: "Automation" },
  ];

  // Callback for child components to surface notifications
  const handleNotification = (n: { type: "success" | "error"; message: string }) => {
    setNotification(n);
  };

  return (
    <div className="max-w-4xl">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
            notification.type === "success"
              ? "bg-success-muted text-success border border-success"
              : "bg-danger-muted text-danger border border-danger"
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
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Integrations</h1>
        <p className="text-foreground-muted">Connect third-party services to enhance DiveStreams</p>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold mb-4">Connected</h2>
          <div className="space-y-4">
            {connectedIntegrations.map((connection) => {
              const integration = integrations.find((i) => i.id === connection.id);
              if (!integration) return null;
              const IconComponent = Icons[integration.icon];

              return (
                <div
                  key={connection.id}
                  className="bg-surface-raised rounded-xl p-6 shadow-sm border-l-4 border-success"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 text-foreground-muted">
                        {IconComponent && <IconComponent className="w-8 h-8" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{integration.name}</h3>
                          <span className="text-xs bg-success-muted text-success px-2 py-0.5 rounded-full">
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-foreground-muted">{integration.description}</p>
                        <div className="mt-2 text-xs text-foreground-subtle">
                          <span>Account: {connection.accountName}</span>
                          <span className="mx-2">-</span>
                          <span>Last sync: {connection.lastSync}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* Per-provider action buttons and modals */}
                      {connection.id === "stripe" && (
                        <StripeIntegration
                          connection={connection}
                          stripeSettings={stripeSettings as StripeSettings | null}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "google-calendar" && (
                        <GoogleCalendarIntegration
                          isConnected={true}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "twilio" && (
                        <TwilioIntegration
                          isConnected={true}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "whatsapp" && (
                        <WhatsAppIntegration
                          isConnected={true}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "xero" && (
                        <XeroIntegration
                          isConnected={true}
                          xeroSettings={xeroSettings as XeroSettings | null}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "quickbooks" && (
                        <QuickBooksIntegration
                          isConnected={true}
                          onNotification={handleNotification}
                        />
                      )}
                      {connection.id === "zapier" && (
                        <ZapierIntegration
                          isConnected={true}
                          zapierTriggers={zapierTriggers}
                          zapierTriggerDescriptions={zapierTriggerDescriptions}
                          zapierWebhookUrl={zapierWebhookUrl}
                          zapierSettings={zapierSettings as { webhookUrl?: string | null; enabledTriggers?: string[] } | null}
                          onNotification={handleNotification}
                        />
                      )}
                      {/* Disconnect button (always shown) */}
                      <fetcher.Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm(`Are you sure you want to disconnect ${integration.name}?`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="disconnect" />
                        <input type="hidden" name="integrationId" value={connection.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm text-danger border border-danger rounded-lg hover:bg-danger-muted"
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
        const categoryIntegrations = integrations.filter(
          (i) => i.category === category.id && !isConnected(i.id)
        );

        if (categoryIntegrations.length === 0) return null;

        return (
          <div key={category.id} className="mb-8">
            <h2 className="font-semibold mb-4">{category.name}</h2>
            <div className="grid grid-cols-2 gap-4">
              {categoryIntegrations.map((integration) => {
                const available = isIntegrationEnabled(integration.id);
                const requiredPlanName = getRequiredPlanName(integration.id);
                const IconComponent = Icons[integration.icon];

                return (
                  <div
                    key={integration.id}
                    className={`bg-surface-raised rounded-xl p-6 shadow-sm ${
                      !available ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 text-foreground-muted">
                          {IconComponent && <IconComponent className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-foreground-muted">{integration.description}</p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 mb-4">
                      {integration.features.map((feature) => (
                        <li key={feature} className="text-xs text-foreground-muted flex items-center gap-1">
                          <Icons.Check className="w-3 h-3 text-success" />
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
                          className="w-full py-2 bg-brand text-white rounded-lg hover:bg-brand-hover text-sm"
                        >
                          Connect
                        </button>
                      </fetcher.Form>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-foreground-muted mb-2">
                          {requiredPlanName
                            ? `Requires ${requiredPlanName} plan`
                            : "Not available on your plan"
                          }
                        </p>
                        <Link
                          to="/tenant/settings/billing"
                          className="text-sm text-brand hover:underline"
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

      {/* Provider modals for not-yet-connected integrations (triggered by "connect" action) */}
      <StripeIntegration
        connection={null}
        stripeSettings={stripeSettings as StripeSettings | null}
        onNotification={handleNotification}
      />
      <GoogleCalendarIntegration
        isConnected={false}
        onNotification={handleNotification}
      />
      <MailchimpIntegration
        isConnected={false}
        mailchimpSettings={mailchimpSettings as { selectedAudienceId?: string; syncOnBooking?: boolean; syncOnCustomerCreate?: boolean } | null}
        mailchimpAudiences={mailchimpAudiences as MailchimpAudience[]}
        onNotification={handleNotification}
      />
      <QuickBooksIntegration
        isConnected={false}
        onNotification={handleNotification}
      />
      <XeroIntegration
        isConnected={false}
        xeroSettings={xeroSettings as XeroSettings | null}
        onNotification={handleNotification}
      />
      <ZapierIntegration
        isConnected={false}
        zapierTriggers={zapierTriggers}
        zapierTriggerDescriptions={zapierTriggerDescriptions}
        zapierWebhookUrl={zapierWebhookUrl}
        zapierSettings={zapierSettings as { webhookUrl?: string | null; enabledTriggers?: string[] } | null}
        onNotification={handleNotification}
      />
      <TwilioIntegration
        isConnected={false}
        onNotification={handleNotification}
      />
      <WhatsAppIntegration
        isConnected={false}
        onNotification={handleNotification}
      />
    </div>
  );
}
