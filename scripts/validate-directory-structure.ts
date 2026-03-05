#!/usr/bin/env tsx
/**
 * Directory Structure Validator
 *
 * Enforces the directory structure policy defined in docs/policies/directory-structure-policy.md
 *
 * Usage:
 *   npm run validate:structure              # Check with warnings
 *   npm run validate:structure -- --strict  # Exit non-zero on any violation (CI mode)
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = join(import.meta.dirname, '..');
const STRICT = process.argv.includes('--strict');

// Build a set of gitignored entries to skip
function getGitignored(): Set<string> {
  try {
    const output = execSync('git ls-files --others --ignored --exclude-standard --directory', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });
    const entries = new Set<string>();
    for (const line of output.trim().split('\n')) {
      if (!line) continue;
      // git returns "dir/" for directories, strip trailing slash and take first component
      const top = line.replace(/\/$/, '').split('/')[0];
      entries.add(top);
    }
    return entries;
  } catch {
    return new Set();
  }
}

// Allowed files in root directory (from policy)
const ALLOWED_ROOT_FILES = new Set([
  '.dockerignore',
  '.env.example',
  '.env.pact-broker.example',
  '.gitattributes',
  '.gitignore',
  '.coverage-config.json',
  '.mcp.json',
  '.mcp.json.example',
  '.nycrc.json',
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

  'Caddyfile',
  'Caddyfile.dev',
  'Caddyfile.test',
  'Caddyfile.pact',

  'Dockerfile',
  'Dockerfile.caddy',

  'README.md',
  'CLAUDE.md',
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
  'orchestrator',
  'pacts',
  'playwright-report',
  'public',
  'scripts',
  'tests',
  'terraform',
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
  /^docker-compose.*\.yml$/,
  /^\.env(\..*)?$/,
];

// Standard files exempt from kebab-case check
const KEBAB_CASE_EXEMPT = new Set([
  'README.md',
  'CLAUDE.md',
  'LICENSE',
]);

const KEBAB_CASE_EXEMPT_PATTERNS = [
  /^Caddyfile(\..+)?$/,
  /^Dockerfile(\..+)?$/,
  /^docker-compose.*\.yml$/,
  /^\..+/,                     // Hidden/dotfiles
  /^[a-z0-9-]+\.config\.[a-z]+$/,  // Config files like vite.config.ts
];

const HISTORICAL_FILE_LIMIT = 30;

interface Violations {
  errors: string[];
  warnings: string[];
}

function isKebabCase(filename: string): boolean {
  if (KEBAB_CASE_EXEMPT.has(filename)) return true;
  if (KEBAB_CASE_EXEMPT_PATTERNS.some(p => p.test(filename))) return true;

  // Strip all extensions to get the base name
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return /^[a-z0-9][a-z0-9-]*$/.test(nameWithoutExt);
}

function isKebabCaseDoc(filename: string): boolean {
  if (filename === 'README.md') return true;
  if (filename.startsWith('.')) return true;

  // Allow issue-prefixed names like kan-624-xxx.md (lowercase)
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return /^[a-z0-9][a-z0-9-]*$/.test(nameWithoutExt);
}

function shouldBeInDocs(filename: string): boolean {
  if (!filename.endsWith('.md')) return false;
  const allowed = ['README.md', 'CLAUDE.md'];
  if (allowed.includes(filename)) return false;

  const docsKeywords = [
    'GUIDE', 'SUMMARY', 'REPORT', 'PLAN', 'CHECKLIST', 'SETUP',
    'IMPLEMENTATION', 'DEPLOYMENT', 'VERIFICATION', 'TESTING',
    'INTEGRATION', 'FIX', 'PEER_REVIEW', 'SESSION', 'ANALYSIS',
  ];
  const upper = filename.toUpperCase();
  return docsKeywords.some(k => upper.includes(k));
}

function validateRootDirectory(violations: Violations, gitignored: Set<string>): void {
  const entries = readdirSync(ROOT_DIR);

  for (const entry of entries) {
    // Skip gitignored entries
    if (gitignored.has(entry)) continue;

    const fullPath = join(ROOT_DIR, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ALLOWED_ROOT_DIRS.has(entry)) {
        violations.errors.push(`Root: unexpected directory '${entry}/'`);
      }
    } else if (stat.isFile()) {
      if (entry === '.git') continue; // worktree file

      let allowed = ALLOWED_ROOT_FILES.has(entry);
      if (!allowed) {
        allowed = ALLOWED_ROOT_PATTERNS.some(p => p.test(entry));
      }
      if (!allowed) {
        violations.errors.push(`Root: unexpected file '${entry}'`);
      }

      if (shouldBeInDocs(entry)) {
        violations.errors.push(`Root: '${entry}' should be in docs/`);
      }
    }
  }
}

function validateDocsNaming(violations: Violations): void {
  const docsDir = join(ROOT_DIR, 'docs');
  if (!existsSync(docsDir)) return;

  function recurse(dir: string, relativePath: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      const relPath = `${relativePath}/${entry}`;

      if (stat.isDirectory()) {
        if (!isKebabCaseDoc(entry)) {
          violations.errors.push(`docs: directory '${relPath}' should use kebab-case`);
        }
        recurse(fullPath, relPath);
      } else if (stat.isFile() && extname(entry) === '.md') {
        if (!isKebabCaseDoc(entry)) {
          violations.errors.push(`docs: file '${relPath}' should use kebab-case`);
        }
      }
    }
  }

  recurse(docsDir, 'docs');
}

function validateScriptsNaming(violations: Violations): void {
  const scriptsDir = join(ROOT_DIR, 'scripts');
  if (!existsSync(scriptsDir)) return;

  const entries = readdirSync(scriptsDir);
  for (const entry of entries) {
    const fullPath = join(scriptsDir, entry);
    const stat = statSync(fullPath);
    if (stat.isFile() && !isKebabCase(entry)) {
      violations.warnings.push(`scripts: '${entry}' should use kebab-case`);
    }
  }
}

function validateHistoricalSize(violations: Violations): void {
  const historicalDir = join(ROOT_DIR, 'docs', 'historical');
  if (!existsSync(historicalDir)) return;

  let count = 0;
  function countFiles(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isFile()) count++;
      else if (stat.isDirectory()) countFiles(fullPath);
    }
  }

  countFiles(historicalDir);
  if (count > HISTORICAL_FILE_LIMIT) {
    violations.warnings.push(
      `docs/historical/ has ${count} files (limit: ${HISTORICAL_FILE_LIMIT}). Consider archiving.`
    );
  }
}

function main() {
  console.log('Validating directory structure...\n');

  const gitignored = getGitignored();
  const violations: Violations = { errors: [], warnings: [] };

  validateRootDirectory(violations, gitignored);
  validateDocsNaming(violations);
  validateScriptsNaming(violations);
  validateHistoricalSize(violations);

  const hasErrors = violations.errors.length > 0;
  const hasWarnings = violations.warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    console.log('Directory structure is valid!\n');
    process.exit(0);
  }

  if (hasErrors) {
    console.log('Errors:');
    violations.errors.forEach(e => console.log(`  - ${e}`));
    console.log('');
  }

  if (hasWarnings) {
    console.log('Warnings:');
    violations.warnings.forEach(w => console.log(`  - ${w}`));
    console.log('');
  }

  console.log(`See docs/policies/directory-structure-policy.md for details\n`);
  console.log(`Errors: ${violations.errors.length}, Warnings: ${violations.warnings.length}\n`);

  if (hasErrors || (STRICT && hasWarnings)) {
    process.exit(1);
  }

  process.exit(0);
}

main();
