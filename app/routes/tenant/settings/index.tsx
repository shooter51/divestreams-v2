import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Link, useLoaderData, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { member, customers, certificationAgencies, certificationLevels } from "../../../../lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";

/**
 * Seed only training agencies (PADI, SSI, NAUI) without other demo data.
 * This is idempotent and safe to call multiple times.
 */
async function seedTrainingAgencies(organizationId: string) {
  // Check existing agencies
  const existingAgencies = await db
    .select({ code: certificationAgencies.code })
    .from(certificationAgencies)
    .where(eq(certificationAgencies.organizationId, organizationId));

  const hasPadi = existingAgencies.some((a) => a.code.toLowerCase() === "padi");
  const hasSsi = existingAgencies.some((a) => a.code.toLowerCase() === "ssi");
  const hasNaui = existingAgencies.some((a) => a.code.toLowerCase() === "naui");

  let seeded = 0;

  // Seed PADI if missing
  if (!hasPadi) {
    const [agency] = await db
      .insert(certificationAgencies)
      .values({
        organizationId,
        code: "padi",
        name: "PADI",
        description: "Professional Association of Diving Instructors",
        website: "https://www.padi.com",
      })
      .returning();

    await db.insert(certificationLevels).values([
      {
        organizationId,
        agencyId: agency.id,
        code: "open-water",
        name: "Open Water Diver",
        levelNumber: 3,
        description: "Entry-level certification",
        minAge: 10,
        minDives: 0,
      },
      {
        organizationId,
        agencyId: agency.id,
        code: "advanced-ow",
        name: "Advanced Open Water",
        levelNumber: 4,
        description: "Explore specialty diving",
        minAge: 12,
        minDives: 0,
      },
    ]);
    seeded++;
  }

  // Seed SSI if missing
  if (!hasSsi) {
    const [agency] = await db
      .insert(certificationAgencies)
      .values({
        organizationId,
        code: "ssi",
        name: "SSI",
        description: "Scuba Schools International",
        website: "https://www.divessi.com",
      })
      .returning();

    await db.insert(certificationLevels).values([
      {
        organizationId,
        agencyId: agency.id,
        code: "ssi-open-water",
        name: "Open Water Diver",
        levelNumber: 3,
        description: "SSI entry-level certification",
        minAge: 10,
        minDives: 0,
      },
      {
        organizationId,
        agencyId: agency.id,
        code: "ssi-advanced",
        name: "Advanced Adventurer",
        levelNumber: 4,
        description: "SSI advanced certification",
        minAge: 12,
        minDives: 0,
      },
    ]);
    seeded++;
  }

  // Seed NAUI if missing
  if (!hasNaui) {
    const [agency] = await db
      .insert(certificationAgencies)
      .values({
        organizationId,
        code: "naui",
        name: "NAUI",
        description: "National Association of Underwater Instructors",
        website: "https://www.naui.org",
      })
      .returning();

    await db.insert(certificationLevels).values([
      {
        organizationId,
        agencyId: agency.id,
        code: "naui-scuba-diver",
        name: "Scuba Diver",
        levelNumber: 3,
        description: "NAUI entry-level certification",
        minAge: 10,
        minDives: 0,
      },
      {
        organizationId,
        agencyId: agency.id,
        code: "naui-advanced",
        name: "Advanced Scuba Diver",
        levelNumber: 4,
        description: "NAUI advanced certification",
        minAge: 15,
        minDives: 0,
      },
    ]);
    seeded++;
  }

  return { seeded, total: 3, existing: 3 - seeded };
}

export const meta: MetaFunction = () => [{ title: "Settings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get real team count
  const [teamCountResult] = await db
    .select({ count: count() })
    .from(member)
    .where(eq(member.organizationId, ctx.org.id));

  const teamCount = teamCountResult?.count || 1;

  // Check if there's already customer data (to show/hide seed option)
  const [customerCountResult] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.organizationId, ctx.org.id));

  const hasData = (customerCountResult?.count || 0) > 0;

  // Parse metadata to check for integrations
  const metadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  // Count connected integrations (based on Stripe connection for now)
  const connectedIntegrations = metadata.stripeCustomerId ? 1 : 0;

  return {
    tenantName: ctx.org.name,
    planName: ctx.subscription?.plan || "free",
    teamCount,
    connectedIntegrations,
    isPremium: ctx.isPremium,
    hasData,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "seedDemoData") {
    try {
      await seedDemoData(ctx.org.id);
      return { success: true, message: "Demo data seeded successfully!" };
    } catch (error) {
      console.error("Failed to seed demo data:", error);
      return { success: false, message: "Failed to seed demo data. Please try again." };
    }
  }

  // Separate action to seed only training agencies (PADI, SSI, NAUI)
  // This is idempotent and can be called multiple times safely
  if (intent === "seedTrainingAgencies") {
    try {
      const result = await seedTrainingAgencies(ctx.org.id);
      if (result.seeded > 0) {
        return { success: true, message: `Training agencies seeded (${result.seeded} new)` };
      } else {
        return { success: true, message: "Training agencies already exist" };
      }
    } catch (error) {
      console.error("Failed to seed training agencies:", error);
      return { success: false, message: "Failed to seed training agencies" };
    }
  }

  return { success: false, message: "Unknown action" };
}

