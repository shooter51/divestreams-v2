-- Migration: Set emailVerified = true for all existing users
--
-- Better Auth's requireEmailVerification blocks login for users with
-- emailVerified = false. Since this is a multi-tenant SaaS where users
-- sign up directly on known subdomains, email verification is handled
-- at signup time (not via email link). This migration fixes existing
-- users created before the signup.tsx fix was deployed.

UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false OR "emailVerified" IS NULL;
