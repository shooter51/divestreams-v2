# Directory Structure Cleanup - Execution Checklist

**Date**: 2026-02-15
**Purpose**: Step-by-step checklist for executing directory cleanup

## Pre-Execution Checklist

- [ ] **Read the policy**: Review `DIRECTORY_STRUCTURE_POLICY.md`
- [ ] **Understand the changes**: Review `DIRECTORY_CLEANUP_SUMMARY.md`
- [ ] **Clean working tree**: Ensure no uncommitted changes
  ```bash
  git status  # Should show clean working tree
  ```
- [ ] **Create backup branch** (optional but recommended):
  ```bash
  git checkout -b backup-before-cleanup
  git checkout vk/5dd3-directory-cleanu  # Return to working branch
  ```

## Execution Steps

### Step 1: Preview Changes
- [ ] Run dry-run to see what will happen:
  ```bash
  npm run cleanup:structure
  ```
- [ ] Review the output carefully
- [ ] Verify file destinations make sense
- [ ] Note any files that need special attention

### Step 2: Execute Cleanup
- [ ] Apply the cleanup:
  ```bash
  npm run cleanup:structure --apply
  ```
- [ ] Verify success message appears

### Step 3: Validate Results
- [ ] Run structure validator:
  ```bash
  npm run validate:structure
  ```
- [ ] Confirm zero violations (exit code 0)
- [ ] If violations remain, investigate and fix manually

### Step 4: Review Changes
- [ ] Check git status:
  ```bash
  git status
  ```
- [ ] Review moved files:
  ```bash
  git diff --summary
  ```
- [ ] Spot-check a few moved files to ensure content is intact
- [ ] Verify new directory structure:
  ```bash
  ls docs/
  ls docs/guides/
  ls docs/integrations/stripe/
  ls docs/integrations/pact/
  ls docs/historical/bug-fixes/
  ```

### Step 5: Test Build
- [ ] Ensure project still builds:
  ```bash
  npm run build
  ```
- [ ] Run type checking:
  ```bash
  npm run typecheck
  ```
- [ ] Run linter:
  ```bash
  npm run lint
  ```

### Step 6: Update Internal Links (If Needed)
- [ ] Search for broken links to moved files:
  ```bash
  # Search for references to moved files
  grep -r "STRIPE_SETUP.md" . --exclude-dir=node_modules
  grep -r "PACT_TESTING.md" . --exclude-dir=node_modules
  ```
- [ ] Update any references found
- [ ] Check README.md for broken links

### Step 7: Commit Changes
- [ ] Stage all changes:
  ```bash
  git add .
  ```
- [ ] Review what will be committed:
  ```bash
  git status
  git diff --cached --summary
  ```
- [ ] Commit with descriptive message:
  ```bash
  git commit -m "docs: reorganize directory structure per policy

  - Move 17 documentation files from root to docs/
  - Rename files to kebab-case for consistency
  - Create organized docs/ subdirectories (guides, integrations, historical)
  - Add DIRECTORY_STRUCTURE_POLICY.md
  - Add validation and cleanup automation scripts
  - Add docs/README.md documentation index
  - Update CLAUDE.md with directory structure reference

  Details:
  - Root clutter reduced from 18+ docs to 3 essential files
  - Documentation now organized by category in docs/
  - Stripe docs consolidated in docs/integrations/stripe/
  - Pact docs consolidated in docs/integrations/pact/
  - Historical bug fixes archived in docs/historical/bug-fixes/
  - All files renamed to kebab-case

  Validation:
  - npm run validate:structure → ✅ 0 violations
  - npm run build → ✅ Success
  - npm run typecheck → ✅ Pass

  See DIRECTORY_CLEANUP_SUMMARY.md for complete details."
  ```

### Step 8: Verify Commit
- [ ] Review commit:
  ```bash
  git show --stat
  ```
- [ ] Confirm all expected files moved
- [ ] Confirm no unexpected deletions

### Step 9: Push Changes
- [ ] Push to remote:
  ```bash
  git push origin vk/5dd3-directory-cleanu
  ```

### Step 10: Post-Cleanup
- [ ] Delete backup branch (if created):
  ```bash
  git branch -D backup-before-cleanup
  ```
- [ ] Update team/documentation
- [ ] Consider adding CI validation (see below)

## Optional: Add CI Validation

To prevent future violations, add to `.github/workflows/test.yml`:

```yaml
- name: Validate directory structure
  run: npm run validate:structure
```

- [ ] Add validation to CI workflow
- [ ] Test CI passes with new check
- [ ] Commit and push workflow update

## Rollback Plan (If Needed)

If something goes wrong:

```bash
# Option 1: Reset to before cleanup
git reset --hard HEAD~1

# Option 2: Restore from backup branch (if created)
git checkout backup-before-cleanup
git checkout -b vk/5dd3-directory-cleanu-v2

# Option 3: Revert the commit
git revert HEAD
```

## Success Criteria

- ✅ `npm run validate:structure` exits with code 0
- ✅ `npm run build` succeeds
- ✅ `npm run typecheck` passes
- ✅ Root directory has ≤3 markdown files
- ✅ All documentation in `docs/` subdirectories
- ✅ All files use kebab-case naming
- ✅ Git history preserved (files moved, not deleted)
- ✅ No broken links in documentation

## Troubleshooting

### Issue: "File already exists at destination"
**Solution**: File was already moved manually. Skip or rename.

### Issue: Validation still shows violations
**Solution**:
1. Run `npm run cleanup:structure` again to see remaining issues
2. Fix manually if needed
3. Re-run `npm run validate:structure`

### Issue: Broken links after cleanup
**Solution**:
1. Search for references to old filenames
2. Update links to new paths
3. Consider adding redirects in documentation

### Issue: CI fails after commit
**Solution**:
1. Check which step failed
2. If it's a new validation step, review errors
3. Fix violations and push again

## Post-Cleanup Maintenance

### Daily
- [ ] Run `npm run validate:structure` before commits

### Weekly
- [ ] Review new files in root directory
- [ ] Ensure new docs are properly organized

### Monthly
- [ ] Archive old bug fix reports to `docs/historical/`
- [ ] Consolidate duplicate documentation
- [ ] Update outdated guides

### Quarterly
- [ ] Full documentation review
- [ ] Remove obsolete docs
- [ ] Update directory policy if needed

## Questions?

- **Policy Details**: See `DIRECTORY_STRUCTURE_POLICY.md`
- **Implementation Details**: See `DIRECTORY_CLEANUP_SUMMARY.md`
- **Quick Reference**: See `docs/guides/directory-structure-quick-reference.md`
- **Documentation Guide**: See `docs/README.md`

---

**Status**: Ready for execution
**Estimated Time**: 10-15 minutes
**Risk Level**: Low (files moved, not deleted; git history preserved)
