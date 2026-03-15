/**
 * Public Site Customer Registration Page
 *
 * Registration form for customers to create accounts on tenant public sites.
 * Includes password validation, terms acceptance, and auto-login on success.
 */

import { useState, useEffect } from "react";
import { Form, Link, useActionData, useNavigation, useRouteLoaderData, redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { registerCustomer, loginCustomer } from "../../../lib/auth/customer-auth.server";
import { checkRateLimit, getClientIp } from "../../../lib/utils/rate-limit";
import { validateAnonCsrfToken, CSRF_FIELD_NAME } from "../../../lib/security/csrf.server";
import { authLogger } from "../../../lib/logger";
import type { SiteLoaderData } from "./_layout";
import { useT } from "../../i18n/use-t";

// ============================================================================
// ICONS
// ============================================================================

function CheckCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExclamationCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

function XCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface ActionData {
  success?: boolean;
  error?: string;
  errors?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  };
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

interface PasswordValidation {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

function validatePassword(password: string): PasswordValidation {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return {
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request }: ActionFunctionArgs): Promise<ActionData | Response> {
  // Rate limit registration attempts
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`register:${clientIp}`, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.allowed) {
    return { error: "auth.register.tooManyAttempts" };
  }

  const formData = await request.formData();

  // CSRF validation (DS-30f)
  const csrfToken = formData.get(CSRF_FIELD_NAME) as string | null;
  if (!validateAnonCsrfToken(csrfToken)) {
    return { error: "auth.register.invalidCsrf" };
  }

  const url = new URL(request.url);

  // Extract organization ID from the URL host
  const host = url.host;

  // Get subdomain from host
  let subdomain: string | null = null;
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      subdomain = parts[0].toLowerCase();
    }
  } else {
    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin") {
        subdomain = sub;
      }
    }
  }

  if (!subdomain) {
    return { error: "auth.register.noOrganization" };
  }

  // Import db and organization schema
  const { db } = await import("../../../lib/db");
  const { organization } = await import("../../../lib/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  // Find organization by slug
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return { error: "auth.register.orgNotFound" };
  }

  // Extract form fields
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const terms = formData.get("terms") as string;

  // Validation
  const errors: ActionData["errors"] = {};

  // First name validation
  if (!firstName || firstName.trim().length < 1) {
    errors.firstName = "auth.register.firstNameRequired";
  } else if (firstName.trim().length > 100) {
    errors.firstName = "auth.register.firstNameTooLong";
  }

  // Last name validation
  if (!lastName || lastName.trim().length < 1) {
    errors.lastName = "auth.register.lastNameRequired";
  } else if (lastName.trim().length > 100) {
    errors.lastName = "auth.register.lastNameTooLong";
  }

  // Email validation
  if (!email || !email.includes("@") || !email.includes(".")) {
    errors.email = "auth.register.invalidEmail";
  } else if (email.length > 255) {
    errors.email = "auth.register.emailTooLong";
  }

  // Phone validation (optional)
  if (phone && phone.trim()) {
    const phoneRegex = /^[\d\s().+-]+$/;
    if (!phoneRegex.test(phone)) {
      errors.phone = "auth.register.invalidPhone";
    } else if (phone.length > 20) {
      errors.phone = "auth.register.phoneTooLong";
    }
  }

  // Password validation
  const passwordValidation = validatePassword(password || "");
  if (!password) {
    errors.password = "auth.register.passwordRequired";
  } else if (!passwordValidation.isValid) {
    const missing: string[] = [];
    if (!passwordValidation.hasMinLength) missing.push("at least 8 characters");
    if (!passwordValidation.hasUppercase) missing.push("one uppercase letter");
    if (!passwordValidation.hasLowercase) missing.push("one lowercase letter");
    if (!passwordValidation.hasNumber) missing.push("one number");
    errors.password = `Password must contain ${missing.join(", ")}`;
  }

  // Confirm password validation
  if (!confirmPassword) {
    errors.confirmPassword = "auth.register.confirmPasswordRequired";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "auth.register.passwordsDoNotMatch";
  }

  // Terms acceptance validation
  if (terms !== "on") {
    errors.terms = "auth.register.acceptTerms";
  }

  // Return validation errors
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // Register the customer
  try {
    await registerCustomer(org.id, {
      email: email.toLowerCase().trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone?.trim() || undefined,
    });

    // Send welcome email
    try {
      const { triggerCustomerWelcomeEmail } = await import("../../../lib/email/triggers");
      await triggerCustomerWelcomeEmail({
        customerEmail: email.toLowerCase().trim(),
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        shopName: org.name,
        subdomain: subdomain,
        tenantId: org.id,
      });
    } catch (emailError) {
      authLogger.error({ err: emailError }, "Failed to send customer welcome email");
      // Continue even if email fails
    }

    // Auto-login the customer
    try {
      const { token, expiresAt } = await loginCustomer(org.id, email, password);

      // Create response with session cookie
      const headers = new Headers();
      headers.append(
        "Set-Cookie",
        `customer_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`
      );

      // Redirect to account page
      return redirect("/site/account", { headers });
    } catch {
      // If auto-login fails, redirect to login with success message
      return redirect("/site/login?registered=true");
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Email already registered") {
        return {
          success: false,
          errors: { email: "auth.register.emailTaken" },
        };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: "auth.register.registrationFailed" };
  }
}

