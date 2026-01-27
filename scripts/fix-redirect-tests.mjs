#!/usr/bin/env node
/**
 * Fix redirect assertions in integration tests
 *
 * Updates test files to use getRedirectPathname() helper for redirect assertions
 * so they work with toast notification query parameters.
 */

import { readFileSync, writeFileSync } from "fs";
import { relative, dirname } from "path";
import { glob } from "glob";

function getHelperImportPath(testFilePath) {
  // Calculate relative path from test file to tests/helpers/redirect.ts
  // Count how many directories deep the test file is under tests/
  const parts = testFilePath.split("/");
  const testsIndex = parts.indexOf("tests");
  const depth = parts.length - testsIndex - 2; // -2 for "tests" itself and the filename

  // Build relative path: go up 'depth' levels, then to helpers/redirect
  const upLevels = "../".repeat(depth);
  return `import { getRedirectPathname } from "${upLevels}helpers/redirect";`;
}

// Find all integration test files in tenant routes
const files = await glob("tests/integration/routes/tenant/**/*.test.ts");

let filesUpdated = 0;
let assertionsFixed = 0;

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  let modified = false;
  const helperImport = getHelperImportPath(file);

  // Remove old incorrect import if exists
  if (content.includes("getRedirectPathname")) {
    content = content.replace(/import \{ getRedirectPathname \} from ["']\.\.\/.*helpers\/redirect["'];?\n?/g, "");
  }

  // Add correct import after vitest imports
  if (!content.includes("getRedirectPathname")) {
    const lines = content.split("\n");
    const vitestImportIndex = lines.findIndex((line) => line.includes('from "vitest"'));

    if (vitestImportIndex !== -1) {
      // Insert after last vitest import
      let insertIndex = vitestImportIndex + 1;
      // Skip any other vitest imports
      while (insertIndex < lines.length && lines[insertIndex].includes("vitest")) {
        insertIndex++;
      }

      lines.splice(insertIndex, 0, helperImport);
      content = lines.join("\n");
      modified = true;
    }
  }

  // Fix redirect assertions: wrap location getter with getRedirectPathname()
  // Pattern: expect(result.headers.get("Location")).toBe("/path")
  // Also: expect((response as Response).headers.get("location")).toBe("/path")

  let newContent = content;

  // Pattern 1: result.headers.get("Location") or result.headers.get("location")
  const pattern1 = /expect\((result\.headers\.get\("(?:Location|location)"\))\)\.toBe\(/g;
  newContent = newContent.replace(pattern1, (match, locationGetter) => {
    assertionsFixed++;
    return `expect(getRedirectPathname(${locationGetter})).toBe(`;
  });

  // Pattern 2: (response as Response).headers.get("location")
  const pattern2 = /expect\((\(response as Response\)\.headers\.get\("(?:Location|location)"\))\)\.toBe\(/g;
  newContent = newContent.replace(pattern2, (match, locationGetter) => {
    assertionsFixed++;
    return `expect(getRedirectPathname(${locationGetter})).toBe(`;
  });

  // Pattern 3: response.headers.get("location") without cast
  const pattern3 = /expect\((response\.headers\.get\("(?:Location|location)"\))\)\.toBe\(/g;
  newContent = newContent.replace(pattern3, (match, locationGetter) => {
    assertionsFixed++;
    return `expect(getRedirectPathname(${locationGetter})).toBe(`;
  });

  if (newContent !== content) {
    content = newContent;
    modified = true;
  }

  if (modified) {
    writeFileSync(file, content, "utf-8");
    filesUpdated++;
    console.log(`✓ Fixed ${file}`);
  }
}

console.log(`\n✅ Updated ${filesUpdated} files, fixed ${assertionsFixed} assertions`);
