# Admin Password Reset Feature - Design Document

**Date:** 2026-02-01
**Status:** Approved
**Scope:** Both Platform Admin and Tenant Admin levels

## Overview

Add the ability for administrators to reset user passwords through the admin panel. Supports three password reset methods with full audit logging and email notifications.

## Requirements

### Functional Requirements

1. **Multi-level Access**
   - Platform admins can reset passwords for platform team members
   - Tenant admins can reset passwords for their team members

2. **Three Reset Methods**
   - **Auto-generate:** System creates secure random password, forces user to change on next login
   - **Manual entry:** Admin types new password with strength validation
   - **Email reset link:** User receives password reset email and sets their own password

3. **Security & Permissions**
   - Only `owner` and `admin` roles can reset passwords
   - Cannot reset passwords for `owner` role accounts (protection)
   - Cannot reset own password via admin panel (use profile settings)
   - All password changes logged to audit table
   - User always notified via email when password is changed

4. **Forced Password Change**
   - Auto-generated passwords require user to change on next login
   - User redirected to password change page until completed

### Non-Functional Requirements

- Audit trail must be queryable for compliance
- Email notifications sent within 5 seconds of password change
- Password generation uses cryptographically secure random
- Hashing uses scrypt (Better Auth compatible format)

## Database Schema

### New Table: `password_change_audit`

```sql
CREATE TABLE password_change_audit (
  id TEXT PRIMARY KEY,
  changed_by_user_id TEXT NOT NULL REFERENCES user(id),
  target_user_id TEXT NOT NULL REFERENCES user(id),
  organization_id TEXT NOT NULL REFERENCES organization(id),
  method TEXT NOT NULL, -- 'auto_generated', 'manual_entry', 'email_reset'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_audit_target ON password_change_audit(target_user_id);
CREATE INDEX idx_password_audit_changed_by ON password_change_audit(changed_by_user_id);
CREATE INDEX idx_password_audit_org ON password_change_audit(organization_id);
```

### Schema Modification: `account` table

```sql
ALTER TABLE account ADD COLUMN force_password_change BOOLEAN DEFAULT FALSE;
```

## Server-Side Architecture

### Core Module: `lib/auth/admin-password-reset.server.ts`

```typescript
export type PasswordResetMethod = 'auto_generated' | 'manual_entry' | 'email_reset';

export async function resetUserPassword(params: {
  targetUserId: string;
  adminUserId: string;
  organizationId: string;
  method: PasswordResetMethod;
  newPassword?: string; // Required for 'manual_entry'
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; password?: string; error?: string }>
```

**Flow:**

1. Validate target user exists
2. Execute method-specific logic:
   - **Auto-generate:** Create random password, hash, set `force_password_change = true`
   - **Manual entry:** Validate strength, hash, update password
   - **Email reset:** Create verification token, send reset email
3. Log audit entry with all metadata
4. Send notification email to user
5. Return result (with generated password if applicable)

### Helper Functions

```typescript
async function updatePassword(
  userId: string,
  hashedPassword: string,
  forceChange: boolean
): Promise<void>

async function logPasswordChange(params: AuditParams): Promise<void>

async function notifyUserPasswordChanged(
  user: User,
  adminUserId: string,
  method: PasswordResetMethod
): Promise<void>

async function createPasswordResetToken(email: string): Promise<string>
```

## UI Components

### Component: `app/components/settings/ResetPasswordModal.tsx`

**Props:**
```typescript
{
  user: { id: string; name: string; email: string };
  onClose: () => void;
  onSubmit: (data: ResetPasswordFormData) => void;
}
```

**Features:**
- Tab/radio selection between three methods
- Auto-generate: Shows generated password with copy button
- Manual entry: Password input with strength indicator
- Email reset: Shows confirmation message with recipient email
- Validation before submission
- Loading states during submission

## Route Integration

### Platform Admin: `app/routes/admin/settings.team.tsx`

**Action Handler:**

```typescript
if (intent === "reset-password") {
  // Permission check
  if (!ctx.isOwner && !ctx.isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  // Validate target is not owner
  const targetMember = await getTargetMember(targetUserId);
  if (targetMember?.role === 'owner') {
    return { error: "Cannot reset password for owner accounts" };
  }

  // Prevent self-reset
  if (targetUserId === ctx.user.id) {
    return { error: "Use profile settings to change your own password" };
  }

  // Execute reset
  const result = await resetUserPassword({...});
  return result;
}
```

### Tenant Admin: `app/routes/tenant/settings/team.tsx`

Identical implementation using `requireOrgContext` instead of `requirePlatformContext`.

## Forced Password Change Flow

### Middleware Check

In `lib/auth/org-context.server.ts` and `platform-context.server.ts`:

