import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "../db";
import {
  user,
  session,
  account,
  verification,
  organization as orgTable,
  member,
  invitation,
} from "../db/schema";
import { sendEmail } from "../email";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL || process.env.APP_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      organization: orgTable,
      member,
      invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: Enable before production launch - currently disabled for development
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your DiveStreams password",
        html: `
          <p>Hi ${user.name || "there"},</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${url}">${url}</a></p>
          <p>This link expires in 1 hour.</p>
        `,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true, // REQUIRED for getSession() to work (Issue #4942)
      maxAge: 60 * 60, // 1 hour - cache duration before revalidating with DB (reduces queries by 92%)
    },
  },
  // Cookie configuration handled by Better Auth defaults
  // sameSite: 'lax' and domain are set appropriately by the framework
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      creatorRole: "owner",
      memberRoles: ["owner", "admin", "staff", "customer"],
      defaultRole: "customer",
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    }),
  ],
  trustedOrigins: [
    "https://divestreams.com",
    "https://*.divestreams.com",
    "https://staging.divestreams.com",
    "https://*.staging.divestreams.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
