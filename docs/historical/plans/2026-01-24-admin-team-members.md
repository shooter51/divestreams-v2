# Admin Team Members

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ability to invite and manage team members in the DiveStreams platform admin panel.

**Architecture:** Reuse existing tenant team member patterns for the platform organization. No database changes needed.

**Tech Stack:** React Router, Better Auth, Drizzle ORM, Email invitations

---

## Overview

The DiveStreams admin system already uses an organization-based approach:
- Special "platform" organization (`slug = "platform"`) contains admin users
- Membership in platform org grants admin access
- Roles: "owner" (full access) and "admin" (management access)

The infrastructure exists - we just need to expose a team management UI.

## Current State

**Admin Access Determination:**
- **File:** `lib/auth/platform-context.server.ts`
- Checks membership in platform organization
- Role-based: `isOwner` and `isAdmin` flags

**Existing Patterns to Reuse:**
- **File:** `app/routes/tenant/settings/team.tsx` - Complete team management UI
- Invite by email, role management, pending invitations
- 7-day invitation expiration
- Email-based invitation acceptance

---

## Implementation Tasks

### Task 1: Create Admin Settings Layout

**Files:**
- Create: `app/routes/admin/settings.tsx`

```typescript
import { Outlet, NavLink } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requirePlatformContext } from "~/lib/auth/platform-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);
  return {};
}

export default function AdminSettings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-6">
        <nav className="w-48 space-y-1">
          <NavLink
            to="/admin/settings/team"
            className={({ isActive }) =>
              `block px-4 py-2 rounded ${isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`
            }
          >
            Team Members
          </NavLink>
        </nav>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
```

### Task 2: Create Admin Team Page

**Files:**
- Create: `app/routes/admin/settings.team.tsx`

**Step 1:** Create loader to fetch platform org members
```typescript
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requirePlatformContext } from "~/lib/auth/platform-context.server";
import { db } from "~/lib/db";
import { member, user, invitation, organization } from "~/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requirePlatformContext(request);

  // Get platform organization
  const [platformOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "platform"))
    .limit(1);

  if (!platformOrg) {
    throw new Response("Platform organization not found", { status: 500 });
  }

  // Get team members
  const members = await db
    .select({
      member: member,
      user: user,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, platformOrg.id))
    .orderBy(desc(member.createdAt));

  // Get pending invitations
  const pendingInvites = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, platformOrg.id),
        eq(invitation.status, "pending")
      )
    )
    .orderBy(desc(invitation.createdAt));

  return {
    members: members.map(m => ({
      id: m.member.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.member.role,
      createdAt: m.member.createdAt,
    })),
    pendingInvites,
    currentUserId: ctx.user.id,
    isOwner: ctx.isOwner,
  };
}
```

**Step 2:** Create actions for invite, update-role, remove
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requirePlatformContext(request);

  if (!ctx.isOwner && !ctx.isAdmin) {
    throw new Response("Only admins can manage team", { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "invite": {
      const email = formData.get("email") as string;
      const role = formData.get("role") as string;

      // Validate email
      if (!email || !email.includes("@")) {
        return { error: "Valid email required" };
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(user.email, email))
        .limit(1);

      if (existing) {
        return { error: "User is already a team member" };
      }

      // Create invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const [platformOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, "platform"))
        .limit(1);

      await db.insert(invitation).values({
        email,
        organizationId: platformOrg.id,
        role: role || "admin",
        status: "pending",
        inviterId: ctx.user.id,
        expiresAt,
      });

      // TODO: Send invitation email
      // await sendAdminInviteEmail(email, ctx.user.name);

      return { success: true, message: "Invitation sent" };
    }

    case "update-role": {
      const memberId = formData.get("memberId") as string;
      const newRole = formData.get("role") as string;

      // Only owners can change roles
      if (!ctx.isOwner) {
        return { error: "Only owners can change roles" };
      }

      await db.update(member)
        .set({ role: newRole })
        .where(eq(member.id, memberId));

      return { success: true };
    }

    case "remove": {
      const memberId = formData.get("memberId") as string;

      // Get member to check if trying to remove self
      const [targetMember] = await db
        .select()
        .from(member)
        .where(eq(member.id, memberId))
        .limit(1);

      if (targetMember?.userId === ctx.user.id) {
        return { error: "Cannot remove yourself" };
      }

      // Only owners can remove other owners
      if (targetMember?.role === "owner" && !ctx.isOwner) {
        return { error: "Only owners can remove other owners" };
      }

      await db.delete(member).where(eq(member.id, memberId));

      return { success: true };
    }

    case "cancel-invite": {
      const inviteId = formData.get("inviteId") as string;

      await db.update(invitation)
        .set({ status: "canceled" })
        .where(eq(invitation.id, inviteId));

      return { success: true };
    }
  }

  return { error: "Unknown action" };
}
```

**Step 3:** Create UI component (mirror tenant team page)
```typescript
export default function AdminTeam() {
  const { members, pendingInvites, currentUserId, isOwner } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Team Members</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Invite Member
        </button>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3">
                  <div>{m.name || "Unnamed"}</div>
                  <div className="text-sm text-gray-500">{m.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    m.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.userId !== currentUserId && isOwner && (
                    <fetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="memberId" value={m.id} />
                      <button
                        type="submit"
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </fetcher.Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <h3 className="px-4 py-3 font-medium border-b">Pending Invitations</h3>
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="px-4 py-3 flex justify-between items-center border-t">
              <div>
                <div>{inv.email}</div>
                <div className="text-sm text-gray-500">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="cancel-invite" />
                <input type="hidden" name="inviteId" value={inv.id} />
                <button type="submit" className="text-gray-600 hover:text-gray-800 text-sm">
                  Cancel
                </button>
              </fetcher.Form>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
```

### Task 3: Add Settings Link to Admin Layout

**Files:**
- Modify: `app/routes/admin/layout.tsx`

**Add navigation link:**
```typescript
<NavLink to="/admin/settings/team" className="...">
  Settings
</NavLink>
```

### Task 4: Create Invitation Acceptance Route

**Files:**
- Create: `app/routes/admin/auth.accept-invite.tsx`

```typescript
// Handle invitation acceptance for admin invites
// Similar to tenant invitation acceptance but for platform org
```

### Task 5: Run Typecheck

```bash
npm run typecheck
```

### Task 6: Test End-to-End

1. Go to /admin/settings/team as owner
2. Invite a new admin by email
3. Verify invitation appears in pending list
4. Accept invitation (login as invited user)
5. Verify new user can access admin panel
6. Test role changes and member removal

---

## Roles Reference

| Role | Permissions |
|------|-------------|
| owner | Full access - manage team, all settings |
| admin | Management access - view/manage tenants, users |

---

## No Database Changes Required

The existing tables support this feature:
- `organization` - platform org already exists
- `member` - stores org membership with role
- `invitation` - stores pending invites
- `user` - stores user credentials

All infrastructure is ready - just needs UI exposure.
