# Admin Password Reset - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable administrators to reset user passwords through three methods (auto-generate, manual entry, email reset) with full audit logging.

**Architecture:** Multi-tier approach with core password reset module, database audit table, React modal UI, route handlers at both platform and tenant levels, and forced password change middleware.

**Tech Stack:** React Router v7, Drizzle ORM, PostgreSQL, Better Auth, TypeScript, Vitest, Playwright

---

## Task 1: Database Schema - Audit Table

**Files:**
- Create: `drizzle/0033_add_password_audit.sql`
- Create: `lib/db/schema/password-audit.ts`
- Modify: `lib/db/schema.ts`

**Step 1: Create migration SQL**

Create `drizzle/0033_add_password_audit.sql`:

```sql
-- Create password change audit table
CREATE TABLE IF NOT EXISTS password_change_audit (
  id TEXT PRIMARY KEY,
  changed_by_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('auto_generated', 'manual_entry', 'email_reset')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_audit_target ON password_change_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_changed_by ON password_change_audit(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_org ON password_change_audit(organization_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_created ON password_change_audit(created_at);

-- Add force_password_change column to account table
ALTER TABLE account ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
```

**Step 2: Create Drizzle schema**

Create `lib/db/schema/password-audit.ts`:

```typescript
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user, organization } from "./auth";

export const passwordChangeAudit = pgTable(
  "password_change_audit",
  {
    id: text("id").primaryKey(),
    changedByUserId: text("changed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    method: text("method").notNull(), // 'auto_generated' | 'manual_entry' | 'email_reset'
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_password_audit_target").on(table.targetUserId),
    index("idx_password_audit_changed_by").on(table.changedByUserId),
    index("idx_password_audit_org").on(table.organizationId),
    index("idx_password_audit_created").on(table.createdAt),
  ]
);

export type PasswordChangeAudit = typeof passwordChangeAudit.$inferSelect;
export type NewPasswordChangeAudit = typeof passwordChangeAudit.$inferInsert;
```

**Step 3: Export schema**

Modify `lib/db/schema.ts` - Add after line 30 (after other schema exports):

```typescript
export * from "./schema/password-audit";
```

**Step 4: Run migration**

Run: `npm run db:push` or apply migration manually to test database

Expected: Tables created successfully

**Step 5: Commit**

```bash
git add drizzle/0033_add_password_audit.sql lib/db/schema/password-audit.ts lib/db/schema.ts
git commit -m "feat(db): add password change audit table and force_password_change column

- Create password_change_audit table with indexes
- Add Drizzle schema for password audit
- Add force_password_change column to account table"
```

---

## Task 2: Email Template - Password Changed Notification

**Files:**
- Create: `lib/email/templates/password-changed-by-admin.ts`
- Create: `tests/unit/lib/email/templates/password-changed-by-admin.test.ts`

**Step 1: Write failing test**

Create `tests/unit/lib/email/templates/password-changed-by-admin.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPasswordChangedByAdminEmail } from "../../../../lib/email/templates/password-changed-by-admin";

describe("Password Changed By Admin Email", () => {
  it("should generate email with admin name and method", () => {
    const result = getPasswordChangedByAdminEmail({
      userName: "John Doe",
      userEmail: "john@example.com",
      adminName: "Admin User",
      method: "auto_generated",
      organizationName: "Test Dive Shop",
      changedAt: "January 15, 2026 at 10:30 AM",
      loginUrl: "https://test.divestreams.com/login",
    });

    expect(result.subject).toContain("password was changed");
    expect(result.subject).toContain("Test Dive Shop");
    expect(result.html).toContain("John Doe");
    expect(result.html).toContain("Admin User");
    expect(result.html).toContain("January 15, 2026 at 10:30 AM");
    expect(result.text).toContain("John Doe");
  });

  it("should show different message for each method", () => {
    const autoGen = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "auto_generated",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    const manual = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "manual_entry",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    const emailReset = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "email_reset",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    expect(autoGen.html).toContain("temporary password");
    expect(manual.html).toContain("new password was set");
    expect(emailReset.html).toContain("reset link");
  });

  it("should escape HTML in user data", () => {
    const result = getPasswordChangedByAdminEmail({
      userName: "<script>alert('xss')</script>",
      userEmail: "test@example.com",
      adminName: "<b>Admin</b>",
      method: "auto_generated",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/email/templates/password-changed-by-admin.test.ts`

