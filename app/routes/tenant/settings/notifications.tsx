import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { db } from "../../../../lib/db";
import { organization, member, user } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

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
  requireRole(ctx, ["owner", "admin"]);
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
  requireRole(ctx, ["owner", "admin"]);
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
  const t = useT();
  const fetcher = useFetcher<{ success?: boolean }>();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          {t("tenant.settings.backToSettings")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.settings.notifications.title")}</h1>
        <p className="text-foreground-muted">{t("tenant.settings.notifications.subtitle")}</p>
      </div>

      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {t("tenant.settings.notifications.savedSuccess")}
        </div>
      )}

      <fetcher.Form method="post" className="space-y-6">
        <CsrfInput />
        {/* Customer Notifications */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.settings.notifications.customerNotifications")}</h2>
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
                <p className="font-medium">{t("tenant.settings.notifications.bookingConfirmations")}</p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.bookingConfirmationsDesc")}
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
                <p className="font-medium">{t("tenant.settings.notifications.bookingReminders")}</p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.bookingRemindersDesc")}
                </p>
              </div>
            </label>

            <div className="ml-6">
              <label className="block text-sm">
                <span className="text-foreground-muted">{t("tenant.settings.notifications.daysBeforeTrip")}</span>
                <select
                  name="reminderDaysBefore"
                  defaultValue={settings.reminderDaysBefore}
                  className="ml-2 px-2 py-1 border border-border-strong rounded bg-surface-raised text-foreground"
                >
                  <option value="1">{t("tenant.settings.notifications.1day")}</option>
                  <option value="2">{t("tenant.settings.notifications.2days")}</option>
                  <option value="3">{t("tenant.settings.notifications.3days")}</option>
                  <option value="7">{t("tenant.settings.notifications.1week")}</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Staff Notifications */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.settings.notifications.staffNotifications")}</h2>
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
                <p className="font-medium">{t("tenant.settings.notifications.newBookingAlerts")}</p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.newBookingAlertsDesc")}
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
                <p className="font-medium">{t("tenant.settings.notifications.cancellationAlerts")}</p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.cancellationAlertsDesc")}
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
                <p className="font-medium">{t("tenant.settings.notifications.lowCapacityAlerts")}</p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.lowCapacityAlertsDesc")}
                </p>
              </div>
            </label>

            <div className="ml-6">
              <label className="block text-sm">
                <span className="text-foreground-muted">{t("tenant.settings.notifications.alertWhenSpotsRemaining")}</span>
                <select
                  name="lowCapacityThreshold"
                  defaultValue={settings.lowCapacityThreshold}
                  className="ml-2 px-2 py-1 border border-border-strong rounded bg-surface-raised text-foreground"
                >
                  <option value="1">{t("tenant.settings.notifications.1spot")}</option>
                  <option value="2">{t("tenant.settings.notifications.2spots")}</option>
                  <option value="3">{t("tenant.settings.notifications.3spots")}</option>
                  <option value="5">{t("tenant.settings.notifications.5spots")}</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Reports */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.settings.notifications.reports")}</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="emailDailyDigest"
                value="true"
                defaultChecked={settings.emailDailyDigest}
                className="mt-1 rounded"
              />
              <div>
                <p className="font-medium">
                  {t("tenant.settings.notifications.dailyDigest")}
                </p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.dailyDigestDesc")}
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
              />
              <div>
                <p className="font-medium">
                  {t("tenant.settings.notifications.weeklyReport")}
                </p>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.settings.notifications.weeklyReportDesc")}
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
            {isSubmitting ? t("common.saving") : t("tenant.settings.notifications.saveSettings")}
          </button>
          <Link
            to="/tenant/settings"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </fetcher.Form>
    </div>
  );
}
