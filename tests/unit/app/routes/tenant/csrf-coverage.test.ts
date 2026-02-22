/**
 * CSRF Coverage Test (Static Analysis)
 *
 * This test prevents the regression where CSRF enforcement was enabled
 * (commit 94ea4a0) but 53 POST forms were not updated to include the
 * CSRF token, causing 403 Forbidden on every authenticated form submit.
 *
 * What it checks:
 * - Every .tsx file under app/routes/tenant/ that contains a POST form
 *   (<form method="post" or <Form method="post") must also include
 *   <CsrfInput or {CSRF_FIELD_NAME} to supply the token.
 *
 * Files excluded from the check:
 * - Login/signup/forgot-password/reset-password: use anon CSRF or no
 *   requireOrgContext, so the standard CsrfInput is not required.
 * - layout.tsx: provides the token to children, does not consume it.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const PROJECT_ROOT = join(__dirname, "../../../../../");
const ROUTES_DIR = join(PROJECT_ROOT, "app/routes/tenant");

// Files where POST forms intentionally don't need CsrfInput
const EXCLUDED_FILES = new Set([
  "login.tsx",
  "signup.tsx",
  "forgot-password.tsx",
  "reset-password.tsx",
  "layout.tsx",
]);

/** Recursively collect all .tsx files under a directory */
function collectTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
    } else if (entry.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Check if a file has a POST form */
function hasPostForm(content: string): boolean {
  return /method=["']post["']/i.test(content);
}

/** Check if a file includes a CSRF token in some form */
function hasCsrfToken(content: string): boolean {
  return (
    content.includes("<CsrfInput") ||
    content.includes("CsrfInput />") ||
    content.includes("CsrfTokenInput") ||
    content.includes("CSRF_FIELD_NAME") ||
    content.includes('name="_csrf"') ||
    content.includes("name={CSRF_FIELD_NAME}")
  );
}

describe("CSRF Coverage: all POST forms must include a CSRF token", () => {
  const allFiles = collectTsxFiles(ROUTES_DIR);

  const violations: string[] = [];

  for (const filePath of allFiles) {
    const fileName = filePath.split("/").pop() ?? "";
    if (EXCLUDED_FILES.has(fileName)) continue;

    const content = readFileSync(filePath, "utf8");
    if (hasPostForm(content) && !hasCsrfToken(content)) {
      violations.push(relative(PROJECT_ROOT, filePath));
    }
  }

  it("no tenant POST forms are missing a CSRF token", () => {
    expect(violations).toEqual([]);

    if (violations.length > 0) {
      console.error(
        "\nForms missing <CsrfInput />:\n" +
          violations.map((f) => `  - ${f}`).join("\n") +
          "\n\nAdd <CsrfInput /> as the first child of each <form method=\"post\"> element." +
          "\nSee app/components/CsrfInput.tsx for usage."
      );
    }
  });

  it("CsrfInput component file exists", () => {
    const csrfComponentPath = join(PROJECT_ROOT, "app/components/CsrfInput.tsx");
    expect(() => readFileSync(csrfComponentPath)).not.toThrow();
  });
});
