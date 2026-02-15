---
name: jira-bug-fix-workflow
description: Complete TDD-driven workflow for Jira bugs - Root cause analysis, test-first implementation, peer review, deploy, and transition to Dev Review
---

# Jira Bug Fix Workflow with TDD

**Purpose:** Systematic, test-driven approach to fixing Jira bugs with comprehensive review and deployment.

**When to Use:**
- User requests: "Fix the Jira bugs", "Work on the backlog", "Address the issues"
- At the start of a sprint
- During bug fix sessions
- When QA reports failures

**Trigger Phrases:**
- "Fix the Jira bugs"
- "Work through the bug backlog"
- "Fix all the issues in To Do"
- "Address the defects"

---

## Execution Modes

### Sequential Mode (Default)
Work through bugs one at a time. Best for:
- Learning/understanding the codebase
- Complex bugs requiring deep focus
- When bugs might be related

### Parallel Mode (Recommended for 3+ bugs)
**Use parallel agents to fix multiple bugs simultaneously.**

**When to use:**
- 3+ independent bugs found in Discovery
- Bugs are in different features/routes (no overlap)
- Want to maximize throughput

**How it works:**
```javascript
// After Discovery phase finds 5 bugs, spawn 5 parallel bug-fix agents
[Single Message - All agents spawned together]:
  Task("Bug Fix Agent #1", "Fix KAN-XXX using full TDD workflow...", "general-purpose")
  Task("Bug Fix Agent #2", "Fix KAN-YYY using full TDD workflow...", "general-purpose")
  Task("Bug Fix Agent #3", "Fix KAN-ZZZ using full TDD workflow...", "general-purpose")
  Task("Bug Fix Agent #4", "Fix KAN-AAA using full TDD workflow...", "general-purpose")
  Task("Bug Fix Agent #5", "Fix KAN-BBB using full TDD workflow...", "general-purpose")
```

**Each agent independently:**
1. Performs root cause analysis
2. Writes failing test
3. Implements fix
4. Verifies test passes
5. Reports completion

**Then you:**
1. Collect all fixes
2. Run unified peer review (all fixes together)
3. Address critical blockers
4. Push all fixes together
5. Transition all issues to DEV REVIEW

---

## The Workflow (Per Bug)

```
┌─────────────────┐
│ 1. Discovery    │  Find bugs in Jira (To Do, In Progress)
└────────┬────────┘
         │
┌────────▼────────┐
│ 2. Root Cause   │  Full analysis - why did this happen?
│    Analysis     │  What's the complete fix (not just symptom)?
└────────┬────────┘
         │
┌────────▼────────┐
│ 3. TDD: Write   │  Write FAILING test that proves defect exists
│    Failing Test │  Red phase - test should fail
└────────┬────────┘
         │
┌────────▼────────┐
│ 4. Implement    │  Fix the bug (make test pass)
│    Fix          │  Green phase - test now passes
└────────┬────────┘
         │
┌────────▼────────┐
│ 5. TDD: Verify  │  All tests pass (including new test)
│    Fix Works    │  Refactor if needed
└────────┬────────┘
         │
┌────────▼────────┐
│ 6. Peer Review  │  Use peer-review-and-fix skill
│                 │  5 independent reviewers check completeness
└────────┬────────┘
         │
┌────────▼────────┐
│ 7. Push, Merge  │  Deploy to staging via CI/CD
│    Monitor      │  Watch logs, check health
└────────┬────────┘
         │
┌────────▼────────┐
│ 8. Transition   │  Move Jira to "DEV REVIEW"
│    to QA        │  Document what was fixed
└─────────────────┘
```

---

## Phase 1: Discovery - Find Bugs in Jira

**Objective:** Get all bugs/defects that need fixing

**Actions:**

```bash
# Search Jira for bugs in To Do or In Progress
mcp__atlassian__jira_search(
  jql: "project = KAN AND issuetype = Bug AND status IN ('To Do', 'In Progress') ORDER BY priority DESC, created ASC",
  limit: 50
)
```

