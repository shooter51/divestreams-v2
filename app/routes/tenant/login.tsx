import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useNavigation, useSearchParams, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { organization, member } from "../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { getAppUrl } from "../../../lib/utils/url";
import { checkRateLimit, getClientIp } from "../../../lib/utils/rate-limit";
import { generateAnonCsrfToken, validateAnonCsrfToken, CSRF_FIELD_NAME } from "../../../lib/security/csrf.server";
import { CsrfTokenInput } from "../../components/CsrfInput";
import { useT } from "../../i18n/use-t";
import { authLogger } from "../../../lib/logger";

type ActionData = {
  error?: string;
  email?: string;
  notMember?: {
    orgName: string;
    orgId: string;
    userId: string;
    email: string;
  };
};

type LoaderData = {
  orgName: string;
  orgId: string | null;
  subdomain: string | null;
  noAccessError?: string | null;
  mainSiteUrl?: string;
  csrfToken: string;
};

export const meta: MetaFunction = () => [{ title: "Login - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  // Get org info first
  const subdomain = getSubdomainFromRequest(request);
  let orgName = "this shop";
  let orgId: string | null = null;

  if (subdomain) {
    const [org] = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (org) {
      orgName = org.name;
      orgId = org.id;
    }
  }

  // Check if already logged in to THIS organization
  const orgContext = await getOrgContext(request);
  if (orgContext) {
    const url = new URL(request.url);
    const rawRedirect = url.searchParams.get("redirect") || "/tenant";
    // Validate redirect to prevent open redirects
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("://")
      ? rawRedirect
      : "/tenant";
    throw redirect(redirectTo);
  }

  // Check if user has a session but no membership in THIS organization
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  // Generate CSRF token for the login/join forms (no session required)
  const csrfToken = generateAnonCsrfToken();

  if (sessionData && sessionData.user) {
    // User is logged in but doesn't have access to this organization
    return {
      orgName,
      orgId,
      subdomain,
      mainSiteUrl: getAppUrl(),
      noAccessError: `You are logged in as ${sessionData.user.email}, but you don't have access to this organization. Please contact the organization owner to request access, or log out and sign in with a different account.`,
      csrfToken,
    };
  }

  return { orgName, orgId, subdomain, csrfToken };
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const redirectTo = formData.get("redirectTo");

  // Validate CSRF token (log warning if missing, reject if present but invalid)
  const csrfToken = formData.get(CSRF_FIELD_NAME) as string | null;
  if (csrfToken && !validateAnonCsrfToken(csrfToken)) {
    return { error: "auth.login.invalidFormSubmission" };
  }

  // Rate limit login attempts
  const clientIp = getClientIp(request);
  const loginEmail = formData.get("email") as string;
  if (intent !== "join" && loginEmail) {
    const rateLimit = await checkRateLimit(`login:${clientIp}:${loginEmail}`, { maxAttempts: 30, windowMs: 15 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return { error: "auth.login.tooManyAttempts" };
    }
  }

  // Validate redirectTo to prevent open redirects (only allow relative URLs, block // protocol-relative)
  let validatedRedirectTo = "/tenant"; // default
  if (typeof redirectTo === "string" && redirectTo.startsWith("/") && !redirectTo.startsWith("//") && !redirectTo.includes("://")) {
    validatedRedirectTo = redirectTo;
  }

  // Handle "join" intent - user wants to join org as customer
  if (intent === "join") {
    // Get authenticated session - userId MUST come from session, not form data
    const joinSession = await auth.api.getSession({
      headers: request.headers,
    });

    if (!joinSession?.user) {
      return { error: "auth.login.mustBeLoggedIn" };
    }

    const userId = joinSession.user.id;

    // Derive orgId from subdomain, NOT from form data (prevents joining arbitrary orgs)
    const joinSubdomain = getSubdomainFromRequest(request);
    if (!joinSubdomain) {
      return { error: "auth.login.unableToDetermineOrg", email: "" };
    }

    const [joinOrg] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, joinSubdomain))
      .limit(1);

    if (!joinOrg) {
      return { error: "auth.login.orgNotFound", email: "" };
    }

    const orgId = joinOrg.id;

    try {
      // Check if user is already a member (edge case)
      const [existingMember] = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, orgId)
          )
        )
        .limit(1);

      if (!existingMember) {
        // Add user as customer
        await db.insert(member).values({
          id: crypto.randomUUID(),
          userId,
          organizationId: orgId,
          role: "customer",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Redirect to app
      return redirect(validatedRedirectTo);
    } catch (error) {
      authLogger.error({ err: error }, "Join org failed");
      return { error: "auth.login.joinFailed", email: "" };
    }
  }

  // Handle normal login
  const email = formData.get("email");
  const password = formData.get("password");

  // Per-email rate limit is already checked above.
  // Validate email and password with null checks
  if (typeof email !== "string" || !email || !emailRegex.test(email)) {
    return { error: "auth.login.invalidEmail", email: email || "" };
  }

  if (typeof password !== "string" || !password) {
    return { error: "auth.login.passwordRequired", email: email || "" };
  }

  try {
    // Call Better Auth sign in API
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
      asResponse: true,
    });

    // Get cookies FIRST before reading body
    const cookies = response.headers.get("set-cookie");

    // Get user data from response to check membership
    const userData = await response.json();

    if (!response.ok) {
      authLogger.warn({ email, reason: userData.message }, "Login failed");
      return { error: userData.message || "auth.login.invalidCredentials", email };
    }

    const userId = userData?.user?.id;

    // Check if user is a member of the current org
    const subdomain = getSubdomainFromRequest(request);

    if (subdomain && userId) {
      const [org] = await db
        .select({ id: organization.id, name: organization.name })
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1);

      if (org) {
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
          // User is NOT a member - return with cookies so they stay logged in
          // and show the "not a member" UI
          return Response.json(
            {
              notMember: {
                orgName: org.name,
                orgId: org.id,
                userId,
                email,
              },
            } as ActionData,
            {
              headers: cookies ? { "Set-Cookie": cookies } : {},
            }
          );
        }
      }
    }

    // User is a member (or no subdomain), redirect to app
    authLogger.info({ email }, "User logged in");
    return redirect(validatedRedirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    authLogger.error({ email, err: error }, "Login error");
    return { error: "auth.login.genericError", email: email || "" };
  }
}