// ============================================================================
// PASSWORD REQUIREMENTS COMPONENT
// ============================================================================

function PasswordRequirements({ password }: { password: string }) {
  const t = useT();
  const validation = validatePassword(password);

  const requirements = [
    { label: t("site.register.min8Chars"), met: validation.hasMinLength },
    { label: t("site.register.oneUppercase"), met: validation.hasUppercase },
    { label: t("site.register.oneLowercase"), met: validation.hasLowercase },
    { label: t("site.register.oneNumber"), met: validation.hasNumber },
  ];

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((req, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-sm"
          style={{
            color: req.met ? "var(--success-text)" : "var(--text-color)",
            opacity: req.met ? 1 : 0.7,
          }}
        >
          {req.met ? (
            <CheckCircleIcon className="w-4 h-4" style={{ color: "var(--success-text)" }} />
          ) : (
            <XCircleIcon className="w-4 h-4" style={{ opacity: 0.4 }} />
          )}
          {req.label}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SiteRegisterPage() {
  const t = useT();
  // Get data from parent layout loader
  const loaderData = useRouteLoaderData<SiteLoaderData>("routes/site/_layout");

  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Track password fields for real-time validation display and error clearing
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Track which fields user has typed in since last server error (to clear stale errors)
  const [clearedErrors, setClearedErrors] = useState<Set<string>>(new Set());
  // Reset cleared errors when new actionData arrives (new submission cycle)
  useEffect(() => {
    setClearedErrors(new Set());
  }, [actionData]);

  // Loading state
  if (!loaderData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold" style={{ color: "var(--text-color)" }}>{t("site.register.title")}</h1>
        <p className="mt-4 text-lg opacity-75">{t("common.loading")}</p>
      </div>
    );
  }

  const { organization } = loaderData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="max-w-md mx-auto">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-color)" }}>{t("site.register.createAccount")}</h1>
          <p className="opacity-75">
            {t("site.register.joinToBook", { name: organization.name })}
          </p>
        </div>

        {/* Registration Form */}
        <div
          className="rounded-2xl p-8 shadow-sm border"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
          }}
        >
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_csrf" value={loaderData?.csrfToken || ""} />
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  {t("site.register.firstName")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.firstName
                      ? "var(--danger)"
                      : "var(--accent-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.firstName ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.firstName ? "firstName-error" : undefined
                  }
                />
                {actionData?.errors?.firstName && (
                  <p
                    id="firstName-error"
                    className="mt-1 text-sm text-danger flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {t(actionData.errors.firstName)}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-color)" }}
                >
                  {t("site.register.lastName")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  autoComplete="family-name"
                  className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.lastName
                      ? "var(--danger)"
                      : "var(--accent-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.lastName ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.lastName ? "lastName-error" : undefined
                  }
                />
                {actionData?.errors?.lastName && (
                  <p
                    id="lastName-error"
                    className="mt-1 text-sm text-danger flex items-center gap-1"
                  >
                    <ExclamationCircleIcon className="w-4 h-4" />
                    {t(actionData.errors.lastName)}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                {t("site.register.emailAddress")} <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderColor: actionData?.errors?.email
                    ? "var(--danger)"
                    : "var(--accent-color)",
                  "--tw-ring-color": "var(--primary-color)",
                }}
                aria-invalid={actionData?.errors?.email ? "true" : undefined}
                aria-describedby={
                  actionData?.errors?.email ? "email-error" : undefined
                }
              />
              {actionData?.errors?.email && (
                <p
                  id="email-error"
                  className="mt-1 text-sm text-danger flex items-center gap-1"
                >
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {t(actionData.errors.email)}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                {t("site.register.phone")} <span className="text-sm opacity-50">({t("common.optional")})</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                autoComplete="tel"
                className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderColor: actionData?.errors?.phone
                    ? "var(--danger)"
                    : "var(--accent-color)",
                  "--tw-ring-color": "var(--primary-color)",
                }}
                aria-invalid={actionData?.errors?.phone ? "true" : undefined}
                aria-describedby={
                  actionData?.errors?.phone ? "phone-error" : undefined
                }
              />
              {actionData?.errors?.phone && (
                <p
                  id="phone-error"
                  className="mt-1 text-sm text-danger flex items-center gap-1"
                >
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {t(actionData.errors.phone)}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                {t("site.register.password")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  aria-label="Password"
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setClearedErrors((prev) => {
                      const next = new Set(prev);
                      next.add("password");
                      next.add("confirmPassword");
                      return next;
                    });
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.password
                      ? "var(--danger)"
                      : "var(--accent-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.password ? "true" : undefined}
                  aria-describedby="password-requirements"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity"
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {actionData?.errors?.password && !clearedErrors.has("password") && (
                <p className="mt-1 text-sm text-danger flex items-center gap-1">
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {t(actionData.errors.password)}
                </p>
              )}
              <div id="password-requirements">
                <PasswordRequirements password={password} />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                {t("site.register.confirmPassword")} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setClearedErrors((prev) => new Set(prev).add("confirmPassword"));
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: actionData?.errors?.confirmPassword && !clearedErrors.has("confirmPassword")
                      ? "var(--danger)"
                      : "var(--accent-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                  aria-invalid={actionData?.errors?.confirmPassword && !clearedErrors.has("confirmPassword") ? "true" : undefined}
                  aria-describedby={
                    actionData?.errors?.confirmPassword && !clearedErrors.has("confirmPassword") ? "confirmPassword-error" : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity"
                  aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {actionData?.errors?.confirmPassword && !clearedErrors.has("confirmPassword") && (
                <p
                  id="confirmPassword-error"
                  className="mt-1 text-sm text-danger flex items-center gap-1"
                >
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {t(actionData.errors.confirmPassword)}
                </p>
              )}
            </div>

            {/* Terms Acceptance */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="terms"
                  className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-2"
                  style={{
                    "--tw-ring-color": "var(--primary-color)",
                    accentColor: "var(--primary-color)",
                  }}
                  aria-describedby={
                    actionData?.errors?.terms ? "terms-error" : undefined
                  }
                />
                <span className="text-sm">
                  {t("site.register.agreeToTerms")}{" "}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="underline hover:opacity-80"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {t("site.register.termsOfService")}
                  </Link>{" "}
                  {t("site.register.and")}{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="underline hover:opacity-80"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {t("site.register.privacyPolicy")}
                  </Link>
                </span>
              </label>
              {actionData?.errors?.terms && (
                <p
                  id="terms-error"
                  className="mt-1 text-sm text-danger flex items-center gap-1"
                >
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {t(actionData.errors.terms)}
                </p>
              )}
            </div>

            {/* General Error */}
            {actionData?.error && (
              <div className="p-4 rounded-lg bg-danger-muted text-danger flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                <p>{t(actionData.error)}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 rounded-lg font-medium text-white transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary-color)",
              }}
            >
              {isSubmitting ? t("site.register.creatingAccount") : t("site.register.createAccountButton")}
            </button>
          </Form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm opacity-75">
              {t("site.register.alreadyHaveAccount")}{" "}
              <Link
                to="/site/login"
                className="font-medium hover:opacity-80"
                style={{ color: "var(--primary-color)" }}
              >
                {t("site.register.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