**Output:** List of bug issues with:
- Issue key (KAN-XXX)
- Summary
- Description
- Priority
- Status

**Decision Point:**
- If 0 bugs: "No bugs found in To Do or In Progress. Great work!"
- If 1-3 bugs: Work through all sequentially
- If 4-10 bugs: Ask user which to prioritize
- If 10+ bugs: Ask user to scope (e.g., "High priority only", "Top 10", "All")

**Create TodoWrite List:**
```typescript
TodoWrite({
  todos: bugs.map((bug, i) => ({
    id: `bug-${i}`,
    content: `${bug.key}: ${bug.summary}`,
    status: "pending",
    priority: bug.priority === "High" ? "high" : "medium"
  }))
})
```

### Parallel Execution Decision

**If 3+ bugs found:**

```javascript
// Ask user: "Found X bugs. Fix in parallel (faster) or sequential (safer)?"
AskUserQuestion({
  questions: [{
    question: `Found ${bugCount} bugs. How should I proceed?`,
    header: "Execution Mode",
    options: [
      {
        label: "Parallel (Recommended)",
        description: `Spawn ${bugCount} agents to fix all bugs simultaneously. Faster but uses more resources.`
      },
      {
        label: "Sequential",
        description: "Fix bugs one at a time. Slower but easier to follow progress."
      },
      {
        label: "Top 3 Only",
        description: "Fix only the 3 highest priority bugs in parallel."
      }
    ],
    multiSelect: false
  }]
})
```

**If user chooses "Parallel":**

```javascript
// CRITICAL: Spawn ALL agents in SINGLE message
[Single Message]:
  Task("Bug Fix Agent #1", `
    You are an independent bug fix agent.

    **YOUR TASK:** Fix KAN-${bug1.key} using complete TDD workflow

    **PHASES TO EXECUTE:**
    1. Root Cause Analysis
    2. Write failing test (TDD Red)
    3. Implement fix
    4. Verify test passes (TDD Green)
    5. Report completion

    **BUG DETAILS:**
    - Key: ${bug1.key}
    - Summary: ${bug1.summary}
    - Description: ${bug1.description}
    - Priority: ${bug1.priority}

    **REQUIREMENTS:**
    - Search for similar defects (completeness check)
    - Create E2E or integration test
    - Fix ALL instances found
    - Document changes clearly

    **DELIVERABLES:**
    - Test file created
    - Code fix implemented
    - All tests passing
    - Summary of changes
  `, "general-purpose"),

  Task("Bug Fix Agent #2", `... [same format for bug 2]`, "general-purpose"),
  Task("Bug Fix Agent #3", `... [same format for bug 3]`, "general-purpose"),
  // ... spawn N agents for N bugs
```

**Agent Coordination:**
- Each agent works independently
- No inter-agent communication needed (bugs must be independent)
- All agents report to main coordinator (you)
- Main coordinator runs peer review after all agents complete

---

## Phase 2: Root Cause Analysis

**For EACH bug, perform deep analysis:**

### 2.1 Understand the Symptom
- **What:** Read Jira description and attachments
- **Where:** Which feature/route/component?
- **When:** What user action triggers it?
- **Who:** What user role experiences it?

### 2.2 Reproduce Locally (if possible)
- **Navigate:** Go to the affected page/route
- **Execute:** Perform the exact user action
- **Observe:** Confirm the defect behavior

### 2.3 Identify Root Cause
**Ask the "5 Whys":**
1. Why does the error occur?
2. Why does that condition exist?
3. Why wasn't this caught earlier?
4. Why is the code structured this way?
5. Why didn't validation prevent this?

### 2.4 Search for Similar Defects
**Critical - Use Grep/Glob to find all instances:**
```bash
# If bug is "email validation missing in login form"
# Search ALL forms for similar missing validation
Grep(pattern: "form.*action", output_mode: "files_with_matches")
Glob(pattern: "app/routes/**/*.tsx")
```

