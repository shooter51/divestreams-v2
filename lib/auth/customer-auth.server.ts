/**
 * Customer Authentication Server Functions
 *
 * Handles customer authentication for the public site.
 * Separate from staff/admin authentication (Better Auth).
 *
 * Features:
 * - Registration with email verification
 * - Login with session tokens
 * - Password reset
 * - Session management
 */

import { db } from "../db";
import { customerCredentials, customerSessions, customers } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Session duration in days */
const SESSION_DURATION_DAYS = 30;

/** Password hashing rounds (bcrypt cost factor) */
const HASH_ROUNDS = 12;

/** Verification token expiry in hours */
const VERIFICATION_TOKEN_HOURS = 24;

/** Password reset token expiry in hours */
const RESET_TOKEN_HOURS = 1;

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register a new customer account
 *
 * Creates both a customer record and credentials for authentication.
 * Generates a verification token that expires after 24 hours.
 *
 * @param organizationId - The organization (dive shop) this customer belongs to
 * @param data - Customer registration data
 * @returns The created customer and verification token
 * @throws Error if email is already registered
 */
export async function registerCustomer(
  organizationId: string,
  data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }
) {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if email already exists for this organization
  const existing = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, normalizedEmail)
      )
    );

  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  // Create customer record
  const [customer] = await db
    .insert(customers)
    .values({
      organizationId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: normalizedEmail,
      phone: data.phone?.trim() || null,
      hasAccount: true,
    })
    .returning();

  // Hash password and create credentials
  const passwordHash = await bcrypt.hash(data.password, HASH_ROUNDS);
  const verificationToken = randomBytes(32).toString("hex");
  const verificationTokenExpires = new Date(
    Date.now() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000
  );

  await db.insert(customerCredentials).values({
    organizationId,
    customerId: customer.id,
    email: normalizedEmail,
    passwordHash,
    verificationToken,
    verificationTokenExpires,
  });

  return { customer, verificationToken };
}

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Authenticate a customer and create a session
 *
 * Verifies the password and creates a session token that expires after 30 days.
 * Updates the last login timestamp.
 *
 * @param organizationId - The organization to authenticate against
 * @param email - Customer email address
 * @param password - Customer password
 * @returns Session token and expiry date
 * @throws Error if credentials are invalid
 */
export async function loginCustomer(
  organizationId: string,
  email: string,
  password: string
) {
  const normalizedEmail = email.toLowerCase().trim();

  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, normalizedEmail)
      )
    );

  if (!creds) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, creds.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  // Create session
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(customerSessions).values({
    organizationId,
    customerId: creds.customerId,
    token,
    expiresAt,
  });

  // Update last login
  await db
    .update(customerCredentials)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerCredentials.id, creds.id));

  return { token, expiresAt };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Verify a session token is valid
 *
 * Checks if the session exists and hasn't expired.
 * Automatically deletes expired sessions.
 *
 * @param token - The session token to verify
 * @returns The session if valid, null otherwise
 */
export async function verifyCustomerSession(token: string) {
  const [session] = await db
    .select()
    .from(customerSessions)
    .where(eq(customerSessions.token, token));

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Session expired, delete it
    await db
      .delete(customerSessions)
      .where(eq(customerSessions.id, session.id));
    return null;
  }

  return session;
}

/**
 * Get customer by session token
 *
 * Verifies the session and returns the associated customer.
 *
 * @param token - The session token
 * @returns The customer if session is valid, null otherwise
 */
export async function getCustomerBySession(token: string) {
  const session = await verifyCustomerSession(token);
  if (!session) {
    return null;
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, session.customerId));

  return customer || null;
}

/**
 * Logout a customer by invalidating their session
 *
 * @param token - The session token to invalidate
 */
export async function logoutCustomer(token: string) {
  await db.delete(customerSessions).where(eq(customerSessions.token, token));
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

/**
 * Request a password reset
 *
 * Generates a reset token that expires after 1 hour.
 * Does not reveal if the email exists for security.
 *
 * @param organizationId - The organization context
 * @param email - The email to send reset to
 * @returns Reset token info if email exists, null otherwise
 */
export async function requestPasswordReset(
  organizationId: string,
  email: string
) {
  const normalizedEmail = email.toLowerCase().trim();

  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, normalizedEmail)
      )
    );

  if (!creds) {
    // Don't reveal if email exists - just return null silently
    return null;
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(
    Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000
  );

  await db
    .update(customerCredentials)
    .set({ resetToken, resetTokenExpires })
    .where(eq(customerCredentials.id, creds.id));

  return { resetToken, email: creds.email };
}

/**
 * Reset password with a valid reset token
 *
 * @param organizationId - The organization context
 * @param token - The reset token from the email
 * @param newPassword - The new password to set
 * @throws Error if token is invalid or expired
 */
export async function resetPassword(
  organizationId: string,
  token: string,
  newPassword: string
) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.resetToken, token)
      )
    );

  if (
    !creds ||
    !creds.resetTokenExpires ||
    creds.resetTokenExpires < new Date()
  ) {
    throw new Error("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);

  await db
    .update(customerCredentials)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(customerCredentials.id, creds.id));
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

/**
 * Verify a customer's email address
 *
 * @param organizationId - The organization context
 * @param token - The verification token from the email
 * @throws Error if token is invalid or expired
 */
export async function verifyEmail(organizationId: string, token: string) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.verificationToken, token)
      )
    );

  if (
    !creds ||
    !creds.verificationTokenExpires ||
    creds.verificationTokenExpires < new Date()
  ) {
    throw new Error("Invalid or expired verification token");
  }

  await db
    .update(customerCredentials)
    .set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(customerCredentials.id, creds.id));
}

// ============================================================================
// STAFF-CREATED CUSTOMERS
// ============================================================================

/**
 * Create initial credentials for a staff-created customer
 *
 * When staff create a customer via the tenant portal, they don't set a password.
 * This function creates credentials with a reset token so the customer can
 * set their own password via email.
 *
 * @param organizationId - The organization context
 * @param customerId - The customer ID
 * @param email - The customer's email address
 * @returns Reset token for the password setup email
 */
export async function createInitialCredentials(
  organizationId: string,
  customerId: string,
  email: string
) {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if credentials already exist
  const existing = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, normalizedEmail)
      )
    );

  if (existing.length > 0) {
    // Already has credentials, request a password reset instead
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(
      Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000
    );

    await db
      .update(customerCredentials)
      .set({ resetToken, resetTokenExpires })
      .where(eq(customerCredentials.id, existing[0].id));

    return { resetToken };
  }

  // Generate a temporary password hash (customer will set their own via reset token)
  const temporaryPassword = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(temporaryPassword, HASH_ROUNDS);

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(
    Date.now() + 24 * 60 * 60 * 1000 // 24 hours for initial setup
  );

  await db.insert(customerCredentials).values({
    organizationId,
    customerId,
    email: normalizedEmail,
    passwordHash, // Temporary, customer will set their own
    resetToken,
    resetTokenExpires,
    emailVerified: false, // Will be verified when they set password
  });

  return { resetToken };
}
