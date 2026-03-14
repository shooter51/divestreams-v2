import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import { useState } from "react";
import { useT } from "../../i18n/use-t";
import { eq, and } from "drizzle-orm";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { organization, member, user } from "../../../lib/db/schema/auth";
import { getAppUrl, getTenantUrl } from "../../../lib/utils/url";
import { checkRateLimit, getClientIp } from "../../../lib/utils/rate-limit";
import { generateAnonCsrfToken, validateAnonCsrfToken, CSRF_FIELD_NAME } from "../../../lib/security/csrf.server";
import { CsrfTokenInput } from "../../components/CsrfInput";
import { authLogger } from "../../../lib/logger";

export const meta: MetaFunction = () => {
  return [{ title: "Login - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);
  const csrfToken = generateAnonCsrfToken();

  if (!subdomain) {
    // No subdomain - show tenant discovery form instead of redirecting
    return { mode: "discovery" as const, csrfToken };
  }

  // Get organization name for display
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect(getAppUrl());
  }

  // Check if already logged in to THIS organization
  const orgContext = await getOrgContext(request);
  if (orgContext) {
    return redirect("/tenant");
  }

  // Check if user has a session but no membership in THIS organization
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData && sessionData.user) {
    // User is logged in but doesn't have access to this organization
    return {
      mode: "tenant" as const,
      tenantName: org.name,
      mainSiteUrl: getAppUrl(),
      noAccessError: `You are logged in as ${sessionData.user.email}, but you don't have access to this organization. Please contact the organization owner to request access, or log out and sign in with a different account.`,
      csrfToken,
    };
  }

  return { mode: "tenant" as const, tenantName: org.name, noAccessError: null, mainSiteUrl: getAppUrl(), csrfToken };
}

export async function action({ request }: ActionFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    // Discovery mode - find which tenant the user belongs to
    const formData = await request.formData();
    const email = (formData.get("email") as string || "").trim();
    const csrfToken = generateAnonCsrfToken();

    if (!email) {
      return { mode: "discovery" as const, errors: { email: "Email is required" }, csrfToken };
    }

    const [foundUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!foundUser) {
      return { mode: "discovery" as const, errors: { email: "No account found with this email address" }, csrfToken };
    }

    const [membership] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, foundUser.id))
      .limit(1);

    if (!membership) {
      return { mode: "discovery" as const, errors: { email: "No organization found for this account" }, csrfToken };
    }

    const [org] = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, membership.organizationId))
      .limit(1);

    if (!org) {
      return { mode: "discovery" as const, errors: { email: "Organization not found" }, csrfToken };
    }

    return redirect(getTenantUrl(org.slug, "/auth/login"));
  }

  // Get organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect(getAppUrl());
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // TEMP DEBUG: Log password details for debugging sign-in failure
  console.log("[AUTH DEBUG] Login attempt:", { email, passwordLength: password?.length, passwordFirstChar: password?.[0], passwordLastChar: password?.slice(-1) });

  // Validate CSRF token
  const csrfToken = formData.get(CSRF_FIELD_NAME) as string | null;
  if (csrfToken && !validateAnonCsrfToken(csrfToken)) {
    return { errors: { form: "Invalid form submission. Please refresh and try again." } };
  }

  const errors: Record<string, string> = {};

  // Rate limit login attempts
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`login:${clientIp}`, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.allowed) {
    authLogger.warn({ email }, "Rate limit exceeded on login");
    return { errors: { form: "Too many login attempts. Please try again later." } };
  }

  if (!email) {
    errors.email = "Email is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, email: email || "" };
  }

  try {
    // Sign in using Better Auth - use asResponse to get full response with cookies
    console.log("[AUTH DEBUG] Calling signInEmail with:", { email, passwordLen: password.length, password: password.replace(/./g, (c, i) => i < 3 || i >= password.length - 1 ? c : '*') });
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
      asResponse: true,
    });
    console.log("[AUTH DEBUG] signInEmail response:", { status: response.status, ok: response.ok });

    // Get cookies FIRST before reading body
    const cookies = response.headers.get("set-cookie");

    // Parse response to check success
    const userData = await response.json();

    if (!response.ok || !userData?.user) {
      authLogger.warn({ email, reason: userData?.message }, "Login failed");
      return { errors: { form: userData?.message || "Invalid email or password" }, email: email || "" };
    }

    const userId = userData?.user?.id;

    // Check if user is a member of the current org
    if (subdomain && userId) {
      // Check membership
      const [existingMember] = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, org.id)
          )
        )
        .limit(1);

      if (!existingMember) {
        // User authenticated successfully but is NOT a member of this organization
        return {
          errors: {
            form: `You don't have access to this organization. Please contact the organization owner to request access.`
          },
          email: email || ""
        };
      }
    }

    // Get redirect URL from query params and validate to prevent open redirects
    const url = new URL(request.url);
    const rawRedirect = url.searchParams.get("redirect") || "/tenant";
    // Only allow relative URLs (must start with / and not contain :// or //)
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("://")
      ? rawRedirect
      : "/tenant";

    // Redirect to app WITH the session cookies
    authLogger.info({ email, organizationId: org.id }, "User logged in");
    return redirect(redirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    authLogger.error({ email, err: error }, "Login error");
    return { errors: { form: "Invalid email or password" }, email: email || "" };
  }
}