**Completeness Check:**
- How many places have this same issue?
- If fixing route A, what about routes B, C, D?
- Is this a systemic pattern problem?

### 2.5 Determine Complete Fix
**NOT just the symptom - the COMPLETE fix:**
- Primary fix: The reported issue
- Secondary fixes: Similar instances found via search
- Preventive measures: Utilities, helpers, validation rules
- Documentation: Update patterns, add comments

**Example:**
```
Bug: KAN-611 "Email missing on login error"

❌ Incomplete fix: Add email preservation to admin/login
✅ Complete fix:
  1. Add preservation to ALL 4 login routes (admin, auth, tenant, site)
  2. Create form-helpers.ts utility for reusable pattern
  3. Add integration tests for all 4 routes
  4. Document the actionData pattern in code comments
```

---

## Phase 3: TDD - Write Failing Test

**Test-Driven Development - Red Phase**

**Objective:** Write a test that PROVES the defect exists (test should FAIL)

### 3.1 Choose Test Type

**Integration Test** (preferred for bugs):
```typescript
// File: tests/integration/bug-KAN-XXX.test.ts
import { describe, it, expect } from 'vitest';

describe('Bug KAN-XXX: [Issue Summary]', () => {
  it('reproduces the defect', async () => {
    // Setup: Create test data
    // Execute: Perform the action that triggers bug
    // Assert: Verify the BUG EXISTS (test should FAIL)

    // This test should FAIL before fix is implemented
    expect(buggyBehavior).toBe(correctBehavior);
  });
});
```

**E2E Test** (for UI bugs):
```typescript
// File: tests/e2e/bugs/KAN-XXX.spec.ts
import { test, expect } from '@playwright/test';

test('Bug KAN-XXX: [Issue Summary]', async ({ page }) => {
  // Navigate to affected page
  // Trigger the bug
  // Assert the bug exists (test should FAIL)
});
```

### 3.2 Run Test - Confirm It FAILS

```bash
npm test tests/integration/bug-KAN-XXX.test.ts
# Expected: ❌ TEST FAILS (proves defect exists)
```

**If test passes:**
- ⚠️ STOP - Your test doesn't actually reproduce the bug
- Re-analyze the defect
- Rewrite the test

**Document the failure:**
```
Test Output:
❌ Bug KAN-XXX: reproduces the defect
  Expected: email preserved
  Received: email empty

✓ Defect confirmed via failing test
```

---

## Phase 4: Implement the Fix

**Test-Driven Development - Green Phase**

**Objective:** Make the test pass by fixing the bug

### 4.1 Implement Primary Fix
- Read the affected files
- Apply the fix
- Follow existing code patterns
- Keep changes minimal and focused

### 4.2 Implement Secondary Fixes
- Fix all similar instances found in root cause analysis
- Apply the same pattern consistently
- Update related code

### 4.3 Add Preventive Measures
- Create utility functions if needed
- Add validation rules
- Update shared libraries
- Add ESLint rules if applicable

### 4.4 Code Quality
- **No over-engineering:** Fix the bug, don't refactor unrelated code
- **No premature abstraction:** Don't create helpers for one-time use
- **Type safety:** Use TypeScript properly
- **Error handling:** Only at system boundaries

**Example Fix:**
```typescript
// Before (BUG):
if (errors.length > 0) {
  return { errors }; // Email is lost!
}

// After (FIXED):
if (errors.length > 0) {
  return {
    errors,
    email: email || "" // Preserve email
  };
}
```

---

## Phase 5: TDD - Verify Fix Works

**Test-Driven Development - Green Phase Validation**

**Objective:** Confirm the fix works and all tests pass

### 5.1 Run the Specific Test
```bash
npm test tests/integration/bug-KAN-XXX.test.ts
# Expected: ✅ TEST PASSES (bug is fixed)
```

**Test should now PASS:**
```
Test Output:
✅ Bug KAN-XXX: reproduces the defect
  All assertions passed

✓ Fix verified via passing test
```

