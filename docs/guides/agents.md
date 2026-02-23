# Agent Instructions

This project uses **Vibe Kanban** for issue tracking. See CLAUDE.md for vibe-kanban setup and defect repair workflow details.

## Defect Tracking - REQUIRED

**When you find a defect during development or testing**, you MUST:

1. **Create a defect issue in vibe-kanban BEFORE fixing**:
   ```javascript
   mcp__vibe_kanban__create_issue({
     title: "[DEFECT] [SEVERITY] Brief description",
     description: "## Summary\n...\n\n## Steps to Reproduce\n...\n\n## Expected Behavior\n...\n\n## Actual Behavior\n...",
     project_id: "500e93c8-662d-4f9e-8745-ac4c259ead3c"
   })
   ```

2. **Write a failing test** that reproduces the defect (TDD)

3. **Fix the defect** with minimal changes

4. **Verify locally**: `npm run lint && npm run typecheck && npm test -- --run`

5. **Update issue status** to "Done" with resolution details

See DEFECT_REPAIR_GUIDE.md for complete workflow and severity levels.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create vibe-kanban issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work in vibe-kanban, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
