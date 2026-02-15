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