### 5.2 Run All Tests
```bash
npm test
# Expected: ✅ ALL TESTS PASS (no regressions)
```

**Check for regressions:**
- Did we break any existing tests?
- Are all new tests passing?
- Any skipped tests that should run?

### 5.3 Type Check
```bash
npm run typecheck
# Expected: ✅ No TypeScript errors
```

### 5.4 Lint Check
```bash
npm run lint
# Expected: ✅ No ESLint errors (warnings OK if documented)
```

### 5.5 Build Check
```bash
npm run build
# Expected: ✅ Production build succeeds
```

**If ANY check fails:**
- ⚠️ STOP - Don't proceed to review
- Fix the failing check
- Re-run all checks
- Only proceed when everything passes

---

## Phase 6: Peer Review

**Use the existing peer-review-and-fix skill**

**Objective:** Ensure fix is complete and doesn't introduce issues

### 6.1 Invoke Peer Review Skill
```bash
Skill(skill: "peer-review-and-fix")
```

**The skill will:**
1. Spawn 5 parallel independent reviewers
2. Each reviewer searches for similar defects
3. Compile unified report
4. Identify critical blockers
5. Assign completeness percentage

### 6.2 Review the Findings
**Read the unified report:**
- Are there "NEEDS CHANGES" verdicts?
- What's the completeness percentage?
- Any critical blockers identified?
- Similar defects found?

### 6.3 Address Critical Blockers
**For each 🔴 REQUIRED item:**
1. Read affected files
2. Apply additional fixes
3. Re-run tests
4. Commit with detailed message

### 6.4 Re-Review (Follow-Up)
**Spawn 5 follow-up reviewers:**
- Verify critical items addressed
- Confirm completeness improved
- Check for APPROVED verdicts

**Success Criteria:**
- Majority verdict: APPROVED or APPROVED WITH CONDITIONS
- No NEEDS CHANGES verdicts
- Completeness: 90%+ (or 100% if achievable)

---

## Phase 7: Push, Merge, Monitor

**Objective:** Deploy to staging and verify in production-like environment

### 7.1 Commit Changes

**Create comprehensive commit message:**
```bash
git add <files>
git commit -m "fix(KAN-XXX): [concise summary]

**Problem:** [What was broken]
- [User-facing symptom]
- [Root cause identified]

**Solution:** [What was fixed]
- [Primary fix]
- [Secondary fixes]
- [Preventive measures]

**Testing:**
- ✅ Integration test: tests/integration/bug-KAN-XXX.test.ts
- ✅ All tests pass (X total)
- ✅ TypeScript clean
- ✅ Build succeeds

**Peer Review:**
- Completeness: [X%]
- Verdict: [APPROVED/APPROVED WITH CONDITIONS]
- Reviewers found [X] similar instances, all addressed

**Files Changed:**
- [file1]: [what changed]
- [file2]: [what changed]

Fixes: KAN-XXX
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 7.2 Push to Staging Branch
```bash
git push origin staging
```

**NEVER use --no-verify unless peer review is complete**

### 7.3 Monitor CI/CD Pipeline
```bash
gh run list --limit 1
gh run view --log
```

**Watch for:**
- ✅ Lint passes
- ✅ TypeCheck passes
- ✅ Unit tests pass
- ✅ E2E tests pass (80 tests)
- ✅ Build succeeds
- ✅ Docker image builds
- ✅ Deploy to staging succeeds

**If CI/CD fails:**
- ⚠️ STOP - Don't transition Jira
- Read the logs
- Fix the issue
- Push again
- Wait for green

### 7.4 Verify on Staging VPS

**Check deployment status:**
```bash
# Via MCP
mcp__hostinger-mcp__VPS_getProjectContainersV1(
  virtualMachineId: 1271895,
  projectName: "divestreams-staging"
)

