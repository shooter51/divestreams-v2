import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { db } from "../../../../lib/db";
import { organization, member, user } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Notifications - DiveStreams" }];

type NotificationSettings = {
  emailBookingConfirmation: boolean;
  emailBookingReminders: boolean;
  reminderDaysBefore: number;
  emailDailyDigest: boolean;
  emailWeeklyReport: boolean;
  notifyNewBooking: boolean;
  notifyCancellation: boolean;
  notifyLowCapacity: boolean;
  lowCapacityThreshold: number;
};

const defaultSettings: NotificationSettings = {
  emailBookingConfirmation: true,
  emailBookingReminders: true,
  reminderDaysBefore: 1,
  emailDailyDigest: false,
  emailWeeklyReport: false,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyLowCapacity: false,
  lowCapacityThreshold: 2,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_ADVANCED_NOTIFICATIONS);

  // Parse notification settings from org metadata
  let metadata: { notifications?: Partial<NotificationSettings> } = {};
  if (ctx.org.metadata) {
    try {
      metadata = JSON.parse(ctx.org.metadata);
    } catch {
      metadata = {};
    }
  }

  const settings: NotificationSettings = {
    ...defaultSettings,
    ...metadata.notifications,
  };

  // Get organization owner's email
  const ownerMember = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, ctx.org.id),
        eq(member.role, "owner")
      )
    )
    .limit(1);

  const orgEmail = ownerMember[0]?.email || ctx.user.email;

  return {
    settings,
    orgEmail,
    isPremium: ctx.isPremium,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  // Parse existing metadata
  let metadata: Record<string, unknown> = {};
  if (ctx.org.metadata) {
    try {
      metadata = JSON.parse(ctx.org.metadata);
    } catch {
      metadata = {};
    }
  }

  // Update notification settings
  const notifications: NotificationSettings = {
    emailBookingConfirmation: formData.get("emailBookingConfirmation") === "true",
    emailBookingReminders: formData.get("emailBookingReminders") === "true",
    reminderDaysBefore: parseInt(formData.get("reminderDaysBefore") as string) || 1,
    emailDailyDigest: formData.get("emailDailyDigest") === "true",
    emailWeeklyReport: formData.get("emailWeeklyReport") === "true",
    notifyNewBooking: formData.get("notifyNewBooking") === "true",
    notifyCancellation: formData.get("notifyCancellation") === "true",
    notifyLowCapacity: formData.get("notifyLowCapacity") === "true",
    lowCapacityThreshold: parseInt(formData.get("lowCapacityThreshold") as string) || 2,
  };

  metadata.notifications = notifications;

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(metadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, ctx.org.id));

  return { success: true };
}

export default function NotificationsPage() {
  const { settings, isPremium } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean }>();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Notification Settings</h1>
        <p className="text-foreground-muted">Configure how you receive notifications</p>
      </div>

      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg mb-6">
          Settings saved successfully!
        </div>
      )}

      <fetcher.Form method="post" className="space-y-6">
        {/* Customer Notifications */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Customer Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="emailBookingConfirmation"
                value="true"
                defaultChecked={settings.emailBookingConfirmation}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">Booking Confirmations</p>
                <p className="text-sm text-foreground-muted">
                  Send confirmation emails when bookings are made
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="emailBookingReminders"
                value="true"
                defaultChecked={settings.emailBookingReminders}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">Booking Reminders</p>
                <p className="text-sm text-foreground-muted">
                  Send reminder emails before trips
                </p>
              </div>
            </label>

            <div className="ml-6">
              <label className="block text-sm">
                <span className="text-foreground-muted">Days before trip:</span>
                <select
                  name="reminderDaysBefore"
                  defaultValue={settings.reminderDaysBefore}
                  className="ml-2 px-2 py-1 border rounded"
                >
                  <option value="1">1 day</option>
                  <option value="2">2 days</option>
                  <option value="3">3 days</option>
                  <option value="7">1 week</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Staff Notifications */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Staff Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="notifyNewBooking"
                value="true"
                defaultChecked={settings.notifyNewBooking}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">New Booking Alerts</p>
                <p className="text-sm text-foreground-muted">
                  Get notified when new bookings are made
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="notifyCancellation"
                value="true"
                defaultChecked={settings.notifyCancellation}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">Cancellation Alerts</p>
                <p className="text-sm text-foreground-muted">
                  Get notified when bookings are canceled
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="notifyLowCapacity"
                value="true"
                defaultChecked={settings.notifyLowCapacity}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">Low Capacity Alerts</p>
                <p className="text-sm text-foreground-muted">
                  Get notified when trips are below minimum capacity
                </p>
              </div>
            </label>

            <div className="ml-6">
              <label className="block text-sm">
                <span className="text-foreground-muted">Alert when spots remaining:</span>
                <select
                  name="lowCapacityThreshold"
                  defaultValue={settings.lowCapacityThreshold}
                  className="ml-2 px-2 py-1 border rounded"
                >
                  <option value="1">1 spot</option>
                  <option value="2">2 spots</option>
                  <option value="3">3 spots</option>
                  <option value="5">5 spots</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Reports */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Reports</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="emailDailyDigest"
                value="true"
                defaultChecked={settings.emailDailyDigest}
                className="mt-1 rounded"
                disabled={!isPremium}
              />
              <div>
                <p className="font-medium">
                  Daily Digest
                  {!isPremium && (
                    <span className="ml-2 text-xs bg-surface-overlay text-foreground-muted px-2 py-0.5 rounded-full">
                      Premium
                    </span>
                  )}
                </p>
                <p className="text-sm text-foreground-muted">
                  Receive a daily summary of bookings and activity
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="emailWeeklyReport"
                value="true"
                defaultChecked={settings.emailWeeklyReport}
                className="mt-1 rounded"
                disabled={!isPremium}
              />
              <div>
                <p className="font-medium">
                  Weekly Report
                  {!isPremium && (
                    <span className="ml-2 text-xs bg-surface-overlay text-foreground-muted px-2 py-0.5 rounded-full">
                      Premium
                    </span>
                  )}
                </p>
                <p className="text-sm text-foreground-muted">
                  Receive weekly analytics and performance reports
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </button>
          <Link
            to="/tenant/settings"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </fetcher.Form>
    </div>
  );
}
