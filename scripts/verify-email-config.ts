#!/usr/bin/env tsx
/**
 * Verify Email Configuration
 *
 * Checks if SMTP is configured and can connect successfully.
 * Run this on app startup or manually to diagnose email issues.
 */

import "dotenv/config";
import { verifyEmailConnection, isEmailConfigured } from "../lib/email/index";

async function main() {
  console.log("\n📧 Email Configuration Verification\n");
  console.log("═".repeat(60));

  // Check if configured
  const configured = isEmailConfigured();
  console.log(`\nConfiguration Status: ${configured ? "✅ CONFIGURED" : "❌ NOT CONFIGURED"}`);

  if (!configured) {
    console.log("\n❌ Missing required environment variables:");
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || "(not set)"}`);
    console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || "(not set)"}`);
    console.log(`   SMTP_USER: ${process.env.SMTP_USER || "(not set)"}`);
    console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? "***" : "(not set)"}`);
    console.log(`   SMTP_FROM: ${process.env.SMTP_FROM || "(not set)"}`);
    console.log("\n⚠️  Emails will NOT be sent until SMTP is configured!\n");
    process.exit(1);
  }

  // Test connection
  console.log("\nTesting SMTP connection...");
  const result = await verifyEmailConnection();

  if (result.success) {
    console.log("✅ SMTP connection successful!\n");
    console.log("Configuration:");
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log(`   From: ${process.env.SMTP_FROM}`);
    console.log("\n✅ Email service is ready to send emails\n");
    console.log("═".repeat(60));
    process.exit(0);
  } else {
    console.log(`❌ SMTP connection failed: ${result.error}\n`);
    console.log("Configuration:");
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log("\nPossible issues:");
    console.log("   - SMTP credentials are incorrect");
    console.log("   - SMTP host/port is wrong");
    console.log("   - Firewall blocking connection");
    console.log("   - SMTP service is down");
    console.log("\n⚠️  Emails will NOT be sent until this is resolved!\n");
    console.log("═".repeat(60));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