# Expected: All containers "Up"
```

**Check application logs:**
```bash
mcp__hostinger-mcp__VPS_getProjectLogsV1(
  virtualMachineId: 1271895,
  projectName: "divestreams-staging"
)

# Look for:
# - No startup errors
# - Application healthy
# - No crash loops
```

### 7.5 Manual Verification (Quick Smoke Test)

**Navigate to staging:**
```
https://staging.divestreams.com
```

**Perform quick verification:**
1. Navigate to affected feature
2. Attempt the action that triggered the bug
3. Verify bug is fixed
4. Check for any obvious regressions

**Document verification:**
```
Manual Verification on Staging:
- ✅ Navigated to [feature]
- ✅ Performed [action]
- ✅ Bug no longer reproduces
- ✅ No regressions observed
```

---

## Phase 8: Transition to DEV REVIEW

**Objective:** Hand off to QA with complete context

### 8.1 Get Available Transitions
```bash
mcp__atlassian__jira_get_transitions(issue_key: "KAN-XXX")
```

### 8.2 Transition to DEV REVIEW
```bash
mcp__atlassian__jira_transition_issue(
  issue_key: "KAN-XXX",
  transition_id: "2",  # DEV REVIEW
  comment: "Fixed: [Summary]

**Root Cause:**
[What caused the bug]

**Fix Implemented:**
- [Primary fix with file references]
- [Secondary fixes - similar instances]
- [Preventive measures - utilities created]

**Testing:**
- ✅ Integration test: tests/integration/bug-KAN-XXX.test.ts
- ✅ All tests pass (X,XXX total, +X new)
- ✅ TypeScript clean
- ✅ Production build succeeds

**Peer Review:**
- 5 independent reviewers
- Completeness: [X%]
- Verdict: [APPROVED/APPROVED WITH CONDITIONS]
- [X] similar defects found and fixed

**Deployment:**
- Commit: [hash]
- Branch: staging
- CI/CD: ✅ Passed
- Staging VPS: ✅ Deployed and verified
- Manual smoke test: ✅ Passed

**Verification Steps for QA:**
1. Navigate to [URL/feature]
2. Perform [specific action]
3. Verify [expected behavior]
4. Check [related areas for regressions]

**Ready for QA verification on staging.divestreams.com**"
)
```

### 8.3 Update TodoWrite
```bash
TodoWrite({
  update: {
    id: "bug-X",
    status: "completed",
    result: "Fixed and moved to DEV REVIEW"
  }
})
```

---

## Success Criteria

**Before moving to DEV REVIEW, ALL must be true:**

✅ **Root Cause:**
- [ ] Full "5 Whys" analysis completed
- [ ] Similar defects searched and found
- [ ] Complete fix determined (not just symptom)

✅ **TDD:**
- [ ] Failing test written (proves bug exists)
- [ ] Test failed before fix (confirmed defect)
- [ ] Test passes after fix (confirmed fix works)
- [ ] All tests pass (no regressions)

✅ **Code Quality:**
- [ ] TypeScript compilation clean
- [ ] ESLint passes (or warnings documented)
- [ ] Production build succeeds
- [ ] No over-engineering

✅ **Peer Review:**
- [ ] 5 independent reviewers completed
- [ ] Unified report generated
- [ ] Critical blockers addressed
- [ ] Completeness 90%+ (or 100%)
- [ ] Majority verdict: APPROVED

✅ **Deployment:**
- [ ] Committed with comprehensive message
- [ ] Pushed to staging branch
- [ ] CI/CD pipeline passed
- [ ] Deployed to staging VPS
- [ ] Containers healthy
- [ ] Manual smoke test passed

✅ **Documentation:**
- [ ] Jira transitioned to DEV REVIEW
- [ ] Comprehensive comment added
- [ ] Verification steps provided for QA
- [ ] Commit message includes all context

---

## Common Patterns and Examples

### Pattern 1: Form Validation Missing
```
Bug: "Can submit form with invalid data"

Root Cause Analysis:
- Server-side validation missing
- Client-side HTML5 validation insufficient
- Similar in 13+ other forms

