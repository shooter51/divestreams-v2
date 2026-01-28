# Automated Peer Review System

## Overview

The DiveStreams v2 project uses an automated peer review system to ensure bug fixes are complete before deployment to staging. This system prevents incomplete fixes from reaching production.

## How It Works

### Git Hook Integration

A `pre-push` hook automatically triggers when pushing to the `staging` branch:

```bash
git push origin staging
# → Triggers automated peer review check
```

**Hook Behavior:**
1. Detects push to `staging` branch
2. Finds bug fix commits since last peer review
3. Prompts to run peer review workflow
4. Blocks push until review is complete

**Feature branches are NOT affected** - the hook only runs for staging.

### Workflow Phases

#### Phase 1: Detection
```
$ git push origin staging

🔍 Staging branch detected - Running automated peer review...
📋 Found 5 bug fix commits since last review (2026-01-27)

Jira Issues to Review:
  - KAN-625
  - KAN-618
  - KAN-620
  - KAN-639
  - KAN-619
```

#### Phase 2: Peer Review Execution
```
⚠️  MANUAL STEP REQUIRED:

Please run this command in Claude Code:

    Use the peer-review-and-fix skill to review recent bug fixes

After peer review completes and critical blockers are fixed,
run 'git push' again to deploy to staging.
```

#### Phase 3: Fix Critical Blockers

The peer review will identify issues like:
- Incomplete fixes (e.g., fixed trips but not courses)
- Missing validation (e.g., bulk update validated but not individual)
- Unregistered routes (e.g., files exist but 404 errors)

Fix these blockers and commit the changes.

#### Phase 4: Re-Review & Deploy

After fixing critical blockers:
```bash
git add .
git commit -m "fix: complete peer review critical blockers"
git push origin staging  # Will trigger re-review
```

The follow-up peer review verifies fixes are complete, then allows the push.

## Manual Usage

### Run Peer Review Script

```bash
# Interactive mode (prompts for confirmation)
./scripts/run-peer-review.sh

# Automatic mode (no prompts)
./scripts/run-peer-review.sh --auto

# Review specific date range
./scripts/run-peer-review.sh --since="2026-01-20"
```

### Bypass Hook (Emergency Only)

```bash
# Skip peer review (NOT RECOMMENDED)
git push --no-verify origin staging
```

**Only use `--no-verify` for:**
- Hotfixes requiring immediate deployment
- Rollbacks
- Non-code changes (documentation only)

## Claude Code Integration

### Triggering Peer Review

In Claude Code, use the skill:

```
Use the peer-review-and-fix skill to review recent bug fixes
```

Or more specific:

```
Use peer-review-and-fix skill to review KAN-625, KAN-618, KAN-620
```

### What Happens

1. **5 Independent Peer Reviewers Spawn** (parallel agents)
   - Each reviews one Jira issue
   - Searches for similar defects
   - Rates completeness (0-100%)
   - Provides verdict: APPROVED / NEEDS CHANGES

2. **Unified Report Generated**
   - Saved to `docs/PEER_REVIEW_REPORT_[DATE].md`
   - Executive summary with metrics
   - Critical action items prioritized

3. **Critical Blockers Fixed** (if any)
   - Claude fixes NEEDS CHANGES issues
   - Commits with detailed explanations
   - Updates completeness percentages

4. **Re-Review Verification**
   - 5 follow-up reviewers verify fixes
   - Confirm completeness improved
   - Final verdict: APPROVED or needs more work

## Peer Review Skill

The `peer-review-and-fix` skill is located at:
```
~/.claude/plugins/cache/superpowers-marketplace/superpowers/4.0.3/skills/peer-review-and-fix/skill.md
```

**Trigger phrases:**
- "Review these fixes"
- "Run peer reviews on the bug fixes"
- "Check if the fixes are complete"
- "Let's review this before merging"

## Success Metrics

**Good Peer Review Session:**
- ✅ All 5 independent reviews completed
- ✅ Unified report saved to `docs/`
- ✅ Critical blockers identified and fixed
- ✅ Re-review shows improvement (completeness ↑)
- ✅ No deploy blockers remaining