```typescript
// After session validation
const [userAccount] = await db
  .select()
  .from(account)
  .where(and(
    eq(account.userId, session.user.id),
    eq(account.providerId, 'credential')
  ))
  .limit(1);

if (userAccount?.force_password_change) {
  const url = new URL(request.url);
  if (!url.pathname.includes('/settings/password')) {
    throw redirect('/tenant/settings/password?forced=true');
  }
}
```

### Password Change Page

`app/routes/tenant/settings/password.tsx`:

- Detect `?forced=true` query parameter
- Show banner: "Your administrator reset your password. Please create a new password."
- Validate new password meets strength requirements
- Clear `force_password_change` flag on successful change
- Redirect to dashboard with success message

## Email Notifications

### Template: `lib/email/templates/password-changed-by-admin.ts`

**Subject:** `Your password was changed - {organizationName}`

**Content:**
- Clear statement: password was changed by admin
- Admin name and timestamp
- Method used (auto-generated, manual, or email reset)
- Login link (for auto-generate and manual methods)
- Security warning: contact admin if unexpected

**Data Structure:**
```typescript
interface PasswordChangedByAdminData {
  userName: string;
  userEmail: string;
  adminName: string;
  method: 'auto_generated' | 'manual_entry' | 'email_reset';
  organizationName: string;
  changedAt: string;
  loginUrl: string;
}
```

## Security Measures

### Permission Checks
- ✓ Only `owner` and `admin` roles allowed
- ✓ Cannot reset owner passwords (escalation protection)
- ✓ Cannot reset own password via admin panel
- ✓ Route-level enforcement before action execution

### Audit Trail
- ✓ All password changes logged with metadata
- ✓ IP address and user agent captured
- ✓ Queryable database table (not just logs)
- ✓ Links admin and target user for accountability

### User Protection
- ✓ Email notification always sent
- ✓ Force password change for auto-generated passwords
- ✓ Password strength validation for manual entry
- ✓ Transparent communication (who, when, how)

### Password Security
- ✓ Uses existing scrypt hashing (Better Auth format)
- ✓ Auto-generated passwords use cryptographic random (16 chars, no ambiguous chars)
- ✓ Manual passwords validated for minimum strength
- ✓ Reset tokens use Better Auth verification table

## Implementation Checklist

### Files to Create

- [ ] `lib/auth/admin-password-reset.server.ts` - Core logic
- [ ] `lib/email/templates/password-changed-by-admin.ts` - Email template
- [ ] `app/components/settings/ResetPasswordModal.tsx` - UI modal
- [ ] `drizzle/XXXX_add_password_audit.sql` - Migration
- [ ] `lib/db/schema/password-audit.ts` - Drizzle schema
- [ ] `tests/unit/lib/auth/admin-password-reset.test.ts` - Unit tests
- [ ] `tests/integration/routes/admin/password-reset.test.ts` - Integration tests
- [ ] `tests/e2e/admin-password-reset.spec.ts` - E2E tests

### Files to Modify

- [ ] `app/routes/admin/settings.team.tsx` - Add reset action
- [ ] `app/routes/tenant/settings/team.tsx` - Add reset action
- [ ] `lib/auth/org-context.server.ts` - Add forced password check
- [ ] `lib/auth/platform-context.server.ts` - Add forced password check
- [ ] `app/routes/tenant/settings/password.tsx` - Handle forced changes

### Testing Strategy

**Unit Tests:**
- `resetUserPassword()` with all three methods
- Permission validation logic
- Password generation and hashing
- Audit log entry creation

**Integration Tests:**
- Route action handlers (both levels)
- Owner password protection
- Self-reset prevention
- Email notification sending
- Database transactions (password + audit + flag)

**E2E Tests:**
- Complete flow: admin login → reset password → user receives email
- Forced password change: user login → redirected → change password → access granted
- All three methods in real browser environment

## Edge Cases & Error Handling

1. **Target user not found:** Return error before any mutations
2. **Network failure during email send:** Password still changed, log error, show warning to admin
3. **User has no email:** Prevent email reset method, show error
4. **Concurrent password changes:** Last write wins, audit log shows both
5. **Token expiration (email reset):** Standard 1-hour expiry, handled by Better Auth
6. **User deletes account before password change:** Cascade delete audit logs

## Future Enhancements (Out of Scope)

- Admin UI to view password change history
- Bulk password reset for multiple users
- Configurable password policies per tenant
- Two-factor authentication before admin password reset
- Temporary access grants (time-limited passwords)

## Success Metrics

- Zero security incidents related to password resets
- Admin satisfaction with flexibility (3 methods)
- User awareness of password changes (email delivery rate)
- Audit compliance for security reviews