export default function LoginPage() {
  const t = useT();
  const { orgName, noAccessError, mainSiteUrl, csrfToken } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const redirectTo = searchParams.get("redirect") || "/tenant";
  const isSignupSuccess = searchParams.get("signup") === "success";
  const emailSkipped = searchParams.get("emailSkipped") === "true";

  // Show "Not a member" UI if user is authenticated but not a member of this org
  if (actionData?.notMember) {
    const { orgName: shopName, orgId, userId, email } = actionData.notMember;

    return (
      <div className="min-h-screen bg-surface-inset flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Warning Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-warning-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            {t("tenant.auth.login.notMemberOf", { shop: shopName })}
          </h2>
          <p className="mt-2 text-center text-sm text-foreground-muted">
            {t("tenant.auth.login.signedInAsNotMember", { email })}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
            <Form method="post" className="space-y-4">
              <CsrfTokenInput token={csrfToken} />
              <input type="hidden" name="intent" value="join" />
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-brand-disabled disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t("tenant.auth.login.joining")}
                  </span>
                ) : (
                  t("tenant.auth.login.joinAsCustomer", { shop: shopName })
                )}
              </button>
            </Form>

            <div className="mt-4 text-center">
              <Link
                to="/"
                className="text-sm font-medium text-foreground-muted hover:text-foreground"
              >
                {t("tenant.auth.login.goBackToHomepage")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-inset flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
          {t("tenant.auth.login.signInToAccount")}
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          {t("tenant.auth.login.welcomeBack")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Access Denied Warning - shown when user is logged in but doesn't have access to this org */}
        {noAccessError && mainSiteUrl && (
          <div className="mb-6 bg-warning-muted border border-warning text-warning p-4 rounded-xl max-w-4xl break-words">
            <div className="font-semibold mb-2">{t("tenant.auth.login.accessDenied")}</div>
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
                {t("tenant.auth.login.goToMainSite")}
              </a>
            </div>
          </div>
        )}

        <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Signup Success Message */}
          {isSignupSuccess && (
            <div className="mb-4 p-3 bg-success-muted border border-success rounded-lg">
              <p className="text-sm text-success font-medium">{t("tenant.auth.login.signupSuccess")}</p>
              {emailSkipped && (
                <p className="text-sm text-foreground-muted mt-1">
                  {t("tenant.auth.login.emailSkippedNote")}
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-4 p-3 bg-danger-muted border border-danger rounded-lg">
              <p className="text-sm text-danger">{t(actionData.error)}</p>
            </div>
          )}

          <Form method="post" className="space-y-6">
            <CsrfTokenInput token={csrfToken} />
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                {t("common.emailAddress")}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={actionData?.email || ""}
                  className="appearance-none block w-full px-3 py-2 border border-border-strong rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand"
                  placeholder={t("site.login.emailPlaceholder")}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                {t("common.password")}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-border-strong rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand"
                  placeholder={t("site.login.passwordPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
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
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-brand focus:ring-brand border-border-strong rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                  {t("tenant.auth.login.rememberMe")}
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/tenant/forgot-password"
                  className="font-medium text-brand hover:text-brand"
                >
                  {t("tenant.auth.login.forgotPassword")}
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-brand-disabled disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t("tenant.auth.login.signingIn")}
                  </span>
                ) : (
                  t("tenant.auth.login.signIn")
                )}
              </button>
            </div>
          </Form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-strong" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-raised text-foreground-muted">{t("tenant.auth.login.notMemberYet")}</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to={`/signup${redirectTo !== "/tenant" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                className="w-full flex justify-center py-2.5 px-4 border border-border-strong rounded-lg shadow-sm text-sm font-medium text-foreground bg-surface-raised hover:bg-surface-inset focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
              >
                {t("tenant.auth.login.createAccount")}
              </Link>
            </div>
          </div>
        </div>

        {/* Join as customer prompt */}
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t("tenant.auth.login.notMemberOfOrg", { org: orgName })}{" "}
          <Link
            to={`/signup?role=customer${redirectTo !== "/tenant" ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-brand hover:text-brand"
          >
            {t("tenant.auth.login.joinAsCustomerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