TDD - Failing Test:
```typescript
it('rejects invalid price', async () => {
  const result = await action({
    request: makeRequest({ price: "0.50" })
  });
  expect(result.error).toBeDefined(); // FAILS before fix
});
```

Complete Fix:
1. Add server-side validation to reported form
2. Search for all forms with similar fields (Grep "form.*price")
3. Add validation to all 13+ similar forms
4. Create validateMoneyAmount() utility
5. Add integration tests for all forms
```

### Pattern 2: State Not Preserved on Error
```
Bug: "Email disappears on login error"

Root Cause Analysis:
- actionData not returned with error
- UI not using actionData for defaultValue
- Affects 4 login routes (admin, auth, tenant, site)

TDD - Failing Test:
```typescript
it('preserves email on error', async () => {
  const result = await action({
    request: makeRequest({ email: "test@example.com", password: "" })
  });
  expect(result.email).toBe("test@example.com"); // FAILS before fix
});
```

Complete Fix:
1. Return email in error response: `return { errors, email }`
2. Update UI: `defaultValue={actionData?.email || ""}`
3. Apply to all 4 login routes
4. Create preserveFormFields() utility
5. Add integration tests for all 4 routes
```

### Pattern 3: Missing Foreign Key Usage
```
Bug: "Premium features locked despite paid subscription"

Root Cause Analysis:
- Code uses legacy 'plan' string field
- Should use 'planId' FK to get planDetails.monthlyPrice
- Immune to plan name changes

TDD - Failing Test:
```typescript
it('isPremium true when monthlyPrice > 0', async () => {
  // Setup subscription with planId pointing to paid plan
  const isPremium = planDetails.monthlyPrice > 0;
  expect(isPremium).toBe(true); // FAILS before fix
});
```

Complete Fix:
1. Change isPremium logic to use planDetails.monthlyPrice
2. Remove dependency on legacy 'plan' field
3. Add integration tests for free and paid plans
```

---

## Red Flags - STOP

**If you catch yourself:**

❌ "Let me just fix the symptom quickly"
→ Do root cause analysis first

❌ "This test isn't really necessary"
→ TDD is required, write the failing test

❌ "I'll skip peer review, this is simple"
→ Simple bugs often have hidden complexity

❌ "Tests pass, I'll push directly"
→ Always verify on staging first

❌ "I'll transition to Dev Review now, QA can verify later"
→ Only transition after staging verification

❌ "This affects other places but I'll fix them later"
→ Fix all similar instances NOW (completeness)

❌ "The test passes, but I didn't see it fail first"
→ CRITICAL - test might not actually test the bug

---

## Integration with Other Skills

**This skill uses:**
- `peer-review-and-fix` - Phase 6 (automatic)
- `verification-before-completion` - After manual testing
- `systematic-debugging` - If root cause is unclear

**Workflow:**
```
User: "Fix the Jira bugs"
→ Use THIS skill (jira-bug-fix-workflow)
  ├─ Phase 1-5: TDD bug fixing
  ├─ Phase 6: Calls peer-review-and-fix skill
  ├─ Phase 7: Deploy and verify
  └─ Phase 8: Transition to DEV REVIEW
