import { useState } from "react";
import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { db } from "../../../../lib/db/client.server";
import { invitation, user, member, organization, account } from "../../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../../../../lib/auth/password.server";
import { createId } from "@paralleldrive/cuid2";

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
      userId = createId();
      const hashedPassword = await hashPassword(password);

      await db.insert(user).values({
        id: userId,
        email: invite.email,
        name,
        emailVerified: true, // Verified through invitation
      });

      // Create account with password
      await db.insert(account).values({
        id: createId(),
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
      id: createId(),
      userId,
      organizationId: invite.organizationId,
      role: invite.role,
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">{data.error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const { invitation: invite, existingUser } = data;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-blue-600 text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
          <p className="text-gray-600 mt-2">
            You've been invited to join <strong>{invite?.organizationName}</strong> as a{" "}
            <strong>{invite?.role}</strong>.
          </p>
        </div>

        {actionData?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="token" value={invite?.id} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={invite?.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {existingUser ? (
            <>
              <input type="hidden" name="existingUserId" value={existingUser.id} />
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Welcome back, <strong>{existingUser.name}</strong>! Click below to accept
                  the invitation and join the team.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Create a password (min 8 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm your password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Accepting..." : "Accept Invitation"}
          </button>
        </Form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