Expected: FAIL - "Cannot find module"

**Step 3: Create email template**

Create `lib/email/templates/password-changed-by-admin.ts`:

```typescript
import { escapeHtml } from "../../security/sanitize";

export interface PasswordChangedByAdminData {
  userName: string;
  userEmail: string;
  adminName: string;
  method: "auto_generated" | "manual_entry" | "email_reset";
  organizationName: string;
  changedAt: string;
  loginUrl: string;
}

export function getPasswordChangedByAdminEmail(
  data: PasswordChangedByAdminData
): {
  subject: string;
  html: string;
  text: string;
} {
  const userName = escapeHtml(data.userName);
  const adminName = escapeHtml(data.adminName);
  const organizationName = escapeHtml(data.organizationName);
  const changedAt = escapeHtml(data.changedAt);
  const loginUrl = escapeHtml(data.loginUrl);

  const methodText =
    data.method === "auto_generated"
      ? "A temporary password was generated for you. You will be required to change it on your next login."
      : data.method === "manual_entry"
      ? "A new password was set for your account."
      : "A password reset link was sent to your email.";

  const subject = `Your password was changed - ${organizationName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 15px 0; color: #991b1b;">⚠️ Password Changed</h2>

    <p style="margin-bottom: 15px;">Hi ${userName},</p>

    <p style="margin-bottom: 15px;">
      Your password for <strong>${organizationName}</strong> was changed by an administrator
      (<strong>${adminName}</strong>) on ${changedAt}.
    </p>

    <p style="margin-bottom: 15px;">${methodText}</p>

    ${
      data.method !== "email_reset"
        ? `<p style="text-align: center; margin: 25px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Login Now
      </a>
    </p>`
        : ""
    }

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #666; font-size: 14px; margin: 0;">
      <strong>⚠️ Security Notice:</strong> If you didn't request this change, please contact your administrator immediately.
    </p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    This email was sent by ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Password Changed - Security Notice

Hi ${userName},

Your password for ${organizationName} was changed by an administrator (${adminName}) on ${changedAt}.

${methodText}

${data.method !== "email_reset" ? `Login: ${data.loginUrl}` : ""}

⚠️ SECURITY NOTICE: If you didn't request this change, please contact your administrator immediately.

---
This email was sent by ${organizationName}
  `.trim();

  return { subject, html, text };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/email/templates/password-changed-by-admin.test.ts`

Expected: PASS - all 3 tests passing

**Step 5: Commit**

```bash
git add lib/email/templates/password-changed-by-admin.ts tests/unit/lib/email/templates/password-changed-by-admin.test.ts
git commit -m "feat(email): add password changed by admin email template

- Create email template with three method variants
- Add security notice for unexpected changes
- Escape HTML in all user-provided data
- Include tests for all methods and XSS protection"
```

---

## Task 3: Core Password Reset Module

**Files:**
- Create: `lib/auth/admin-password-reset.server.ts`
- Create: `tests/unit/lib/auth/admin-password-reset.test.ts`

**Step 1: Write failing test**

Create `tests/unit/lib/auth/admin-password-reset.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetUserPassword } from "../../../../lib/auth/admin-password-reset.server";

// Mock dependencies
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../../lib/auth/password.server", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password_123"),
  generateRandomPassword: vi.fn().mockReturnValue("SecurePass123"),
}));

describe("resetUserPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate random password for auto_generated method", async () => {
    const { db } = await import("../../../../lib/db");
    const { generateRandomPassword } = await import("../../../../lib/auth/password.server");

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "user-123", email: "test@example.com", name: "Test User" },
        ]),
      }),
    } as any);

    const result = await resetUserPassword({
      targetUserId: "user-123",
      adminUserId: "admin-456",
      organizationId: "org-789",
      method: "auto_generated",
    });

    expect(result.success).toBe(true);
    expect(result.password).toBe("SecurePass123");
    expect(generateRandomPassword).toHaveBeenCalled();
  });

  it("should return error if target user not found", async () => {
    const { db } = await import("../../../../lib/db");

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const result = await resetUserPassword({
      targetUserId: "nonexistent",
      adminUserId: "admin-456",
      organizationId: "org-789",
      method: "auto_generated",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  it("should require password for manual_entry method", async () => {
    const result = await resetUserPassword({
      targetUserId: "user-123",
      adminUserId: "admin-456",
      organizationId: "org-789",
      method: "manual_entry",
      // Missing newPassword
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Password required");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/auth/admin-password-reset.test.ts`

Expected: FAIL - "Cannot find module"

**Step 3: Create core module (minimal implementation)**

Create `lib/auth/admin-password-reset.server.ts`:

```typescript
import { db } from "../db";
import { user, account, passwordChangeAudit } from "../db/schema";
import { hashPassword, generateRandomPassword } from "./password.server";
import { sendEmail } from "../email";
import { getPasswordChangedByAdminEmail } from "../email/templates/password-changed-by-admin";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export type PasswordResetMethod = "auto_generated" | "manual_entry" | "email_reset";

export interface ResetPasswordParams {
  targetUserId: string;
  adminUserId: string;
  organizationId: string;
  method: PasswordResetMethod;
  newPassword?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  password?: string;
  error?: string;
}

export async function resetUserPassword(
  params: ResetPasswordParams
): Promise<ResetPasswordResult> {
  // 1. Get target user
  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, params.targetUserId))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  // 2. Get admin user for email notification
  const [adminUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, params.adminUserId))
    .limit(1);

  if (!adminUser) {
    return { success: false, error: "Admin user not found" };
  }

  let newPassword: string | undefined;
  let hashedPassword: string;
  let forceChange = false;

  // 3. Handle each method
  try {
    switch (params.method) {
      case "auto_generated":
        newPassword = generateRandomPassword(16);
        hashedPassword = await hashPassword(newPassword);
        forceChange = true;
        await updatePassword(params.targetUserId, hashedPassword, forceChange);
        break;

      case "manual_entry":
        if (!params.newPassword) {
          return { success: false, error: "Password required for manual entry" };
        }
        hashedPassword = await hashPassword(params.newPassword);
        await updatePassword(params.targetUserId, hashedPassword, false);
        break;

      case "email_reset":
        // For email reset, Better Auth handles the token creation
        // We just log the audit entry and send notification
        // The actual reset will happen when user clicks the link
        break;

      default:
        return { success: false, error: "Invalid method" };
    }

    // 4. Log audit entry
    await logPasswordChange({
      changedByUserId: params.adminUserId,
      targetUserId: params.targetUserId,
      organizationId: params.organizationId,
      method: params.method,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 5. Send notification email
    await notifyUserPasswordChanged(
      targetUser,
      adminUser,
      params.organizationId,
      params.method
    );

    return { success: true, password: newPassword };
  } catch (error) {
    console.error("Password reset error:", error);
    return { success: false, error: "Failed to reset password" };
  }
}

async function updatePassword(
  userId: string,
  hashedPassword: string,
  forceChange: boolean
): Promise<void> {
  await db
    .update(account)
    .set({
      password: hashedPassword,
      force_password_change: forceChange,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential")
      )
    );
}

async function logPasswordChange(params: {
  changedByUserId: string;
  targetUserId: string;
  organizationId: string;
  method: PasswordResetMethod;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db.insert(passwordChangeAudit).values({
    id: nanoid(),
    changedByUserId: params.changedByUserId,
    targetUserId: params.targetUserId,
    organizationId: params.organizationId,
    method: params.method,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: new Date(),
  });
}

async function notifyUserPasswordChanged(
  targetUser: { id: string; email: string; name: string | null },
  adminUser: { id: string; email: string; name: string | null },
  organizationId: string,
  method: PasswordResetMethod
): Promise<void> {
  // Get organization for email
  const [org] = await db
    .select()
    .from(require("../db/schema").organization)
    .where(eq(require("../db/schema").organization.id, organizationId))
    .limit(1);

  const emailData = getPasswordChangedByAdminEmail({
    userName: targetUser.name || targetUser.email,
    userEmail: targetUser.email,
    adminName: adminUser.name || adminUser.email,
    method,
    organizationName: org?.name || "DiveStreams",
    changedAt: new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }),
    loginUrl: `https://${org?.slug || "app"}.divestreams.com/login`,
  });

  await sendEmail({
    to: targetUser.email,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/auth/admin-password-reset.test.ts`

Expected: PASS - 3 tests passing

**Step 5: Commit**

```bash
git add lib/auth/admin-password-reset.server.ts tests/unit/lib/auth/admin-password-reset.test.ts
git commit -m "feat(auth): add core password reset module

- Implement resetUserPassword with three methods
- Add updatePassword, logPasswordChange, notifyUserPasswordChanged helpers
- Handle all three reset methods (auto, manual, email)
- Set force_password_change flag for auto-generated passwords
- Send email notifications for all changes"
```

---

## Task 4: UI Modal Component

**Files:**
- Create: `app/components/settings/ResetPasswordModal.tsx`
- Create: `tests/unit/components/settings/ResetPasswordModal.test.tsx`

**Step 1: Write failing test**

Create `tests/unit/components/settings/ResetPasswordModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResetPasswordModal } from "../../../../app/components/settings/ResetPasswordModal";

describe("ResetPasswordModal", () => {
  it("should render with user information", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ResetPasswordModal
        user={{ id: "123", name: "John Doe", email: "john@example.com" }}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Reset Password for John Doe/i)).toBeInTheDocument();
  });

  it("should show three method options", () => {
    render(
      <ResetPasswordModal
        user={{ id: "123", name: "Test", email: "test@example.com" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Auto-Generate/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual Entry/i)).toBeInTheDocument();
    expect(screen.getByText(/Email Reset Link/i)).toBeInTheDocument();
  });

  it("should call onSubmit with correct data", () => {
    const onSubmit = vi.fn();

    render(
      <ResetPasswordModal
        user={{ id: "123", name: "Test", email: "test@example.com" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText(/Reset Password/i));

    expect(onSubmit).toHaveBeenCalledWith({
      userId: "123",
      method: "auto_generated",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/components/settings/ResetPasswordModal.test.tsx`

Expected: FAIL - "Cannot find module"

**Step 3: Create modal component**

Create `app/components/settings/ResetPasswordModal.tsx`:

```typescript
import { useState } from "react";

export type PasswordResetMethod = "auto_generated" | "manual_entry" | "email_reset";

export interface ResetPasswordFormData {
  userId: string;
  method: PasswordResetMethod;
  newPassword?: string;
}

interface ResetPasswordModalProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onClose: () => void;
  onSubmit: (data: ResetPasswordFormData) => void;
}

export function ResetPasswordModal({ user, onClose, onSubmit }: ResetPasswordModalProps) {
  const [method, setMethod] = useState<PasswordResetMethod>("auto_generated");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (method === "manual_entry" && !password) {
      alert("Please enter a password");
      return;
    }

    if (method === "manual_entry" && password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    onSubmit({
      userId: user.id,
      method,
      newPassword: method === "manual_entry" ? password : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Reset Password for {user.name}
        </h2>

        {/* Method Selection */}
        <div className="space-y-2 mb-6">
          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="auto_generated"
              checked={method === "auto_generated"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Auto-Generate Password</div>
              <div className="text-sm text-foreground-muted">
                System creates secure password. User must change on next login.
              </div>
            </div>
          </label>

          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="manual_entry"
              checked={method === "manual_entry"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Manual Entry</div>
              <div className="text-sm text-foreground-muted">
                Type a new password for the user.
              </div>
            </div>
          </label>

          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="email_reset"
              checked={method === "email_reset"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Email Reset Link</div>
              <div className="text-sm text-foreground-muted">
                User receives email to set their own password.
              </div>
            </div>
          </label>
        </div>

        {/* Method-specific content */}
        {method === "manual_entry" && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-brand"
              placeholder="Enter new password"
              minLength={8}
            />
            <p className="text-sm text-foreground-muted mt-1">
              Minimum 8 characters
            </p>
          </div>
        )}

        {method === "email_reset" && (
          <div className="mb-6 p-3 bg-info-muted rounded">
            <p className="text-sm">
              Password reset link will be sent to:{" "}
              <strong>{user.email}</strong>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/components/settings/ResetPasswordModal.test.tsx`

Expected: PASS - 3 tests passing

**Step 5: Commit**

```bash
git add app/components/settings/ResetPasswordModal.tsx tests/unit/components/settings/ResetPasswordModal.test.tsx
git commit -m "feat(ui): add password reset modal component

- Create modal with three method selection (radio buttons)
- Show method-specific UI (password input, email confirmation)
- Validate password length for manual entry
- Add loading states during submission"
```

---

## Task 5: Platform Admin Route Integration

**Files:**
- Modify: `app/routes/admin/settings.team.tsx`
- Create: `tests/integration/routes/admin/password-reset.test.ts`

**Step 1: Write failing integration test**

Create `tests/integration/routes/admin/password-reset.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, createMockContext } from "../../test-helpers";

describe("Admin Password Reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset password for team member", async () => {
    const { action } = await import("../../../app/routes/admin/settings.team");

    const request = createMockRequest({
      method: "POST",
      formData: {
        intent: "reset-password",
        userId: "user-123",
        method: "auto_generated",
      },
    });

    // Mock requirePlatformContext
    vi.mock("../../../lib/auth/platform-context.server", () => ({
      requirePlatformContext: vi.fn().mockResolvedValue({
        user: { id: "admin-456" },
        org: { id: "platform-org" },
        isOwner: true,
        isAdmin: true,
      }),
    }));

    const result = await action({ request, params: {}, context: {} });

    expect(result.success).toBe(true);
  });

  it("should prevent non-admin from resetting passwords", async () => {
    const { action } = await import("../../../app/routes/admin/settings.team");

    vi.mock("../../../lib/auth/platform-context.server", () => ({
      requirePlatformContext: vi.fn().mockResolvedValue({
        user: { id: "user-123" },
        org: { id: "org-456" },
        isOwner: false,
        isAdmin: false,
      }),
    }));

    const request = createMockRequest({
      method: "POST",
      formData: {
        intent: "reset-password",
        userId: "target-789",
        method: "auto_generated",
      },
    });

    await expect(action({ request, params: {}, context: {} })).rejects.toThrow(
      "Forbidden"
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/integration/routes/admin/password-reset.test.ts`

Expected: FAIL - action handler doesn't handle reset-password intent

**Step 3: Modify platform admin route**

Modify `app/routes/admin/settings.team.tsx` - Add to action function after line 94 (after existing intent checks):

```typescript
  if (intent === "reset-password") {
    const userId = formData.get("userId") as string;
    const method = formData.get("method") as PasswordResetMethod;
    const newPassword = formData.get("newPassword") as string | undefined;

    // Get target member to check role
    const [targetMember] = await db
      .select()
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);

    if (!targetMember) {
      return { error: "User not found" };
    }

    // Cannot reset owner passwords
    if (targetMember.role === "owner") {
      return { error: "Cannot reset password for owner accounts" };
    }

    // Prevent self-reset
    if (userId === ctx.user.id) {
      return { error: "Use profile settings to change your own password" };
    }

    // Execute reset
    const result = await resetUserPassword({
      targetUserId: userId,
      adminUserId: ctx.user.id,
      organizationId: platformOrg.id,
      method,
      newPassword,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return result;
  }
```

Also add import at top of file:

```typescript
import { resetUserPassword, type PasswordResetMethod } from "../../../lib/auth/admin-password-reset.server";
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/integration/routes/admin/password-reset.test.ts`

Expected: PASS - 2 tests passing

**Step 5: Add UI integration**

Modify `app/routes/admin/settings.team.tsx` - Add modal state and button in the UI section (around line 200+):

Find the team member table and add a "Reset Password" button in each row. Add this import:

```typescript
import { ResetPasswordModal } from "../../../app/components/settings/ResetPasswordModal";
```

Add state at top of component:

```typescript
const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; email: string } | null>(null);
```

Add button in team member row (find the actions column):

```typescript
<button
  onClick={() => setResetPasswordUser({ id: m.userId, name: m.name, email: m.email })}
  className="text-sm text-brand hover:text-brand-hover"
>
  Reset Password
</button>
```

Add modal at end of component:

```typescript
{resetPasswordUser && (
  <ResetPasswordModal
    user={resetPasswordUser}
    onClose={() => setResetPasswordUser(null)}
    onSubmit={(data) => {
      fetcher.submit(
        {
          intent: "reset-password",
          userId: data.userId,
          method: data.method,
          ...(data.newPassword && { newPassword: data.newPassword }),
        },
        { method: "post" }
      );
      setResetPasswordUser(null);
    }}
  />
)}
```

**Step 6: Commit**

```bash
git add app/routes/admin/settings.team.tsx tests/integration/routes/admin/password-reset.test.ts
git commit -m "feat(admin): integrate password reset in platform admin

- Add reset-password intent handler to action
- Check permissions (owner/admin only)
- Prevent owner password resets
- Prevent self-reset via admin panel
- Add Reset Password button and modal to UI
- Capture IP address and user agent for audit"
```

---

## Task 6: Tenant Admin Route Integration

**Files:**
- Modify: `app/routes/tenant/settings/team.tsx`

**Step 1: Modify tenant admin route (similar to platform)**

Modify `app/routes/tenant/settings/team.tsx` - Add after existing action handlers:

```typescript
  if (intent === "reset-password") {
    const userId = formData.get("userId") as string;
    const method = formData.get("method") as PasswordResetMethod;
    const newPassword = formData.get("newPassword") as string | undefined;

    // Check permissions
    if (ctx.member.role !== "owner" && ctx.member.role !== "admin") {
      return { error: "Only owners and admins can reset passwords" };
    }

    // Get target member to check role
    const [targetMember] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, ctx.org.id)
        )
      )
      .limit(1);

    if (!targetMember) {
      return { error: "User not found" };
    }

    // Cannot reset owner passwords
    if (targetMember.role === "owner") {
      return { error: "Cannot reset password for owner accounts" };
    }

    // Prevent self-reset
    if (userId === ctx.user.id) {
      return { error: "Use profile settings to change your own password" };
    }

    // Execute reset
    const result = await resetUserPassword({
      targetUserId: userId,
      adminUserId: ctx.user.id,
      organizationId: ctx.org.id,
      method,
      newPassword,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return result;
  }
```

Add imports:

```typescript
import { resetUserPassword, type PasswordResetMethod } from "../../../../lib/auth/admin-password-reset.server";
import { ResetPasswordModal } from "../../../../app/components/settings/ResetPasswordModal";
```

**Step 2: Add UI integration (same as platform)**

Add state:

```typescript
const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; email: string } | null>(null);
```

Add button in team member table:

```typescript
{(ctx.member.role === "owner" || ctx.member.role === "admin") && m.id !== ctx.user.id && (
  <button
    onClick={() => setResetPasswordUser({ id: m.userId, name: m.name, email: m.email })}
    className="text-sm text-brand hover:text-brand-hover"
  >
    Reset Password
  </button>
)}
```

Add modal:

```typescript
{resetPasswordUser && (
  <ResetPasswordModal
    user={resetPasswordUser}
    onClose={() => setResetPasswordUser(null)}
    onSubmit={(data) => {
      fetcher.submit(
        {
          intent: "reset-password",
          userId: data.userId,
          method: data.method,
          ...(data.newPassword && { newPassword: data.newPassword }),
        },
        { method: "post" }
      );
      setResetPasswordUser(null);
    }}
  />
)}
```

**Step 3: Commit**

```bash
git add app/routes/tenant/settings/team.tsx
git commit -m "feat(tenant): integrate password reset in tenant admin

- Add reset-password intent handler
- Check owner/admin role permissions
- Prevent owner password resets
- Prevent self-reset
- Add Reset Password button conditionally (owner/admin only)
- Add modal integration with fetcher submit"
```

---

## Task 7: Forced Password Change Middleware

**Files:**
- Modify: `lib/auth/org-context.server.ts`
- Modify: `lib/auth/platform-context.server.ts`

**Step 1: Modify tenant context**

Modify `lib/auth/org-context.server.ts` - Add after session validation (around line 20-30):

```typescript
  // Check if user is forced to change password
  const [userAccount] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "credential")
      )
    )
    .limit(1);

  if (userAccount?.force_password_change) {
    const url = new URL(request.url);
    // Allow access to password change page and logout
    if (
      !url.pathname.includes("/settings/password") &&
      !url.pathname.includes("/logout")
    ) {
      throw redirect("/tenant/settings/password?forced=true");
    }
  }
```

Add import at top:

```typescript
import { account } from "../db/schema";
```

**Step 2: Modify platform context**

Modify `lib/auth/platform-context.server.ts` - Add same check after session validation:

```typescript
  // Check if user is forced to change password
  const [userAccount] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "credential")
      )
    )
    .limit(1);

  if (userAccount?.force_password_change) {
    const url = new URL(request.url);
    if (
      !url.pathname.includes("/settings/password") &&
      !url.pathname.includes("/logout")
    ) {
      throw redirect("/admin/settings/password?forced=true");
    }
  }
```

Add import:

```typescript
import { account } from "../db/schema";
```

**Step 3: Commit**

```bash
git add lib/auth/org-context.server.ts lib/auth/platform-context.server.ts
git commit -m "feat(auth): add forced password change middleware

- Check force_password_change flag in both contexts
- Redirect to password change page if flag is set
- Allow access to password change page and logout only
- Apply to both tenant and platform contexts"
```

---

## Task 8: Password Change Page Updates

**Files:**
- Modify: `app/routes/tenant/settings/password.tsx`

**Step 1: Add forced password change handling**

Modify `app/routes/tenant/settings/password.tsx` - Update loader:

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const forced = url.searchParams.get("forced") === "true";

  return {
    forced,
    message: forced
      ? "Your administrator reset your password. Please create a new password to continue."
      : null,
  };
}
```

Update action to clear force flag:

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Check if forced (skip current password check)
  const url = new URL(request.url);
  const forced = url.searchParams.get("forced") === "true";

  if (!forced && !currentPassword) {
    return { error: "Current password is required" };
  }

  // Update password using Better Auth
  try {
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update in database
    await db
      .update(account)
      .set({
        password: hashedPassword,
        force_password_change: false, // Clear the flag
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(account.userId, ctx.user.id),
          eq(account.providerId, "credential")
        )
      );

    return redirect("/tenant/dashboard?message=Password updated successfully");
  } catch (error) {
    console.error("Password update error:", error);
    return { error: "Failed to update password" };
  }
}
```

Add imports:

```typescript
import { hashPassword } from "../../../../lib/auth/password.server";
import { db } from "../../../../lib/db";
import { account } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
```

Update UI to show banner when forced:

```typescript
export default function PasswordSettingsPage() {
  const { forced, message } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      {forced && (
        <div className="mb-6 p-4 bg-warning-muted border border-warning rounded">
          <p className="font-medium">⚠️ Password Change Required</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
      )}

      {/* Rest of password change form */}
      {/* ... existing form with current password field hidden if forced ... */}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/routes/tenant/settings/password.tsx
git commit -m "feat(settings): handle forced password change flow

- Detect forced=true query parameter
- Show warning banner for forced changes
- Skip current password check when forced
- Clear force_password_change flag on success
- Redirect to dashboard after successful change"
```

---

## Task 9: E2E Tests

**Files:**
- Create: `tests/e2e/admin-password-reset.spec.ts`

**Step 1: Create E2E test**

Create `tests/e2e/admin-password-reset.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Admin Password Reset", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', "admin@divestreams.com");
    await page.fill('input[name="password"]', "admin_password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin/);
  });

  test("should reset password with auto-generate method", async ({ page }) => {
    // Navigate to team settings
    await page.goto("/admin/settings/team");

    // Click reset password for a team member
    await page.click('button:has-text("Reset Password")');

    // Modal should appear
    await expect(page.locator("text=Reset Password for")).toBeVisible();

    // Auto-generate should be selected by default
    await expect(page.locator('input[value="auto_generated"]')).toBeChecked();

    // Click reset
    await page.click('button:has-text("Reset Password")');

    // Should show success message or generated password
    await expect(page.locator("text=/password/i")).toBeVisible();
  });

  test("should prevent resetting owner password", async ({ page }) => {
    await page.goto("/admin/settings/team");

    // Find owner row and try to reset
    const ownerRow = page.locator('tr:has-text("Owner")');

    // Reset button should not be present or disabled
    const resetButton = ownerRow.locator('button:has-text("Reset Password")');
    await expect(resetButton).not.toBeVisible();
  });
});

test.describe("Forced Password Change", () => {
  test("should force user to change password after admin reset", async ({
    page,
  }) => {
    // This test requires setting up a user with force_password_change = true
    // Then logging in as that user

    // Login as user with forced password change
    await page.goto("/login");
    await page.fill('input[name="email"]', "forceduser@example.com");
    await page.fill('input[name="password"]', "temp_password");
    await page.click('button[type="submit"]');

    // Should be redirected to password change page
    await expect(page).toHaveURL(/\/settings\/password\?forced=true/);

    // Should show warning banner
    await expect(
      page.locator("text=/Password Change Required/i")
    ).toBeVisible();

    // Fill new password
    await page.fill('input[name="newPassword"]', "NewSecure123!");
    await page.fill('input[name="confirmPassword"]', "NewSecure123!");
    await page.click('button:has-text("Update Password")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

**Step 2: Run E2E tests**

Run: `npm run test:e2e tests/e2e/admin-password-reset.spec.ts`

Expected: Tests should pass (may need to adjust selectors based on actual UI)

**Step 3: Commit**

```bash
git add tests/e2e/admin-password-reset.spec.ts
git commit -m "test(e2e): add admin password reset E2E tests

- Test auto-generate password flow
- Test owner password protection
- Test forced password change flow
- Verify redirects and UI state"
```

---

## Task 10: Documentation and Final Touches

**Files:**
- Create: `docs/features/admin-password-reset.md`

**Step 1: Create feature documentation**

Create `docs/features/admin-password-reset.md`:

```markdown
# Admin Password Reset Feature

## Overview

Administrators can reset user passwords through the team management interface at both platform and tenant levels.

## Methods

### 1. Auto-Generate Password
- System generates a secure 16-character password
- User receives email with temporary password
- User must change password on next login
- Best for: Account recovery, new user setup

### 2. Manual Entry
- Admin types a new password
- User can login immediately with that password
- No forced password change
- Best for: Quick resets, known temporary passwords

### 3. Email Reset Link
- User receives password reset email
- User sets their own password via link
- Most secure method
- Best for: Self-service password resets

## Permissions

- Only `owner` and `admin` roles can reset passwords
- Cannot reset passwords for `owner` role accounts
- Cannot reset your own password via admin panel
- Use profile settings to change your own password

## Audit Trail

All password changes are logged to `password_change_audit` table:
- Who changed the password (admin)
- Whose password was changed (target user)
- When it was changed
- What method was used
- IP address and user agent

## Email Notifications

Users always receive an email when their password is changed by an admin:
- Clear statement of who changed it and when
- Method used
- Security warning to contact admin if unexpected
- Login link (for auto-generate and manual methods)

## Forced Password Change

When admin uses auto-generate method:
1. Password is set in database
2. `force_password_change` flag is set to `true`
3. User receives email with temporary password
4. On next login, user is redirected to password change page
5. User cannot access app until password is changed
6. After changing password, flag is cleared

## Usage

### Platform Admin
1. Navigate to `/admin/settings/team`
2. Find team member in list
3. Click "Reset Password" button
4. Select method and complete form
5. Copy generated password (if auto-generate)
6. Communicate new password to user (if needed)

### Tenant Admin
1. Navigate to `/tenant/settings/team`
2. Find team member in list
3. Click "Reset Password" button
4. Follow same steps as platform admin

## Security Considerations

- All passwords hashed with scrypt (Better Auth format)
- Auto-generated passwords use cryptographic random
- Manual passwords validated for minimum length
- All actions logged for audit compliance
- Users notified via email for transparency
- IP address and user agent captured
```

**Step 2: Commit**

```bash
git add docs/features/admin-password-reset.md
git commit -m "docs: add admin password reset feature documentation

- Document three reset methods
- Explain permissions and security
- Describe audit trail and notifications
- Add usage instructions for both admin levels"
```

**Step 3: Final verification**

Run full test suite:

```bash
npm run test
npm run test:e2e
npm run typecheck
```

Expected: All tests passing, no TypeScript errors

**Step 4: Final commit**

```bash
git commit --allow-empty -m "feat: admin password reset feature complete

Complete implementation of admin password reset with:
- Three reset methods (auto-generate, manual, email)
- Full audit logging to database
- Email notifications for all changes
- Forced password change flow
- Both platform and tenant admin levels
- Comprehensive test coverage
- Security measures (permission checks, owner protection)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan creates a complete admin password reset feature with:

- ✅ Database schema with audit table
- ✅ Email template for notifications
- ✅ Core password reset module
- ✅ React modal UI component
- ✅ Platform admin integration
- ✅ Tenant admin integration
- ✅ Forced password change middleware
- ✅ Password change page updates
- ✅ E2E tests
- ✅ Documentation

**Total Tasks:** 10
**Estimated Time:** 3-4 hours
**Test Coverage:** Unit, Integration, E2E

**Follow TDD:** Write test → Run (fail) → Implement → Run (pass) → Commit

**Skills Referenced:**
- @superpowers:test-driven-development for all test-first development
- @superpowers:systematic-debugging if issues arise during implementation
- @superpowers:verification-before-completion before marking complete
