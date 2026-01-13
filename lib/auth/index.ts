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

export const auth = betterAuth({
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
    requireEmailVerification: false, // Can enable later
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
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
    "http://localhost:3000",
    "http://localhost:5173",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
