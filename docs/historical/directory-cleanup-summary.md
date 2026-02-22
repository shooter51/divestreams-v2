# Directory Structure Cleanup - Implementation Summary

**Date**: 2026-02-15
**Status**: Ready for Execution

## Problem Statement

The DiveStreams v2 repository had significant directory structure issues:

1. **Root directory clutter**: 18+ markdown documentation files in root
2. **Inconsistent naming**: Mix of UPPER_SNAKE_CASE, kebab-case, and PascalCase
3. **Disorganized docs/**: 100+ files with no clear hierarchy
4. **No enforcement**: No automated checks to prevent future violations

## Solution Overview

Created a comprehensive directory structure policy with automated tooling for validation and cleanup.

## Deliverables

### 1. Policy Documentation

**File**: `DIRECTORY_STRUCTURE_POLICY.md`

Comprehensive policy document that defines:
- Allowed files in root directory
- Canonical directory structure
- Documentation organization (`docs/` subdirectories)
- Test structure (`tests/` subdirectories)
- Naming conventions (kebab-case)
- Enforcement mechanisms

### 2. Validation Script

**File**: `scripts/validate-directory-structure.ts`
**Command**: `npm run validate:structure`

Automated validator that checks:
- ✅ No prohibited files in root
- ✅ Documentation files in appropriate `docs/` subdirectories
- ✅ Consistent file naming (kebab-case)
- ✅ Exit code 1 on violations (CI-friendly)

**Current violations detected**: 49 (before cleanup)

### 3. Cleanup Script

**File**: `scripts/cleanup-directory-structure.ts`
**Command**: `npm run cleanup:structure` (dry-run)
**Command**: `npm run cleanup:structure --apply` (execute)

Automated cleanup that:
- 📁 Creates organized `docs/` subdirectory structure
- 📄 Moves documentation files to correct locations
- 🔤 Renames files to kebab-case
- 📋 Shows preview before applying changes

**Files to be reorganized**: 17

### 4. Documentation Index

**File**: `docs/README.md`

Comprehensive documentation index with:
- Documentation structure overview
- Contributing guidelines
- Naming conventions
- Style guide
- Maintenance procedures

## Planned Directory Structure

### Root Directory (After Cleanup)

```
divestreams-v2/
├── .dockerignore
├── .env.example
├── .gitignore
├── package.json
├── README.md              ← Project overview
├── CLAUDE.md              ← AI agent instructions
├── DIRECTORY_STRUCTURE_POLICY.md  ← This policy
├── tsconfig.json
├── vite.config.ts
├── Dockerfile
├── Caddyfile
├── docker-compose*.yml
└── [other essential config files]
```

**Clean root = Better developer experience**

### Documentation Structure (New)

```
docs/
├── README.md                    ← Documentation index (NEW)
├── guides/                      ← How-to guides (NEW)
│   ├── agents.md               (moved from root)
│   ├── api-testing-plan.md     (moved from root)
│   ├── api-testing-summary.md  (moved from root)
│   └── plan-management-guide.md (moved from root)
├── integrations/               ← Integration docs (NEW)
│   ├── stripe/                 (NEW subdirectory)
│   │   ├── setup.md           (moved from root)
│   │   ├── sync-guide.md      (moved from root)
│   │   ├── checklist.md       (moved from root)
│   │   ├── permissions.md     (moved from root)
│   │   ├── actual-permissions.md
│   │   └── restricted-keys.md
│   ├── pact/                   (NEW subdirectory)
│   │   ├── testing.md         (moved from root)
│   │   ├── broker-deployment.md (moved from root)
│   │   ├── deployment-safety.md (moved from root)
│   │   └── implementation-summary.md
│   └── zapier/
├── historical/                  ← Archived docs (NEW)
│   ├── bug-fixes/              (NEW subdirectory)
│   │   ├── bug-fix-403-public-site-data.md
│   │   └── kan-638-resolution.md
│   ├── peer-reviews/
│   └── session-reports/
└── [existing docs/ subdirectories...]
```

## Migration Plan

### Phase 1: Validation (Completed ✅)

- [x] Created `DIRECTORY_STRUCTURE_POLICY.md`
- [x] Created `validate-directory-structure.ts`
- [x] Ran validator to identify violations (49 found)
- [x] Documented current state

### Phase 2: Cleanup Script (Completed ✅)

- [x] Created `cleanup-directory-structure.ts`
- [x] Tested in dry-run mode (17 files to move)
- [x] Created `docs/README.md` index

### Phase 3: Execute Cleanup (Ready)

```bash
# 1. Review planned changes
npm run cleanup:structure

# 2. Apply changes
npm run cleanup:structure --apply

# 3. Verify clean state
npm run validate:structure

# 4. Commit changes
git add .
git commit -m "docs: reorganize directory structure per policy"
```

### Phase 4: CI Integration (Recommended)

Add to `.github/workflows/test.yml`:

```yaml
- name: Validate directory structure
  run: npm run validate:structure
```

This prevents future violations.

## File Movements Summary

### To `docs/guides/` (4 files)
- `AGENTS.md` → `agents.md`
- `API_TESTING_PLAN.md` → `api-testing-plan.md`
- `API_TESTING_SUMMARY.md` → `api-testing-summary.md`
- `PLAN-MANAGEMENT-GUIDE.md` → `plan-management-guide.md`

### To `docs/integrations/stripe/` (6 files)
- `STRIPE_SETUP.md` → `stripe-setup.md`
- `STRIPE-SYNC-GUIDE.md` → `stripe-sync-guide.md`
- `STRIPE_CHECKLIST.md` → `stripe-checklist.md`
- `STRIPE_ACTUAL_PERMISSIONS.md` → `stripe-actual-permissions.md`
- `STRIPE_PERMISSIONS_REFERENCE.md` → `stripe-permissions-reference.md`
- `STRIPE_RESTRICTED_KEYS.md` → `stripe-restricted-keys.md`

### To `docs/integrations/pact/` (4 files)
- `PACT_TESTING.md` → `pact-testing.md`
- `PACT_BROKER_DEPLOYMENT.md` → `pact-broker-deployment.md`
- `PACT_DEPLOYMENT_SAFETY.md` → `pact-deployment-safety.md`
- `PACT_IMPLEMENTATION_SUMMARY.md` → `pact-implementation-summary.md`

### To `docs/historical/bug-fixes/` (2 files)
- `BUG-FIX-403-public-site-data.md` → `bug-fix-403-public-site-data.md`
- `KAN-638-RESOLUTION.md` → `kan-638-resolution.md`

### To `scripts/` (1 file)
- `deploy-to-dev.sh`

**Total**: 17 files reorganized

## Impact Analysis

### Benefits

1. **Improved Developer Experience**
   - Clean root directory (3 docs instead of 18+)
   - Intuitive documentation structure
   - Easy to find relevant information

2. **Enforced Consistency**
   - Automated validation prevents future violations
   - Consistent naming conventions (kebab-case)
   - Clear policies reduce ambiguity

3. **Better Maintainability**
   - Documentation organized by category
   - Historical documents archived separately
   - Easier to clean up old docs

4. **Scalability**
   - Clear structure can grow with project
   - New contributors know where to add docs
   - Reduces decision fatigue

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Broken links** | Manual review after cleanup; Update links |
| **Lost context** | Git history preserved; Files only moved, not deleted |
| **Tool confusion** | Scripts are well-documented; Dry-run mode available |
| **Resistance to change** | Policy clearly documented; Benefits explained |

### Breaking Changes

**None** - This is a documentation reorganization only. No code changes required.

However:
- Internal documentation links may need updating
- Bookmarks to specific docs will break (rare)
- CI scripts referencing moved files need updating (if any)

## Validation Results

### Before Cleanup
```
❌ Directory structure violations found:
📁 Root Directory Clutter: 18 files
📄 Files that should be in docs/: 11 files
🔤 Naming Convention Violations: 20 files
Total violations: 49
```

### After Cleanup (Expected)
```
✅ Directory structure is valid!
```

## Maintenance

### Ongoing Responsibilities

1. **Run validator before commits**
   ```bash
   npm run validate:structure
   ```

2. **Add new docs to correct locations**
   - See `docs/README.md` for guidance
   - Follow naming conventions

3. **Quarterly cleanup**
   - Archive old bug fix reports
   - Consolidate duplicate documentation
   - Update outdated guides

### Adding to CI/CD

Recommended addition to test workflow:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - name: Validate directory structure
        run: npm run validate:structure
```

This ensures PRs can't introduce violations.

## Next Steps

1. **Execute cleanup script**
   ```bash
   npm run cleanup:structure --apply
   ```

2. **Verify success**
   ```bash
   npm run validate:structure
   ```

3. **Review moved files**
   - Check links still work
   - Update any references

4. **Commit changes**
   ```bash
   git add .
   git commit -m "docs: reorganize directory structure per policy

   - Move 17 documentation files from root to docs/
   - Rename files to kebab-case
   - Create organized docs/ subdirectories
   - Add DIRECTORY_STRUCTURE_POLICY.md
   - Add validation and cleanup scripts
   - Add docs/README.md index

   See DIRECTORY_CLEANUP_SUMMARY.md for details"
   ```

5. **Optional: Add CI validation**
   - Update `.github/workflows/test.yml`
   - Add structure validation step

## Success Metrics

- ✅ Zero violations in `npm run validate:structure`
- ✅ Root directory contains ≤3 markdown files
- ✅ All documentation in organized `docs/` subdirectories
- ✅ Consistent kebab-case naming
- ✅ Clear documentation index (`docs/README.md`)

## Conclusion

This cleanup establishes a sustainable directory structure for the DiveStreams v2 repository. The automated tooling ensures the structure stays clean as the project grows.

**Recommendation**: Execute the cleanup script and add CI validation to prevent future violations.

---

**Created by**: Claude Code (Directory Cleanup Task)
**Date**: 2026-02-15
**Status**: Ready for execution
