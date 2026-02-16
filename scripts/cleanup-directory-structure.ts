#!/usr/bin/env tsx
/**
 * Directory Structure Cleanup Script
 *
 * Automatically reorganizes files according to DIRECTORY_STRUCTURE_POLICY.md
 *
 * Usage:
 *   npm run cleanup:structure           # Dry-run (show what would be done)
 *   npm run cleanup:structure --apply   # Actually move files
 */

import { readdirSync, statSync, mkdirSync, renameSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const DRY_RUN = !process.argv.includes('--apply');

interface FileMove {
  from: string;
  to: string;
  reason: string;
}

const moves: FileMove[] = [];

/**
 * Ensure directory exists
 */
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    if (!DRY_RUN) {
      mkdirSync(dir, { recursive: true });
    }
    console.log(`  📁 Create directory: ${dir}`);
  }
}

/**
 * Move a file
 */
function moveFile(from: string, to: string, reason: string) {
  moves.push({ from, to, reason });

  if (!DRY_RUN) {
    const toDir = join(to, '..');
    ensureDir(toDir);
    renameSync(from, to);
  }
}

/**
 * Convert filename to kebab-case
 */
function toKebabCase(filename: string): string {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? `.${parts.pop()}` : '';
  const name = parts.join('.');

  // Convert UPPER_SNAKE_CASE or UPPER-KEBAB-CASE to kebab-case
  const kebab = name
    .replace(/_/g, '-')           // Replace underscores with hyphens
    .toLowerCase();                // Convert to lowercase

  return kebab + ext;
}

/**
 * Determine target directory for a documentation file
 */
function getDocsTargetDir(filename: string): string {
  const upper = filename.toUpperCase();

  // Stripe documentation
  if (upper.includes('STRIPE')) {
    return join(ROOT_DIR, 'docs/integrations/stripe');
  }

  // Pact documentation
  if (upper.includes('PACT')) {
    return join(ROOT_DIR, 'docs/integrations/pact');
  }

  // API testing
  if (upper.includes('API_TESTING')) {
    return join(ROOT_DIR, 'docs/guides');
  }

  // Bug fixes
  if (upper.includes('BUG-FIX') || upper.startsWith('KAN-')) {
    return join(ROOT_DIR, 'docs/historical/bug-fixes');
  }

  // Plans and guides
  if (upper.includes('PLAN') || upper.includes('GUIDE')) {
    return join(ROOT_DIR, 'docs/guides');
  }

  // Agent documentation
  if (upper.includes('AGENTS')) {
    return join(ROOT_DIR, 'docs/guides');
  }

  // Default to guides
  return join(ROOT_DIR, 'docs/guides');
}

/**
 * Process root directory files
 */
function processRootDirectory() {
  const entries = readdirSync(ROOT_DIR);

  for (const entry of entries) {
    const fullPath = join(ROOT_DIR, entry);
    const stat = statSync(fullPath);

    if (!stat.isFile()) continue;
    if (!entry.endsWith('.md') && !entry.endsWith('.sh')) continue;

    // Skip essential docs
    if (['README.md', 'CLAUDE.md', 'DIRECTORY_STRUCTURE_POLICY.md', 'plan.md'].includes(entry)) {
      continue;
    }

    // Move documentation files
    if (entry.endsWith('.md')) {
      const targetDir = getDocsTargetDir(entry);
      const newName = toKebabCase(entry);
      const targetPath = join(targetDir, newName);

      moveFile(fullPath, targetPath, 'Documentation file moved to docs/ and renamed to kebab-case');
    }

    // Move scripts
    if (entry.endsWith('.sh')) {
      const targetPath = join(ROOT_DIR, 'scripts', entry);
      moveFile(fullPath, targetPath, 'Script moved to scripts/');
    }
  }
}

/**
 * Main function
 */
function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be moved\n');
    console.log('To apply changes, run: npm run cleanup:structure --apply\n');
  } else {
    console.log('⚠️  APPLYING CHANGES - Files will be moved\n');
  }

  console.log('📦 Processing directory structure cleanup...\n');

  processRootDirectory();

  if (moves.length === 0) {
    console.log('✅ No cleanup needed - directory structure is already clean!\n');
    return;
  }

  console.log(`📋 Planned changes (${moves.length} files):\n`);

  // Group by target directory
  const byTarget = new Map<string, FileMove[]>();
  for (const move of moves) {
    const dir = join(move.to, '..');
    if (!byTarget.has(dir)) {
      byTarget.set(dir, []);
    }
    byTarget.get(dir)!.push(move);
  }

  for (const [targetDir, fileMoves] of byTarget) {
    const relativeDir = targetDir.replace(ROOT_DIR, '').replace(/^\//, '') || '/';
    console.log(`📁 ${relativeDir}/`);
    for (const move of fileMoves) {
      const filename = basename(move.to);
      const originalFilename = basename(move.from);
      if (filename !== originalFilename) {
        console.log(`   ${originalFilename} → ${filename}`);
      } else {
        console.log(`   ${filename}`);
      }
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('💡 Run with --apply to execute these changes\n');
  } else {
    console.log('✅ Cleanup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Review the changes');
    console.log('   2. Run: npm run validate:structure');
    console.log('   3. Update any broken links in documentation');
    console.log('   4. Commit the changes\n');
  }
}

main();
