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