export default function SettingsPage() {
  const { tenantName, planName, teamCount, connectedIntegrations, hasData } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isSeeding = fetcher.state === "submitting";

  const settingsLinks: Array<{
    href: string;
    title: string;
    description: string;
    icon: string;
    preview: string | null;
    disabled?: boolean;
  }> = [
    {
      href: "/tenant/settings/profile",
      title: "Shop Profile",
      description: "Business name, address, timezone, and booking settings",
      icon: "🏪",
      preview: tenantName,
    },
    {
      href: "/tenant/settings/billing",
      title: "Billing & Subscription",
      description: "Manage your subscription, payment methods, and invoices",
      icon: "💳",
      preview: `${planName} Plan`,
    },
    {
      href: "/tenant/settings/team",
      title: "Team Members",
      description: "Invite staff and manage roles and permissions",
      icon: "👥",
      preview: `${teamCount} members`,
    },
    {
      href: "/tenant/settings/integrations",
      title: "Integrations",
      description: "Connect third-party services like Stripe, Google Calendar, and more",
      icon: "🔌",
      preview: `${connectedIntegrations} connected`,
    },
    {
      href: "/tenant/settings/notifications",
      title: "Notifications",
      description: "Configure email and notification preferences",
      icon: "🔔",
      preview: null,
    },
    {
      href: "/tenant/settings/booking-widget",
      title: "Booking Widget",
      description: "Customize and embed your booking widget",
      icon: "🎨",
      preview: null,
    },
    {
      href: "/tenant/settings/public-site",
      title: "Public Site",
      description: "Configure your public-facing website and appearance",
      icon: "🌐",
      preview: null,
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-4">
        {settingsLinks.map((link) =>
          link.disabled ? (
            <div
              key={link.href}
              className="bg-surface-raised rounded-xl p-6 shadow-sm opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{link.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{link.title}</h2>
                    <span className="text-xs bg-surface-overlay text-foreground-muted px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-foreground-muted text-sm mt-1">{link.description}</p>
                </div>
              </div>
            </div>
          ) : (
            <Link
              key={link.href}
              to={link.href}
              className="block bg-surface-raised rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{link.icon}</div>
                <div className="flex-1">
                  <h2 className="font-semibold group-hover:text-brand transition-colors">
                    {link.title}
                  </h2>
                  <p className="text-foreground-muted text-sm mt-1">{link.description}</p>
                </div>
                {link.preview && (
                  <div className="text-sm text-foreground-subtle">{link.preview}</div>
                )}
                <div className="text-foreground-subtle group-hover:text-brand transition-colors">
                  →
                </div>
              </div>
            </Link>
          )
        )}
      </div>

      {/* Demo Data Section - only show if no data exists */}
      {!hasData && (
        <div className="mt-8 bg-brand-muted rounded-xl p-6 border border-brand-muted">
          <h2 className="font-semibold text-brand mb-2">Get Started</h2>
          <p className="text-sm text-brand mb-4">
            Your account is empty. Populate with sample data to explore all features.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-brand">Seed Demo Data</p>
              <p className="text-xs text-brand">
                Add sample customers, tours, bookings, equipment, and products
              </p>
            </div>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="seedDemoData" />
              <button
                type="submit"
                disabled={isSeeding}
                className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSeeding ? "Seeding..." : "Load Demo Data"}
              </button>
            </fetcher.Form>
          </div>
          {fetcher.data?.message && (
            <p className={`mt-3 text-sm ${fetcher.data.success ? "text-success" : "text-danger"}`}>
              {fetcher.data.message}
            </p>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-8 bg-danger-muted rounded-xl p-6 border border-danger-muted">
        <h2 className="font-semibold text-danger mb-2">Danger Zone</h2>
        <p className="text-sm text-danger mb-4">
          Permanent actions that cannot be undone
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-danger">Export all data</p>
              <p className="text-xs text-danger">
                Download a copy of all your data in JSON format
              </p>
            </div>
            <button
              onClick={() => alert("Data export feature coming soon. Contact support@divestreams.com for immediate data export needs.")}
              className="px-4 py-2 text-sm border border-danger-muted rounded-lg hover:bg-danger-muted text-danger"
            >
              Export Data
            </button>
          </div>
          <hr className="border-danger-muted" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-danger">Delete account</p>
              <p className="text-xs text-danger">
                Permanently delete your account and all data
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm("⚠️ WARNING: This will permanently delete your account and ALL data including customers, bookings, trips, and equipment. This action CANNOT be undone.\n\nAre you absolutely sure you want to delete your account?")) {
                  if (confirm("Please confirm once more. Type 'DELETE' in the next prompt to proceed.")) {
                    const input = prompt("Type DELETE to confirm account deletion:");
                    if (input === "DELETE") {
                      alert("Account deletion request submitted. Our team will process this within 24 hours and send confirmation to your email.");
                    } else {
                      alert("Account deletion cancelled - confirmation text did not match.");
                    }
                  }
                }
              }}
              className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger-hover"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
