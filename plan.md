# CI/CD Pipeline Redesign - Ground-Up Vibe Coding Infrastructure

## Current State (Broken)
- **256 lint errors** (hardcoded colors violating semantic token rule)
- **262 unit/integration test failures** across 40 files
- **E2E tests failing** in CI
- **deploy.yml has `continue-on-error: true`** on lint, typecheck, AND tests - pipeline provides ZERO quality gates
- **deploy-test fails** because `TEST_VPS_SSH_KEY` secret is missing
- Everything deploys regardless of test results

## Target Architecture

```
 Feature Branch (AI agent workspace)
       │
       │  PR + unit tests gate
       ▼
   develop ──────► Dev VPS (62.72.3.35)
       │           - CI platform / AI sandbox
       │           - Multi-instance Docker support
       │           - Full regression suite runs post-deploy
       │
       │  PR + all tests gate (unit + E2E + integration)
       ▼
   staging ──────► Stage VPS (76.13.28.28)
       │           - Pre-production / Human QA
       │           - Smoke tests post-deploy
       │           - Tom explores and tests here
       │
       │  PR + manual approval
       ▼
    main ────────► Prod VPS (72.62.166.128)
                   - Live users
                   - Retag :test → :latest (no rebuild)
                   - Health check verification
```

## Execution Plan (6 issues in vibe-kanban)

### Phase 1: Make Tests Pass (this workspace)

**Issue: Clean Passing CI** (already in progress)
- Fix 262 unit/integration test failures
- Root causes: broken mocks for requireOrgContext, signup action return shape changes, deleted feature test references
- Group by root cause, fix infrastructure first

**Issue: Fix 256 lint errors**
- Category A (exempt ~50): Theme config files, agency brand colors, test fixtures = add ESLint file exemptions
- Category B (refactor ~80): Public site routes, embed routes, POS components = replace hex with `var(--token)`
- Category C (test data ~126): Extract color constants or exempt test files

### Phase 2: Lock Down the Pipeline

**Issue: Redesign deploy.yml**
- Remove ALL `continue-on-error` flags
- develop: lint + typecheck + unit tests → build :dev → deploy Dev VPS
- staging: lint + typecheck + unit + E2E → build :test → deploy Stage VPS → smoke tests
- main: retag :test → :latest → deploy Prod VPS → health check
- Fix secret scoping (TEST_VPS_SSH_KEY per environment)

**Issue: Branch protection + environment rules**
- main: require PR, require CI, require review
- staging: require PR from develop, require CI
- develop: require CI status checks
- Configure GitHub environment protection rules

### Phase 3: Vibe Coding Integration

**Issue: Configure vibe-kanban workspace scripts**
- setup_script: `npm ci && docker compose -f docker-compose.dev.yml up -d && npm run db:push`
- dev_server_script: `npm run dev`
- cleanup_script: `docker compose -f docker-compose.dev.yml down`

**Issue: Document pipeline for AI agents**
- Update CLAUDE.md with finalized pipeline
- Full workflow: workspace → feature branch → develop → staging → main
- How to check CI, read failures, fix and retry

## Execution Order
1. Fix tests (Phase 1) - unblocks everything
2. Fix lint (Phase 1) - unblocks pipeline enforcement
3. Redesign deploy.yml (Phase 2) - enforces gates
4. Branch protection (Phase 2) - prevents bypassing
5. Workspace scripts (Phase 3) - improves DX
6. Documentation (Phase 3) - completes the loop

## What I'll Do Now (After Approval)
Start with Phase 1: Fix the 262 test failures and 256 lint errors on this branch (`vk/94eb-ci-cd-pipeline-d`), then remove the `continue-on-error` flags from deploy.yml. This gets us a pipeline that actually blocks bad code.