export default function LoginPage() {
  const t = useT();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const isSubmitting = navigation.state === "submitting";

  // Discovery mode: root domain with no tenant subdomain
  if (loaderData.mode === "discovery") {
    const discoveryActionData = actionData?.mode === "discovery" ? actionData : null;
    const csrfToken = loaderData.csrfToken;
    return (
      <div className="min-h-screen bg-surface-inset flex items-center justify-center">
        <div className="max-w-md w-full px-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-brand">DiveStreams</h1>
            <p className="text-foreground-muted mt-2">{t("auth.login.enterEmailToFind")}</p>
          </div>
          <form method="post" noValidate className="bg-surface-raised rounded-xl p-8 shadow-sm border">
            <CsrfTokenInput token={csrfToken} />
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  {t("auth.login.emailAddress")}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder="you@example.com"
                  required
                />
                {discoveryActionData?.errors?.email && (
                  <p className="text-danger text-sm mt-1">{discoveryActionData.errors.email}</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
            >
              {isSubmitting ? t("auth.login.searching") : t("auth.login.findMyAccount")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { tenantName, noAccessError, mainSiteUrl, csrfToken } = loaderData;

  return (
    <div className="min-h-screen bg-surface-inset flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand">{tenantName}</h1>
          <p className="text-foreground-muted mt-2">{t("auth.login.signInToAccount")}</p>
        </div>

        {noAccessError && (
          <div className="bg-warning-muted border border-warning text-warning p-4 rounded-xl max-w-4xl break-words mb-6">
            <div className="font-semibold mb-2">{t("auth.login.accessDenied")}</div>
            <p className="text-sm">{noAccessError}</p>
            <div className="mt-4 flex gap-2">
              <a
                href="/auth/logout"
                className="flex-1 px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning-hover text-center text-sm"
              >
                {t("auth.logout")}
              </a>
              <a
                href={mainSiteUrl}
                className="flex-1 px-4 py-2 border-2 border-warning text-warning rounded-lg hover:bg-warning-muted text-center text-sm"
              >
                {t("auth.login.goToMainSite")}
              </a>
            </div>
          </div>
        )}

        <form method="post" noValidate className="bg-surface-raised rounded-xl p-8 shadow-sm border">
          <CsrfTokenInput token={csrfToken} />
          {actionData?.errors?.form && (
            <div className="bg-danger-muted text-danger p-3 rounded-lg max-w-4xl break-words mb-4">
              {actionData.errors.form}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                {t("common.email")}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                defaultValue={actionData?.email || ""}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors && 'email' in actionData.errors && (
                <p className="text-danger text-sm mt-1">{(actionData.errors as Record<string, string>).email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                {t("auth.login.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {actionData?.errors && 'password' in actionData.errors && (
                <p className="text-danger text-sm mt-1">{(actionData.errors as Record<string, string>).password}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("auth.login.signingIn") : t("auth.login.signIn")}
          </button>

          <a
            href="/auth/forgot-password"
            className="block text-center text-sm text-brand mt-4"
          >
            {t("auth.login.forgotYourPassword")}
          </a>
        </form>
      </div>
    </div>
  );
}