```

---

## Metrics and Success

**Good Session Indicators:**
- All bugs have failing test → fix → passing test cycle
- Completeness percentages: 90%+ (or 100%)
- Peer review verdicts: APPROVED
- CI/CD: ✅ Green pipeline
- Staging: ✅ All containers healthy
- Manual verification: ✅ Bug fixed

**Red Flags:**
- Tests pass without seeing them fail first
- Peer review completeness < 70%
- CI/CD pipeline failures
- Staging deployment errors
- Bug still reproduces on staging

---

## Parallel Execution Workflow (3+ Bugs)

### Step 1: Discovery Phase (You)
```
Found 5 bugs: KAN-638, KAN-637, KAN-636, KAN-635, KAN-634
All are independent (different features/routes)
```

### Step 2: Spawn Parallel Bug Fix Agents (You)
**CRITICAL:** All agents spawned in SINGLE message

```javascript
[Single Message with 5 Task calls]:
  Task("Bug Fix Agent #1 - KAN-638", `
    Fix KAN-638: Customer unable to book course

    **FULL TDD WORKFLOW:**
    1. Root cause analysis (search for similar defects)
    2. Write failing test
    3. Implement fix (all instances)
    4. Verify test passes
    5. Report summary

    **BUG DETAILS:**
    Key: KAN-638
    Summary: Customer unable to book a course
    Description: [full description]
    Priority: High

    **DELIVERABLES:**
    - File: tests/e2e/bugs/KAN-638-course-booking.spec.ts
    - Fix: app/routes/site/courses/$courseId.tsx
    - Status: All tests passing
    - Summary: What was fixed + completeness %
  `, "general-purpose"),

  Task("Bug Fix Agent #2 - KAN-637", `[same format]`, "general-purpose"),
  Task("Bug Fix Agent #3 - KAN-636", `[same format]`, "general-purpose"),
  Task("Bug Fix Agent #4 - KAN-635", `[same format]`, "general-purpose"),
  Task("Bug Fix Agent #5 - KAN-634", `[same format]`, "general-purpose")
```

### Step 3: Wait for All Agents to Complete
**Each agent reports:**
- ✅ Root cause identified
- ✅ Failing test written
- ✅ Fix implemented
- ✅ Test now passes
- Summary: "Fixed X instances in Y files"

### Step 4: Unified Peer Review (You)
**After all 5 agents complete, run peer-review-and-fix skill:**

```javascript
// Spawn 5 peer reviewers to review ALL 5 fixes
[Single Message with 5 Task calls]:
  Task("Peer Reviewer #1", "Review KAN-638 fix for completeness...", "general-purpose"),
  Task("Peer Reviewer #2", "Review KAN-637 fix for completeness...", "general-purpose"),
  Task("Peer Reviewer #3", "Review KAN-636 fix for completeness...", "general-purpose"),
  Task("Peer Reviewer #4", "Review KAN-635 fix for completeness...", "general-purpose"),
  Task("Peer Reviewer #5", "Review KAN-634 fix for completeness...", "general-purpose")
```

### Step 5: Compile Unified Report (You)
```markdown
# Unified Peer Review Report
**Date:** 2026-01-28
**Issues Reviewed:** 5
**Reviewers:** 5 Independent Peer Reviewers

## Executive Summary

| Issue | Fix Quality | Completeness | Verdict | Files Changed |
|-------|-------------|--------------|---------|---------------|
| KAN-638 | ⭐⭐⭐⭐⭐ | 100% | APPROVED | 1 file |
| KAN-637 | ⭐⭐⭐⭐ | 80% | APPROVED WITH CONDITIONS | 2 files |
| KAN-636 | ⭐⭐⭐⭐⭐ | 100% | APPROVED | 1 file |
| KAN-635 | ⭐⭐⭐ | 60% | NEEDS CHANGES | 3 files |
| KAN-634 | ⭐⭐⭐⭐⭐ | 100% | APPROVED | 2 files |

**Critical Blockers Found:** 1 (KAN-635 incomplete)
**Total Files Changed:** 9
**Total Tests Added:** 15
```

### Step 6: Fix Critical Blockers (You)
```
KAN-635 Verdict: NEEDS CHANGES
Reason: Only fixed primary instance, 2 similar instances remain

Action: Fix remaining instances
Result: Completeness 60% → 100%
```

### Step 7: Batch Deploy (You)
```bash
# All 5 fixes committed together
git add .
git commit -m "fix: batch bug fixes (KAN-638, KAN-637, KAN-636, KAN-635, KAN-634)

**KAN-638:** Customer booking - added session selection requirement
**KAN-637:** [description]
**KAN-636:** [description]
**KAN-635:** [description] (peer review blocker fixed)
**KAN-634:** [description]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
"

