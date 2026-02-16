# Defect Repair Workflow Guide

## Overview

This guide explains how AI agents and developers should handle defects found during the DiveStreams v2 development lifecycle using vibe-kanban.

## Defect Discovery & Tracking

### When to Create a Defect Issue

Create a defect issue when you encounter:
- Unit test failures
- E2E test failures
- Runtime errors or exceptions
- Incorrect functionality behavior
- UI/UX issues that break user workflows
- Performance regressions
- Security vulnerabilities
- Data integrity issues

### Defect Issue Format

**Title Format:**
```
[DEFECT] [SEVERITY] Brief description
```

**Severity Levels:**
- `[CRITICAL]` - Production blocking, data loss, security issues, complete feature failure
- `[HIGH]` - Major functionality broken, no workaround exists
- `[MEDIUM]` - Functionality broken but workaround exists, significant user impact
- `[LOW]` - Minor issues, cosmetic bugs, edge cases, low user impact

**Description Template:**
```markdown
## Summary
Brief description of the defect

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Environment: Dev/Test/Production
- Browser/Version: (if applicable)
- Date Found: YYYY-MM-DD

## Related Issues
- Parent Feature Issue: [ISSUE-ID] (if applicable)
- Related Defects: [ISSUE-ID] (if applicable)

## Error Messages/Logs
```
Paste relevant error messages or stack traces
```

## Screenshots
(if applicable)
```

## Defect Repair Workflow

### 1. Create Defect Issue in Vibe Kanban

```javascript
// Use vibe-kanban MCP tool to create issue
const issue = await mcp__vibe_kanban__create_issue({
  title: "[DEFECT] [HIGH] Tenant deactivation returns 404 instead of 403",
  description: `
## Summary
Deactivated tenants receive 404 error instead of proper 403 forbidden response

## Steps to Reproduce
1. Deactivate a tenant in admin panel
2. Attempt to access tenant subdomain
3. Observe error response

## Expected Behavior
Should return 403 Forbidden with JSON response

## Actual Behavior
Returns 404 Not Found

## Environment
- Environment: Test
- Date Found: 2026-02-15

## Related Issues
- None
  `,
  project_id: "500e93c8-662d-4f9e-8745-ac4c259ead3c"
});
```

### 2. Link to Current Workspace (if applicable)

If working in a vibe-kanban workspace:

```javascript
await mcp__vibe_kanban__link_workspace({
  workspace_id: "<current-workspace-id>",
  issue_id: issue.id
});
```

### 3. Write Failing Test First (TDD)

Always write a test that reproduces the defect before fixing:

```typescript
// Example: Unit test for defect
describe('Tenant deactivation handling', () => {
  it('should return 403 for deactivated tenant data requests', async () => {
    // Arrange: Set up deactivated tenant
    const tenant = await createTestTenant({ active: false });

    // Act: Make request to tenant endpoint
    const response = await fetch(`https://${tenant.subdomain}.test.divestreams.com/api/bookings.data`);

    // Assert: Should get 403, not 404
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Tenant account is deactivated'
    });
  });
});
```

### 4. Fix the Defect

- Make minimal changes to fix the issue
- Ensure the fix doesn't break existing functionality
- Add comments explaining the fix if not obvious

### 5. Verify Fix Locally

```bash
# Run affected unit tests
npm test -- path/to/test-file.test.ts

# Run all unit tests
npm test -- --run

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run E2E tests (if applicable)
npm run test:e2e
```

### 6. Update Issue Status

```javascript
// Mark issue as completed
await mcp__vibe_kanban__update_issue({
  issue_id: issue.id,
  status: "Done",
  description: issue.description + `

## Resolution
Fixed in commit: <commit-hash>

### Changes Made
- Updated tenant loader to check active status
- Return 403 JSON response for deactivated tenants
- Added unit test coverage

### Tests Added
- test/routes/tenant-activation.test.ts
`
});
```

### 7. Deploy Through CI/CD Pipeline

```bash
# Stage changes
git add .

# Commit with defect reference
git commit -m "fix: return 403 for deactivated tenant data requests

- Check tenant active status in loader
- Return proper JSON 403 response
- Add unit test coverage

Fixes vibe-kanban issue: <issue-id>"

# Push to feature branch
git push origin <feature-branch>

# Create PR to develop
gh pr create --base develop --title "Fix: Deactivated tenant 403 response" --body "..."

# After merge to develop → auto-deploys to Dev VPS
# Create PR to staging for QA testing
gh pr create --base staging --title "Fix: Deactivated tenant 403 response" --body "..."

# After QA approval → merge to main for production
```

## Defect Prioritization

### CRITICAL - Fix Immediately
- Production is down
- Data loss or corruption
- Security vulnerabilities
- Complete feature failure blocking users

### HIGH - Fix This Sprint
- Major functionality broken
- No workaround available
- Affects multiple users
- Test suite failures blocking CI/CD

### MEDIUM - Fix Next Sprint
- Functionality broken but workaround exists
- Affects some users
- Non-blocking test failures

### LOW - Backlog
- Cosmetic issues
- Edge cases
- Minor inconveniences
- Nice-to-have fixes

## Best Practices

1. **Test First**: Always write a failing test before fixing
2. **Minimal Changes**: Fix only what's broken, avoid scope creep
3. **Document**: Update issue with resolution details
4. **Test Coverage**: Ensure fix is covered by automated tests
5. **CI/CD Gate**: Let pipeline catch regressions
6. **QA Verification**: All defect fixes should be tested on Test VPS before production

## Common Defect Categories

### Authentication/Authorization Defects
- Login failures
- Permission issues
- Session handling bugs
- Token expiration issues

### Database Defects
- Query failures
- Migration errors
- Data integrity issues
- Performance issues

### API Defects
- Incorrect status codes
- Malformed responses
- Missing validation
- Error handling gaps

### UI/UX Defects
- Broken layouts
- Non-functional buttons
- Form validation issues
- Accessibility problems

### Integration Defects
- Stripe payment failures
- Email sending issues
- File upload problems
- Third-party API issues

## Monitoring & Prevention

### After Fixing a Defect
1. Add monitoring/logging to catch similar issues
2. Update E2E tests to prevent regression
3. Document lessons learned in issue
4. Consider if architectural changes are needed

### Defect Analysis
Periodically review defects to identify:
- Common failure patterns
- Areas needing more test coverage
- Technical debt to address
- Process improvements needed
