#!/usr/bin/env node
/**
 * Fix import paths for redirect helper based on file depth
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

// Find all test files with the redirect import
const files = await glob("tests/integration/routes/tenant/**/*.test.ts");

let fixed = 0;

for (const file of files) {
  let content = readFileSync(file, "utf-8");

  // Check if file has the redirect import
  if (!content.includes("getRedirectPathname")) {
    continue;
  }

  // Calculate correct relative path based on directory depth
  // File path format: tests/integration/routes/tenant/.../file.test.ts
  const parts = file.split("/");
  const tenantIndex = parts.indexOf("tenant");
  const depth = parts.length - tenantIndex - 1; // Depth from tenant directory

  // Calculate correct path: go up to tests directory, then to helpers
  // From tenant: ../../helpers
  // From tenant/boats: ../../../helpers
  // From tenant/boats/$id: ../../../../helpers
  // From tenant/boats/$id/edit: ../../../../../helpers
  const upLevels = depth + 2; // +2 for 'routes' and 'integration'
  const correctPath = "../".repeat(upLevels) + "helpers/redirect";

  // Replace existing import path
  const oldPattern = /from ["']\.\..*helpers\/redirect["']/;
  const newImport = `from "${correctPath}"`;

  if (oldPattern.test(content)) {
    const newContent = content.replace(oldPattern, newImport);

    if (newContent !== content) {
      writeFileSync(file, newContent, "utf-8");
      fixed++;
      console.log(`✓ Fixed ${file} (depth ${depth}, path ${correctPath})`);
    }
  }
}

console.log(`\n✅ Fixed ${fixed} files`);