git push origin staging
```

### Step 8: Batch Transition to DEV REVIEW (You)
**CRITICAL:** Always transition Jira issues after fixes are complete, tested, and deployed.

```javascript
// Transition all 5 issues together in parallel (single message)
[Parallel Jira updates]:
  mcp__atlassian__jira_transition_issue(
    issue_key: "KAN-638",
    transition_id: "2",  // DEV REVIEW
    comment: "Fixed and deployed to staging.\n\n**Root Cause:** ...\n**Fix:** ...\n**Testing:** ✅ ...\n**Deployment:** Commit: xxx, Branch: staging"
  )
  mcp__atlassian__jira_transition_issue(key: "KAN-637", transition_id: "2", comment: "...")
  mcp__atlassian__jira_transition_issue(key: "KAN-636", transition_id: "2", comment: "...")
  mcp__atlassian__jira_transition_issue(key: "KAN-635", transition_id: "2", comment: "...")
  mcp__atlassian__jira_transition_issue(key: "KAN-634", transition_id: "2", comment: "...")
```

**Comment Template:**
```
Fixed and deployed to staging.

**Root Cause:** [What was broken and why]

**Fix Implemented:**
- [Primary fix with file references]
- [Completeness: X/Y instances fixed]

**Files Changed:**
- [file]: [description]

**Testing:**
✅ TypeScript clean
✅ Build succeeds
✅ [X] tests passing ([Y] new tests)

**Deployment:**
- Commit: [hash]
- Branch: staging
- Ready for QA verification
```

### Parallel Execution Benefits
**Time Savings:**
- Sequential: 5 bugs × 30 min/bug = 150 minutes
- Parallel: 30 min (longest bug) + 10 min (review) = 40 minutes
- **Savings: 73% faster**

**Quality:**
- Same TDD rigor per bug
- Same peer review coverage
- Same deployment verification
- Unified peer review catches cross-cutting issues

**When NOT to use parallel:**
- Bugs are related/overlapping
- Bugs affect same files
- Learning/understanding phase
- First time with TDD workflow

---

## Example Full Session

```
User: "Fix the Jira bugs in To Do"

Phase 1: Discovery
→ Found 3 bugs: KAN-638, KAN-637, KAN-636

Phase 2-5: For KAN-638 (Customer can't book course)
→ Root Cause: Form submission handler missing validation
→ Similar: Found 2 other booking forms with same issue
→ TDD: Wrote failing test (form submits with invalid data)
→ Implement: Added validation to all 3 forms
→ TDD: Test now passes, all 2,474 tests pass
→ Commit: "fix(KAN-638): add booking form validation"

Phase 6: Peer Review
→ Spawned 5 reviewers
→ Completeness: 100% (all 3 forms fixed)
→ Verdict: APPROVED

Phase 7: Deploy
→ Pushed to staging
→ CI/CD: ✅ All checks passed
→ Staging: ✅ Deployed successfully
→ Manual: ✅ Booking works

Phase 8: Transition
→ Moved KAN-638 to DEV REVIEW
→ Added comprehensive comment for QA

Repeat for KAN-637 and KAN-636...

Session Complete:
✅ 3 bugs fixed
✅ 9 integration tests added
✅ All deployed to staging
✅ All in DEV REVIEW for QA
```

---

## Notes

- **Always use TDD:** Failing test → Fix → Passing test
- **Always do root cause:** Don't just fix symptoms
- **Always search for similar:** Fix all instances, not just reported one
- **Always peer review:** 5 independent reviewers catch what you miss
- **Always verify on staging:** Before transitioning to DEV REVIEW
- **Always document:** Comprehensive Jira comments for QA

**This workflow ensures:**
1. Bugs are actually fixed (TDD proves it)
2. Fixes are complete (peer review verifies)
3. No regressions (all tests pass)
4. QA has context (comprehensive documentation)
5. Deployment works (staging verification)
