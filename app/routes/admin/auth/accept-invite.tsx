import { useState } from "react";
import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { db } from "../../../../lib/db";
import { invitation, user, member, organization, account } from "../../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../../../../lib/auth/password.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { error: "Invalid invitation link", invitation: null };
  }

  // Find the invitation
  const [invite] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, token))
    .limit(1);

  if (!invite) {
    return { error: "Invitation not found", invitation: null };
  }

  if (invite.status !== "pending") {
    return { error: `This invitation has already been ${invite.status}`, invitation: null };
  }

  if (new Date(invite.expiresAt) < new Date()) {
    // Update status to expired
    await db
      .update(invitation)
      .set({ status: "expired" })
      .where(eq(invitation.id, token));
    return { error: "This invitation has expired", invitation: null };
  }

  // Check if user already exists
  const [existingUser] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, invite.email))
    .limit(1);

  return {
    error: null,
    invitation: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      organizationName: invite.organizationName,
      organizationId: invite.organizationId,
    },
    existingUser: existingUser || null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const existingUserId = formData.get("existingUserId") as string | null;

  if (!token) {
    return { error: "Invalid invitation" };
  }

  // Find the invitation
  const [invite] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.id, token),
        eq(invitation.status, "pending")
      )
    )
    .limit(1);

  if (!invite) {
    return { error: "Invitation not found or already used" };
  }

  if (new Date(invite.expiresAt) < new Date()) {
    await db
      .update(invitation)
      .set({ status: "expired" })
      .where(eq(invitation.id, token));
    return { error: "This invitation has expired" };
  }

  let userId: string;

  if (existingUserId) {
    // User already exists, just add them as a member
    userId = existingUserId;
  } else {
    // Create new user
    if (!name || !password) {
      return { error: "Name and password are required" };
    }

    if (password !== confirmPassword) {
      return { error: "Passwords do not match" };
    }

    if (password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }

    // Check if user already exists (race condition check)
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, invite.email))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create user
      userId = crypto.randomUUID();
      const hashedPassword = await hashPassword(password);

      await db.insert(user).values({
        id: userId,
        email: invite.email,
        name,
        emailVerified: true, // Verified through invitation
      });

      // Create account with password
      await db.insert(account).values({
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      });
    }
  }

  // Check if already a member
  const [existingMember] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, invite.organizationId)
      )
    )
    .limit(1);

  if (!existingMember) {
    // Add as member of the organization
    await db.insert(member).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: invite.organizationId,
      role: invite.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update invitation status
  await db
    .update(invitation)
    .set({ status: "accepted" })
    .where(eq(invitation.id, token));

  // Redirect to admin login
  return redirect("/login?message=Invitation accepted! Please log in.");
}

export default function AcceptInvite() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-inset">
        <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8 text-center">
          <div className="text-danger text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invitation</h1>
          <p className="text-foreground-muted mb-6">{data.error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const { invitation: invite, existingUser } = data;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-inset">
      <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-brand text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-foreground">Accept Invitation</h1>
          <p className="text-foreground-muted mt-2">
            You've been invited to join <strong>{invite?.organizationName}</strong> as a{" "}
            <strong>{invite?.role}</strong>.
          </p>
        </div>

        {actionData?.error && (
          <div className="mb-4 p-3 bg-danger-muted border border-danger rounded-lg text-danger text-sm">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="token" value={invite?.id} />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              value={invite?.email}
              disabled
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-inset text-foreground-muted"
            />
          </div>

          {existingUser ? (
            <>
              <input type="hidden" name="existingUserId" value={existingUser.id} />
              <div className="p-4 bg-brand-muted rounded-lg">
                <p className="text-sm text-brand">
                  Welcome back, <strong>{existingUser.name}</strong>! Click below to accept
                  the invitation and join the team.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Create a password (min 8 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Confirm your password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-brand text-white rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Accepting..." : "Accept Invitation"}
          </button>
        </Form>

        <p className="mt-6 text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <a href="/login" className="text-brand hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
