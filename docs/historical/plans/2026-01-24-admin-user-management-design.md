# Admin User Management Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add password reset and email change capabilities for tenant users in the admin panel.

**Architecture:** Extend existing `tenants.$id.tsx` page with modals for password reset and email change. Use Better Auth's scrypt hashing for passwords.

**Tech Stack:** React Router actions, Better Auth scrypt hashing, React state for modals

---

## Overview

Platform admins need to help tenant users who:
- Are locked out and can't reset password via email
- Need initial credentials during onboarding
- Typo'd their email during signup
- May have compromised accounts requiring password reset

## Location

Extend `app/routes/admin/tenants.$id.tsx` - the existing tenant detail page that already shows members.

## Password Reset

Three options available in a modal:

### Option 1: Set Specific Password
- Admin types a password (min 8 chars)
- System hashes with scrypt (N=16384, r=16, p=1, dkLen=64)
- Updates `account.password` directly
- Admin shares password with user via phone/chat

### Option 2: Generate Random Password
- System generates 16-char alphanumeric password
- Displayed in copyable field
- Admin copies and shares with user
- Same hashing process as Option 1

### Option 3: Send Reset Link
- Uses Better Auth's existing `auth.api.forgetPassword` flow
- Triggers password reset email to user
- User handles reset themselves
- Admin doesn't see any password

## Email Change

Simple direct update:
- Admin enters new email address
- Validation: valid email format, not already in use
- Updates `user.email` directly
- No verification required (admin has full control)

## Action Handlers

```typescript
// Password reset
intent: "resetPassword"
userId: string
method: "set" | "generate" | "sendLink"
password?: string  // only for "set" method

// Email change
intent: "changeEmail"
userId: string
newEmail: string
```

## UI Components

### Member Row (enhanced)
```
[Avatar] [Name/Email] [Role Badge] [Manage ▾] [Remove]
```

Manage dropdown:
- Reset Password
- Change Email

### Reset Password Modal
```
┌─────────────────────────────────────────┐
│  Reset Password for john@example.com    │
├─────────────────────────────────────────┤
│  ○ Set specific password                │
│    [________________] [Reset]           │
│                                         │
│  ○ Generate random password             │
│    [Generate & Copy]                    │
│    Generated: ████████████████ [📋]     │
│                                         │
│  ○ Send reset link via email            │
│    [Send Reset Email]                   │
│                                         │
│                          [Cancel]       │
└─────────────────────────────────────────┘
```

### Change Email Modal
```
┌─────────────────────────────────────────┐
│  Change Email                           │
├─────────────────────────────────────────┤
│  Current: john@example.com              │
│  New email: [____________________]      │
│                                         │
│              [Cancel] [Update Email]    │
└─────────────────────────────────────────┘
```

## Error Handling

- Invalid password (too short): "Password must be at least 8 characters"
- Invalid email format: "Please enter a valid email address"
- Duplicate email: "Email already in use by another account"
- Send reset failed: "Failed to send reset email. Check user's email address."

## Security Considerations

- Only platform admins can access (already enforced by `requirePlatformContext`)
- Generated passwords use crypto.randomBytes for security
- Passwords never logged or stored in plaintext
- No audit logging (per user request - keep simple)

## Implementation Tasks

### Task 1: Add Password Hashing Utility
- Create `lib/auth/password.server.ts`
- Export `hashPassword(password: string): Promise<string>`
- Use scrypt with Better Auth params

### Task 2: Add Action Handlers
- Add `resetPassword` intent handler
- Add `changeEmail` intent handler
- Add `generateRandomPassword` helper

### Task 3: Add UI Components
- Add modal state management
- Create ResetPasswordModal component
- Create ChangeEmailModal component
- Add Manage dropdown to member rows

### Task 4: Manual Testing
- Test all three password reset methods
- Test email change with valid/invalid/duplicate emails
- Verify user can log in with new credentials
