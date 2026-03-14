import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { account } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";
import { authLogger } from "../../../../lib/logger";

export const meta: MetaFunction = () => [{ title: "Change Password - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check the database flag, not the URL parameter, to determine if password change is forced
  const [userAccount] = await db
    .select({ forcePasswordChange: account.forcePasswordChange })
    .from(account)
    .where(eq(account.userId, ctx.user.id))
    .limit(1);

  const forced = userAccount?.forcePasswordChange === true;

  return {
    forced,
    message: forced
      ? "Your administrator reset your password. Please create a new password to continue."
      : null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Check the database flag to determine if password change is forced (not URL parameter)
  const [userAccount] = await db
    .select({ forcePasswordChange: account.forcePasswordChange })
    .from(account)
    .where(eq(account.userId, ctx.user.id))
    .limit(1);

  const forced = userAccount?.forcePasswordChange === true;

  if (!forced && !currentPassword) {
    return { error: "Current password is required" };
  }

  try {
    if (forced) {
      // For forced password changes (admin-initiated reset), use Better Auth's
      // changePassword with the temporary password. The forcePasswordChange flag
      // is already set on the account, and we need to clear it after success.
      // Since the user may not know the current password (admin-generated),
      // we use the direct API approach with session context.
      await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword: currentPassword || newPassword, // For forced, current may be empty
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });

      // Clear forcePasswordChange flag after successful password change
      await db
        .update(account)
        .set({
          forcePasswordChange: false,
          updatedAt: new Date(),
        })
        .where(eq(account.userId, ctx.user.id));
    } else {
      // Normal password change - Better Auth verifies the current password
      await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword,
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });
    }

    authLogger.info({ userId: ctx.user.id, organizationId: ctx.org.id }, "Password changed");
    return redirect("/tenant/dashboard?message=Password updated successfully");
  } catch (error) {
    // Re-throw Response objects (redirects) so React Router can handle them
    if (error instanceof Response) {
      throw error;
    }
    authLogger.error({ userId: ctx.user.id, err: error }, "Password update error");
    // Better Auth throws if current password is incorrect
    if (!forced) {
      return { error: "Current password is incorrect" };
    }
    return { error: "Failed to update password. Please try again." };
  }
}

export default function PasswordSettingsPage() {
  const { forced, message } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const t = useT();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        {!forced && (
          <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
            {t("tenant.settings.backToSettings")}
          </Link>
        )}
        <h1 className="text-2xl font-bold mt-2">{t("tenant.settings.password.title")}</h1>
      </div>

      {forced && (
        <div className="mb-6 p-4 bg-warning-muted border border-warning rounded">
          <p className="font-medium">{t("tenant.settings.password.changeRequired")}</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
      )}

      {actionData?.error && (
        <div className="mb-6 p-4 bg-danger-muted border border-danger rounded">
          <p className="text-danger font-medium">{actionData.error}</p>
        </div>
      )}

      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <Form method="post">
          <CsrfInput />
          <div className="space-y-4">
            {!forced && (
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                  {t("tenant.settings.password.currentPassword")}
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  required={!forced}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder={t("tenant.settings.password.enterCurrentPassword")}
                />
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                {t("tenant.settings.password.newPassword")}
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder={t("tenant.settings.password.enterNewPassword")}
              />
              <p className="text-sm text-foreground-muted mt-1">
                {t("tenant.settings.password.minChars")}
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                {t("tenant.settings.password.confirmNewPassword")}
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder={t("tenant.settings.password.confirmNewPasswordPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.settings.password.updatePassword")}
            </button>
            {!forced && (
              <Link
                to="/tenant/settings"
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                {t("common.cancel")}
              </Link>
            )}
          </div>
        </Form>
      </div>

      <div className="mt-6 p-4 bg-info-muted border border-info rounded">
        <h3 className="font-medium mb-2">{t("tenant.settings.password.requirements")}</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>{t("tenant.settings.password.req8Chars")}</li>
          <li>{t("tenant.settings.password.reqMix")}</li>
          <li>{t("tenant.settings.password.reqAvoidCommon")}</li>
        </ul>
      </div>
    </div>
  );
}