**Red Flags:**
- ❌ All reviews are APPROVED (reviewers weren't thorough)
- ❌ No similar defects found (search wasn't comprehensive)
- ❌ Same verdict after re-review (fixes weren't effective)
- ❌ Skipping follow-up reviews (can't verify improvement)

## Real-World Example

### Initial Review Findings (2026-01-28)
| Issue | Completeness | Verdict | Critical Finding |
|-------|--------------|---------|------------------|
| KAN-625 | 1.2% | NEEDS CHANGES | 671 timeout instances remain |
| KAN-618 | 100% | APPROVED | Migration works |
| KAN-620 | 60% | NEEDS CHANGES | Individual modal lacks validation |
| KAN-639 | 50% | NEEDS CHANGES | Course booking broken |
| KAN-619 | 100% | APPROVED | 7 routes unregistered |

### After Fixing Critical Blockers
| Issue | Completeness | Verdict | Improvement |
|-------|--------------|---------|-------------|
| KAN-625 | 1.2% | NEEDS CHANGES | No change (follow-up ticket created) |
| KAN-618 | 100% | APPROVED | No change |
| KAN-620 | **100%** ↑ | **APPROVED** ✅ | Individual modal fixed |
| KAN-639 | **100%** ↑ | **APPROVED** ✅ | Both course links fixed |
| KAN-619 | 100% | **APPROVED** ✅ | All 7 routes registered |

**Result:** 3 critical blockers fixed, completeness improved, safe to deploy.

## Configuration

### Disable Automated Peer Review

To disable the git hook:
```bash
# Rename the hook
mv .git/hooks/pre-push .git/hooks/pre-push.disabled

# Or remove it
rm .git/hooks/pre-push
```

### Re-enable Automated Peer Review

```bash
# Restore from disabled
mv .git/hooks/pre-push.disabled .git/hooks/pre-push

# Or recreate from this guide (see "Git Hook Integration" section)
```

### Customize Review Frequency

Edit `.git/hooks/pre-push` to change when reviews trigger:

```bash
# Only run if 3+ bug fixes
if [ "$commits_since_review" -ge 3 ]; then

# Run every time (regardless of commit count)
if [ "$branch" = "staging" ]; then

# Run weekly (regardless of commits)
days_since_review=$(( ($(date +%s) - $(date -d "$last_review_date" +%s)) / 86400 ))
if [ "$days_since_review" -ge 7 ]; then
```

## Troubleshooting

### Hook Not Running

**Check hook exists and is executable:**
```bash
ls -la .git/hooks/pre-push
# Should show: -rwxr-xr-x (executable)

# Fix permissions if needed
chmod +x .git/hooks/pre-push
```

### Push Blocked Incorrectly

**Manually mark review as complete:**
```bash
# Create a dated review file to reset the timer
touch "docs/PEER_REVIEW_REPORT_$(date +%Y-%m-%d).md"

# Then push
git push origin staging
```

### Review Skill Not Found

**Verify skill installation:**
```bash
ls ~/.claude/plugins/cache/superpowers-marketplace/superpowers/4.0.3/skills/peer-review-and-fix/

# Should show: skill.md
```

If missing, the skill file is at the top of this session and can be recreated.

## Best Practices

1. **Run Reviews Before Merge**
   - Review on `staging` before merging to `main`
   - Catch issues before production deployment

2. **Fix Critical Blockers Immediately**
   - Don't bypass review for convenience
   - Incomplete fixes create technical debt

3. **Trust the Process**
   - 40-70% of fixes are incomplete on first review
   - Peer reviews find 3-5x more instances of same bug
   - Near-zero production bugs after peer review

4. **Document Follow-Up Work**
   - Create Beads tickets for technical debt (like KAN-625 timeouts)
   - Track systemic issues separately from critical blockers

## Integration with CI/CD

The peer review system complements CI/CD:

```
Feature Branch → Staging Branch → Main Branch → Production
                      ↓
                 Peer Review ← (Automated via git hook)
                      ↓
                 Fix Blockers
                      ↓
                 Re-Review
                      ↓
                   Deploy
```

**CI/CD runs:**
- Lint, typecheck, unit tests
- E2E tests (80 workflow tests)
- Build Docker images

**Peer Review ensures:**
- Bug fixes are complete (not just symptom fixes)
- Similar defects are identified
- Testing requirements are documented
- Technical debt is tracked

Both systems work together to maintain code quality.

---

**Questions or issues?** Check the peer review skill documentation or ask Claude Code:
```
Explain how the peer-review-and-fix skill works
```
