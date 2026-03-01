#!/usr/bin/env tsx
/**
 * Directory Structure Validator
 *
 * Enforces the directory structure policy defined in DIRECTORY_STRUCTURE_POLICY.md
 *
 * Usage:
 *   npm run validate:structure          # Check only
 *   npm run validate:structure --fix    # Auto-fix violations
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');

// Allowed files in root directory (from policy)
const ALLOWED_ROOT_FILES = new Set([
  // Config files
  '.dockerignore',
  '.env.example',
  '.env.pact-broker.example',
  '.gitattributes',
  '.gitignore',
  '.coverage-config.json',
  '.mcp.json',
  '.mcp.json.example',
  '.nycrc.json',
  '.vibe-issue-mapping.json',
  '.pactrc',
  '.prettierrc',
  'drizzle.config.ts',
  'eslint.config.js',
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'react-router.config.ts',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',

  // Caddy files
  'Caddyfile',
  'Caddyfile.dev',
  'Caddyfile.test',
  'Caddyfile.pact',

  // Docker files
  'Dockerfile',
  'Dockerfile.caddy',

  // Essential docs
  'README.md',
  'CLAUDE.md',
  'DIRECTORY_STRUCTURE_POLICY.md',

  // Temporary/generated (warn but allow)
  'plan.md',
  'coverage-summary.json',


]);

// Allowed directories in root
const ALLOWED_ROOT_DIRS = new Set([
  '.beads',
  '.claude',
  '.git',
  '.github',
  'app',
  'docs',
  'drizzle',
  'lib',
  'node_modules',
  'pacts',
  'playwright-report',
  'public',
  'scripts',
  'tests',
  'tools',
  'zapier-app',
  'deployment',
  'schemas',
  'build',
  '.cache',
  '.react-router',
  'coverage',
]);

// Files that match these patterns are allowed in root
const ALLOWED_ROOT_PATTERNS = [
  /^docker-compose.*\.yml$/,  // All docker-compose variants
  /^\.env(\..*)?$/,            // .env files
];

interface ValidationResult {
  valid: boolean;
  violations: {
    rootClutter: string[];
    shouldBeInDocs: string[];
    namingIssues: string[];
  };
}

/**
 * Check if a filename violates kebab-case convention
 */
function isValidKebabCase(filename: string): boolean {
  // Exceptions: Standard files, config files, generated files
  // Standard files and config files with non-kebab naming conventions
  if (/^(README|CLAUDE|DIRECTORY_STRUCTURE_POLICY)\.md$/.test(filename)) return true;
  if (/^Caddyfile(\..+)?$/.test(filename)) return true;
  if (/^Dockerfile(\..+)?$/.test(filename)) return true;
  if (filename.startsWith('.')) return true; // Hidden files exempt
  if (filename.includes('.')) {
    const nameWithoutExt = filename.split('.')[0];
    // Check if name part is kebab-case or all lowercase
    return /^[a-z0-9-]+$/.test(nameWithoutExt);
  }
  return /^[a-z0-9-]+$/.test(filename);
}

/**
 * Check if file should be in docs/ instead of root
 */
function shouldBeInDocs(filename: string): boolean {
  if (!filename.endsWith('.md')) return false;

  const allowedMdFiles = [
    'README.md', 'CLAUDE.md', 'DIRECTORY_STRUCTURE_POLICY.md', 'plan.md',
    'DIRECTORY_CLEANUP_SUMMARY.md', 'CLEANUP_EXECUTION_CHECKLIST.md',
  ];
  if (allowedMdFiles.includes(filename)) return false;

  // Check if it's a guide, report, or documentation
  const docsKeywords = [
    'GUIDE', 'SUMMARY', 'REPORT', 'PLAN', 'CHECKLIST', 'SETUP',
    'IMPLEMENTATION', 'DEPLOYMENT', 'VERIFICATION', 'TESTING',
    'INTEGRATION', 'FIX', 'PEER_REVIEW', 'SESSION', 'ANALYSIS',
  ];

  const upperFilename = filename.toUpperCase();
  return docsKeywords.some(keyword => upperFilename.includes(keyword));
}

/**
 * Validate root directory structure
 */
function validateRootDirectory(): ValidationResult {
  const violations = {
    rootClutter: [] as string[],
    shouldBeInDocs: [] as string[],
    namingIssues: [] as string[],
  };

  const entries = readdirSync(ROOT_DIR);

  for (const entry of entries) {
    const fullPath = join(ROOT_DIR, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Check directory names
      if (!ALLOWED_ROOT_DIRS.has(entry)) {
        violations.rootClutter.push(`Unexpected directory: ${entry}/`);
      }
    } else if (stat.isFile()) {
      // .git can be a file in worktree setups — treat it like a directory
      if (entry === '.git') {
        if (!ALLOWED_ROOT_DIRS.has(entry)) {
          violations.rootClutter.push(`Unexpected entry: ${entry}`);
        }
        continue;
      }

      // Check file names
      let allowed = ALLOWED_ROOT_FILES.has(entry);

      // Check patterns
      if (!allowed) {
        allowed = ALLOWED_ROOT_PATTERNS.some(pattern => pattern.test(entry));
      }

      if (!allowed) {
        violations.rootClutter.push(`Unexpected file: ${entry}`);
      }

      // Check if should be in docs/
      if (shouldBeInDocs(entry)) {
        violations.shouldBeInDocs.push(entry);
      }

      // Check naming convention
      if (!isValidKebabCase(entry)) {
        violations.namingIssues.push(`${entry} (should use kebab-case)`);
      }
    }
  }

  return {
    valid: violations.rootClutter.length === 0 &&
           violations.shouldBeInDocs.length === 0 &&
           violations.namingIssues.length === 0,
    violations,
  };
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 Validating directory structure...\n');

  const result = validateRootDirectory();

  if (result.valid) {
    console.log('✅ Directory structure is valid!\n');
    process.exit(0);
  }

  console.log('❌ Directory structure violations found:\n');

  if (result.violations.rootClutter.length > 0) {
    console.log('📁 Root Directory Clutter:');
    result.violations.rootClutter.forEach(v => console.log(`   - ${v}`));
    console.log('');
  }

  if (result.violations.shouldBeInDocs.length > 0) {
    console.log('📄 Files that should be in docs/:');
    result.violations.shouldBeInDocs.forEach(v => console.log(`   - ${v} → docs/`));
    console.log('');
  }

  if (result.violations.namingIssues.length > 0) {
    console.log('🔤 Naming Convention Violations:');
    result.violations.namingIssues.forEach(v => console.log(`   - ${v}`));
    console.log('');
  }

  console.log('📖 See DIRECTORY_STRUCTURE_POLICY.md for details\n');

  const totalViolations =
    result.violations.rootClutter.length +
    result.violations.shouldBeInDocs.length +
    result.violations.namingIssues.length;

  console.log(`Total violations: ${totalViolations}\n`);
  process.exit(1);
}

main();
